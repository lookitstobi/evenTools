<?php
/**
 * Einmaliges Setup-Skript: Lädt CDN-Bibliotheken für nti_tool lokal herunter.
 * Aufruf via CLI: php download_vendor.php
 * Darf NICHT über den Webserver erreichbar sein (.htaccess blockiert es via deploy.php-Regel bereits nicht,
 * aber sicherheitshalber sollte es nach dem ersten Ausführen gelöscht werden).
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Nur via CLI ausführbar.');
}

$vendor = __DIR__ . '/app/tools/nti_tool/vendor';
if (!is_dir($vendor)) {
    mkdir($vendor, 0775, true);
}

$files = [
    'chart.umd.min.js'  => 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    'jspdf.umd.min.js'  => 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'pdf-lib.min.js'    => 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
];

foreach ($files as $filename => $url) {
    $target = $vendor . '/' . $filename;
    if (file_exists($target) && filesize($target) > 10000) {
        echo "SKIP  $filename (bereits vorhanden, " . filesize($target) . " Bytes)\n";
        continue;
    }
    echo "DL    $filename ...";
    $ctx = stream_context_create(['http' => ['timeout' => 30, 'user_agent' => 'Mozilla/5.0 (download_vendor.php)']]);
    $data = @file_get_contents($url, false, $ctx);
    if ($data === false || strlen($data) < 1000) {
        echo " FEHLER – übersprungen\n";
        continue;
    }
    file_put_contents($target, $data);
    echo " OK (" . strlen($data) . " Bytes)\n";
}

echo "\nFertig. Vendor-Verzeichnis: $vendor\n";
