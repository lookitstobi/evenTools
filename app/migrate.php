<?php
declare(strict_types=1);

require dirname(__DIR__) . '/_bootstrap.php';
require __DIR__ . '/cuesheet_lib.php';
require __DIR__ . '/dguv_lib.php';
require __DIR__ . '/pdf_template_lib.php';
require __DIR__ . '/patchmatrix_lib.php';

/**
 * Explizite DB-Migrationen für Deploys.
 *
 * Aufruf:
 *   php app/migrate.php
 */

function migrate_users_db(array $config): void {
  $db = new PDO('sqlite:' . (string)$config['db_path']);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('PRAGMA foreign_keys = ON;');

  $db->exec('CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    passhash TEXT NOT NULL,
    tools TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0
  )');
}

function migrate_cuesheet_db(): void {
  $db = cuesheet_db();
  cuesheet_init_schema($db);
}

function migrate_dguv_db(): void {
  $db = dguv_db();
  dguv_init_schema($db);
}

function migrate_pdf_template_db(): void {
  // Schema wird durch pdf_template_db() via pdf_template_init_schema() automatisch angelegt.
  pdf_template_db();
}

/**
 * Stellt sicher, dass alle Admin-User den pdf_template_builder in ihrer
 * Tools-Liste haben, damit sie nach dem ersten Deploy sofort Zugriff erhalten.
 */
function migrate_grant_builder_to_admins(array $config): void {
  $db = new PDO('sqlite:' . (string)$config['db_path']);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $stmt = $db->query('SELECT id, tools FROM users WHERE is_admin = 1');
  $admins = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

  foreach ($admins as $admin) {
    try {
      $tools = json_decode((string)($admin['tools'] ?? '[]'), true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable) {
      $tools = [];
    }
    if (!is_array($tools)) {
      $tools = [];
    }
    if (!in_array('pdf_template_builder', $tools, true)) {
      $tools[] = 'pdf_template_builder';
      $upd = $db->prepare('UPDATE users SET tools = ? WHERE id = ?');
      $upd->execute([json_encode(array_values($tools), JSON_THROW_ON_ERROR), (int)$admin['id']]);
    }
  }
}

/**
 * Importiert die NEXUS-Konfiguration aus assets/JSON Datenbank NEXUS Patch.txt
 * als fertiges Patchmatrix-Dokument in die Datenbank.
 */
function migrate_patchmatrix_nexus_config(array $config): void {
  $dbPath = (string)$config['patchmatrix_db_path'] ?? (__DIR__ . '/patchmatrix.sqlite');
  $db = new PDO('sqlite:' . $dbPath);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('PRAGMA foreign_keys = ON;');

  patchmatrix_init_schema($db);

  // Prüfe, ob das Dokument bereits existiert
  $existing = $db->prepare('SELECT id FROM patchmatrix_documents WHERE title LIKE ?');
  $existing->execute(['%SLM%Nexus%']);
  if ($existing->fetch()) {
    return; // Dokument existiert bereits
  }

  // Lade die NEXUS-Konfiguration aus Assets
  $filePath = dirname(__DIR__) . '/assets/JSON Datenbank NEXUS Patch.txt';
  if (!file_exists($filePath)) {
    return; // Datei nicht gefunden
  }

  try {
    $rawJson = file_get_contents($filePath);
    if ($rawJson === false) {
      return;
    }
    $sourcePayload = json_decode($rawJson, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($sourcePayload)) {
      return;
    }
  } catch (Throwable) {
    return;
  }

  // Normalisiere die Payload
  $payload = patchmatrix_normalize_payload($sourcePayload);
  if (!is_array($payload)) {
    return;
  }

  // Repariere fehlende Ports, die in Patches referenziert werden
  $payload = migrate_patchmatrix_fixup_missing_ports($payload);

  // Bestimme den Benutzer (nutze ersten Admin oder system)
  $uid = 1;
  $username = 'System';
  try {
    $usersDb = new PDO('sqlite:' . (string)$config['db_path']);
    $usersDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Suche eine Admin
    $adminStmt = $usersDb->query('SELECT id, username FROM users WHERE is_admin = 1 LIMIT 1');
    if ($adminStmt) {
      $adminRow = $adminStmt->fetch(PDO::FETCH_ASSOC);
      if ($adminRow) {
        $uid = (int)$adminRow['id'];
        $username = (string)$adminRow['username'];
      }
    }
  } catch (Throwable) {
    // Fallback auf defaults
  }

  // Befülle Server-Metadaten
  $now = patchmatrix_iso_now();
  $title = 'SLM 001 - Nexus Konfiguration';
  $payload = patchmatrix_apply_server_meta($payload, $title, $now, $uid, $username);

  // Validiere die Payload
  $errors = patchmatrix_validate_payload($payload);
  if ($errors !== []) {
    return; // Validierungsfehler - Dokument nicht importieren
  }

  // Einfügen in die Datenbank
  $stmt = $db->prepare('INSERT INTO patchmatrix_documents
    (title, payload_json, version, created_at, created_by_user_id, created_by_username, updated_at, updated_by_user_id, updated_by_username)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)');
  
  $stmt->execute([
    $title,
    json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
    $now,
    $uid,
    $username,
    $now,
    $uid,
    $username,
  ]);
}

/**
 * Repariert fehlende Ports und entfernt ungültige Patches in der Payload.
 * - Generiert automatisch Ports für alle Patches, deren Quell- oder Ziel-Ports fehlen
 * - Entfernt Patches, die auf nicht existierende Karten beziehen
 */
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
      continue; // Karte existiert nicht - überspringe diesen Port
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

  // Filtere Patches, deren Ports auf nicht existierende Karten beziehen
  $validPatches = [];
  foreach ($payload['patches'] as $patch) {
    // Parse Karten-IDs aus den Port-IDs
    $sourceParts = explode('|', $patch['source_port_id']);
    $targetParts = explode('|', $patch['target_port_id']);
    
    $sourceCardId = $sourceParts[0] ?? '';
    $targetCardId = $targetParts[0] ?? '';
    
    // Überspringe Patches, deren Karten nicht existieren
    if (!isset($cardsById[$sourceCardId]) || !isset($cardsById[$targetCardId])) {
      continue;
    }
    
    $validPatches[] = $patch;
  }
  
  $payload['patches'] = $validPatches;

  return $payload;
}

/**
 * Benennt den Tool-Key "nti_tool" in users.tools JSON und pdf_templates auf
 * "pegelTool" um. Idempotent – kann beliebig oft ausgeführt werden.
 */
function migrate_rename_nti_tool_to_pegel_tool(array $config): void {
  // 1. users.sqlite: tools-JSON-Spalte
  $db = new PDO('sqlite:' . (string)$config['db_path']);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $stmt = $db->query('SELECT id, tools FROM users WHERE tools LIKE \'%"nti_tool"%\'');
  $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
  foreach ($rows as $row) {
    try {
      $tools = json_decode((string)($row['tools'] ?? '[]'), true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable) {
      $tools = [];
    }
    if (!is_array($tools)) {
      $tools = [];
    }
    $tools = array_map(static fn(string $t) => $t === 'nti_tool' ? 'pegelTool' : $t, $tools);
    $upd = $db->prepare('UPDATE users SET tools = ? WHERE id = ?');
    $upd->execute([json_encode(array_values($tools), JSON_THROW_ON_ERROR), (int)$row['id']]);
  }

  // 2. pdf_templates.sqlite: tool_key + title
  $pdfDb = new PDO('sqlite:' . (string)$config['pdf_template_db_path']);
  $pdfDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $pdfDb->exec('
    UPDATE pdf_templates
    SET tool_key = \'pegelTool\',
        title    = REPLACE(title, \'nti_tool\', \'pegelTool\')
    WHERE tool_key = \'nti_tool\'
  ');
  $pdfDb->exec('
    UPDATE pdf_template_revisions
    SET tool_key = \'pegelTool\',
        title    = REPLACE(title, \'nti_tool\', \'pegelTool\')
    WHERE tool_key = \'nti_tool\'
  ');
}

try {
  migrate_users_db($config);
  migrate_cuesheet_db();
  migrate_dguv_db();
  migrate_pdf_template_db();
  migrate_grant_builder_to_admins($config);
  migrate_rename_nti_tool_to_pegel_tool($config);
  migrate_patchmatrix_nexus_config($config);

  echo "OK: Migration abgeschlossen.\n";
  exit(0);
} catch (Throwable $e) {
  fwrite(STDERR, 'Migration fehlgeschlagen: ' . $e->getMessage() . "\n");
  exit(1);
}
