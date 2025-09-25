<?php
// upload.php — Subida de imágenes/PDF para el editor
// Seguridad mínima: limita tipos MIME, tamaño, y nombre aleatorio.
// Recomendado: proteger con autenticación si es público.

header('Content-Type: application/json; charset=utf-8');

// Config
$UPLOAD_DIR = __DIR__ . '/uploads';
$BASE_URL   = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://')
            . $_SERVER['HTTP_HOST']
            . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\')
            . '/uploads/';
$MAX_BYTES  = 15 * 1024 * 1024; // 15 MB
$ALLOWED    = [
  'image/png','image/jpeg','image/jpg','image/webp','image/gif','image/svg+xml',
  'application/pdf'
];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok'=>false, 'error'=>'Método no permitido']);
  exit;
}

if (empty($_FILES['file']['tmp_name'])) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'Archivo no recibido']);
  exit;
}

$f = $_FILES['file'];
if ($f['error'] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'Error en subida (code '.$f['error'].')']);
  exit;
}

if ($f['size'] > $MAX_BYTES) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'Archivo demasiado grande']);
  exit;
}

$mime = mime_content_type($f['tmp_name']);
if (!in_array($mime, $ALLOWED, true)) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'Tipo de archivo no permitido: '.$mime]);
  exit;
}

if (!is_dir($UPLOAD_DIR)) {
  if (!mkdir($UPLOAD_DIR, 0755, true)) {
    http_response_code(500);
    echo json_encode(['ok'=>false, 'error'=>'No se pudo crear el directorio de subida']);
    exit;
  }
}

// extensión segura según MIME
$extMap = [
  'image/png' => 'png',
  'image/jpeg'=> 'jpg',
  'image/jpg' => 'jpg',
  'image/webp'=> 'webp',
  'image/gif' => 'gif',
  'image/svg+xml' => 'svg',
  'application/pdf' => 'pdf'
];
$ext = isset($extMap[$mime]) ? $extMap[$mime] : 'bin';

// nombre aleatorio
$name = bin2hex(random_bytes(8)) . '.' . $ext;
$dest = $UPLOAD_DIR . DIRECTORY_SEPARATOR . $name;

if (!move_uploaded_file($f['tmp_name'], $dest)) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'No se pudo mover el archivo']);
  exit;
}

$url = $BASE_URL . $name;
echo json_encode(['ok'=>true, 'url'=>$url]);