// ============ Configuración ============
const CONFIG_URL = "revista.config.json";
const UPLOAD_URL = "upload.php";
const SAVE_URL = "save-config.php";

// ============ Estado ============
let state = null; // <-- SIN fallback: todo debe venir de revista.config.json

// ============ Helpers ============
const $ = (id) => document.getElementById(id);
const byKey = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);
const setByKey = (obj, path, val) => {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((o, k) => (o[k] ??= {}), obj);
  parent[last] = val;
};

function showToast(message, isError = false) {
  const toast = $("toast");
  const toastMessage = $("toast-message");
  if (!toast || !toastMessage) return;
  toastMessage.textContent = message;
  if (isError) toast.classList.add("error");
  else toast.classList.remove("error");
  toast.classList.remove("hidden");
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 3000);
}

function setFormEnabled(enabled) {
  const ids = [
    "page.title",
    "brand.text",
    "brand.logo_alt",
    "brand.logo_url",
    "brand.logo_width",
    "brand.logo_height",
    "pdf.url",
    "pdf.allow_query_override",
    "texts.loading",
    "texts.prev",
    "texts.next",
    "texts.pagesHeader",
    "texts.pageInfoPattern",
    "texts.thumbAltPattern",
    "logoFile",
    "pdfFile",
    "btnSaveServer",
  ];
  ids.forEach((id) => {
    const el = $(id);
    if (el) el.disabled = !enabled;
  });
}

function updatePreview() {
  // Marca
  const brandText = byKey(state, "brand.text") ?? "";
  const logoW = byKey(state, "brand.logo_width") ?? "auto";
  const logoH = byKey(state, "brand.logo_height") ?? "auto";
  const logoUrl = byKey(state, "brand.logo_url") ?? "";
  const logoAlt = byKey(state, "brand.logo_alt") ?? "logo";

  const txt = $("brandPreviewText");
  if (txt) txt.textContent = brandText;
  const w = $("brandW");
  if (w) w.textContent = String(logoW);
  const h = $("brandH");
  if (h) h.textContent = String(logoH);

  const img = $("brandPreviewImg");
  if (img) {
    img.src = logoUrl;
    img.alt = logoAlt;
    img.style.width = "56px";
    img.style.height = "56px";
  }

  const small = $("logoPreview");
  if (small) {
    small.src = logoUrl;
    small.alt = logoAlt;
  }
}

function bindInputsFromState() {
  if (!state) return;
  const keys = [
    "page.title",
    "brand.text",
    "brand.logo_alt",
    "brand.logo_url",
    "brand.logo_width",
    "brand.logo_height",
    "pdf.url",
    "pdf.allow_query_override",
    "texts.loading",
    "texts.prev",
    "texts.next",
    "texts.pagesHeader",
    "texts.pageInfoPattern",
    "texts.thumbAltPattern",
  ];
  for (const k of keys) {
    const el = $(k);
    if (!el) continue;
    const v = byKey(state, k);
    if (el.type === "checkbox") el.checked = Boolean(v);
    else el.value = v ?? "";
  }
  updatePreview();
}

function pullInputsIntoState() {
  if (!state) return;
  const keys = [
    "page.title",
    "brand.text",
    "brand.logo_alt",
    "brand.logo_url",
    "brand.logo_width",
    "brand.logo_height",
    "pdf.url",
    "pdf.allow_query_override",
    "texts.loading",
    "texts.prev",
    "texts.next",
    "texts.pagesHeader",
    "texts.pageInfoPattern",
    "texts.thumbAltPattern",
  ];
  for (const k of keys) {
    const el = $(k);
    if (!el) continue;
    let val = el.type === "checkbox" ? el.checked : el.value;
    if (k === "brand.logo_height") {
      const n = Number(val);
      val = Number.isFinite(n) ? n : val; // num si aplica
    }
    setByKey(state, k, val);
  }
  updatePreview();
}

function initState(obj) {
  state = structuredClone(obj);
  bindInputsFromState();
  setFormEnabled(true);
}

// ============ Carga automática del JSON ============
async function loadInitialConfig() {
  setFormEnabled(false);
  try {
    const res = await fetch(`${CONFIG_URL}?_=${Date.now()}`, {
      cache: "no-cache",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const obj = await res.json();

    // Validación mínima
    const ok = obj && obj.page && obj.brand && obj.pdf && obj.texts;
    if (!ok) throw new Error("Estructura inválida");

    // Asegurar que no usamos texts.openPdf (no requerido)
    if ("openPdf" in (obj.texts || {})) delete obj.texts.openPdf;

    initState(obj);
    showToast("Configuración cargada");
  } catch (err) {
    console.error("Error cargando revista.config.json:", err);
    showToast("No se pudo cargar revista.config.json", true);
    // Mantener formulario deshabilitado para evitar guardar un estado vacío
  }
}

// ============ Eventos globales ============
window.addEventListener("DOMContentLoaded", loadInitialConfig);

document.addEventListener("input", (e) => {
  if (!state) return;
  if (
    e.target &&
    e.target.matches(
      'input[type="text"], input[type="number"], input[type="checkbox"]'
    )
  ) {
    pullInputsIntoState();
  }
});

// ============ Logo: probar URL / limpiar / subir ============
$("btnTestLogo")?.addEventListener("click", () => {
  if (!state) return;
  const url = $("brand.logo_url")?.value?.trim();
  if (!url) return showToast("Primero ingresa una URL de logo.", true);
  const img = new Image();
  img.onload = () => {
    const small = $("logoPreview");
    if (small) small.src = url;
    setByKey(state, "brand.logo_url", url);
    updatePreview();
    showToast("Logo cargado correctamente");
  };
  img.onerror = () => showToast("No se pudo cargar la imagen.", true);
  img.src = url;
});

$("btnClearLogo")?.addEventListener("click", () => {
  if (!state) return;
  const inp = $("brand.logo_url");
  if (!inp) return;
  inp.value = "";
  setByKey(state, "brand.logo_url", "");
  updatePreview();
  showToast("Logo eliminado");
});

$("logoFile")?.addEventListener("change", async (e) => {
  if (!state) return;
  const file = e.target.files?.[0];
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    showToast("Selecciona una imagen válida.", true);
    e.target.value = "";
    return;
  }
  try {
    if (UPLOAD_URL) {
      showToast("Subiendo imagen...");
      const url = await uploadFile(file);
      const inp = $("brand.logo_url");
      if (inp) inp.value = url;
      setByKey(state, "brand.logo_url", url);
      showToast("Imagen subida correctamente");
    } else {
      const dataUrl = await fileToDataURL(file);
      const inp = $("brand.logo_url");
      if (inp) inp.value = dataUrl;
      setByKey(state, "brand.logo_url", dataUrl);
      showToast("Imagen convertida a DataURL");
    }
    updatePreview();
  } catch (err) {
    console.error(err);
    showToast("Error subiendo imagen", true);
  } finally {
    e.target.value = "";
  }
});

// ============ PDF: subir & setear url ============
$("pdfFile")?.addEventListener("change", async (e) => {
  if (!state) return;
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.type !== "application/pdf") {
    showToast("Selecciona un PDF válido.", true);
    e.target.value = "";
    return;
  }
  try {
    if (!UPLOAD_URL) {
      showToast("Configura UPLOAD_URL para subir al servidor.", true);
      return;
    }
    showToast("Subiendo PDF...");
    const url = await uploadFile(file);
    const inp = $("pdf.url");
    if (inp) inp.value = url;
    setByKey(state, "pdf.url", url);
    showToast("PDF subido correctamente");
  } catch (err) {
    console.error(err);
    showToast("Error subiendo PDF", true);
  } finally {
    e.target.value = "";
  }
});

// ============ Utilidades de archivo ============
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const resp = await fetch(UPLOAD_URL, { method: "POST", body: fd });
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const data = await resp.json();
  if (!data.ok || !data.url) throw new Error("Respuesta inválida del servidor");
  return data.url;
}

// ============ Guardar ============
async function saveToServer() {
  if (!state) return showToast("No hay configuración cargada.", true);
  if (!SAVE_URL) return showToast("SAVE_URL no configurado.", true);
  try {
    showToast("Guardando en servidor...");
    const res = await fetch(SAVE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "revista.config.json", config: state }),
    });
    const data = await res.json();
    if (data?.ok) showToast("Guardado en servidor correctamente");
    else throw new Error(data?.error || "Error desconocido");
  } catch (err) {
    console.error(err);
    showToast("No se pudo guardar en el servidor.", true);
  }
}
$("btnSaveServer")?.addEventListener("click", saveToServer);

function bloquear(el) {
  el.addEventListener("keydown", prevent, true);
  el.addEventListener("paste", prevent, true);
  el.addEventListener("input", prevent, true);
}
function desbloquear(el) {
  el.removeEventListener("keydown", prevent, true);
  el.removeEventListener("paste", prevent, true);
  el.removeEventListener("input", prevent, true);
}
function prevent(e) {
  e.preventDefault();
}

const ids = [
  "texts.loading",
  "texts.prev",
  "texts.next",
  "texts.pagesHeader",
  "texts.pageInfoPattern",
  "texts.thumbAltPattern",
];

// Habilitar/deshabilitar campos de texto
$("disableFields")?.addEventListener("change", (e) => {
  ids.forEach((id) => {
    const el = $(id);
    if (el) {
      if (e.target.checked) {
        el.classList.add("disabled");
        bloquear(el);
      } else {
        el.classList.remove("disabled");
        desbloquear(el);
      }
    }
  });
});

// Inicialmente deshabilitar campos de texto
window.addEventListener("DOMContentLoaded", () => {
  ids.forEach((id) => {
    const el = $(id);
    if (el) bloquear(el);
  });
});
