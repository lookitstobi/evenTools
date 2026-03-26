<?php
declare(strict_types=1);

$dataDirEnv = trim((string)(getenv('APP_DATA_DIR') ?: ''));
$appDir = __DIR__;
$projectRoot = dirname(__DIR__);
$runtimeDataDir = $projectRoot . '/data';

// Decision logic for database directory:
// Priority: explicit APP_DATA_DIR > existing data/ with users > existing app/ with users > fresh setup > default app/
if ($dataDirEnv !== '') {
  $dataDir = $dataDirEnv;
} elseif (is_file($runtimeDataDir . '/users.sqlite')) {
  // IMPORTANT: Prefer data/ if it already has user data (indicates production setup)
  $dataDir = $runtimeDataDir;
} elseif (is_file($appDir . '/users.sqlite')) {
  // Fallback to app/ if it has user data (development/legacy)
  $dataDir = $appDir;
} elseif (is_dir($runtimeDataDir)) {
  // Fresh setup: if data/ exists, prefer it for new DBs
  $dataDir = $runtimeDataDir;
} else {
  // Ultimate fallback: use app/ directory
  $dataDir = $appDir;
}

// Warn if both databases exist (indicates possible duplicate data scenario)
if (is_file($appDir . '/users.sqlite') && is_file($runtimeDataDir . '/users.sqlite') && $dataDir === $appDir) {
  // Log warning: both DBs exist but we're using app/ - this might be a problem
  error_log('[TOOLSAPP CONFIG] WARNING: Both app/users.sqlite and data/users.sqlite exist! Using app/users.sqlite. Consider setting APP_DATA_DIR=/path/to/data');
}

return [
  'site_name'    => 'Tools',
  'session_name' => 'TOOLSSESS',
  'tools_dir'    => __DIR__ . '/tools',
  'db_path'      => $dataDir . '/users.sqlite',
  'dguv_db_path' => $dataDir . '/dguv.sqlite',
  'cuesheet_db_path' => $dataDir . '/cuesheet.sqlite',
  'pdf_template_db_path' => $dataDir . '/pdf_templates.sqlite',
  'patchmatrix_db_path' => $dataDir . '/patchmatrix.sqlite',
  'data_dir' => $dataDir,
  'dguv_agent_token' => getenv('DGUV_AGENT_TOKEN') ?: '',
];