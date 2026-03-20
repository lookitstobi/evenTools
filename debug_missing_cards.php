<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/app/patchmatrix_lib.php';

$filePath = __DIR__ . '/assets/JSON Datenbank NEXUS Patch.txt';
$rawJson = file_get_contents($filePath);
$sourcePayload = json_decode($rawJson, true, 512, JSON_THROW_ON_ERROR);

$payload = patchmatrix_normalize_payload($sourcePayload);

// Sammle alle Karten-IDs
$cardsIds = array_map(function($c) { return $c['id']; }, $payload['cards']);
$cardsById = array_flip($cardsIds);

// Sammle alle referenzierten Karten aus Patches
$referencedCards = [];
foreach ($payload['patches'] as $patch) {
  // Parse Karten-IDs aus den Port-IDs
  $parts = explode('|', $patch['source_port_id']);
  if (count($parts) >= 1) {
    $referencedCards[$parts[0]] = true;
  }
  
  $parts = explode('|', $patch['target_port_id']);
  if (count($parts) >= 1) {
    $referencedCards[$parts[0]] = true;
  }
}

echo "Karten-Referenzen im Patch:\n";
echo "Referenzierte Karten: " . count($referencedCards) . "\n";
echo "Vorhandene Karten: " . count($cardsIds) . "\n";

$missingCards = [];
foreach (array_keys($referencedCards) as $cardId) {
  if (!isset($cardsById[$cardId])) {
    $missingCards[$cardId] = true;
  }
}

echo "Fehlende Karten: " . count($missingCards) . "\n";
foreach (array_keys($missingCards) as $cardId) {
  echo "  - $cardId\n";
  
  // Suche nach dieser Karte in der Quellen-JSON
  $sourceCards = array_filter($sourcePayload['cards'] ?? [], function($c) use ($cardId) {
    return ($c['id'] ?? '') === $cardId;
  });
  
  if (count($sourceCards) > 0) {
    $srcCard = reset($sourceCards);
    echo "    Gefunden in Quellen: " . $srcCard['name'] . "\n";
  } else {
    echo "    NICHT in Quellen!\n";
  }
}
