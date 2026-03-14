<?php
declare(strict_types=1);

$dataDirEnv = trim((string)(getenv('APP_DATA_DIR') ?: ''));
$dataDir = $dataDirEnv !== '' ? $dataDirEnv : __DIR__;

return [
  'site_name'    => 'Tools',
  'session_name' => 'TOOLSSESS',
  'tools_dir'    => __DIR__ . '/tools',
  'db_path'      => $dataDir . '/users.sqlite',
  'dguv_db_path' => $dataDir . '/dguv.sqlite',
  'cuesheet_db_path' => $dataDir . '/cuesheet.sqlite',
  'pdf_template_db_path' => $dataDir . '/pdf_templates.sqlite',
  'data_dir' => $dataDir,
  'dguv_agent_token' => getenv('DGUV_AGENT_TOKEN') ?: '',
];