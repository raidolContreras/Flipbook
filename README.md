# 📖 Flipbook – Revista Interactiva

Este proyecto implementa un sistema de **revista digital interactiva** en formato **flipbook** con configuración dinámica mediante un archivo JSON. Permite visualizar documentos PDF como libros digitales con efecto de paso de página, navegación, miniaturas y personalización de marca.

---

## 🚀 Características principales

- 📑 **Visualización de PDF como flipbook** utilizando [PageFlip.js](https://www.npmjs.com/package/page-flip).
- 🔎 **Miniaturas de páginas** con resaltado de la página activa.
- ⏳ **Pantalla de carga animada** con progreso en tiempo real.
- 🎨 **Personalización de marca** (logo, texto, colores, tamaño del logo) configurable desde `revista.config.json`.
- 🌐 **Compatibilidad multi-dispositivo** (navegación por teclado, botones o clic en miniaturas).
- ⚡ **Optimización de rendimiento** con renderizado en canvas de PDF.js.
- 💾 **Persistencia de sesión**: recuerda la última página leída mediante `localStorage`.
- 🔐 **Seguridad** en `/uploads` mediante `.htaccess` que bloquea ejecución de scripts.
- 🛠️ **Editor de configuración** (`editor.html`) para modificar parámetros de la revista sin editar manualmente el JSON.

---

## 📂 Estructura del proyecto

```
/
├── index.html              # Visualizador principal del flipbook
├── editor.html             # Editor visual de configuración
├── revista.config.json     # Archivo JSON de configuración
├── upload.php              # Endpoint PHP para subir archivos (logo/PDF)
├── save-config.php         # Endpoint PHP para guardar cambios en JSON
├── uploads/                # Carpeta de archivos cargados (protegida)
│   └── .htaccess           # Bloquea ejecución de scripts en uploads
```

---

## ⚙️ Configuración (`revista.config.json`)

Ejemplo del archivo de configuración:

```json
{
  "page": {
    "title": "Revista Montrer Sep 2025"
  },
  "brand": {
    "text": "Revista Montrer Sep 2025",
    "logo_url": "https://serviciosocial.unimontrer.edu.mx/view/assets/images/logo-color.png",
    "logo_alt": "Logo UNIMO",
    "logo_width": "auto",
    "logo_height": 36
  },
  "pdf": {
    "url": "http://localhost/Flipbook/uploads/d66a2b59c87d4d51.pdf",
    "allow_query_override": true
  },
  "texts": {
    "loading": "Cargando Revista",
    "prev": "Anterior",
    "next": "Siguiente",
    "pagesHeader": "Páginas",
    "pageInfoPattern": "Páginas {left}-{right} de {count}",
    "thumbAltPattern": "Miniatura página {page}"
  }
}
```

### Parámetros principales

- **page.title** → Título mostrado en el navegador.  
- **brand.*** → Configuración de logo (URL, alt, ancho/alto) y texto de marca.  
- **pdf.url** → URL del PDF a mostrar.  
- **texts.*** → Textos personalizables de la UI.  

---

## 🖥️ Uso del Editor (`editor.html`)

El **Editor Config** permite:

- Subir o cambiar el **logo**.
- Subir un nuevo **PDF**.
- Editar textos de la interfaz.
- Guardar cambios directamente en `revista.config.json` mediante `save-config.php`.

Incluye:
- ✅ Vista previa en tiempo real del logo y la marca.  
- ✅ Opción de **deshabilitar campos** para evitar edición manual.  
- ✅ Notificaciones visuales (toast) de éxito o error.  

---

## 🔒 Seguridad

En la carpeta `uploads/` se incluye un `.htaccess` que **bloquea la ejecución de scripts**:

```apache
<FilesMatch "\.(php|phar|phtml|pl|py|jsp|asp|aspx|cgi)$">
  Deny from all
</FilesMatch>
Options -ExecCGI
RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .phps
```

Esto asegura que solo se puedan servir archivos estáticos (PDF, imágenes).

---

## 📦 Dependencias principales

- [Bootstrap 5](https://getbootstrap.com/) → Estilos y diseño responsivo.  
- [Font Awesome 6](https://fontawesome.com/) → Iconos.  
- [PageFlip.js](https://www.npmjs.com/package/page-flip) → Animación de flipbook.  
- [PDF.js](https://mozilla.github.io/pdf.js/) → Renderizado de PDF a imágenes.  
- [TailwindCSS](https://tailwindcss.com/) → Usado en `editor.html` para interfaz moderna.  

---

## ▶️ Instalación y uso

1. Clona el proyecto en tu servidor (ej. XAMPP o Plesk).
2. Coloca tus PDFs en la carpeta `/uploads/`.
3. Edita `revista.config.json` manualmente o usa `editor.html`.
4. Abre `index.html` en el navegador → carga automática del PDF definido en el JSON.
5. Opcional: accede al editor en `/editor.html` para modificar parámetros.

---

## 📌 Recomendaciones

- Usa URLs relativas o absolutas (http/https) para el PDF, no `file:///`.  
- Mantén la carpeta `/uploads/` protegida con `.htaccess`.  
- Para entornos productivos, valida los archivos en `upload.php` antes de almacenarlos.  
- Configura permisos adecuados en el servidor (ej. solo lectura para `revista.config.json`).  

---
