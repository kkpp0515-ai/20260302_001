# Video localization studio

Title-driven, browser-local MP4 generation for the existing GitHub Pages workspace.
サーバーは使わず、変換はすべて各メンバーのPC（ブラウザ）内で行います。

## Usage

1. タイトルを選び、元動画を**1本または複数本**ドロップ／選択する（一覧から選ぶとプレビューを切り替えられる）。
2. 出力する言語とサイズを選ぶ。
3. 構図（ドラッグ・ズーム・フィット）を確認する。構図は**元動画ごと・サイズ別**に自動保存され、全言語に共通で適用される。同じサイズの構図を全動画へ適用するボタンもある。
4. 「04 保存方法」でフォルダ分け（言語ごと／サイズごと／元動画ごと／なし）を選ぶ。Chrome / Edge では保存先フォルダを指定し、完了した動画から順に自動保存できる。
5. 生成する。完了後は ZIP 1つにまとめて保存、または個別に保存できる。

言語・サイズ・帯の種類・フォルダ分けなどの設定は、このPCのブラウザに自動保存される。

The catalog registers per-language bands (obi) and end-card videos per title. Square / landscape outputs use the band PNG; portrait outputs use no band. End-card video is fitted inside the band opening without cropping.

## 速くなる仕組み（フタ動画の再利用）

従来は 1本ごとに「本編＋フタ動画」を毎回まとめて再エンコードしていた。現在は次のように分けている。

- **フタ動画**（映像・帯込み）は 言語 × サイズ ごとに**初回だけ合成**し、このPCのブラウザ内（IndexedDB）に保存して再利用する。音声は言語ごとに1つ保存する。
- 2回目以降は**本編だけ**を変換し、保存済みのフタ動画と**無再エンコードで連結**する。音声は元素材から1回だけ組み立てるので、連結部のズレ・劣化はない。
- 素材（帯PNG・フタ動画）が差し替わると、ファイルサイズと先頭/末尾64KBの内容が変わるため**自動で作り直される**。エンコード設定を変えるときは `model.js` の `ENCODE_VERSION` を上げる。
- 保存データが壊れている場合は、出力の映像の長さを検査して検知し、**自動で従来の1回処理に切り替え**、壊れたデータを破棄して続行する。
- 保存データは「04 保存方法」の下にある「保存データを削除」から消せる（上限 1.5GB、超えると古いものから削除）。

効果の目安は「フタ動画の長さ ÷ 本編の長さ」で決まる。フタ動画が長いタイトルほど、2回目以降が速くなる。

## Adding a title

Add an entry to catalog.json with an id, label, language list, and per-language bands/endcard URLs. Keep paths relative to this directory. Runtime video metadata supplies end-card dimensions and duration; largest transparent rectangles are detected from PNG alpha.

## Files

- `model.js` — サイズ定義、ファイル名、ffmpegコマンド生成（従来の1回処理 `buildCommand` と、分割処理 `buildVideoSegmentCommand` / `buildEndAudioCommand` / `buildFinalCommand`）。
- `zip.js` — 外部ライブラリなしの ZIP（無圧縮）書き出し。
- `store.js` — フタ動画の保存データ・保存先フォルダのハンドル（IndexedDB）。
- `app.js` — 画面と生成の制御。

## Engine and media

FFmpeg core 0.12.10 is vendored in vendor/ to avoid dependence on a third-party CDN at runtime. The existing FFmpeg JavaScript wrapper and worker are reused from ../influencer-video-ffmpeg/vendor/.

The supplied 1080x1920 end cards retain their full duration and dimensions; copies served here are H.264 CRF20 / AAC160k with fast-start metadata. The supplied PNGs are unchanged.

See vendor/README.md for engine source and license information.

## Verification

### 2026-10-26

- JavaScript syntax and 48 command-construction combinations.
- Browser: full 21-second English end-card append, MP4 download and H.264/AAC 1080x1080 / 21.513-second verification.
- Browser: all four languages across three sizes, 12 completed outputs with end-card append disabled for this short fixture.
- Browser: language checkbox exclusion, live output count, title/frame preview, all four end-card assets, cancellation with completed results retained.
- Native FFmpeg: actual frame and end-card conversion to all three sizes with audio and expected duration.

### 2026-11-18（複数動画・フタ動画再利用・ZIP・フォルダ保存）

- Native FFmpeg / vendored ffmpeg.wasm: 従来方式と分割方式で、尺・フレーム数・音声長が一致し、全フレームのデコードにエラーがないこと（island / SciMagic、音声あり／なし、3サイズ）。連結部の音声ズレは 1ms 台。
- ZIP: `unzip -t` と Python `zipfile` で整合性と内容の一致を確認（日本語名・フォルダ・空ファイル含む）。
- Chrome（実ブラウザ）: 複数動画の一括生成、2回目のフタ動画再利用、設定・構図の復元（元動画ごと）、ZIP保存とフォルダ分け、保存先フォルダへの自動保存（疑似ハンドル）、壊れた保存データからの自動復旧、中止後の再実行。
- 未確認: Firefox / Safari、実際のフォルダ選択ダイアログ（ヘッドレス環境では操作できないため疑似ハンドルで代用）。

Serve the repository root over HTTP for local development. The source video is processed locally; it is never uploaded to a conversion server.
