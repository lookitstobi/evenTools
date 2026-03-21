<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require_login();

/**
 * @return array<string, string>
 */
function named_color_map(): array {
  return [
    'transparent' => 'rgba(0,0,0,0)',
    'white' => '#ffffff',
    'black' => '#000000',
    'red' => '#ff0000',
    'green' => '#008000',
    'blue' => '#0000ff',
    'gray' => '#808080',
    'grey' => '#808080',
    'yellow' => '#ffff00',
    'orange' => '#ffa500',
    'purple' => '#800080',
    'pink' => '#ffc0cb',
    'brown' => '#a52a2a',
    'cyan' => '#00ffff',
    'magenta' => '#ff00ff',
  ];
}

/**
 * @return array{r:int,g:int,b:int,a:float}|null
 */
function parse_hex_color(string $hex): ?array {
  $value = ltrim(trim($hex), '#');

  if (!preg_match('/^[0-9a-fA-F]+$/', $value)) {
    return null;
  }

  if (strlen($value) === 3 || strlen($value) === 4) {
    $expanded = '';
    for ($i = 0; $i < strlen($value); $i++) {
      $expanded .= $value[$i] . $value[$i];
    }
    $value = $expanded;
  }

  if (strlen($value) !== 6 && strlen($value) !== 8) {
    return null;
  }

  $r = hexdec(substr($value, 0, 2));
  $g = hexdec(substr($value, 2, 2));
  $b = hexdec(substr($value, 4, 2));
  $a = 1.0;

  if (strlen($value) === 8) {
    $a = round(hexdec(substr($value, 6, 2)) / 255, 4);
  }

  return ['r' => $r, 'g' => $g, 'b' => $b, 'a' => $a];
}

/**
 * @return array{r:int,g:int,b:int,a:float}|null
 */
function parse_rgb_color(string $raw): ?array {
  if (!preg_match('/^rgba?\(([^\)]+)\)$/i', trim($raw), $m)) {
    return null;
  }

  $parts = array_map('trim', explode(',', $m[1]));
  if (count($parts) < 3) {
    return null;
  }

  $r = (int)round((float)$parts[0]);
  $g = (int)round((float)$parts[1]);
  $b = (int)round((float)$parts[2]);
  $a = 1.0;

  if (isset($parts[3])) {
    $a = (float)$parts[3];
  }

  $r = max(0, min(255, $r));
  $g = max(0, min(255, $g));
  $b = max(0, min(255, $b));
  $a = max(0.0, min(1.0, $a));

  return ['r' => $r, 'g' => $g, 'b' => $b, 'a' => round($a, 4)];
}

/**
 * @return array{r:int,g:int,b:int,a:float}|null
 */
function parse_hsl_color(string $raw): ?array {
  if (!preg_match('/^hsla?\(([^\)]+)\)$/i', trim($raw), $m)) {
    return null;
  }

  $parts = array_map('trim', explode(',', $m[1]));
  if (count($parts) < 3) {
    return null;
  }

  $h = (float)str_replace('deg', '', strtolower($parts[0]));
  $s = (float)str_replace('%', '', $parts[1]);
  $l = (float)str_replace('%', '', $parts[2]);
  $a = 1.0;

  if (isset($parts[3])) {
    $a = (float)$parts[3];
  }

  $h = fmod($h, 360.0);
  if ($h < 0) {
    $h += 360.0;
  }

  $s = max(0.0, min(100.0, $s)) / 100.0;
  $l = max(0.0, min(100.0, $l)) / 100.0;
  $a = max(0.0, min(1.0, $a));

  $c = (1 - abs(2 * $l - 1)) * $s;
  $x = $c * (1 - abs(fmod($h / 60.0, 2) - 1));
  $mShift = $l - $c / 2;

  $rp = 0.0;
  $gp = 0.0;
  $bp = 0.0;

  if ($h < 60) {
    $rp = $c;
    $gp = $x;
  } elseif ($h < 120) {
    $rp = $x;
    $gp = $c;
  } elseif ($h < 180) {
    $gp = $c;
    $bp = $x;
  } elseif ($h < 240) {
    $gp = $x;
    $bp = $c;
  } elseif ($h < 300) {
    $rp = $x;
    $bp = $c;
  } else {
    $rp = $c;
    $bp = $x;
  }

  $r = (int)round(($rp + $mShift) * 255);
  $g = (int)round(($gp + $mShift) * 255);
  $b = (int)round(($bp + $mShift) * 255);

  return [
    'r' => max(0, min(255, $r)),
    'g' => max(0, min(255, $g)),
    'b' => max(0, min(255, $b)),
    'a' => round($a, 4),
  ];
}

/**
 * @param array{r:int,g:int,b:int,a:float} $color
 */
function color_to_hex(array $color): string {
  $alpha = (int)round($color['a'] * 255);
  $base = sprintf('#%02X%02X%02X', $color['r'], $color['g'], $color['b']);
  if ($alpha >= 255) {
    return $base;
  }
  return $base . sprintf('%02X', max(0, min(255, $alpha)));
}

/**
 * @param array{r:int,g:int,b:int,a:float} $color
 */
function color_to_rgba(array $color): string {
  if ($color['a'] >= 1) {
    return sprintf('rgb(%d, %d, %d)', $color['r'], $color['g'], $color['b']);
  }
  $alpha = rtrim(rtrim(number_format($color['a'], 3, '.', ''), '0'), '.');
  return sprintf('rgba(%d, %d, %d, %s)', $color['r'], $color['g'], $color['b'], $alpha === '' ? '0' : $alpha);
}

/**
 * @param array{r:int,g:int,b:int,a:float} $color
 */
function color_key(array $color): string {
  $alpha = number_format($color['a'], 4, '.', '');
  return sprintf('%d,%d,%d,%s', $color['r'], $color['g'], $color['b'], $alpha);
}

/**
 * @return array<int, string>
 */
function usage_purposes(string $line): array {
  $purposes = [];

  if (preg_match('/--([a-z0-9_-]+)\s*:/i', $line, $m)) {
    $token = strtolower((string)$m[1]);
    if (preg_match('/ok|warn|bad|error|success/', $token)) {
      $purposes[] = 'Statusfarben';
    } elseif (preg_match('/accent|brand/', $token)) {
      $purposes[] = 'Akzente und Interaktion';
    } elseif (preg_match('/bg|panel|field/', $token)) {
      $purposes[] = 'Hintergrunde und Flachen';
    } elseif (preg_match('/text|muted|faint/', $token)) {
      $purposes[] = 'Text und Lesbarkeit';
    } elseif (preg_match('/border|line|outline/', $token)) {
      $purposes[] = 'Rahmen und Trennlinien';
    } elseif (preg_match('/shadow/', $token)) {
      $purposes[] = 'Schatten und Tiefe';
    } else {
      $purposes[] = 'Design-Token';
    }
  }

  if (preg_match_all('/\b(background(?:-color)?|color|border(?:-color)?|outline(?:-color)?|box-shadow|text-shadow|accent-color|fill|stroke|scrollbar-color)\b/i', $line, $m)) {
    foreach ((array)$m[1] as $propertyRaw) {
      $property = strtolower((string)$propertyRaw);
      if ($property === 'background' || $property === 'background-color') {
        $purposes[] = 'Hintergrunde und Flachen';
      } elseif ($property === 'color') {
        $purposes[] = 'Text und Lesbarkeit';
      } elseif (str_starts_with($property, 'border') || str_starts_with($property, 'outline')) {
        $purposes[] = 'Rahmen und Trennlinien';
      } elseif ($property === 'box-shadow' || $property === 'text-shadow') {
        $purposes[] = 'Schatten und Tiefe';
      } elseif ($property === 'accent-color') {
        $purposes[] = 'Formular-Akzente';
      } elseif ($property === 'fill' || $property === 'stroke') {
        $purposes[] = 'Icons und Vektoren';
      } elseif ($property === 'scrollbar-color') {
        $purposes[] = 'Scrollbars';
      }
    }
  }

  if (preg_match('/style\.(color|backgroundColor|borderColor|outlineColor)/', $line, $m)) {
    $jsProp = strtolower((string)$m[1]);
    if ($jsProp === 'color') {
      $purposes[] = 'Dynamischer Textzustand';
    } elseif ($jsProp === 'backgroundcolor') {
      $purposes[] = 'Dynamischer Hintergrundzustand';
    } else {
      $purposes[] = 'Dynamischer Rahmenzustand';
    }
  }

  if (empty($purposes)) {
    $purposes[] = 'Allgemeine UI-Gestaltung';
  }

  $purposes = array_values(array_unique($purposes));
  sort($purposes);
  return $purposes;
}

/**
 * @return array<int, string>
 */
function scan_source_files(string $baseDir): array {
  $extensions = ['php', 'css', 'js', 'html'];
  $excludedDirs = ['.git', '.vscode', '__pycache__', 'node_modules', 'vendor'];
  $roots = [
    $baseDir . '/assets',
    $baseDir . '/app/tools',
  ];

  $files = [];
  foreach ($roots as $root) {
    if (!is_dir($root)) {
      continue;
    }

    $iterator = new RecursiveIteratorIterator(
      new RecursiveCallbackFilterIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        static function (SplFileInfo $current, string $key, RecursiveDirectoryIterator $iter) use ($excludedDirs): bool {
          if ($current->isDir()) {
            return !in_array($current->getFilename(), $excludedDirs, true);
          }
          return true;
        }
      )
    );

    foreach ($iterator as $fileInfo) {
      if (!$fileInfo instanceof SplFileInfo || !$fileInfo->isFile()) {
        continue;
      }

      $ext = strtolower((string)$fileInfo->getExtension());
      if (!in_array($ext, $extensions, true)) {
        continue;
      }

      $path = (string)$fileInfo->getPathname();
      if (str_contains($path, '/memories/')) {
        continue;
      }

      $files[] = $path;
    }
  }

  $toolServe = $baseDir . '/toolserve.php';
  if (is_file($toolServe)) {
    $files[] = $toolServe;
  }

  $files = array_values(array_unique($files));
  sort($files);
  return $files;
}

/**
 * @return array<string, array{hex:string, rgba:string, purposes:array<int, string>}>
 */
function collect_colors(string $baseDir): array {
  $pattern = '/(?<![\w-])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|(?:rgba?|hsla?)\([^\n\)]*\)|(?<![\w-])(?:transparent|white|black|red|green|blue|gray|grey|yellow|orange|purple|pink|brown|cyan|magenta)(?![\w-])/i';
  $namedColors = named_color_map();

  $result = [];
  foreach (scan_source_files($baseDir) as $filePath) {
    $lines = @file($filePath, FILE_IGNORE_NEW_LINES);
    if ($lines === false) {
      continue;
    }

    foreach ($lines as $line) {
      if (!preg_match_all($pattern, $line, $matches)) {
        continue;
      }

      foreach ((array)$matches[0] as $rawToken) {
        $token = trim((string)$rawToken);
        if ($token === '') {
          continue;
        }

        $parsed = null;
        $tokenLower = strtolower($token);

        if (isset($namedColors[$tokenLower])) {
          $token = $namedColors[$tokenLower];
          $tokenLower = strtolower($token);
        }

        if (str_starts_with($token, '#')) {
          $parsed = parse_hex_color($token);
        } elseif (str_starts_with($tokenLower, 'rgb')) {
          $parsed = parse_rgb_color($tokenLower);
        } elseif (str_starts_with($tokenLower, 'hsl')) {
          $parsed = parse_hsl_color($tokenLower);
        }

        if ($parsed === null) {
          continue;
        }

        $key = color_key($parsed);
        if (!isset($result[$key])) {
          $result[$key] = [
            'hex' => color_to_hex($parsed),
            'rgba' => color_to_rgba($parsed),
            'purposes' => [],
          ];
        }

        foreach (usage_purposes($line) as $purpose) {
          if (!in_array($purpose, $result[$key]['purposes'], true)) {
            $result[$key]['purposes'][] = $purpose;
          }
        }
      }
    }
  }

  uasort(
    $result,
    static fn(array $a, array $b): int => strcmp($a['hex'], $b['hex'])
  );

  return $result;
}

$colors = collect_colors(__DIR__);

page_start('Farb-Inventar', true);
?>
<section class="card color-audit-card">
  <h1>UI-Farbinventar von evenTools</h1>
  <p class="muted">
    Gefundene UI-Farben in assets, app/tools und toolserve-Fallback: <strong><?= count($colors) ?></strong>
  </p>
  <div class="table-wrap">
    <table class="table color-audit-table">
      <thead>
        <tr>
          <th>Swatch</th>
          <th>Hex-Code</th>
          <th>RGB-Wert</th>
          <th>Nutzung</th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($colors as $color): ?>
        <tr>
          <td>
            <span class="swatch" style="--swatch: <?= h($color['rgba']) ?>;"></span>
          </td>
          <td><code><?= h($color['hex']) ?></code></td>
          <td><code><?= h($color['rgba']) ?></code></td>
          <td><?= h(implode(', ', $color['purposes'])) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>

<style>
.color-audit-card h1 {
  margin-top: 0;
}

.color-audit-table .swatch {
  display: inline-block;
  width: 52px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,.18);
  background: var(--swatch);
}

.color-audit-table code {
  white-space: nowrap;
}
.color-audit-table td:last-child {
  min-width: 320px;
}
</style>
<?php
page_end();
