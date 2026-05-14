import os
import base64
import json
import re
import uuid
import urllib.request
from io import BytesIO
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_file
from openai import OpenAI
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB

UPLOAD_DIR = Path("uploads")
GENERATED_DIR = Path("generated")
UPLOAD_DIR.mkdir(exist_ok=True)
GENERATED_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def get_client():
    api_key = request.headers.get("X-API-Key") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OpenAI APIキーが設定されていません")
    return OpenAI(api_key=api_key)


def image_to_base64(path: Path) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def get_mime_type(path: Path) -> str:
    ext = path.suffix.lower()
    return {"jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
            ".webp": "image/webp", ".gif": "image/gif"}.get(ext, "image/jpeg")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/upload", methods=["POST"])
def upload_images():
    files = request.files.getlist("images")
    if not files:
        return jsonify({"error": "画像が選択されていません"}), 400

    session_id = str(uuid.uuid4())[:8]
    session_dir = UPLOAD_DIR / session_id
    session_dir.mkdir(exist_ok=True)

    saved = []
    for f in files:
        if Path(f.filename).suffix.lower() not in ALLOWED_EXTENSIONS:
            continue
        fname = Path(f.filename).name
        dest = session_dir / fname
        f.save(dest)
        saved.append({"name": fname, "session_id": session_id})

    return jsonify({"session_id": session_id, "count": len(saved), "files": saved})


@app.route("/api/image/<session_id>/<filename>")
def serve_image(session_id, filename):
    path = UPLOAD_DIR / session_id / filename
    if not path.exists():
        return jsonify({"error": "Not found"}), 404
    return send_file(path)


@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "session_id が必要です"}), 400

    session_dir = UPLOAD_DIR / session_id
    image_files = [p for p in session_dir.iterdir() if p.suffix.lower() in ALLOWED_EXTENSIONS]

    if not image_files:
        return jsonify({"error": "画像が見つかりません"}), 400

    try:
        client = get_client()
    except ValueError as e:
        return jsonify({"error": str(e)}), 401

    # Build vision message with all images (max 10)
    content = [
        {
            "type": "text",
            "text": (
                "これらは成果の良かった広告バナー画像です。"
                "以下の観点で共通の傾向を詳しく分析してください：\n"
                "1. カラーパレット（背景色、テキスト色、アクセント色）\n"
                "2. レイアウト・構図（テキスト配置、画像配置、余白）\n"
                "3. タイポグラフィスタイル（フォントの太さ、サイズ感）\n"
                "4. ビジュアルスタイル（写真系、イラスト系、フラットデザインなど）\n"
                "5. ムード・トーン（エネルギッシュ、落ち着き、高級感など）\n"
                "6. CTA（ボタンのサイズ・位置・スタイル）\n\n"
                "分析後、この傾向を活かした新しい広告バナーのコンセプト提案を3つ作成してください。\n"
                "各提案は以下のJSON形式で返してください（JSONのみ、説明文なし）：\n"
                '{"analysis": "傾向の分析サマリー（日本語）", '
                '"proposals": ['
                '{"id": 1, "title": "提案タイトル", "concept": "コンセプト説明（日本語）", '
                '"dalle_prompt": "DALL-E用英語プロンプト（詳細・具体的に）"},'
                '{"id": 2, ...}, {"id": 3, ...}]}'
            )
        }
    ]

    for img_path in image_files[:10]:
        b64 = image_to_base64(img_path)
        mime = get_mime_type(img_path)
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"}
        })

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": content}],
            max_tokens=2000,
        )
        raw = response.choices[0].message.content.strip()

        # Extract JSON from response
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
        else:
            result = json.loads(raw)

        return jsonify(result)

    except json.JSONDecodeError:
        return jsonify({"error": "AI応答のパースに失敗しました", "raw": raw}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.get_json()
    prompt = data.get("dalle_prompt")
    proposal_title = data.get("title", "banner")

    if not prompt:
        return jsonify({"error": "プロンプトが必要です"}), 400

    try:
        client = get_client()
    except ValueError as e:
        return jsonify({"error": str(e)}), 401

    # Enhance prompt for ad banner
    full_prompt = (
        f"{prompt}. "
        "Square format 1:1 aspect ratio, professional advertising banner, "
        "high quality, sharp, print-ready."
    )

    try:
        response = client.images.generate(
            model="gpt-image-1",
            prompt=full_prompt,
            size="1024x1024",
            quality="high",
            n=1,
        )

        image_data = response.data[0]

        # gpt-image-1 returns b64_json
        if hasattr(image_data, "b64_json") and image_data.b64_json:
            img_bytes = base64.b64decode(image_data.b64_json)
        elif hasattr(image_data, "url") and image_data.url:
            with urllib.request.urlopen(image_data.url) as r:
                img_bytes = r.read()
        else:
            return jsonify({"error": "画像データを取得できませんでした"}), 500

        img = Image.open(BytesIO(img_bytes))
        img_1080 = img.resize((1080, 1080), Image.LANCZOS)

        filename = f"{uuid.uuid4()}.png"
        out_path = GENERATED_DIR / filename
        img_1080.save(out_path, "PNG", optimize=True)

        return jsonify({"filename": filename, "url": f"/api/download/{filename}"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/download/<filename>")
def download(filename):
    path = GENERATED_DIR / filename
    if not path.exists():
        return jsonify({"error": "Not found"}), 404
    return send_file(path, as_attachment=True, download_name=f"banner_1080x1080_{filename}")


if __name__ == "__main__":
    app.run(debug=True, port=5050)
