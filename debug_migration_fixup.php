<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/app/patchmatrix_lib.php';

// Definiere die Fixup-Funktion lokal
function migrate_patchmatrix_fixup_missing_ports(array $payload): array {
  if (!isset($payload['cards']) || !is_array($payload['cards'])) {
    return $payload;
  }
  if (!isset($payload['patches']) || !is_array($payload['patches'])) {
    return $payload;
  }
  if (!isset($payload['ports']) || !is_array($payload['ports'])) {
    $payload['ports'] = [];
  }

  // Baue Indizes für schnelle Lookups
  $cardsById = [];
  foreach ($payload['cards'] as $card) {
    $cardsById[$card['id']] = $card;
  }

  $portsById = [];
  foreach ($payload['ports'] as $port) {
    $portsById[$port['id']] = true;
  }

  // Sammle alle referenzierten Ports aus Patches
  $referencedPorts = [];
  foreach ($payload['patches'] as $patch) {
    $referencedPorts[$patch['source_port_id']] = true;
    $referencedPorts[$patch['target_port_id']] = true;
  }

  // Generiere fehlende Ports
  $nextPortIndex = count($payload['ports']);
  foreach ($referencedPorts as $portId => $_) {
    if (isset($portsById[$portId])) {
      continue; // Port existiert bereits
    }

    // Parse die Port-ID: format ist "cardId|direction|index"
    $parts = explode('|', $portId);
    if (count($parts) !== 3) {
      continue; // Unbekanntes Format
    }

    $cardId = $parts[0];
    $direction = $parts[1];
    $index = (int)$parts[2];

    if (!isset($cardsById[$cardId])) {
      continue; // Karte existiert nicht
    }

    // Generiere einen neuen Port
    $card = $cardsById[$cardId];
    $payload['ports'][] = [
      'id' => $portId,
      'card_id' => $cardId,
      'base_device_id' => $card['base_device_id'] ?? '',
      'direction' => in_array($direction, ['in', 'out']) ? $direction : 'in',
      'index' => max(1, $index),
      'numeric_id' => null,
      'name' => '',
      'label' => '',
      'group' => '',
      'note' => 'Auto-generated during import',
      'tags' => [],
      'is_virtual' => false,
      'is_locked' => false,
      'is_auto_generated' => true,
    ];
    
    $portsById[$portId] = true;
    $nextPortIndex++;
  }

  return $payload;
}

$filePath = __DIR__ . '/assets/JSON Datenbank NEXUS Patch.txt';
$rawJson = file_get_contents($filePath);
$sourcePayload = json_decode($rawJson, true, 512, JSON_THROW_ON_ERROR);

echo "=== Import-Prozess ===\n\n";

// 1. Normalisieren
echo "1. Payload normalisieren...\n";
$payload = patchmatrix_normalize_payload($sourcePayload);
echo "   Ausgangspyload: " . count($payload['ports']) . " Ports, " . count($payload['patches']) . " Patches\n";

// 2. Fixup
echo "2. Fehlende Ports reparieren...\n";
$beforePorts = count($payload['ports']);
$payload = migrate_patchmatrix_fixup_missing_ports($payload);
$afterPorts = count($payload['ports']);
echo "   Ports vorher: " . $beforePorts . ", nachher: " . $afterPorts . "\n";
echo "   Neue Ports hinzugefügt: " . ($afterPorts - $beforePorts) . "\n";

// 3. Validieren
echo "3. Validieren...\n";
$errors = patchmatrix_validate_payload($payload);
if ($errors === []) {
  echo "   ✓ KEIN Validierungsfehler!\n";
} else {
  echo "   ✗ Noch Validierungsfehler: " . count($errors) . "\n";
  foreach (array_slice($errors, 0, 5) as $error) {
    echo "     - " . json_encode($error) . "\n";
  }
}
