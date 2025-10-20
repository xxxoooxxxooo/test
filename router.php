<?php
// Of video — PHP Router & Minimal API
// - Serves API endpoints for contact form and AI video providers (mock + optional Replicate)
// - When used with PHP built-in server: php -S 0.0.0.0:3000 router.php
// - When used behind Apache: use .htaccess to rewrite /api/* and /healthz to this file

$ROOT = __DIR__;

// Load local config.php if present (for non-Docker PHP installs)
$CONFIG = [];
$configFile = $ROOT . '/config.php';
if (is_file($configFile)) {
    $cfg = include $configFile;
    if (is_array($cfg)) $CONFIG = $cfg;
}

// Determine enabled providers: env > config > default
$providersEnv = getenv('ENABLED_VIDEO_PROVIDERS');
if ($providersEnv === false || $providersEnv === '') {
    $providersEnv = isset($CONFIG['ENABLED_VIDEO_PROVIDERS']) ? $CONFIG['ENABLED_VIDEO_PROVIDERS'] : 'mock';
}
$ENABLED_VIDEO_PROVIDERS = array_filter(array_map('trim', explode(',', $providersEnv ?: 'mock')));

// Determine Replicate token: env vars > config > empty
$replicateEnv = getenv('REPLICATE_API_TOKEN');
if ($replicateEnv === false || $replicateEnv === '') {
    $replicateEnv = getenv('VIDEO_REPLICATE_API_TOKEN');
}
if (($replicateEnv === false || $replicateEnv === '') && isset($CONFIG['REPLICATE_API_TOKEN'])) {
    $replicateEnv = $CONFIG['REPLICATE_API_TOKEN'];
}
$REPLICATE_API_TOKEN = $replicateEnv ?: '';

function send($code, $body, $headers = []) {
    http_response_code($code);
    $isJson = is_array($body) || is_object($body);
    $defaultHeaders = [
        'Content-Type' => $isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
        'Cache-Control' => 'no-store',
        'Access-Control-Allow-Origin' => '*',
    ];
    foreach (array_merge($defaultHeaders, $headers) as $k => $v) {
        header($k . ': ' . $v);
    }
    echo $isJson ? json_encode($body, JSON_UNESCAPED_UNICODE) : $body;
    exit;
}

function get_client_ip() {
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($parts[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

function read_json_body() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    if ($data === null && json_last_error() !== JSON_ERROR_NONE) return null;
    return $data ?: [];
}

function list_video_providers($enabled, $replicateToken) {
    $providers = [];
    if (in_array('mock', $enabled)) {
        $providers[] = [
            'key' => 'mock',
            'name' => 'Mock Provider',
            'capabilities' => ['text_to_video' => true, 'image_to_video' => true],
            'auth' => 'none',
        ];
    }
    if (in_array('replicate', $enabled)) {
        $providers[] = [
            'key' => 'replicate',
            'name' => 'Replicate',
            'capabilities' => ['text_to_video' => true, 'image_to_video' => true],
            'auth' => $replicateToken ? 'configured' : 'missing',
            'docs' => 'https://replicate.com/docs/reference/http#predictions.create',
            'notes' => 'Use either deployment (owner/name) or version (model version ID) and provide input JSON per model.'
        ];
    }
    return $providers;
}

function replicate_request($method, $url, $headers = [], $body = null) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $h = [];
    foreach ($headers as $k => $v) { $h[] = $k . ': ' . $v; }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $h);
    if ($body !== null) {
        $payload = is_string($body) ? $body : json_encode($body);
        $h[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    }
    $respBody = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($respBody && ($json = json_decode($respBody, true)) !== null) {
        return [$status, $json, null];
    }
    return [$status, $respBody, $err ?: null];
}

function replicate_create_prediction($token, $payload) {
    if (!$token) return [400, ['ok' => false, 'error' => 'REPLICATE_API_TOKEN is not set'], null];
    $version = $payload['version'] ?? null;
    $deployment = $payload['deployment'] ?? null;
    $input = $payload['input'] ?? [];
    $headers = [ 'Authorization' => 'Token ' . $token, 'Content-Type' => 'application/json' ];
    if ($deployment) {
        $url = 'https://api.replicate.com/v1/deployments/' . rawurlencode($deployment) . '/predictions';
        return replicate_request('POST', $url, $headers, ['input' => $input]);
    } else if ($version) {
        $url = 'https://api.replicate.com/v1/predictions';
        return replicate_request('POST', $url, $headers, ['version' => $version, 'input' => $input]);
    } else {
        return [400, ['ok' => false, 'error' => 'Missing deployment or version for Replicate'], null];
    }
}

function replicate_get_prediction($token, $id) {
    if (!$token) return [400, ['ok' => false, 'error' => 'REPLICATE_API_TOKEN is not set'], null];
    $headers = [ 'Authorization' => 'Token ' . $token ];
    $url = 'https://api.replicate.com/v1/predictions/' . rawurlencode($id);
    return replicate_request('GET', $url, $headers);
}

function mock_job_file($root, $id) {
    $dir = $root . '/data/mockjobs';
    if (!is_dir($dir)) @mkdir($dir, 0777, true);
    return $dir . '/' . $id . '.json';
}

function create_mock_job($root, $payload) {
    $id = 'mock_' . time() . '_' . substr(bin2hex(random_bytes(4)), 0, 6);
    $job = [
        'id' => $id,
        'provider' => 'mock',
        'status' => 'starting',
        'input' => $payload ?: [],
        'created_at' => gmdate('c'),
        'output' => null,
        'error' => null,
    ];
    file_put_contents(mock_job_file($root, $id), json_encode($job, JSON_UNESCAPED_UNICODE));
    return $job;
}

function get_mock_job_status($root, $id) {
    $file = mock_job_file($root, $id);
    if (!is_file($file)) return null;
    $job = json_decode(file_get_contents($file), true) ?: null;
    if (!$job) return null;
    $createdAt = strtotime($job['created_at'] ?? 'now');
    $elapsed = microtime(true) - $createdAt;
    if ($elapsed < 0.8) $job['status'] = 'starting';
    else if ($elapsed < 2.2) $job['status'] = 'processing';
    else {
        $job['status'] = 'succeeded';
        $job['completed_at'] = gmdate('c');
        $job['output'] = [
            'message' => 'Mock video generated successfully. Integrate a real provider to get actual video output.',
            'url' => '',
            'thumbnail' => '',
        ];
    }
    // Save back (best-effort)
    @file_put_contents($file, json_encode($job, JSON_UNESCAPED_UNICODE));
    return $job;
}

// Handle CORS preflight for API endpoints
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET,POST,OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// For PHP built-in server: serve files directly if they exist
if (PHP_SAPI === 'cli-server') {
    $file = realpath($ROOT . $uri);
    if ($file && is_file($file)) {
        return false; // Let built-in server serve the file
    }
}

// API routes
if ($uri === '/healthz' || $uri === '/api/healthz' || $uri === '/api/health') {
    send(200, ['ok' => true]);
}

if ($uri === '/api/contact') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send(405, ['ok' => false, 'error' => 'Method Not Allowed']);
    $data = read_json_body();
    if ($data === null) send(400, ['ok' => false, 'error' => 'Bad JSON']);
    $name = trim((string)($data['name'] ?? ''));
    $email = trim((string)($data['email'] ?? ''));
    $message = trim((string)($data['message'] ?? ''));
    if ($name === '' || $email === '' || $message === '') send(400, ['ok' => false, 'error' => 'Missing fields']);
    $dir = $ROOT . '/data';
    if (!is_dir($dir)) @mkdir($dir, 0777, true);
    $file = $dir . '/contacts.json';
    $arr = [];
    if (is_file($file)) {
      $prev = json_decode(file_get_contents($file), true);
      if (is_array($prev)) $arr = $prev;
    }
    $arr[] = [
        'name' => $name,
        'email' => $email,
        'message' => $message,
        'ts' => gmdate('c'),
        'ip' => get_client_ip(),
        'ua' => $_SERVER['HTTP_USER_AGENT'] ?? '',
    ];
    file_put_contents($file, json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    send(200, ['ok' => true]);
}

if ($uri === '/api/video/providers') {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') send(405, ['ok' => false, 'error' => 'Method Not Allowed']);
    send(200, ['ok' => true, 'providers' => list_video_providers($ENABLED_VIDEO_PROVIDERS, $REPLICATE_API_TOKEN)]);
}

if ($uri === '/api/video/generate') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') send(405, ['ok' => false, 'error' => 'Method Not Allowed']);
    $body = read_json_body();
    if ($body === null) send(400, ['ok' => false, 'error' => 'Bad JSON']);
    $provider = trim((string)($body['provider'] ?? ''));
    if ($provider === '' || !in_array($provider, $ENABLED_VIDEO_PROVIDERS)) send(400, ['ok' => false, 'error' => 'Provider not enabled or missing']);
    if ($provider === 'mock') {
        $job = create_mock_job($ROOT, [ 'prompt' => $body['prompt'] ?? '', 'options' => $body['options'] ?? [] ]);
        send(200, ['ok' => true, 'provider' => 'mock', 'id' => $job['id'], 'status' => $job['status']]);
    }
    if ($provider === 'replicate') {
        [$status, $data, $err] = replicate_create_prediction($REPLICATE_API_TOKEN, $body);
        if ($status >= 400) send($status, ['ok' => false, 'error' => 'Replicate API error', 'detail' => $data ?: $err]);
        $id = is_array($data) ? ($data['id'] ?? '') : '';
        $st = is_array($data) ? ($data['status'] ?? 'starting') : 'starting';
        send(200, ['ok' => true, 'provider' => 'replicate', 'id' => $id, 'status' => $st, 'raw' => $data]);
    }
    send(400, ['ok' => false, 'error' => 'Unknown provider']);
}

if (preg_match('#^/api/video/jobs/([^/]+)/([^/]+)$#', $uri, $m)) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') send(405, ['ok' => false, 'error' => 'Method Not Allowed']);
    $provider = $m[1];
    $id = $m[2];
    if (!in_array($provider, $ENABLED_VIDEO_PROVIDERS)) send(400, ['ok' => false, 'error' => 'Provider not enabled']);
    if ($provider === 'mock') {
        $job = get_mock_job_status($ROOT, $id);
        if (!$job) send(404, ['ok' => false, 'error' => 'Job not found']);
        send(200, ['ok' => true, 'provider' => 'mock', 'id' => $job['id'], 'status' => $job['status'], 'output' => $job['output'] ?? null, 'error' => $job['error'] ?? null]);
    }
    if ($provider === 'replicate') {
        [$status, $data, $err] = replicate_get_prediction($REPLICATE_API_TOKEN, $id);
        if ($status >= 400) send($status, ['ok' => false, 'error' => 'Replicate API error', 'detail' => $data ?: $err]);
        $rawStatus = is_array($data) ? ($data['status'] ?? '') : '';
        if ($rawStatus === 'succeeded') $statusNorm = 'succeeded';
        else if ($rawStatus === 'failed' || $rawStatus === 'canceled') $statusNorm = 'failed';
        else $statusNorm = 'processing';
        send(200, ['ok' => true, 'provider' => 'replicate', 'id' => is_array($data) ? ($data['id'] ?? $id) : $id, 'status' => $statusNorm, 'output' => (is_array($data) ? ($data['output'] ?? null) : null), 'raw' => $data]);
    }
    send(400, ['ok' => false, 'error' => 'Unknown provider']);
}

// Default: if built-in server -> return index.html; if under Apache, .htaccess will not send here for static assets
// As a fallback, show 404 if API path not matched
send(404, 'Not Found');
