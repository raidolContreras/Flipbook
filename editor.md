
# Flipbook — **Editor de Configuración** (`editor.js`)

Guía técnica del **editor web** para administrar `revista.config.json`. Permite **cargar, editar, previsualizar, subir archivos (logo/PDF)** y **guardar** la configuración en el servidor, con validaciones mínimas y notificaciones visuales (toast).

> **Archivo:** `editor.js` (frontend puro, sin frameworks)  
> **Config objetivo:** `revista.config.json`  
> **Endpoints esperados:** `upload.php` y `save-config.php`

---

## Tabla de contenidos
- [Resumen funcional](#resumen-funcional)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Integración en HTML](#integración-en-html)
- [Esquema de `revista.config.json`](#esquema-de-revistaconfigjson)
- [Flujo del editor](#flujo-del-editor)
- [Funciones clave](#funciones-clave)
- [Eventos y comportamiento de UI](#eventos-y-comportamiento-de-ui)
- [Contratos de backend (PHP)](#contratos-de-backend-php)
- [Estados, validación y toasts](#estados-validación-y-toasts)
- [Seguridad y buenas prácticas](#seguridad-y-buenas-prácticas)
- [Pruebas manuales](#pruebas-manuales)
- [Solución de problemas](#solución-de-problemas)
- [Extensiones sugeridas](#extensiones-sugeridas)

---

## Resumen funcional

- **Carga automática** del archivo `revista.config.json` al iniciar (sin fallback).  
- **Binding bidireccional**: inputs HTML ↔ `state` (objeto en memoria).  
- **Previsualización** de marca (logo + texto + dimensiones).  
- **Subida de archivos**:
  - **Logo** (`image/*`) → `upload.php` o DataURL si no hay endpoint.
  - **PDF** (`application/pdf`) → `upload.php` (obligatorio).
- **Guardado** de la configuración en el servidor mediante `save-config.php`.  
- **Bloqueo/Desbloqueo** de campos de texto (para congelar etiquetas de UI).  
- **Notificaciones** de éxito/error mediante un **toast** simple.

---

## Estructura del proyecto

```
/public
  editor.html
  editor.js
  revista.config.json
  upload.php
  save-config.php
  /assets
    /img
    /pdf
```

- `editor.html` contiene el formulario con los **IDs** que el editor espera.  
- `editor.js` implementa la lógica descrita en este documento.  
- `upload.php` y `save-config.php` implementan los contratos de backend.

---

## Integración en HTML

El editor espera ciertos IDs de elementos en el DOM:

```html
<!-- Toast -->
<div id="toast" class="hidden"><span id="toast-message"></span></div>

<!-- Campos mapeados 1:1 con el state -->
<input id="page.title" type="text">
<input id="brand.text" type="text">
<input id="brand.logo_alt" type="text">
<input id="brand.logo_url" type="text">
<input id="brand.logo_width" type="text">
<input id="brand.logo_height" type="number">

<input id="pdf.url" type="text">
<input id="pdf.allow_query_override" type="checkbox">

<input id="texts.loading" type="text">
<input id="texts.prev" type="text">
<input id="texts.next" type="text">
<input id="texts.pagesHeader" type="text">
<input id="texts.pageInfoPattern" type="text">
<input id="texts.thumbAltPattern" type="text">

<!-- Acciones -->
<input id="logoFile" type="file" accept="image/*">
<button id="btnTestLogo" type="button">Probar URL</button>
<button id="btnClearLogo" type="button">Quitar Logo</button>

<input id="pdfFile" type="file" accept="application/pdf">

<button id="btnSaveServer" type="button">Guardar</button>

<!-- Previsualización -->
<img id="brandPreviewImg" alt="" />
<span id="brandPreviewText"></span>
<span id="brandW"></span> × <span id="brandH"></span>
<img id="logoPreview" alt="logo pequeño">

<!-- Bloqueo opcional de textos -->
<label><input id="disableFields" type="checkbox"> Bloquear textos de UI</label>

<script src="editor.js"></script>
```

> El estilo del **toast** usa clases `hidden`, `show` y `error`. Deben definirse en tu CSS.

---

## Esquema de `revista.config.json`

```jsonc
{
  "page": { "title": "Flipbook" },

  "brand": {
    "text": "Flipbook",
    "logo_alt": "Logo",
    "logo_url": "./assets/img/logo.png",
    "logo_width": "auto",   // o número en px
    "logo_height": 56       // número en px
  },

  "pdf": {
    "url": "./assets/pdf/documento.pdf",
    "allow_query_override": false  // hoy no lo usa el visor, reservado a futuro
  },

  "texts": {
    "loading": "Cargando Revista",
    "prev": "Anterior",
    "next": "Siguiente",
    "pagesHeader": "Páginas",
    "pageInfoPattern": "Páginas {left}-{right} de {count}",
    "pageInfoSinglePattern": "Página {idx} de {count}",
    "thumbAltPattern": "Pág {page}"
  }
}
```

> **Importante:** El editor valida una **estructura mínima** (`page`, `brand`, `pdf`, `texts`). Si no existe, **no habilita** el formulario.

---

## Flujo del editor

1. **`DOMContentLoaded` → `loadInitialConfig()`**  
   - Deshabilita el formulario, descarga `revista.config.json` con `no-cache`, valida y llama a `initState(obj)`.
2. **`initState(obj)`**  
   - Clona a `state`, hace `bindInputsFromState()` y habilita el formulario (`setFormEnabled(true)`).
3. **Edición**  
   - Cualquier `input` (text/number/checkbox) dispara `pullInputsIntoState()` y `updatePreview()`.
4. **Subidas**  
   - Logo: URL prueba / borrar / subir (opcionalmente DataURL si no hay backend).
   - PDF: sólo vía `upload.php`.
5. **Guardar**  
   - `btnSaveServer` → `saveToServer()` que POSTea a `save-config.php`.

---

## Funciones clave

### Helpers de acceso por ruta
- `byKey(obj, "a.b.c")` → `obj.a.b.c` (con optional chaining).  
- `setByKey(obj, "a.b.c", value)` crea nodos intermedios si no existen.

### Estado y binding
- `bindInputsFromState()` rellena los campos HTML desde `state`.  
- `pullInputsIntoState()` vuelca los valores de inputs a `state`.  
- `updatePreview()` actualiza la vista de **marca** (texto + logo + dimensiones).

### Carga y validación de config
- `loadInitialConfig()` hace fetch a `CONFIG_URL` y valida la forma mínima antes de habilitar el form.

### Subida de archivos
- `uploadFile(file)` → `POST multipart/form-data` a `UPLOAD_URL`.  
  - Respuesta esperada: `{"ok": true, "url": "https://…/archivo.ext"}`.  
- `fileToDataURL(file)` (sólo para **logo** si no hay backend).

### Guardado en servidor
- `saveToServer()` → `POST application/json` a `SAVE_URL` con `{ name, config }`.  
  - Respuesta esperada: `{"ok": true}`.

### Toast
- `showToast(msg, isError)` manipula clases del contenedor `#toast` y texto en `#toast-message`.

### Bloqueo de campos de texto
- Lista `ids` con claves de `texts.*`.  
- `#disableFields` activa/desactiva bloqueo via `bloquear()`/`desbloquear()` (se previene `keydown`, `paste`, `input`).  
- Al iniciar, los campos quedan **bloqueados** por defecto.

---

## Eventos y comportamiento de UI

- **Global input listener**: escucha `input` en `text|number|checkbox` y sincroniza `state`.  
- **Botón “Probar URL”** (`btnTestLogo`): descarga la imagen, la muestra y actualiza `state.brand.logo_url`.  
- **Botón “Quitar Logo”** (`btnClearLogo`): limpia la URL de logo y la previsualización.  
- **`logoFile`**: valida tipo `image/*` y sube con `uploadFile` (o DataURL).  
- **`pdfFile`**: valida `application/pdf` y sube con `uploadFile` (obligatorio backend).  
- **`btnSaveServer`**: guarda `revista.config.json` en el servidor.  
- **`disableFields`**: bloquea/desbloquea inputs de textos traducibles.

---

## Contratos de backend (PHP)

### 1) `upload.php` (imagenes/PDF)

**Solicitud**
```
POST /upload.php
Content-Type: multipart/form-data
file: <FICHERO>
```

**Respuesta (éxito)**
```json
{ "ok": true, "url": "https://tusitio.com/uploads/abc123.pdf" }
```

**Sugerencia de implementación (segura)**
```php
<?php
// upload.php
header('Content-Type: application/json; charset=utf-8');

$MAX = 25 * 1024 * 1024; // 25MB
$ALLOWED = [
  'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp',
  'application/pdf' => 'pdf'
];

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
  http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Archivo inválido']); exit;
}

$f = $_FILES['file'];
if ($f['size'] > $MAX) { http_response_code(413); echo json_encode(['ok'=>false,'error'=>'Archivo muy grande']); exit; }

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($f['tmp_name']) ?: 'application/octet-stream';
if (!isset($ALLOWED[$mime])) { http_response_code(415); echo json_encode(['ok'=>false,'error'=>'Tipo no permitido']); exit; }

$ext = $ALLOWED[$mime];
$base = bin2hex(random_bytes(10));
$dir = __DIR__ . '/uploads';
if (!is_dir($dir)) mkdir($dir, 0755, true);

$dest = $dir . '/' . $base . '.' . $ext;
if (!move_uploaded_file($f['tmp_name'], $dest)) {
  http_response_code(500); echo json_encode(['ok'=>false,'error'=>'No se pudo mover el archivo']); exit;
}

$urlBase = (isset($_SERVER['HTTPS'])?'https':'http') . '://' . $_SERVER['HTTP_HOST']
  . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
$url = $urlBase . '/uploads/' . basename($dest);

echo json_encode(['ok'=>true, 'url'=>$url]);
```

### 2) `save-config.php` (guardar JSON)

**Solicitud**
```
POST /save-config.php
Content-Type: application/json

{
  "name": "revista.config.json",
  "config": { ...objeto JSON válido... }
}
```

**Respuesta (éxito)**
```json
{ "ok": true }
```

**Sugerencia de implementación (segura)**
```php
<?php
// save-config.php
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data || !isset($data['name'], $data['config'])) {
  http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Payload inválido']); exit;
}

// Forzar nombre y ruta segura (sin traversal)
$fname = basename($data['name']);
if ($fname !== 'revista.config.json') {
  http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Nombre no permitido']); exit;
}

$json = json_encode($data['config'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT);
if ($json === false) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Config no serializable']); exit; }

$path = __DIR__ . '/' . $fname;

// Backup rotativo simple
if (file_exists($path)) {
  @copy($path, $path . '.' . date('Ymd-His') . '.bak');
}

if (file_put_contents($path, $json) === false) {
  http_response_code(500); echo json_encode(['ok'=>false,'error'=>'No se pudo escribir']); exit;
}

echo json_encode(['ok'=>true]);
```

---

## Estados, validación y toasts

- `state` **no** tiene fallback: si el JSON inicial falla, el formulario sigue **deshabilitado**.  
- Validación mínima: existencia de `page`, `brand`, `pdf`, `texts`.  
- **Toasts**:
  - `showToast(msg, false)` → éxito/información.  
  - `showToast(msg, true)` → error (añade clase `error`).

> Recomendado: incluir `role="status"` y `aria-live="polite"` para accesibilidad del toast.

---

## Seguridad y buenas prácticas

- **Subidas**:
  - Validar MIME real con `finfo`, limitar tamaños y extensiones, renombrar con ID aleatorio.  
  - Servir desde `/uploads` **sin ejecución** (deshabilitar PHP allí).  
- **Guardado**:
  - Forzar el nombre `revista.config.json`; evitar rutas relativas del cliente.  
  - Hacer **backup** previo y usar permisos `0644`.  
- **CORS**: si el editor se usa cruzando dominios, configurar `Access-Control-Allow-Origin` apropiado.  
- **XSS**: al previsualizar logos, el `src` proviene del usuario; si permites DataURL, no permitas `javascript:`.  
- **Autenticación**: proteger `upload.php`/`save-config.php` con sesión/CSRF si el editor es privado.

---

## Pruebas manuales

1. **Carga de config**: desconecta la red o cambia la URL para ver el toast de error.  
2. **Binding**: cambia `brand.text` y verifica la previsualización.  
3. **Logo**:
   - Probar URL válida/invalidar → toasts correspondientes.  
   - Subir archivo grande para validar límites.  
4. **PDF**: intenta subir un `.txt` (debe rechazarlo).  
5. **Guardar**: apaga permisos de escritura de la carpeta y verifica el error.  
6. **Bloqueo de campos**: activa/desactiva `disableFields`.

---

## Solución de problemas

- **“No se pudo cargar revista.config.json”**  
  - Revisa ruta de `CONFIG_URL` y CORS; el editor requiere servidor HTTP (no `file:///`).  
- **“Error subiendo PDF/imagen”**  
  - Verifica logs del servidor, tamaño permitido, permisos de `uploads/`.  
- **“No se pudo guardar en el servidor”**  
  - Comprueba permisos de escritura en el directorio de destino.  
- **Logo no se ve**  
  - La URL debe ser alcanzable desde el navegador; revisa consola (404/403).

---

## Extensiones sugeridas

- **Validación de esquema** con JSON Schema (ajusta mensajes de error de forma amigable).  
- **Historial de versiones** del config con “deshacer”/“rehacer”.  
- **Vista previa integrada del PDF** (sólo portada) al cambiar `pdf.url`.  
- **Control de cambios por usuario** (quién modificó qué y cuándo).  
- **i18n**: selector de idioma y carga/salvado de múltiples ficheros de textos.

---

**Mantenimiento**: Documenta versiones mínimas de PHP (>=7.4), límites de subida (`upload_max_filesize`, `post_max_size`) y políticas de backup para `revista.config.json`.

