<?php
declare(strict_types=1);

function usage(): void {
  echo "DGUV Device Agent\n";
  echo "\n";
  echo "Usage:\n";
  echo "  php dguv_device_agent.php --api=http://host/dguv_api.php --token=SECRET --export-json=/path/device_export.json [--agent-name=device-bridge-1] [--export-cmd='path/to/bridge {json}'] [--interval=3] [--once]\n";
  echo "\n";
  echo "Optional import push:\n";
  echo "  --import-json=/path/device_import.json\n";
  echo "\n";
  echo "Hinweis:\n";
  echo "  Mindestens einer der Modi muss konfiguriert sein: --export-json oder --import-json\n";
}

$options = getopt('', [
  'api:',
  'token:',
  'agent-name::',
  'export-json:',
  'export-cmd::',
  'import-json::',
  'interval::',
  'once',
  'help',
]);

if ($options === false || isset($options['help'])) {
  usage();
  exit(isset($options['help']) ? 0 : 1);
}

$api = trim((string)($options['api'] ?? ''));
$token = trim((string)($options['token'] ?? ''));
$agentName = trim((string)($options['agent-name'] ?? 'device-bridge-1'));
$exportJsonPath = trim((string)($options['export-json'] ?? ''));
$exportCmd = trim((string)($options['export-cmd'] ?? ''));
$importJsonPath = trim((string)($options['import-json'] ?? ''));
$interval = max(1, (int)($options['interval'] ?? 3));
$once = array_key_exists('once', $options);

if ($api === '' || $token === '' || ($exportJsonPath === '' && $importJsonPath === '')) {
  usage();
  exit(1);
}

$hasExportMode = $exportJsonPath !== '';
$hasImportMode = $importJsonPath !== '';

if ($hasExportMode) {
  $exportDir = dirname($exportJsonPath);
  if (!is_dir($exportDir)) {
    if (!mkdir($exportDir, 0770, true) && !is_dir($exportDir)) {
      fwrite(STDERR, "Export-Verzeichnis kann nicht erstellt werden: {$exportDir}\n");
      exit(1);
    }
  }
}

function post_json(string $url, string $token, array $payload): array {
  $ch = curl_init($url);
  if ($ch === false) {
    throw new RuntimeException('curl_init_failed');
  }

  $json = json_encode($payload, JSON_THROW_ON_ERROR);

  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
      'Content-Type: application/json',
      'X-DGUV-Agent-Token: ' . $token,
    ],
    CURLOPT_POSTFIELDS => $json,
    CURLOPT_TIMEOUT => 25,
  ]);

  $raw = curl_exec($ch);
  if ($raw === false) {
    $error = curl_error($ch);
    curl_close($ch);
    throw new RuntimeException('curl_exec_failed:' . $error);
  }

  $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);

  $decoded = json_decode($raw, true);
  if (!is_array($decoded)) {
    throw new RuntimeException('invalid_json_response');
  }

  if ($status < 200 || $status >= 300 || empty($decoded['ok'])) {
    $error = (string)($decoded['error'] ?? 'http_' . $status);
    throw new RuntimeException('api_error:' . $error);
  }

  return $decoded;
}

function atomic_write_file(string $path, string $content): void {
  $tmp = $path . '.tmp.' . getmypid() . '.' . bin2hex(random_bytes(4));
  if (file_put_contents($tmp, $content) === false) {
    throw new RuntimeException('write_tmp_failed');
  }

  if (!rename($tmp, $path)) {
    @unlink($tmp);
    throw new RuntimeException('rename_tmp_failed');
  }
}

function run_cmd_if_set(string $template, string $jsonPath): void {
  if ($template === '') {
    return;
  }

  $quotedJson = escapeshellarg($jsonPath);
  $command = str_replace('{json}', $quotedJson, $template);
  passthru($command, $exitCode);
  if ($exitCode !== 0) {
    throw new RuntimeException('command_failed_exit_' . $exitCode);
  }
}

function process_export_job(string $api, string $token, string $agentName, string $exportJsonPath, string $exportCmd): bool {
  $claim = post_json($api . '?action=agent_claim_device_job', $token, ['agent_name' => $agentName]);
  $job = $claim['job'] ?? null;

  if (!is_array($job) || !$job) {
    return false;
  }

  $jobId = (int)($job['id'] ?? 0);
  if ($jobId <= 0) {
    return false;
  }

  $success = false;
  $errorText = '';

  try {
    $payload = $job['payload'] ?? [];
    if (!is_array($payload)) {
      $payload = [];
    }

    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    atomic_write_file($exportJsonPath, $json . "\n");
    run_cmd_if_set($exportCmd, $exportJsonPath);
    $success = true;
  } catch (Throwable $e) {
    $errorText = $e->getMessage();
  }

  post_json($api . '?action=agent_finish_device_job', $token, [
    'job_id' => $jobId,
    'success' => $success,
    'error_text' => $errorText,
    'agent_meta' => ['agent_name' => $agentName, 'processed_at' => gmdate('c')],
  ]);

  if ($success) {
    echo '[' . gmdate('c') . "] export job {$jobId} done\n";
  } else {
    echo '[' . gmdate('c') . "] export job {$jobId} failed: {$errorText}\n";
  }

  return true;
}

function process_import_file(string $api, string $token, string $agentName, string $importJsonPath): void {
  if ($importJsonPath === '' || !is_file($importJsonPath)) {
    return;
  }

  $raw = file_get_contents($importJsonPath);
  if ($raw === false || trim($raw) === '') {
    return;
  }

  $rows = json_decode($raw, true);
  if (!is_array($rows)) {
    throw new RuntimeException('import_file_invalid_json');
  }

  post_json($api . '?action=agent_push_import', $token, [
    'source_name' => 'device_agent:' . $agentName,
    'source_format' => 'json',
    'rows' => $rows,
  ]);

  $archived = $importJsonPath . '.imported.' . gmdate('Ymd_His') . '.' . getmypid() . '.' . bin2hex(random_bytes(3));
  if (!rename($importJsonPath, $archived)) {
    throw new RuntimeException('import_file_archive_failed');
  }

  echo '[' . gmdate('c') . "] import file pushed: {$archived}\n";
}

echo "DGUV Device Agent gestartet ({$agentName})\n";

do {
  try {
    if ($hasImportMode) {
      process_import_file($api, $token, $agentName, $importJsonPath);
    }

    $processed = false;
    if ($hasExportMode) {
      $processed = process_export_job($api, $token, $agentName, $exportJsonPath, $exportCmd);
    }

    if (!$processed) {
      echo '[' . gmdate('c') . "] keine Device-Jobs\n";
    }
  } catch (Throwable $e) {
    fwrite(STDERR, '[' . gmdate('c') . '] Fehler: ' . $e->getMessage() . "\n");
  }

  if ($once) {
    break;
  }

  sleep($interval);
} while (true);
