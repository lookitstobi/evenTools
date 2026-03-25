<?php
declare(strict_types=1);

$dataDirEnv = trim((string)(getenv('APP_DATA_DIR') ?: ''));
$appDir = __DIR__;
$projectRoot = dirname(__DIR__);
$runtimeDataDir = $projectRoot . '/data';

if ($dataDirEnv !== '') {
  $dataDir = $dataDirEnv;
} elseif (is_file($runtimeDataDir . '/users.sqlite')) {
  // Prefer the shared runtime data directory if it already contains user data.
  $dataDir = $runtimeDataDir;
} elseif (is_dir($runtimeDataDir) && !is_file($appDir . '/users.sqlite')) {
  // Fresh setups with a data directory should initialize DBs there.
  $dataDir = $runtimeDataDir;
} else {
  $dataDir = $appDir;
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