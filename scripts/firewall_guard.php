<?php
declare(strict_types=1);

/**
 * Firewall-/WAF-Kompatibilitaets-Guard fuer das Repository.
 *
 * Nutzung:
 *   php scripts/firewall_guard.php
 *
 * Exit codes:
 *   0 = ok
 *   1 = Verstoss gefunden
 */

$root = realpath(__DIR__ . '/..');
if (!$root) {
    fwrite(STDERR, "Konnte Projektwurzel nicht ermitteln.\n");
    exit(1);
}

$errors = [];

/** @return list<string> */
function list_files(string $root): array {
    $allowedExt = ['php', 'html', 'js', 'css'];
    $skipPaths = [
        '.git/',
        '.github/',
        '__pycache__/',
        'memories/',
        'app/tools/pegelTool/vendor/',
        'app/tools/pdf_template_builder/vendor/',
        'scripts/',
    ];

    $skipFiles = [
        'download_vendor.php',
        'dguv_print_agent.php',
    ];

    $result = [];
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
    );

    /** @var SplFileInfo $file */
    foreach ($it as $file) {
        if (!$file->isFile()) {
            continue;
        }

        $path = $file->getPathname();
        $rel = ltrim(str_replace('\\', '/', substr($path, strlen($root))), '/');

        if (strtolower((string)pathinfo($rel, PATHINFO_EXTENSION)) === 'md') {
            continue;
        }

        $skip = false;
        foreach ($skipPaths as $needle) {
            if (strpos($rel, $needle) === 0) {
                $skip = true;
                break;
            }
        }
        if (!$skip) {
            foreach ($skipFiles as $exactFile) {
                if ($rel === $exactFile) {
                    $skip = true;
                    break;
                }
            }
        }
        if ($skip) {
            continue;
        }

        $ext = strtolower((string)pathinfo($path, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExt, true)) {
            continue;
        }

        $result[] = $path;
    }

    return $result;
}

/**
 * @param list<string> $lines
 */
function add_line_matches(array $lines, string $absolutePath, string $root, string $pattern, string $message, array &$errors): void {
    foreach ($lines as $i => $line) {
        if (preg_match($pattern, $line) === 1) {
            $rel = ltrim(str_replace('\\', '/', substr($absolutePath, strlen($root))), '/');
            $errors[] = sprintf('%s:%d %s', $rel, $i + 1, $message);
        }
    }
}

$files = list_files($root);

foreach ($files as $file) {
    $content = file_get_contents($file);
    if ($content === false) {
        $errors[] = 'Lesefehler: ' . $file;
        continue;
    }

    $lines = preg_split('/\R/', $content) ?: [];

    // Harte Firewall-/WAF-Blocker
    add_line_matches($lines, $file, $root, '/unsafe-inline/i', "'unsafe-inline' ist verboten", $errors);
    add_line_matches($lines, $file, $root, '/unsafe-eval/i', "'unsafe-eval' ist verboten", $errors);
    add_line_matches($lines, $file, $root, '/connect-src\s+\'self\'\s+https:/i', "connect-src darf nicht auf beliebige HTTPS-Ziele erweitert werden", $errors);
    add_line_matches($lines, $file, $root, '/\bhttp:\/\//i', 'Unverschluesselte HTTP-URL gefunden', $errors);
    add_line_matches($lines, $file, $root, '/\bws:\/\//i', 'Unsicheres WebSocket (ws://) gefunden', $errors);

    // Externe Ressourcen in Tool-Frontends verhindern
    add_line_matches($lines, $file, $root, '/cdn\.jsdelivr\.net/i', 'Externe CDN-Domain verboten (jsdelivr)', $errors);
    add_line_matches($lines, $file, $root, '/cdnjs\.cloudflare\.com/i', 'Externe CDN-Domain verboten (cdnjs)', $errors);
    add_line_matches($lines, $file, $root, '/fonts\.googleapis\.com/i', 'Externe Font-Domain verboten (fonts.googleapis.com)', $errors);
    add_line_matches($lines, $file, $root, '/fonts\.gstatic\.com/i', 'Externe Font-Domain verboten (fonts.gstatic.com)', $errors);

    // Unsichere JS-Muster
    add_line_matches($lines, $file, $root, '/\beval\s*\(/i', 'eval(...) ist verboten', $errors);
    add_line_matches($lines, $file, $root, '/\bnew\s+Function\s*\(/i', 'new Function(...) ist verboten', $errors);
    add_line_matches($lines, $file, $root, '/document\.write\s*\(/i', 'document.write(...) ist verboten', $errors);

    // Inline-Event-Handler verhindern
    add_line_matches($lines, $file, $root, '/\son[a-z]+\s*=\s*["\"]/i', 'Inline-Event-Handler (on*) ist verboten', $errors);
}

// Zusatzaudit: _bootstrap.php muss zentrale Header behalten
$bootstrap = $root . '/_bootstrap.php';
if (is_file($bootstrap)) {
    $text = file_get_contents($bootstrap) ?: '';
    $requiredTokens = [
        'Strict-Transport-Security',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'Permissions-Policy',
        'function csp_nonce()',
    ];
    foreach ($requiredTokens as $token) {
        if (strpos($text, $token) === false) {
            $errors[] = '_bootstrap.php fehlt Pflichtbestandteil: ' . $token;
        }
    }
}

if ($errors !== []) {
    fwrite(STDERR, "Firewall-Guard FEHLGESCHLAGEN\n");
    foreach ($errors as $error) {
        fwrite(STDERR, ' - ' . $error . "\n");
    }
    exit(1);
}

echo "Firewall-Guard OK\n";
exit(0);
