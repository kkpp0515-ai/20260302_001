let sessionId = null;
let uploadedFiles = [];
let proposals = [];

const $ = (id) => document.getElementById(id);

// --- API Key ---
function getApiKey() {
  return sessionStorage.getItem("openai_api_key") || "";
}

$("saveKey").addEventListener("click", () => {
  const key = $("apiKey").value.trim();
  if (!key.startsWith("sk-")) {
    showToast("APIキーは sk- で始まる必要があります");
    return;
  }
  sessionStorage.setItem("openai_api_key", key);
  $("keyStatus").textContent = "✓ 保存済み";
  $("apiKey").value = "";
});

// Restore masked display if key exists
if (getApiKey()) $("keyStatus").textContent = "✓ 設定済み";

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
  if (!files.length) return;

  const formData = new FormData();
  let count = 0;
  for (const f of files) {
    if (count >= 10) break;
    if (f.type.startsWith("image/")) {
      formData.append("images", f);
      count++;
    }
  }

  if (count === 0) { showToast("画像ファイルが見つかりません"); return; }

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json();

  if (data.error) { showToast(data.error); return; }

  sessionId = data.session_id;
  uploadedFiles = data.files;

  renderUploadedGallery(data.files);
  $("uploadedGallery").classList.remove("hidden");
  $("analyzeBtn").classList.remove("hidden");
}

function renderUploadedGallery(files) {
  const gallery = $("uploadedGallery");
  gallery.innerHTML = "";
  for (const f of files) {
    const img = document.createElement("img");
    img.src = `/api/image/${f.session_id}/${f.name}`;
    img.alt = f.name;
    gallery.appendChild(img);
  }
}

// --- Analyze ---
$("analyzeBtn").addEventListener("click", startAnalysis);

async function startAnalysis() {
  if (!getApiKey()) {
    showToast("先にAPIキーを入力・保存してください");
    return;
  }

  showStep("step2");

  // Render reference gallery in step2
  const refGallery = $("refGallery");
  refGallery.innerHTML = "";
  for (const f of uploadedFiles) {
    const img = document.createElement("img");
    img.src = `/api/image/${f.session_id}/${f.name}`;
    refGallery.appendChild(img);
  }

  $("loadingSpinner").classList.remove("hidden");
  $("proposalsGrid").innerHTML = '<p style="color:#666; font-size:0.9rem;">分析中...</p>';

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": getApiKey(),
      },
      body: JSON.stringify({ session_id: sessionId }),
    });

    const data = await res.json();

    if (data.error) {
      showToast(data.error);
      $("proposalsGrid").innerHTML = `<p style="color:#ef4444;">${data.error}</p>`;
      return;
    }

    // Show analysis
    $("analysisText").textContent = data.analysis;
    $("analysisBox").classList.remove("hidden");

    // Render proposals
    proposals = data.proposals;
    renderProposals(proposals);

  } catch (e) {
    showToast("エラーが発生しました: " + e.message);
  } finally {
    $("loadingSpinner").classList.add("hidden");
  }
}

function renderProposals(proposals) {
  const grid = $("proposalsGrid");
  grid.innerHTML = "";

  for (const p of proposals) {
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
      const id = parseInt(btn.dataset.id);
      const proposal = proposals.find((p) => p.id === id);
      if (proposal) approveAndGenerate(proposal);
    });
  });
}

// --- Generate ---
async function approveAndGenerate(proposal) {
  if (!getApiKey()) { showToast("APIキーが必要です"); return; }

  $("generatingOverlay").classList.remove("hidden");

  // Disable all approve buttons
  document.querySelectorAll(".approve-btn").forEach((b) => b.disabled = true);

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": getApiKey(),
      },
      body: JSON.stringify({
        dalle_prompt: proposal.dalle_prompt,
        title: proposal.title,
      }),
    });

    const data = await res.json();

    if (data.error) {
      showToast("生成エラー: " + data.error);
      document.querySelectorAll(".approve-btn").forEach((b) => b.disabled = false);
      return;
    }

    // Show result
    $("resultImage").src = data.url;
    $("downloadBtn").href = data.url;
    $("downloadBtn").download = `banner_1080x1080.png`;
    showStep("step3");

  } catch (e) {
    showToast("エラー: " + e.message);
    document.querySelectorAll(".approve-btn").forEach((b) => b.disabled = false);
  } finally {
    $("generatingOverlay").classList.add("hidden");
  }
}

// --- Navigation ---
$("backBtn").addEventListener("click", () => {
  showStep("step2");
  document.querySelectorAll(".approve-btn").forEach((b) => b.disabled = false);
});

$("restartBtn").addEventListener("click", () => {
  sessionId = null;
  uploadedFiles = [];
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
  const target = $(id);
  target.classList.remove("hidden");
  target.classList.add("active");
}

function showToast(msg) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
