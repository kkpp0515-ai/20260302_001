// APIキーはsessionStorageのみ（ブラウザタブを閉じると自動消去、サーバー送信なし）
let uploadedImages = []; // [{ name, dataUrl, base64, mimeType }]
let proposals = [];

const $ = (id) => document.getElementById(id);

// --- API Key (sessionStorage only) ---
function getApiKey() {
  return sessionStorage.getItem("oai_key") || "";
}

$("saveKey").addEventListener("click", () => {
  const key = $("apiKey").value.trim();
  if (!key.startsWith("sk-")) {
    showToast("APIキーは sk- で始まる必要があります");
    return;
  }
  sessionStorage.setItem("oai_key", key);
  $("apiKey").value = "";
  $("keyStatus").textContent = "✓ 今回のセッションのみ保持";
});

if (getApiKey()) $("keyStatus").textContent = "✓ セッション内に保持中";

// --- Drag & Drop ---
const dropZone = $("dropZone");

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  handleFiles(e.dataTransfer.files);
});
$("fileInput").addEventListener("change", (e) => handleFiles(e.target.files));

async function handleFiles(files) {
  for (const file of files) {
    if (uploadedImages.length >= 10) break;
    if (!file.type.startsWith("image/")) continue;
    const dataUrl = await readAsDataUrl(file);
    const base64 = dataUrl.split(",")[1];
    uploadedImages.push({ name: file.name, dataUrl, base64, mimeType: file.type });
  }

  if (uploadedImages.length === 0) { showToast("画像ファイルが見つかりません"); return; }

  renderGallery($("uploadedGallery"), uploadedImages.map((i) => i.dataUrl));
  $("uploadedGallery").classList.remove("hidden");
  $("analyzeBtn").classList.remove("hidden");
}

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function renderGallery(el, dataUrls) {
  el.innerHTML = "";
  for (const url of dataUrls) {
    const img = document.createElement("img");
    img.src = url;
    el.appendChild(img);
  }
}

// --- Analyze ---
$("analyzeBtn").addEventListener("click", startAnalysis);

async function startAnalysis() {
  const apiKey = getApiKey();
  if (!apiKey) { showToast("先にAPIキーを入力・保存してください"); return; }

  showStep("step2");

  renderGallery($("refGallery"), uploadedImages.map((i) => i.dataUrl));

  $("loadingSpinner").classList.remove("hidden");
  $("proposalsGrid").innerHTML = '<p style="color:#666;font-size:0.9rem;">分析中...</p>';

  const content = [
    {
      type: "text",
      text:
        "これらは成果の良かった広告バナー画像です。" +
        "以下の観点で共通の傾向を詳しく分析してください：\n" +
        "1. カラーパレット（背景色、テキスト色、アクセント色）\n" +
        "2. レイアウト・構図（テキスト配置、画像配置、余白）\n" +
        "3. タイポグラフィスタイル（フォントの太さ、サイズ感）\n" +
        "4. ビジュアルスタイル（写真系、イラスト系、フラットデザインなど）\n" +
        "5. ムード・トーン（エネルギッシュ、落ち着き、高級感など）\n" +
        "6. CTA（ボタンのサイズ・位置・スタイル）\n\n" +
        "分析後、この傾向を活かした新しい広告バナーのコンセプト提案を3つ作成してください。\n" +
        "各提案は以下のJSON形式で返してください（JSONのみ、説明文なし）：\n" +
        '{"analysis":"傾向の分析サマリー（日本語）",' +
        '"proposals":[' +
        '{"id":1,"title":"提案タイトル","concept":"コンセプト説明（日本語）","dalle_prompt":"DALL-E用英語プロンプト（詳細・具体的に）"},' +
        '{"id":2,"title":"...","concept":"...","dalle_prompt":"..."},' +
        '{"id":3,"title":"...","concept":"...","dalle_prompt":"..."}]}',
    },
  ];

  for (const img of uploadedImages) {
    content.push({
      type: "image_url",
      image_url: { url: img.dataUrl, detail: "high" },
    });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content }],
        max_tokens: 2000,
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const raw = data.choices[0].message.content.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);

    $("analysisText").textContent = parsed.analysis;
    $("analysisBox").classList.remove("hidden");

    proposals = parsed.proposals;
    renderProposals(proposals);
  } catch (e) {
    showToast("エラー: " + e.message);
    $("proposalsGrid").innerHTML = `<p style="color:#ef4444;">${escapeHtml(e.message)}</p>`;
  } finally {
    $("loadingSpinner").classList.add("hidden");
  }
}

function renderProposals(list) {
  const grid = $("proposalsGrid");
  grid.innerHTML = "";
  for (const p of list) {
    const card = document.createElement("div");
    card.className = "proposal-card";
    card.innerHTML = `
      <div class="proposal-num">提案 ${p.id}</div>
      <h3>${escapeHtml(p.title)}</h3>
      <p class="concept">${escapeHtml(p.concept)}</p>
      <div class="prompt-preview">${escapeHtml(p.dalle_prompt)}</div>
      <button class="approve-btn" data-id="${p.id}">承認して生成 →</button>
    `;
    grid.appendChild(card);
  }
  grid.querySelectorAll(".approve-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = proposals.find((x) => x.id === parseInt(btn.dataset.id));
      if (p) approveAndGenerate(p);
    });
  });
}

// --- Generate ---
async function approveAndGenerate(proposal) {
  const apiKey = getApiKey();
  if (!apiKey) { showToast("APIキーが必要です"); return; }

  $("generatingOverlay").classList.remove("hidden");
  document.querySelectorAll(".approve-btn").forEach((b) => (b.disabled = true));

  const prompt =
    proposal.dalle_prompt +
    ". Square format 1:1 aspect ratio, professional advertising banner, high quality, sharp, print-ready.";

  try {
    const res = await fetch("https://api.openai.com/v1/images/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        size: "1024x1024",
        quality: "hd",
        n: 1,
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const b64 = data.data[0].b64_json;
    const resizedDataUrl = await resizeTo1080(b64);

    $("resultImage").src = resizedDataUrl;
    $("downloadBtn").href = resizedDataUrl;
    showStep("step3");
  } catch (e) {
    showToast("生成エラー: " + e.message);
    document.querySelectorAll(".approve-btn").forEach((b) => (b.disabled = false));
  } finally {
    $("generatingOverlay").classList.add("hidden");
  }
}

function resizeTo1080(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1080;
      canvas.getContext("2d").drawImage(img, 0, 0, 1080, 1080);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = "data:image/png;base64," + base64;
  });
}

// --- Navigation ---
$("backBtn").addEventListener("click", () => {
  showStep("step2");
  document.querySelectorAll(".approve-btn").forEach((b) => (b.disabled = false));
});

$("restartBtn").addEventListener("click", () => {
  uploadedImages = [];
  proposals = [];
  $("uploadedGallery").innerHTML = "";
  $("uploadedGallery").classList.add("hidden");
  $("analyzeBtn").classList.add("hidden");
  $("fileInput").value = "";
  $("analysisBox").classList.add("hidden");
  showStep("step1");
});

// --- Helpers ---
function showStep(id) {
  document.querySelectorAll(".step").forEach((s) => {
    s.classList.remove("active");
    s.classList.add("hidden");
  });
  const t = $(id);
  t.classList.remove("hidden");
  t.classList.add("active");
}

function showToast(msg) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
