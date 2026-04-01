<?php
declare(strict_types=1);

/**
 * Golden-Master Preflight Check fuer PDF-Template-Faelle.
 *
 * Usage:
 *   php scripts/pdf_golden_master_check.php
 *   php scripts/pdf_golden_master_check.php --db-check
 */

$root = dirname(__DIR__);
$casesFile = $root . '/docs/pdf_template_golden_master_cases.json';

if (!is_file($casesFile)) {
  fwrite(STDERR, "[FAIL] Cases file fehlt: {$casesFile}\n");
  exit(1);
}

$raw = file_get_contents($casesFile);
if ($raw === false || trim($raw) === '') {
  fwrite(STDERR, "[FAIL] Cases file ist leer oder nicht lesbar.\n");
  exit(1);
}

try {
  /** @var mixed $decoded */
  $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
  fwrite(STDERR, "[FAIL] JSON Syntaxfehler: " . $e->getMessage() . "\n");
  exit(1);
}

if (!is_array($decoded)) {
  fwrite(STDERR, "[FAIL] Root muss ein Objekt sein.\n");
  exit(1);
}

$errors = [];
$warnings = [];

$version = (int)($decoded['version'] ?? 0);
if ($version < 1) {
  $errors[] = 'version fehlt oder ist ungueltig (>=1 erwartet).';
}

$tolerance = (float)($decoded['tolerance_mm'] ?? 0.0);
if ($tolerance <= 0.0) {
  $errors[] = 'tolerance_mm muss > 0 sein.';
} elseif ($tolerance > 0.5) {
  $errors[] = 'tolerance_mm verletzt striktes Gate (<= 0.5 mm).';
}

$cases = $decoded['cases'] ?? null;
if (!is_array($cases)) {
  $errors[] = 'cases fehlt oder ist kein Array.';
  $cases = [];
}

$count = count($cases);
if ($count < 5 || $count > 8) {
  $errors[] = 'cases muss zwischen 5 und 8 Eintraegen enthalten.';
}

$validToolKeys = ['pegelTool', 'dguv_v3', 'cuesheet', 'patchmatrix'];
$seenIds = [];

foreach ($cases as $idx => $case) {
  $prefix = 'case[' . $idx . ']';
  if (!is_array($case)) {
    $errors[] = $prefix . ' muss ein Objekt sein.';
    continue;
  }

  $id = trim((string)($case['id'] ?? ''));
  if ($id === '') {
    $errors[] = $prefix . '.id fehlt.';
  } elseif (isset($seenIds[$id])) {
    $errors[] = $prefix . '.id ist nicht eindeutig: ' . $id;
  } else {
    $seenIds[$id] = true;
  }

  $toolKey = trim((string)($case['tool_key'] ?? ''));
  if ($toolKey === '') {
    $errors[] = $prefix . '.tool_key fehlt.';
  } elseif (!in_array($toolKey, $validToolKeys, true)) {
    $errors[] = $prefix . '.tool_key ungueltig: ' . $toolKey;
  }

  $title = trim((string)($case['template_title'] ?? ''));
  if ($title === '') {
    $errors[] = $prefix . '.template_title fehlt.';
  }

  $focus = $case['focus'] ?? null;
  if (!is_array($focus) || $focus === []) {
    $errors[] = $prefix . '.focus muss ein nicht-leeres Array sein.';
  }

  $checks = $case['checks'] ?? null;
  if (!is_array($checks) || $checks === []) {
    $errors[] = $prefix . '.checks muss ein nicht-leeres Array sein.';
  }
}

$dbCheck = in_array('--db-check', $argv, true);
if ($dbCheck && $cases !== []) {
  $config = require $root . '/app/config.php';
  $dbPath = (string)($config['pdf_template_db_path'] ?? '');
  if ($dbPath === '' || !is_file($dbPath)) {
    $warnings[] = 'DB-Check uebersprungen: pdf_template_db_path nicht gefunden.';
  } else {
    try {
      $pdo = new PDO('sqlite:' . $dbPath);
      $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
      $stmt = $pdo->prepare('SELECT COUNT(*) FROM pdf_templates WHERE deleted_at IS NULL AND tool_key = ? AND title = ?');

      foreach ($cases as $idx => $case) {
        if (!is_array($case)) {
          continue;
        }
        $toolKey = trim((string)($case['tool_key'] ?? ''));
        $title = trim((string)($case['template_title'] ?? ''));
        if ($toolKey === '' || $title === '') {
          continue;
        }

        $stmt->execute([$toolKey, $title]);
        $found = (int)$stmt->fetchColumn();
        if ($found === 0) {
          $warnings[] = 'Kein Template in DB gefunden fuer: ' . $toolKey . ' / ' . $title;
        }
      }
    } catch (Throwable $e) {
      $warnings[] = 'DB-Check fehlgeschlagen: ' . $e->getMessage();
    }
  }
}

if ($errors !== []) {
  fwrite(STDERR, "[FAIL] Golden-Master Preflight fehlgeschlagen:\n");
  foreach ($errors as $line) {
    fwrite(STDERR, '  - ' . $line . "\n");
  }
  if ($warnings !== []) {
    fwrite(STDERR, "[WARN]\n");
    foreach ($warnings as $line) {
      fwrite(STDERR, '  - ' . $line . "\n");
    }
  }
  exit(1);
}

fwrite(STDOUT, "[OK] Golden-Master Preflight erfolgreich.\n");
fwrite(STDOUT, '  - version: ' . $version . "\n");
fwrite(STDOUT, '  - tolerance_mm: ' . number_format($tolerance, 3, '.', '') . "\n");
fwrite(STDOUT, '  - cases: ' . $count . "\n");

if ($warnings !== []) {
  fwrite(STDOUT, "[WARN]\n");
  foreach ($warnings as $line) {
    fwrite(STDOUT, '  - ' . $line . "\n");
  }
}

exit(0);
