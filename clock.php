<?php
declare(strict_types=1);

// Öffentlich zugängliche Inspizientenuhr – kein Login erforderlich.
// Kein Zugriff auf Datenbank oder Session-Daten.

$toolDir = __DIR__ . '/app/tools/timeTools';

$cssFile  = realpath($toolDir . '/style.css');
$jsFile   = realpath($toolDir . '/app.js');
$htmlFile = realpath($toolDir . '/index.html');

if (!$cssFile || !$jsFile || !$htmlFile) {
    http_response_code(503);
    echo 'Tool nicht verfügbar.';
    exit;
}

$nonce = base64_encode(random_bytes(16));

$css  = file_get_contents($cssFile);
$js   = file_get_contents($jsFile);
$html = file_get_contents($htmlFile);

// toolserve-Referenzen durch inlinierte Inhalte ersetzen (mit Nonce)
$html = str_replace(
    '<link rel="stylesheet" href="/toolserve.php?name=timeTools&file=style.css">',
    '<style nonce="' . $nonce . '">' . $css . '</style>',
    $html
);
$html = str_replace(
    '<script src="/toolserve.php?name=timeTools&file=app.js" defer></script>',
    '<script nonce="' . $nonce . '">' . $js . '</script>',
    $html
);
// Nonce zu verbleibenden inline <style>- und <script>-Tags hinzufügen
$html = preg_replace('/<style\b(?![^>]*\bnonce\b)/i', '<style nonce="' . $nonce . '"', $html);
$html = preg_replace('/<script\b(?![^>]*\b(?:src|nonce)\b)/i', '<script nonce="' . $nonce . '"', $html);

if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}
header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
header('Content-Type: text/html; charset=utf-8');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'nonce-{$nonce}'; script-src 'nonce-{$nonce}'; frame-ancestors 'self';");
echo $html;
