<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/app/patchmatrix_lib.php';

echo "=== Debug NEXUS-Konfiguration Import ===\n\n";

// 1. Datei prüfen
$filePath = __DIR__ . '/assets/JSON Datenbank NEXUS Patch.txt';
echo "1. Datei: " . $filePath . "\n";
echo "   Existiert: " . (file_exists($filePath) ? "JA" : "NEIN") . "\n";
if (file_exists($filePath)) {
  echo "   Größe: " . filesize($filePath) . " bytes\n";
}
echo "\n";

// 2. JSON laden
echo "2. JSON laden...\n";
if (file_exists($filePath)) {
  try {
    $rawJson = file_get_contents($filePath);
    $sourcePayload = json_decode($rawJson, true, 512, JSON_THROW_ON_ERROR);
    echo "   ✓ JSON geladen\n";
    echo "   Top-level-keys: " . implode(", ", array_keys($sourcePayload)) . "\n";
    echo "   baseDevices: " . count($sourcePayload['baseDevices'] ?? []) . " Geräte\n";
    echo "   cards: " . count($sourcePayload['cards'] ?? []) . " Karten\n";
    echo "   fixedLinks: " . count($sourcePayload['fixedLinks'] ?? []) . " Links\n";
  } catch (Throwable $e) {
    echo "   ✗ Fehler: " . $e->getMessage() . "\n";
  }
}
echo "\n";

// 3. Normalisieren
echo "3. Payload normalisieren...\n";
try {
  $payload = patchmatrix_normalize_payload($sourcePayload);
  echo "   ✓ Normalisiert\n";
  echo "   base_devices: " . count($payload['base_devices'] ?? []) . "\n";
  echo "   cards: " . count($payload['cards'] ?? []) . "\n";
  echo "   ports: " . count($payload['ports'] ?? []) . "\n";
  echo "   patches: " . count($payload['patches'] ?? []) . "\n";
} catch (Throwable $e) {
  echo "   ✗ Fehler: " . $e->getMessage() . "\n";
}
echo "\n";

// 4. Validieren
echo "4. Payload validieren...\n";
try {
  $errors = patchmatrix_validate_payload($payload);
  if ($errors === []) {
    echo "   ✓ Keine Validierungsfehler\n";
  } else {
    echo "   ✗ Validierungsfehler: " . count($errors) . "\n";
    foreach ($errors as $idx => $error) {
      if (is_array($error)) {
        echo "     Fehler " . ($idx+1) . ": " . json_encode($error, JSON_UNESCAPED_UNICODE) . "\n";
      } else {
        echo "     Fehler " . ($idx+1) . ": " . $error . "\n";
      }
    }
  }
} catch (Throwable $e) {
  echo "   ✗ Exception: " . $e->getMessage() . "\n";
  echo "   Stack: " . $e->getFile() . ":" . $e->getLine() . "\n";
}
echo "\n";

// 5. Datenbank prüfen
echo "5. Datenbank prüfen...\n";
try {
  $db = patchmatrix_db();
  $stmt = $db->query('SELECT COUNT(*) as cnt FROM patchmatrix_documents');
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  echo "   ✓ Insgesamt " . $row['cnt'] . " Dokumente\n";
  
  $stmt = $db->prepare('SELECT id, title FROM patchmatrix_documents WHERE title LIKE ?');
  $stmt->execute(['%SLM%']);
  $slmDocs = $stmt->fetchAll(PDO::FETCH_ASSOC);
  echo "   SLM-Dokumente: " . count($slmDocs) . "\n";
  foreach ($slmDocs as $doc) {
    echo "     - ID " . $doc['id'] . ": " . $doc['title'] . "\n";
  }
} catch (Throwable $e) {
  echo "   ✗ Fehler: " . $e->getMessage() . "\n";
}
echo "\n";
