<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/app/patchmatrix_lib.php';

$filePath = __DIR__ . '/assets/JSON Datenbank NEXUS Patch.txt';
$rawJson = file_get_contents($filePath);
$sourcePayload = json_decode($rawJson, true, 512, JSON_THROW_ON_ERROR);

echo "Quellen-Ports: " . (isset($sourcePayload['ports']) ? "JA" : "NEIN") . "\n";
if (isset($sourcePayload['ports'])) {
  echo "Anzahl: " . count($sourcePayload['ports']) . "\n";
  echo "\nErste 3 Ports:\n";
  foreach (array_slice($sourcePayload['ports'], 0, 3) as $port) {
    echo "  - ID: " . $port['id'] . "\n";
    echo "    card_id/cardId: " . ($port['cardId'] ?? $port['card_id'] ?? 'NONE') . "\n";
    echo "    direction: " . ($port['dir'] ?? $port['direction'] ?? 'NONE') . "\n";
    echo "    index: " . ($port['idx'] ?? $port['index'] ?? 'NONE') . "\n";
  }
  
  echo "\nPorts mit missing numId:\n";
  $missing = array_filter($sourcePayload['ports'], function($p) {
    return empty($p['numId']) && empty($p['numeric_id']);
  });
  echo "Count: " . count($missing) . "\n";
}

// Überprüfe jetzt welche IDs in den fixedLinks verwiesen werden
$fixedLinkIds = [];
foreach ($sourcePayload['fixedLinks'] ?? [] as $link) {
  if (is_string($link)) {
    // Parse die Link-String z.B. "card_id|in|1|card_id|out|1"
    $parts = explode('|', $link);
    if (count($parts) >= 6) {
      $cardId1 = $parts[0];
      $dir1 = $parts[1];
      $idx1 = $parts[2];
      $cardId2 = $parts[3];
      $dir2 = $parts[4];
      $idx2 = $parts[5];
      
      $fixedLinkIds[] = "$cardId1|$dir1|$idx1";
      $fixedLinkIds[] = "$cardId2|$dir2|$idx2";
    }
  }
}

$fixedLinkIds = array_unique($fixedLinkIds);
echo "\n\nAnzahl einzigartiger Ports in fixedLinks: " . count($fixedLinkIds) . "\n";

// Überprüfe, welche dieser IDs in der ports-Liste fehlen
if (isset($sourcePayload['ports'])) {
  $portIds = array_map(function($p) {
    $cardId = $p['cardId'] ?? $p['card_id'] ?? '';
    $dir = $p['dir'] ?? $p['direction'] ?? '';
    $idx = $p['idx'] ?? $p['index'] ?? '';
    return "$cardId|$dir|$idx";
  }, $sourcePayload['ports']);
  
  $missing = array_diff($fixedLinkIds, $portIds);
  echo "Fehlende Ports: " . count($missing) . "\n";
  foreach (array_slice($missing, 0, 10) as $mp) {
    echo "  - $mp\n";
  }
}
