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

$css  = file_get_contents($cssFile);
$js   = file_get_contents($jsFile);
$html = file_get_contents($htmlFile);

// toolserve-Referenzen durch inlinierte Inhalte ersetzen
$html = str_replace(
    '<link rel="stylesheet" href="/toolserve.php?name=timeTools&file=style.css">',
    '<style>' . $css . '</style>',
    $html
);
$html = str_replace(
    '<script src="/toolserve.php?name=timeTools&file=app.js" defer></script>',
    '<script>' . $js . '</script>',
    $html
);

header('Content-Type: text/html; charset=utf-8');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';");
header('X-Content-Type-Options: nosniff');
echo $html;
