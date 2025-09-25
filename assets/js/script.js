/* ====== Revista Unimo — Viewer estilo “flipbook pro” ====== */
/* Mantiene PDF.js + PageFlip. UI flotante, zoom+paneo y filmstrip. */

/* ---------- Config & helpers ---------- */
let CFG = null;
const fmt = (str, vars) => str.replace(/\{(\w+)\}/g, (_, k) => vars?.[k] ?? "");
const textOr = (k, d) => CFG?.texts?.[k] ?? d;
const el = (id) => document.getElementById(id);
const lsGet = (k, fallback = null) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
};
const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));

async function loadConfig(path) {
  try {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (e) {
    console.warn("No se pudo cargar el JSON de configuración:", e);
    return null;
  }
}

/* ---------- Estado global ---------- */
let pdf = null;
let total = 0;
let images = []; // dataURLs páginas
let thumbsArr = []; // dataURLs miniaturas
let pageFlip = null;
let currentSinglePage = null;
let fileKey = null;

/* Zoom/pan estado */
const Z = { s: 1, x: 0, y: 0, dragging: false, sx: 0, sy: 0 };
const Z_MAX = 2.5,
  Z_MIN = 1,
  Z_STEP = 0.15;

/* ---------- DOM refs ---------- */
const loading = el("loading"),
  pFill = el("pFill"),
  pText = el("pText");
const flipContainer = el("flipContainer"),
  flipbookEl = el("flipbook");
const zoomOverlay = el("zoomOverlay");
const thumbs = el("thumbs");

const btnPrev = el("btnPrev"),
  btnNext = el("btnNext");
const pageInput = el("pageInput"),
  pageTotal = el("pageTotal");
const btnZoomIn = el("btnZoomIn"),
  btnZoomOut = el("btnZoomOut"),
  zoomRange = el("zoomRange");
const btnShare = el("btnShare"),
  btnFullscreen = el("btnFullscreen");

/* ---------- Utilidad UI ---------- */
const showLoading = () => loading?.classList.remove("d-none");
const hideLoading = () => loading?.classList.add("d-none");
const isNarrow = () => window.matchMedia("(max-width: 991.98px)").matches; // ≤992px => 1 hoja
const keyForFile = (file) => `${file.name}|${file.size}`;

function applyBrandFromConfig() {
  if (!CFG) return;
  if (CFG.page?.title) document.title = CFG.page.title;

  const brandLogo = document.getElementById("brandLogo");
  const brandText = document.getElementById("brandText");
  if (CFG.brand?.text) brandText.textContent = CFG.brand.text;
  if (CFG.brand?.logo_url) {
    brandLogo.src = CFG.brand.logo_url;
    brandLogo.alt = CFG.brand?.logo_alt || CFG.brand?.text || "Logo";
    if (CFG.brand?.logo_width) {
      brandLogo.style.width =
        CFG.brand.logo_width === "auto" ? "auto" : CFG.brand.logo_width + "px";
    }
    if (CFG.brand?.logo_height) {
      brandLogo.style.height = CFG.brand.logo_height + "px";
    }
    brandLogo.style.display = "inline-block";
  }

  el("loadingTitle").textContent = textOr("loading", "Cargando Revista");
}

/* Altura dinámica del contenedor */
function setFlipHeight() {
  const header = document.querySelector("header.glassbar");
  const hHeader = header?.offsetHeight ?? 60;
  const pad = 28; // margen inferior
  const vh = window.innerHeight;
  const target = Math.max(420, Math.round(vh - hHeader - pad));
  if (flipContainer) flipContainer.style.height = target + "px";
}

/* Persistencia de página */
function saveSession() {
  if (!fileKey || !pageFlip) return;
  lsSet(`flip:last:${fileKey}`, { page: pageFlip.getCurrentPageIndex() + 1 });
}
function restoreSession() {
  if (!fileKey || !pageFlip) return;
  const sess = lsGet(`flip:last:${fileKey}`);
  if (sess?.page) {
    try {
      pageFlip.turnToPage(Math.max(0, sess.page - 1));
    } catch (e) {
      console.error("Error restaurando página:", e);
    }
  }
}

/* ---------- Navegación ---------- */
function updateToolbar() {
  if (!pageFlip) return;
  const pageCount = pageFlip.getPageCount();
  const idx = pageFlip.getCurrentPageIndex() + 1;

  pageTotal.textContent = pageCount;
  pageInput.value = idx;

  if (currentSinglePage) {
    btnPrev.disabled = idx <= 1;
    btnNext.disabled = idx >= pageCount;
  } else {
    const left = idx % 2 === 0 ? idx - 1 : idx;
    const right = Math.min(left + 1, pageCount);
    btnPrev.disabled = left <= 1;
    btnNext.disabled = right >= pageCount;
  }
}

/* ---------- Thumbnails (filmstrip) ---------- */
function buildThumbs() {
  if (!thumbs) return;
  thumbs.innerHTML = "";
  for (let i = 1; i <= total; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "thumb-btn";
    const alt = fmt(textOr("thumbAltPattern", "Pág {page}"), { page: i });
    b.innerHTML = `<img src="${
      thumbsArr[i] || images[i] || ""
    }" alt="${alt}" loading="lazy" decoding="async">`;
    b.addEventListener("click", () => pageFlip.turnToPage(i - 1));
    thumbs.appendChild(b);
  }
  markActiveThumb(true);
}
function markActiveThumb(center = false) {
  if (!pageFlip || !thumbs) return;
  const idx = pageFlip.getCurrentPageIndex() + 1;
  const buttons = [...thumbs.querySelectorAll("button.thumb-btn")];
  buttons.forEach((b) => b.classList.remove("thumb-active"));
  const btn = buttons[idx - 1];
  if (btn) {
    btn.classList.add("thumb-active");
    if (center) {
      btn.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }
}

/* ---------- Flipbook ---------- */
function initFlip(startIndex = null) {
  try {
    pageFlip?.destroy();
  } catch {}
  flipbookEl.innerHTML = "";

  const wantSingle = isNarrow();
  currentSinglePage = wantSingle;

  pageFlip = new St.PageFlip(flipbookEl, {
    width: 600,
    height: 800,
    size: "stretch",
    minWidth: 320,
    minHeight: 420,
    maxShadowOpacity: wantSingle ? 0.2 : 0.35,
    showPageCorners: !wantSingle,
    drawShadow: true,
    startPage: startIndex ?? 0,
    singlePageMode: wantSingle,
    useMouseEvents: true,
    mobileScrollSupport: true,
    swipeDistance: 20,
    clickEventForward: true,
  });

  const srcs = [];
  for (let i = 1; i <= total; i++) srcs.push(images[i]);
  pageFlip.loadFromImages(srcs);

  pageFlip.on("flip", () => {
    updateToolbar();
    markActiveThumb();
    saveSession();
  });
  pageFlip.on("changeState", updateToolbar);

  btnPrev.disabled = btnNext.disabled = false;
  updateToolbar();
}

/* ---------- Render PDF -> imágenes ---------- */
async function renderPDF(file) {
  showLoading();
  images = [];
  thumbsArr = [];

  const arr = await file.arrayBuffer();
  pdf = await pdfjsLib.getDocument({ data: arr }).promise;
  total = pdf.numPages;
  fileKey = keyForFile(file);

  // Ajusta aquí la calidad: 150 DPI es buen equilibrio
  const DPI = 150;
  const scaleFactor = DPI / 72; // PDF.js trabaja a 72 DPI base
  const thumbW = 240; // ancho de las miniaturas

  for (let i = 1; i <= total; i++) {
    try {
      const page = await pdf.getPage(i);

      // Viewport en resolución original (con DPI elegido)
      const vp = page.getViewport({ scale: scaleFactor });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      images[i] = canvas.toDataURL("image/jpeg", 0.92);

      // Miniatura (independiente del DPI)
      const v1 = page.getViewport({ scale: 1 });
      const tScale = thumbW / v1.width;
      const tvp = page.getViewport({ scale: tScale });
      const tcan = document.createElement("canvas");
      const tctx = tcan.getContext("2d", { willReadFrequently: true });
      tcan.width = Math.floor(tvp.width);
      tcan.height = Math.floor(tvp.height);
      await page.render({ canvasContext: tctx, viewport: tvp }).promise;
      thumbsArr[i] = tcan.toDataURL("image/jpeg", 0.85);

      // Barra de progreso
      const pct = Math.round((i / total) * 100);
      if (pFill) pFill.style.width = pct + "%";
      if (pText) pText.textContent = `${pct}% (${i}/${total})`;
      await new Promise((r) => requestAnimationFrame(r));
    } catch (e) {
      console.error("Render page error", e);
    }
  }

  hideLoading();

  setFlipHeight();
  initFlip(0);
  buildThumbs();
  restoreSession();
}

/* ---------- Carga desde URL ---------- */
async function preloadFromUrl(url) {
  const resp = await fetch(url, { cache: "no-cache" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  const name = url.split("/").pop() || "documento.pdf";
  const file = new File([blob], name, { type: "application/pdf" });
  await renderPDF(file);
}

/* ---------- ZOOM + PANE0 ---------- */
function applyZoom() {
  flipbookEl.style.setProperty("--zs", Z.s.toString());
  flipbookEl.style.setProperty("--zx", `${Z.x}px`);
  flipbookEl.style.setProperty("--zy", `${Z.y}px`);

  const zoomed = Z.s > 1.001;
  flipContainer.classList.toggle("zoomed", zoomed);
  zoomOverlay.classList.toggle("active", zoomed);
  zoomRange.value = Z.s.toFixed(2);
}

function clampPan(x, y) {
  const cw = flipContainer.clientWidth;
  const ch = flipContainer.clientHeight;
  const maxX = Math.max(0, (cw * (Z.s - 1)) / 2);
  const maxY = Math.max(0, (ch * (Z.s - 1)) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

function setZoom(newS) {
  const s = Math.max(Z_MIN, Math.min(Z_MAX, newS));
  // mantener centro razonable
  const ratio = s / Z.s;
  Z.s = s;
  Z.x = Z.x * ratio;
  Z.y = Z.y * ratio;
  const cl = clampPan(Z.x, Z.y);
  Z.x = cl.x;
  Z.y = cl.y;
  applyZoom();
}

/* Drag para paneo */
function startDrag(clientX, clientY) {
  if (Z.s <= 1.001) return;
  Z.dragging = true;
  Z.sx = clientX - Z.x;
  Z.sy = clientY - Z.y;
  zoomOverlay.classList.add("dragging");
}
function moveDrag(clientX, clientY) {
  if (!Z.dragging) return;
  const nx = clientX - Z.sx;
  const ny = clientY - Z.sy;
  const cl = clampPan(nx, ny);
  Z.x = cl.x;
  Z.y = cl.y;
  applyZoom();
}
function endDrag() {
  Z.dragging = false;
  zoomOverlay.classList.remove("dragging");
}

/* ---------- Eventos ---------- */
// Botones navegación
btnNext?.addEventListener("click", () => pageFlip?.turnToNextPage());
btnPrev?.addEventListener("click", () => pageFlip?.turnToPrevPage());

// Teclado
document.addEventListener("keydown", (e) => {
  if (!pageFlip) return;
  if (e.key === "ArrowRight") pageFlip.turnToNextPage();
  if (e.key === "ArrowLeft") pageFlip.turnToPrevPage();
  if (e.key === "f" || e.key === "F") {
    btnFullscreen?.click();
  }
  if (e.key === "Escape") {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (Z.s > 1.001) {
      setZoom(1);
    }
  }

  if (e.key === "+" || e.key === "=") {
    btnZoomIn?.click();
  }
  if (e.key === "-" || e.key === "_") {
    btnZoomOut?.click();
  }

  if ("0123456789".includes(e.key)) {
    const percent = parseInt(e.key, 10) * 10;
    const zoomValue = Z_MIN + ((Z_MAX - Z_MIN) * percent) / 100;
    setZoom(zoomValue);
  }

  if (e.key === "ArrowUp") {
    setZoom(Z.s + Z_STEP);
  }
  if (e.key === "ArrowDown") {
    setZoom(Z.s - Z_STEP);
  }
});

// Cambiar por número
pageInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const v = Math.max(
      1,
      Math.min(parseInt(pageInput.value || "1", 10), pageFlip.getPageCount())
    );
    pageFlip.turnToPage(v - 1);
  }
});

// Zoom UI
btnZoomIn?.addEventListener("click", () => setZoom(Z.s + Z_STEP));
btnZoomOut?.addEventListener("click", () => setZoom(Z.s - Z_STEP));
zoomRange?.addEventListener("input", () =>
  setZoom(parseFloat(zoomRange.value || "1"))
);

// Zoom con Ctrl + rueda
flipContainer.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = -e.deltaY; // rueda arriba = acercar
      const factor = 1 + delta * 0.0015;
      setZoom(Z.s * factor);
    }
  },
  { passive: false }
);

// Paneo: mouse
zoomOverlay.addEventListener("mousedown", (e) =>
  startDrag(e.clientX, e.clientY)
);
window.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
window.addEventListener("mouseup", endDrag);

// Paneo: touch/pointer
zoomOverlay.addEventListener(
  "touchstart",
  (e) => {
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  },
  { passive: true }
);
zoomOverlay.addEventListener(
  "touchmove",
  (e) => {
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  },
  { passive: true }
);
zoomOverlay.addEventListener("touchend", endDrag);

// Pantalla completa
btnFullscreen?.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await flipContainer.requestFullscreen({ navigationUI: "hide" });
    } else {
      await document.exitFullscreen();
    }
  } catch {}
});

// Compartir
btnShare?.addEventListener("click", async () => {
  const url = location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: document.title, url });
    } else {
      await navigator.clipboard.writeText(url);
      btnShare.classList.add("active");
      setTimeout(() => btnShare.classList.remove("active"), 800);
    }
  } catch {}
});

// Resize: recalcular alto y re-evaluar single/doble página
function debounce(fn, ms = 200) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
window.addEventListener(
  "resize",
  debounce(() => {
    setFlipHeight();
    if (!pageFlip) return;
    const wantSingle = isNarrow();
    if (wantSingle !== currentSinglePage) {
      const idx = pageFlip.getCurrentPageIndex() || 0;
      initFlip(idx); // reinit conservando página
      markActiveThumb();
    } else {
      updateToolbar();
    }
  }, 150)
);

/* ---------- Bootstrap ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  // 1) Config (?cfg=path.json permitido)
  const params = new URLSearchParams(location.search);
  const CFG_PATH = params.get("cfg") || "revista.config.json";
  CFG = await loadConfig(CFG_PATH);
  applyBrandFromConfig();

  // 2) Solo desde el JSON (ignora ?pdf=)
  const pdfUrl = CFG?.pdf?.url || "./documento.pdf";

  // 3) Altura inicial
  setFlipHeight();
  applyZoom(); // inicializa transform

  // 4) Precarga del PDF
  try {
    await preloadFromUrl(pdfUrl);
  } catch (e) {
    console.error("Error precargando PDF", e);
  }
});
