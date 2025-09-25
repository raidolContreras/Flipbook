
# Flipbook — Visor (viewer.js, sin doble tap/zoom)

Documentación técnica del visor **responsive** para revistas en PDF que renderiza páginas a imágenes con **PDF.js** y aplica efecto **flipbook** con **PageFlip**. Optimizado para lectura en dispositivos móviles (modo 1 página), con miniaturas, navegación por teclado y persistencia de la última página leída.

> **Versión del script:** `viewer.js (sin doble tap/zoom)`  
> **Dependencias principales:** Bootstrap 5, Font Awesome, PageFlip 2.0.7, PDF.js 2.6.347

---

## Tabla de contenidos
- [Arquitectura general](#arquitectura-general)
- [Requisitos y dependencias](#requisitos-y-dependencias)
- [Estructura de archivos recomendada](#estructura-de-archivos-recomendada)
- [Integración en HTML](#integración-en-html)
- [Configuración (`revista.config.json`)](#configuración-revistaconfigjson)
- [Flujo interno del visor](#flujo-interno-del-visor)
- [Funciones principales](#funciones-principales)
- [Comportamiento responsive](#comportamiento-responsive)
- [Persistencia y estado](#persistencia-y-estado)
- [Rendimiento y calidad de render](#rendimiento-y-calidad-de-render)
- [Accesibilidad y usabilidad](#accesibilidad-y-usabilidad)
- [Seguridad y CORS](#seguridad-y-cors)
- [Personalización](#personalización)
- [Solución de problemas](#solución-de-problemas)
- [Extensiones sugeridas (roadmap)](#extensiones-sugeridas-roadmap)
- [Licencias y créditos](#licencias-y-créditos)

---

## Arquitectura general

1. **Carga de configuración** desde `revista.config.json` (título de página, marca/logo, textos, URL del PDF).  
2. **Descarga del PDF** (con `fetch`) y **renderizado a imágenes** usando **PDF.js** (una imagen por página).  
3. **Instanciación de PageFlip** con el arreglo de imágenes renderizadas.  
4. UI con:
   - **Barra superior**: marca, botones anterior/siguiente, indicador de página.
   - **Flipbook**: contenedor central con el libro.
   - **Miniaturas**: carrusel horizontal en móvil, barra lateral en escritorio.
5. **Persistencia**: guarda en `localStorage` la última página vista por archivo (`flip:last:{fileKey}`).

---

## Requisitos y dependencias

- **Bootstrap 5** (estilos básicos responsivos)
- **Font Awesome** (iconos navegación)
- **PageFlip 2.0.7** (efecto libreta)
- **PDF.js 2.6.347** (render a canvas)

> Las versiones usadas han sido probadas de forma conjunta. Si actualizas, valida de nuevo el comportamiento del flip y el render.

---

## Estructura de archivos recomendada

```
/public
  index.html
  viewer.js
  revista.config.json
  /assets
    /img (logos, etc)
    documento.pdf
```

- `index.html` incluye los enlaces a los CDNs y el `viewer.js`.
- `revista.config.json` centraliza textos y la URL del PDF.
- `documento.pdf` puede ser local o remoto (mismo origen o con CORS permitido).

---

## Integración en HTML

Incluye los CDNs y crea los elementos con **IDs** esperados por el script:

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/css/page-flip.min.css">
<script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js"></script>

<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.min.js"></script>
<script>pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.worker.min.js";</script>

<!-- ...tu HTML... -->

<!-- Elementos usados por viewer.js -->
<div id="loading" class="d-none">
  <div id="pFill"></div>
  <div id="pText"></div>
</div>

<header class="glassbar">
  <img id="brandLogo" style="display:none" alt="">
  <span id="brandText"></span>
  <button id="btnPrev"></button>
  <span id="pageInfo"></span>
  <button id="btnNext"></button>
</header>

<main>
  <section>
    <div id="flipContainer">
      <div id="flipbook"></div>
    </div>
  </section>
  <aside>
    <div id="pagesHeader"></div>
    <div id="thumbs"></div>
  </aside>
</main>

<script src="viewer.js"></script>
```

> **Nota:** el CSS del proyecto define estilos de `.thumb-btn`, `#flipContainer`, etc. Asegúrate de mantenerlos.

---

## Configuración (`revista.config.json`)

Ejemplo mínimo:

```json
{
  "page": { "title": "Flipbook" },
  "brand": {
    "text": "Flipbook",
    "logo_url": "./assets/img/logo.png",
    "logo_width": 140,
    "logo_height": 40
  },
  "texts": {
    "loading": "Cargando Revista",
    "prev": "Anterior",
    "next": "Siguiente",
    "pagesHeader": "Páginas",
    "pageInfoPattern": "Páginas {left}-{right} de {count}",
    "pageInfoSinglePattern": "Página {idx} de {count}",
    "thumbAltPattern": "Pág {page}"
  },
  "pdf": { "url": "./documento.pdf" }
}
```

- Puedes pasar un **config alterno** via `?cfg=/ruta/otra.config.json` en la URL.
- Por diseño, **se ignora `?pdf=`** para centralizar la fuente del documento sólo en el JSON.

---

## Flujo interno del visor

1. **DOMContentLoaded**  
   - Carga de `CFG` → `applyConfig()`  
   - `setFlipHeight()` y validación de URL del PDF  
   - `preloadFromUrl()` → `renderPDF(file)`

2. **renderPDF(file)**  
   - `pdfjsLib.getDocument` → `pdf.numPages`  
   - Bucle de páginas: render en **canvas** a **JPEG** (media calidad) y miniatura (más pequeña).  
   - Actualiza la barra de progreso (`#pFill`, `#pText`).  
   - Al terminar: `initFlip(0)`, `buildThumbs()`, `restoreSession()`.

3. **initFlip(startIndex)**  
   - Crea `new St.PageFlip(...)` con `singlePageMode` **automático** si `≤ 992px`.  
   - Registra eventos `flip`/`changeState` → `updateNavButtons()` + persistencia en `localStorage`.

4. **Interacción**  
   - Botones prev/next, teclas `←/→`.  
   - Click en miniatura navega a la primera página del par (o a la propia si está en modo 1 página).

---

## Funciones principales

- **`loadConfig(path)`**: descarga el JSON de configuración.  
- **`applyConfig()`**: aplica título, marca y textos UI.  
- **`setFlipHeight()`**: calcula la altura de `#flipContainer` según viewport y barra superior.  
- **`renderPDF(file)`**: renderiza páginas y miniaturas con **PDF.js**; controla calidad vía `targetW`.  
- **`initFlip(startIndex)`**: instancia **PageFlip** (modo 1 página si `isNarrow()`).  
- **`updateNavButtons()`**: actualiza botones y etiqueta “Página X”/“Páginas X–Y”.  
- **`buildThumbs()` / `markActiveThumb()`**: genera y resalta las miniaturas.  
- **`saveSession()` / `restoreSession()`**: persiste la última página por `fileKey` (`{name}|{size}`).  
- **`preloadFromUrl(url)`**: descarga el PDF y llama a `renderPDF`.

---

## Comportamiento responsive

- **≤ 992 px**: `singlePageMode = true`. Se muestra **una sola página** para mejor legibilidad.  
- **Miniaturas**:  
  - **Móvil**: carrusel horizontal con `overflow-x:auto`.  
  - **Escritorio (≥1200 px)**: barra lateral vertical con `max-height` y `overflow-y:auto`.
- **Altura del flip**: se ajusta a `window.innerHeight` menos la altura de la barra superior.

---

## Persistencia y estado

- `localStorage` clave: `flip:last:{fileKey}` donde `fileKey = "{nombre}|{tamaño}"`.  
- Guarda `page` (1-based). Al reabrir el mismo PDF, navega a esa página si existe.

> **Nota:** Si cambias el PDF pero conservas nombre y tamaño, la sesión se reutilizará. Considera invalidar el almacenamiento si el contenido cambia con misma huella.

---

## Rendimiento y calidad de render

- **Calidad adaptativa**:  
  - `targetW = min(1800, baseW * DPR * boost)`  
  - `boost = 1.5` en móvil y `1.2` en escritorio.
- **Formato**: JPEG calidad `0.9` para páginas; JPEG `0.8` para miniaturas.  
- **Sugerencias**:
  - Servir el PDF comprimido (`Content-Encoding: gzip/br`) y con **caché** (ETag/Cache-Control).  
  - Si tu revista es muy larga, considera **lazy render** por ventana (render por demanda en lugar de todas las páginas).  
  - Reutiliza canvas para reducir presión de memoria si el documento es muy grande.

---

## Accesibilidad y usabilidad

- Botones con `title`/`aria-label` útiles.  
- Indicador de página se actualiza en cada `flip`.  
- Navegación por **teclado**: `←` anterior, `→` siguiente.  
- Respeta `prefers-reduced-motion` si se usa animación CSS (no afecta el flip, controlado por PageFlip).

---

## Seguridad y CORS

- **No funciona desde `file:///`** (por `fetch`/CORS). Sirve desde un **servidor HTTP** (localhost o hosting).  
- Si `pdf.url` apunta a otro dominio, éste debe permitir CORS (`Access-Control-Allow-Origin`).  
- Evita exponer PDFs privados sin control de acceso; usa URLs firmadas o sesión autenticada si aplica.

---

## Personalización

- **Textos UI**: en `CFG.texts.*` (p. ej. `pageInfoPattern`).  
- **Marca**: `CFG.brand.logo_url|text|logo_width|logo_height`.  
- **Umbral responsive**: cambia `isNarrow()` si deseas otro breakpoint.  
- **Calidad**: ajusta `boost`, `targetW` y calidad JPEG en `renderPDF`.

---

## Solución de problemas

- **No carga el PDF**: revisa la consola (HTTP 4xx/5xx), CORS y ruta en `revista.config.json`.  
- **Miniaturas no se ven**: verifica que existen estilos `.thumb-btn` y que `#thumbs` está presente.  
- **Se corta el flip en altura**: `setFlipHeight()` depende de `.glassbar`; si cambias el header, ajusta el cálculo.  
- **Se “resetea” al cambiar el tamaño de pantalla**: el visor reinicia PageFlip cuando cambia de modo 1↔2 páginas; conserva índice.

---

## Extensiones sugeridas (roadmap)

- **Búsqueda de texto** y resaltado (índice invertido en memoria).  
- **Tabla de contenidos** (`pdf.getOutline()`).  
- **Modo documento alterno** (viewer de PDF.js embebido).  
- **PWA/offline** con Service Worker.  
- **Análisis de lectura** (tiempo por página).  
- **Exportar páginas seleccionadas** (PNG/ZIP vía backend).

---

## Licencias y créditos

- **PageFlip**: https://github.com/Nodlik/StPageFlip (MIT)  
- **PDF.js**: https://github.com/mozilla/pdf.js (Apache-2.0)  
- **Bootstrap**: https://getbootstrap.com (MIT)  
- **Font Awesome**: https://fontawesome.com (Free License / CC BY 4.0 para marcas)

---

### Contacto / mantenimiento

- Mantener versiones de librerías actualizadas y probar en navegadores modernos (Chrome, Edge, Firefox, Safari).  
- Issues conocidos o mejoras: documentarlas en tu repositorio junto con esta guía.
