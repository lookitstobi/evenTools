<?php
declare(strict_types=1);

function patchmatrix_db(): PDO {
  static $db = null;
  if ($db instanceof PDO) {
    return $db;
  }

  $config = require __DIR__ . '/config.php';
  $path = (string)($config['patchmatrix_db_path'] ?? (__DIR__ . '/patchmatrix.sqlite'));

  $db = new PDO('sqlite:' . $path);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('PRAGMA foreign_keys = ON;');

  patchmatrix_init_schema($db);

  return $db;
}

function patchmatrix_init_schema(PDO $db): void {
  $db->exec('CREATE TABLE IF NOT EXISTS patchmatrix_documents (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    created_by_user_id INTEGER NOT NULL,
    created_by_username TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by_user_id INTEGER NOT NULL,
    updated_by_username TEXT NOT NULL
  )');

  $db->exec('CREATE INDEX IF NOT EXISTS idx_patchmatrix_documents_updated ON patchmatrix_documents(updated_at)');
}

function patchmatrix_iso_now(): string {
  return gmdate('c');
}

function patchmatrix_require_tool_access(): void {
  require_login();
  if (!empty($_SESSION['is_admin'])) {
    return;
  }

  $allowed = $_SESSION['tools'] ?? [];
  if (!is_array($allowed) || !in_array('patchmatrix', $allowed, true)) {
    http_response_code(403);
    echo '403';
    exit;
  }
}

function patchmatrix_current_uid(): int {
  return (int)($_SESSION['uid'] ?? 0);
}

function patchmatrix_current_username(): string {
  return (string)($_SESSION['username'] ?? '');
}

function patchmatrix_default_payload(string $title = 'Neue Nexus Konfiguration'): array {
  return [
    'schema_version' => 1,
    'meta' => [
      'title' => $title,
      'location' => '',
      'show_or_project' => '',
      'notes' => '',
      'created_at' => '',
      'updated_at' => '',
      'created_by' => [
        'user_id' => 0,
        'username' => '',
      ],
      'updated_by' => [
        'user_id' => 0,
        'username' => '',
      ],
    ],
    'base_devices' => [],
    'cards' => [],
    'ports' => [],
    'patches' => [],
  ];
}

function patchmatrix_apply_server_meta(array $payload, string $title, string $now, int $uid, string $username, ?array $existingMeta = null): array {
  if (!is_array($payload['meta'] ?? null)) {
    $payload['meta'] = [];
  }

  $existingCreatedAt = '';
  $existingCreatedBy = ['user_id' => 0, 'username' => ''];
  if (is_array($existingMeta)) {
    $existingCreatedAt = trim((string)($existingMeta['created_at'] ?? ''));
    $rawCreatedBy = $existingMeta['created_by'] ?? null;
    if (is_array($rawCreatedBy)) {
      $existingCreatedBy = [
        'user_id' => (int)($rawCreatedBy['user_id'] ?? 0),
        'username' => trim((string)($rawCreatedBy['username'] ?? '')),
      ];
    }
  }

  $createdAt = $existingCreatedAt !== '' ? $existingCreatedAt : $now;
  if ($existingCreatedBy['user_id'] <= 0 && $existingCreatedBy['username'] === '') {
    $existingCreatedBy = ['user_id' => $uid, 'username' => $username];
  }

  $payload['schema_version'] = 1;
  $payload['meta']['title'] = $title;
  $payload['meta']['created_at'] = $createdAt;
  $payload['meta']['updated_at'] = $now;
  $payload['meta']['created_by'] = $existingCreatedBy;
  $payload['meta']['updated_by'] = [
    'user_id' => $uid,
    'username' => $username,
  ];

  return $payload;
}

function patchmatrix_normalize_payload(array $payload): array {
  $base = patchmatrix_default_payload(trim((string)($payload['meta']['title'] ?? 'Neue Nexus Konfiguration')));
  $base['schema_version'] = max(1, (int)($payload['schema_version'] ?? 1));

  $meta = $payload['meta'] ?? [];
  if (is_array($meta)) {
    $base['meta']['title'] = trim((string)($meta['title'] ?? $base['meta']['title']));
    $base['meta']['location'] = trim((string)($meta['location'] ?? ''));
    $base['meta']['show_or_project'] = trim((string)($meta['show_or_project'] ?? ''));
    $base['meta']['notes'] = trim((string)($meta['notes'] ?? ''));
    $base['meta']['created_at'] = trim((string)($meta['created_at'] ?? ''));
    $base['meta']['updated_at'] = trim((string)($meta['updated_at'] ?? ''));

    $createdBy = $meta['created_by'] ?? null;
    if (is_array($createdBy)) {
      $base['meta']['created_by'] = [
        'user_id' => (int)($createdBy['user_id'] ?? 0),
        'username' => trim((string)($createdBy['username'] ?? '')),
      ];
    }

    $updatedBy = $meta['updated_by'] ?? null;
    if (is_array($updatedBy)) {
      $base['meta']['updated_by'] = [
        'user_id' => (int)($updatedBy['user_id'] ?? 0),
        'username' => trim((string)($updatedBy['username'] ?? '')),
      ];
    }
  }

  $baseDevices = $payload['base_devices'] ?? $payload['baseDevices'] ?? [];
  if (is_array($baseDevices)) {
    $normalizedBaseDevices = [];
    foreach ($baseDevices as $idx => $item) {
      if (!is_array($item)) {
        continue;
      }
      $id = trim((string)($item['id'] ?? ''));
      if ($id === '') {
        continue;
      }

      $normalizedBaseDevices[] = [
        'id' => $id,
        'name' => trim((string)($item['name'] ?? '')),
        'room' => trim((string)($item['room'] ?? '')),
        'sort_order' => max(1, (int)($item['sort_order'] ?? ($idx + 1))),
        'note' => trim((string)($item['note'] ?? '')),
      ];
    }
    $base['base_devices'] = $normalizedBaseDevices;
  }

  $cards = $payload['cards'] ?? [];
  if (is_array($cards)) {
    $normalizedCards = [];
    foreach ($cards as $idx => $item) {
      if (!is_array($item)) {
        continue;
      }
      $id = trim((string)($item['id'] ?? ''));
      if ($id === '') {
        continue;
      }

      $defaults = is_array($item['defaults'] ?? null) ? $item['defaults'] : [];
      $autoPairs = $defaults['auto_link_pairs'] ?? $item['autoPairs'] ?? [];
      if (!is_array($autoPairs)) {
        $autoPairs = [];
      }
      $normalizedPairs = [];
      foreach ($autoPairs as $pairValue) {
        $pair = (int)$pairValue;
        if ($pair > 0) {
          $normalizedPairs[] = $pair;
        }
      }
      $normalizedPairs = array_values(array_unique($normalizedPairs));
      sort($normalizedPairs, SORT_NUMERIC);

      $normalizedCards[] = [
        'id' => $id,
        'base_device_id' => trim((string)($item['base_device_id'] ?? $item['bdId'] ?? '')),
        'name' => trim((string)($item['name'] ?? '')),
        'kind' => trim((string)($item['kind'] ?? '')),
        'sort_order' => max(1, (int)($item['sort_order'] ?? ($idx + 1))),
        'note' => trim((string)($item['note'] ?? '')),
        'defaults' => [
          'input_count' => max(0, (int)($defaults['input_count'] ?? $item['inN'] ?? 0)),
          'output_count' => max(0, (int)($defaults['output_count'] ?? $item['outN'] ?? 0)),
          'input_prefix' => trim((string)($defaults['input_prefix'] ?? $item['inPrefix'] ?? '')),
          'output_prefix' => trim((string)($defaults['output_prefix'] ?? $item['outPrefix'] ?? '')),
          'input_numeric_start' => patchmatrix_optional_int($defaults['input_numeric_start'] ?? $item['inIdStart'] ?? null),
          'output_numeric_start' => patchmatrix_optional_int($defaults['output_numeric_start'] ?? $item['outIdStart'] ?? null),
          'auto_link_mode' => patchmatrix_normalize_auto_link_mode((string)($defaults['auto_link_mode'] ?? $item['autoMode'] ?? 'none')),
          'auto_link_pairs' => $normalizedPairs,
        ],
      ];
    }
    $base['cards'] = $normalizedCards;
  }

  $ports = $payload['ports'] ?? [];
  if (is_array($ports)) {
    $normalizedPorts = [];
    foreach ($ports as $item) {
      if (!is_array($item)) {
        continue;
      }
      $id = trim((string)($item['id'] ?? ''));
      if ($id === '') {
        continue;
      }

      $tags = $item['tags'] ?? [];
      if (!is_array($tags)) {
        $tags = [];
      }
      $normalizedTags = [];
      foreach ($tags as $tag) {
        $clean = trim((string)$tag);
        if ($clean !== '') {
          $normalizedTags[] = $clean;
        }
      }
      $normalizedTags = array_values(array_unique($normalizedTags));

      $normalizedPorts[] = [
        'id' => $id,
        'card_id' => trim((string)($item['card_id'] ?? $item['cardId'] ?? '')),
        'base_device_id' => trim((string)($item['base_device_id'] ?? $item['bdId'] ?? '')),
        'direction' => patchmatrix_normalize_direction((string)($item['direction'] ?? $item['dir'] ?? '')),
        'index' => max(1, (int)($item['index'] ?? $item['idx'] ?? 1)),
        'numeric_id' => patchmatrix_optional_int($item['numeric_id'] ?? $item['numId'] ?? null),
        'name' => trim((string)($item['name'] ?? '')),
        'label' => trim((string)($item['label'] ?? '')),
        'group' => trim((string)($item['group'] ?? '')),
        'note' => trim((string)($item['note'] ?? '')),
        'tags' => $normalizedTags,
        'is_virtual' => patchmatrix_to_bool($item['is_virtual'] ?? false),
        'is_locked' => patchmatrix_to_bool($item['is_locked'] ?? false),
        'is_auto_generated' => patchmatrix_to_bool($item['is_auto_generated'] ?? false),
      ];
    }
    $base['ports'] = $normalizedPorts;
  }

  $patches = $payload['patches'] ?? [];
  if (!is_array($patches) || $patches === []) {
    $patches = patchmatrix_legacy_patches_from_payload($payload);
  }

  if (is_array($patches)) {
    $normalizedPatches = [];
    foreach ($patches as $item) {
      if (!is_array($item)) {
        continue;
      }
      $sourcePortId = trim((string)($item['source_port_id'] ?? $item['sourcePortId'] ?? $item['source'] ?? ''));
      $targetPortId = trim((string)($item['target_port_id'] ?? $item['targetPortId'] ?? $item['target'] ?? ''));
      if ($sourcePortId === '' || $targetPortId === '') {
        continue;
      }

      $patchType = patchmatrix_normalize_patch_type((string)($item['patch_type'] ?? $item['patchType'] ?? 'crosspoint'));
      $state = patchmatrix_normalize_patch_state((string)($item['state'] ?? 'active'));
      $patchId = trim((string)($item['id'] ?? ''));
      if ($patchId === '') {
        $patchId = sha1($sourcePortId . '|' . $targetPortId . '|' . $patchType);
      }

      $updatedBy = $item['updated_by'] ?? null;
      if (!is_array($updatedBy)) {
        $updatedBy = [];
      }

      $normalizedPatches[] = [
        'id' => $patchId,
        'source_port_id' => $sourcePortId,
        'target_port_id' => $targetPortId,
        'patch_type' => $patchType,
        'state' => $state,
        'note' => trim((string)($item['note'] ?? '')),
        'created_at' => trim((string)($item['created_at'] ?? $item['createdAt'] ?? '')),
        'updated_at' => trim((string)($item['updated_at'] ?? $item['updatedAt'] ?? '')),
        'updated_by' => [
          'user_id' => (int)($updatedBy['user_id'] ?? 0),
          'username' => trim((string)($updatedBy['username'] ?? '')),
        ],
      ];
    }
    $base['patches'] = $normalizedPatches;
  }

  return $base;
}

function patchmatrix_validate_payload(array $payload): array {
  $errors = [];

  $baseDevices = is_array($payload['base_devices'] ?? null) ? $payload['base_devices'] : [];
  $cards = is_array($payload['cards'] ?? null) ? $payload['cards'] : [];
  $ports = is_array($payload['ports'] ?? null) ? $payload['ports'] : [];
  $patches = is_array($payload['patches'] ?? null) ? $payload['patches'] : [];

  $baseDeviceById = [];
  foreach ($baseDevices as $idx => $row) {
    if (!is_array($row)) {
      $errors[] = ['path' => 'base_devices[' . $idx . ']', 'message' => 'invalid_object'];
      continue;
    }

    $id = trim((string)($row['id'] ?? ''));
    if ($id === '') {
      $errors[] = ['path' => 'base_devices[' . $idx . '].id', 'message' => 'missing_id'];
      continue;
    }
    if (isset($baseDeviceById[$id])) {
      $errors[] = ['path' => 'base_devices[' . $idx . '].id', 'message' => 'duplicate_id'];
      continue;
    }
    $baseDeviceById[$id] = true;
  }

  $cardById = [];
  foreach ($cards as $idx => $row) {
    if (!is_array($row)) {
      $errors[] = ['path' => 'cards[' . $idx . ']', 'message' => 'invalid_object'];
      continue;
    }

    $id = trim((string)($row['id'] ?? ''));
    if ($id === '') {
      $errors[] = ['path' => 'cards[' . $idx . '].id', 'message' => 'missing_id'];
      continue;
    }
    if (isset($cardById[$id])) {
      $errors[] = ['path' => 'cards[' . $idx . '].id', 'message' => 'duplicate_id'];
      continue;
    }

    $baseDeviceId = trim((string)($row['base_device_id'] ?? ''));
    if ($baseDeviceId === '' || !isset($baseDeviceById[$baseDeviceId])) {
      $errors[] = ['path' => 'cards[' . $idx . '].base_device_id', 'message' => 'unknown_base_device'];
    }

    $cardById[$id] = $baseDeviceId;
  }

  $portById = [];
  foreach ($ports as $idx => $row) {
    if (!is_array($row)) {
      $errors[] = ['path' => 'ports[' . $idx . ']', 'message' => 'invalid_object'];
      continue;
    }

    $id = trim((string)($row['id'] ?? ''));
    if ($id === '') {
      $errors[] = ['path' => 'ports[' . $idx . '].id', 'message' => 'missing_id'];
      continue;
    }
    if (isset($portById[$id])) {
      $errors[] = ['path' => 'ports[' . $idx . '].id', 'message' => 'duplicate_id'];
      continue;
    }

    $cardId = trim((string)($row['card_id'] ?? ''));
    if ($cardId === '' || !array_key_exists($cardId, $cardById)) {
      $errors[] = ['path' => 'ports[' . $idx . '].card_id', 'message' => 'unknown_card'];
    }

    $baseDeviceId = trim((string)($row['base_device_id'] ?? ''));
    if ($baseDeviceId === '' || !isset($baseDeviceById[$baseDeviceId])) {
      $errors[] = ['path' => 'ports[' . $idx . '].base_device_id', 'message' => 'unknown_base_device'];
    } elseif ($cardId !== '' && array_key_exists($cardId, $cardById) && $cardById[$cardId] !== '' && $cardById[$cardId] !== $baseDeviceId) {
      $errors[] = ['path' => 'ports[' . $idx . '].base_device_id', 'message' => 'card_base_device_mismatch'];
    }

    $direction = patchmatrix_normalize_direction((string)($row['direction'] ?? ''));
    if ($direction === '') {
      $errors[] = ['path' => 'ports[' . $idx . '].direction', 'message' => 'invalid_direction'];
    }

    $index = (int)($row['index'] ?? 0);
    if ($index <= 0) {
      $errors[] = ['path' => 'ports[' . $idx . '].index', 'message' => 'invalid_index'];
    }

    $portById[$id] = [
      'direction' => $direction,
      'base_device_id' => $baseDeviceId,
      'card_id' => $cardId,
    ];
  }

  $patchIds = [];
  $activeTargets = [];
  $activePairs = [];

  foreach ($patches as $idx => $row) {
    if (!is_array($row)) {
      $errors[] = ['path' => 'patches[' . $idx . ']', 'message' => 'invalid_object'];
      continue;
    }

    $id = trim((string)($row['id'] ?? ''));
    if ($id === '') {
      $errors[] = ['path' => 'patches[' . $idx . '].id', 'message' => 'missing_id'];
    } elseif (isset($patchIds[$id])) {
      $errors[] = ['path' => 'patches[' . $idx . '].id', 'message' => 'duplicate_id'];
    } else {
      $patchIds[$id] = true;
    }
    $activePatchRef = $id !== '' ? $id : '__idx_' . $idx;

    $sourcePortId = trim((string)($row['source_port_id'] ?? ''));
    $targetPortId = trim((string)($row['target_port_id'] ?? ''));
    if ($sourcePortId === '' || !isset($portById[$sourcePortId])) {
      $errors[] = ['path' => 'patches[' . $idx . '].source_port_id', 'message' => 'unknown_port'];
      continue;
    }
    if ($targetPortId === '' || !isset($portById[$targetPortId])) {
      $errors[] = ['path' => 'patches[' . $idx . '].target_port_id', 'message' => 'unknown_port'];
      continue;
    }

    if ($sourcePortId === $targetPortId) {
      $errors[] = ['path' => 'patches[' . $idx . ']', 'message' => 'self_link_not_allowed'];
    }

    if (($portById[$sourcePortId]['direction'] ?? '') !== 'output') {
      $errors[] = ['path' => 'patches[' . $idx . '].source_port_id', 'message' => 'source_must_be_output'];
    }

    if (($portById[$targetPortId]['direction'] ?? '') !== 'input') {
      $errors[] = ['path' => 'patches[' . $idx . '].target_port_id', 'message' => 'target_must_be_input'];
    }

    $patchType = patchmatrix_normalize_patch_type((string)($row['patch_type'] ?? ''));
    if ($patchType === '') {
      $errors[] = ['path' => 'patches[' . $idx . '].patch_type', 'message' => 'invalid_patch_type'];
    }

    $state = patchmatrix_normalize_patch_state((string)($row['state'] ?? ''));
    if ($state === '') {
      $errors[] = ['path' => 'patches[' . $idx . '].state', 'message' => 'invalid_state'];
      continue;
    }

    if ($state === 'active') {
      if (isset($activeTargets[$targetPortId]) && $activeTargets[$targetPortId] !== $activePatchRef) {
        $errors[] = ['path' => 'patches[' . $idx . '].target_port_id', 'message' => 'target_already_patched'];
      } else {
        $activeTargets[$targetPortId] = $activePatchRef;
      }

      $pairKey = $sourcePortId . '>' . $targetPortId;
      if (isset($activePairs[$pairKey])) {
        $errors[] = ['path' => 'patches[' . $idx . ']', 'message' => 'duplicate_active_pair'];
      } else {
        $activePairs[$pairKey] = true;
      }
    }
  }

  return $errors;
}

function patchmatrix_optional_int(mixed $value): ?int {
  if ($value === null || $value === '') {
    return null;
  }
  if (!is_numeric($value)) {
    return null;
  }
  return (int)$value;
}

function patchmatrix_to_bool(mixed $value): bool {
  if (is_bool($value)) {
    return $value;
  }
  if (is_int($value) || is_float($value)) {
    return (int)$value !== 0;
  }
  $normalized = strtolower(trim((string)$value));
  return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
}

function patchmatrix_normalize_direction(string $direction): string {
  $v = strtolower(trim($direction));
  if ($v === 'in' || $v === 'input') {
    return 'input';
  }
  if ($v === 'out' || $v === 'output') {
    return 'output';
  }
  return '';
}

function patchmatrix_normalize_auto_link_mode(string $mode): string {
  $v = strtolower(trim($mode));
  return in_array($v, ['none', 'all', 'custom'], true) ? $v : 'none';
}

function patchmatrix_normalize_patch_type(string $patchType): string {
  $v = strtolower(trim($patchType));
  return in_array($v, ['fixed', 'crosspoint'], true) ? $v : '';
}

function patchmatrix_normalize_patch_state(string $state): string {
  $v = strtolower(trim($state));
  return in_array($v, ['active', 'disabled'], true) ? $v : '';
}

function patchmatrix_legacy_patches_from_payload(array $payload): array {
  $patches = [];

  $fixedLinks = $payload['fixedLinks'] ?? [];
  if (is_array($fixedLinks)) {
    foreach ($fixedLinks as $entry) {
      if (!is_string($entry) || trim($entry) === '') {
        continue;
      }
      $parsed = patchmatrix_parse_legacy_link($entry);
      if ($parsed === null) {
        continue;
      }
      $patches[] = [
        'id' => sha1('fixed|' . $parsed['source_port_id'] . '|' . $parsed['target_port_id']),
        'source_port_id' => $parsed['source_port_id'],
        'target_port_id' => $parsed['target_port_id'],
        'patch_type' => 'fixed',
        'state' => 'active',
        'note' => '',
        'created_at' => '',
        'updated_at' => '',
        'updated_by' => ['user_id' => 0, 'username' => ''],
      ];
    }
  }

  $crosspoints = $payload['crosspoints'] ?? [];
  if (is_array($crosspoints)) {
    foreach ($crosspoints as $entry) {
      if (is_string($entry)) {
        $parsed = patchmatrix_parse_legacy_link($entry);
        if ($parsed === null) {
          continue;
        }
        $patches[] = [
          'id' => sha1('crosspoint|' . $parsed['source_port_id'] . '|' . $parsed['target_port_id']),
          'source_port_id' => $parsed['source_port_id'],
          'target_port_id' => $parsed['target_port_id'],
          'patch_type' => 'crosspoint',
          'state' => 'active',
          'note' => '',
          'created_at' => '',
          'updated_at' => '',
          'updated_by' => ['user_id' => 0, 'username' => ''],
        ];
        continue;
      }

      if (!is_array($entry)) {
        continue;
      }

      $sourcePortId = trim((string)($entry['source_port_id'] ?? $entry['sourcePortId'] ?? $entry['source'] ?? ''));
      $targetPortId = trim((string)($entry['target_port_id'] ?? $entry['targetPortId'] ?? $entry['target'] ?? ''));
      if ($sourcePortId === '' || $targetPortId === '') {
        continue;
      }

      $patches[] = [
        'id' => sha1('crosspoint|' . $sourcePortId . '|' . $targetPortId),
        'source_port_id' => $sourcePortId,
        'target_port_id' => $targetPortId,
        'patch_type' => 'crosspoint',
        'state' => 'active',
        'note' => '',
        'created_at' => '',
        'updated_at' => '',
        'updated_by' => ['user_id' => 0, 'username' => ''],
      ];
    }
  }

  return $patches;
}

function patchmatrix_parse_legacy_link(string $value): ?array {
  $parts = explode('|', trim($value));
  if (count($parts) !== 6) {
    return null;
  }

  $source = implode('|', array_slice($parts, 0, 3));
  $target = implode('|', array_slice($parts, 3, 3));

  if ($source === '' || $target === '') {
    return null;
  }

  return [
    'source_port_id' => $source,
    'target_port_id' => $target,
  ];
}

function patchmatrix_fetch_row(PDO $db, int $id): ?array {
  $stmt = $db->prepare('SELECT * FROM patchmatrix_documents WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  return is_array($row) ? $row : null;
}
