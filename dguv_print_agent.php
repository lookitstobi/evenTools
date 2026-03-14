<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
  http_response_code(400);
  echo "CLI only\n";
  exit(1);
}

function usage(): void {
  echo "DGUV CSV Print Agent\n";
  echo "Usage:\n";
  echo "  php dguv_print_agent.php --api=https://eventools.site/dguv_api.php --token=SECRET --csv=/path/labels.csv [--agent-name=brother-pc-1] [--open-cmd='path/to/program {csv}'] [--print-cmd='path/to/program --print {csv}'] [--interval=3] [--once]\n";
}

$options = getopt('', [
  'api:',
  'token:',
  'csv:',
  'agent-name::',
  'open-cmd::',
  'print-cmd::',
  'interval::',
  'once',
  'help',
]);

if (isset($options['help'])) {
  usage();
  exit(0);
}

$api = trim((string)($options['api'] ?? ''));
$token = trim((string)($options['token'] ?? ''));
$csvPath = trim((string)($options['csv'] ?? ''));
$agentName = trim((string)($options['agent-name'] ?? gethostname() ?: 'dguv-agent'));
$openCmd = trim((string)($options['open-cmd'] ?? ''));
$printCmd = trim((string)($options['print-cmd'] ?? ''));
$interval = max(1, (int)($options['interval'] ?? 3));
$once = isset($options['once']);

if ($api === '' || $token === '' || $csvPath === '') {
  usage();
  exit(1);
}

if (!str_starts_with($api, 'http://') && !str_starts_with($api, 'https://')) {
  fwrite(STDERR, "API URL muss mit http:// oder https:// starten\n");
  exit(1);
}

$csvDir = dirname($csvPath);
if (!is_dir($csvDir)) {
  if (!mkdir($csvDir, 0770, true) && !is_dir($csvDir)) {
    fwrite(STDERR, "CSV Verzeichnis kann nicht erstellt werden: {$csvDir}\n");
    exit(1);
  }
}

function post_json(string $url, array $payload, string $token): array {
  $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($payloadJson === false) {
    throw new RuntimeException('JSON encode failed');
  }

  $headers = [
    'Content-Type: application/json',
    'X-DGUV-Agent-Token: ' . $token,
  ];

  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    if ($ch === false) {
      throw new RuntimeException('curl_init failed');
    }

    curl_setopt_array($ch, [
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => $headers,
      CURLOPT_POSTFIELDS => $payloadJson,
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_CONNECTTIMEOUT => 8,
      CURLOPT_TIMEOUT => 20,
    ]);

    $result = curl_exec($ch);
    if ($result === false) {
      $error = curl_error($ch);
      curl_close($ch);
      throw new RuntimeException('curl error: ' . $error);
    }

    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
  } else {
    $context = stream_context_create([
      'http' => [
        'method' => 'POST',
        'header' => implode("\r\n", $headers),
        'content' => $payloadJson,
        'ignore_errors' => true,
        'timeout' => 20,
      ],
    ]);
    $result = file_get_contents($url, false, $context);
    if ($result === false) {
      throw new RuntimeException('HTTP request failed');
    }

    $status = 0;
    $meta = $http_response_header ?? [];
    foreach ($meta as $line) {
      if (preg_match('/^HTTP\/\d\.\d\s+(\d+)/', $line, $matches)) {
        $status = (int)$matches[1];
        break;
      }
    }
  }

  $parsed = json_decode((string)$result, true);
  if (!is_array($parsed)) {
    throw new RuntimeException('invalid JSON response');
  }

  if ($status >= 400 || empty($parsed['ok'])) {
    $error = (string)($parsed['error'] ?? ('http_' . $status));
    throw new RuntimeException($error);
  }

  return $parsed;
}

function write_csv_atomic(string $targetPath, string $payload): void {
  $tmp = $targetPath . '.tmp';
  if (file_put_contents($tmp, $payload) === false) {
    throw new RuntimeException('CSV konnte nicht geschrieben werden');
  }
  if (!rename($tmp, $targetPath)) {
    @unlink($tmp);
    throw new RuntimeException('CSV konnte nicht atomar ersetzt werden');
  }
}

function run_command(string $commandTemplate, string $csvPath): array {
  if ($commandTemplate === '') {
    return ['executed' => false, 'exit_code' => 0, 'output' => 'kein Befehl konfiguriert'];
  }

  $safeCsv = escapeshellarg($csvPath);
  $cmd = str_contains($commandTemplate, '{csv}')
    ? str_replace('{csv}', $safeCsv, $commandTemplate)
    : $commandTemplate . ' ' . $safeCsv;

  $output = [];
  $exitCode = 0;
  exec($cmd . ' 2>&1', $output, $exitCode);

  return ['executed' => true, 'exit_code' => $exitCode, 'output' => implode("\n", $output)];
}

$claimUrl = $api . '?action=agent_claim_job';
$finishUrl = $api . '?action=agent_finish_job';

echo "DGUV Agent gestartet: {$agentName}\n";
echo "API: {$api}\n";
echo "CSV Ziel: {$csvPath}\n";

while (true) {
  try {
    $claim = post_json($claimUrl, ['action' => 'agent_claim_job', 'agent_name' => $agentName], $token);
    $job = $claim['job'] ?? null;

    if (!is_array($job)) {
      if ($once) {
        echo "Kein Job vorhanden.\n";
        break;
      }
      sleep($interval);
      continue;
    }

    $jobId = (int)($job['id'] ?? 0);
    $mode = (string)($job['mode'] ?? 'open_only');
    $csvPayload = (string)($job['csv_payload'] ?? '');

    echo "Job {$jobId} verarbeitet ({$mode})...\n";

    write_csv_atomic($csvPath, $csvPayload);

    $commandResult = ['executed' => false, 'exit_code' => 0, 'output' => ''];
    if ($mode === 'print_now') {
      $commandResult = run_command($printCmd !== '' ? $printCmd : $openCmd, $csvPath);
    } else {
      $commandResult = run_command($openCmd, $csvPath);
    }

    $success = !$commandResult['executed'] || ((int)$commandResult['exit_code'] === 0);
    $error = $success ? '' : 'command_exit_' . (int)$commandResult['exit_code'];

    post_json($finishUrl, [
      'action' => 'agent_finish_job',
      'job_id' => $jobId,
      'success' => $success,
      'error_text' => $error,
      'agent_meta' => [
        'csv_path' => $csvPath,
        'mode' => $mode,
        'command_executed' => $commandResult['executed'],
        'command_output' => (string)$commandResult['output'],
      ],
    ], $token);

    echo $success
      ? "Job {$jobId} abgeschlossen.\n"
      : "Job {$jobId} fehlgeschlagen ({$error}).\n";
  } catch (Throwable $e) {
    fwrite(STDERR, 'Agentfehler: ' . $e->getMessage() . "\n");
    if ($once) {
      exit(1);
    }
    sleep($interval);
  }

  if ($once) {
    break;
  }
}
