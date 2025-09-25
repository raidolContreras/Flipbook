<?php
// save-config.php — Guarda el JSON de configuración en el servidor
header('Content-Type: application/json; charset=utf-8');

// Opcional: API key simple (pon una cadena segura). Déjalo vacío para desactivar.
$API_KEY = ''; // <-- cambia esto si deseas exigir API key

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok'=>false, 'error'=>'Método no permitido']);
  exit;
}

$raw = file_get_contents('php://input');
if (!$raw) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'Cuerpo vacío']);
  exit;
}

$data = json_decode($raw, true);
if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'JSON inválido']);
  exit;
}

$name = isset($data['name']) ? basename($data['name']) : 'revista.config.json';
$config = $data['config'] ?? null;
if (!$config) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'Campo "config" requerido']);
  exit;
}

// Validación mínima de estructura
if (!isset($config['page']) || !isset($config['brand']) || !isset($config['pdf']) || !isset($config['texts'])) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'Estructura inválida (faltan claves principales)']);
  exit;
}

$json = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
if ($json === false) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'No se pudo serializar el JSON']);
  exit;
}

$ok = file_put_contents(__DIR__ . DIRECTORY_SEPARATOR . $name, $json);
if ($ok === false) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'No se pudo escribir el archivo']);
  exit;
}

echo json_encode(['ok'=>true, 'file'=>$name]);
