<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/app/patchmatrix_lib.php';

$filePath = __DIR__ . '/assets/JSON Datenbank NEXUS Patch.txt';
$rawJson = file_get_contents($filePath);
$sourcePayload = json_decode($rawJson, true, 512, JSON_THROW_ON_ERROR);

$payload = patchmatrix_normalize_payload($sourcePayload);

echo "=== Patch-Struktur ===\n\n";
echo "Beispiel-Patches (die fehlschlagen):\n\n";

foreach (array_slice($payload['patches'], 36, 3) as $idx => $patch) {
  echo "Patch " . (36 + $idx) . ":\n";
  echo "  source_port_id: " . $patch['source_port_id'] . "\n";
  echo "  target_port_id: " . $patch['target_port_id'] . "\n";
  echo "  patch_type: " . $patch['patch_type'] . "\n";
}

echo "\n\nPort-IDs (die ersten 5):\n";
foreach (array_slice($payload['ports'], 0, 5) as $port) {
  echo "  - " . $port['id'] . "\n";
}

echo "\n\nExistiert patch[36].source_port '" . $payload['patches'][36]['source_port_id'] . "' in den Ports? ";
$exists = array_filter($payload['ports'], function($p) use ($payload) {
  return $p['id'] === $payload['patches'][36]['source_port_id'];
});
echo (count($exists) > 0 ? "JA" : "NEIN") . "\n";
