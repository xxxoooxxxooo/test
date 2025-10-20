<?php
// Simple PHP entry to serve the static index.html
$index = __DIR__ . '/index.html';
if (is_file($index)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($index);
    exit;
}
http_response_code(404);
echo 'index.html not found';
