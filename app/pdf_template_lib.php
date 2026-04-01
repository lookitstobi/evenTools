<?php
declare(strict_types=1);

function pdf_template_db(): PDO {
  static $db = null;
  if ($db instanceof PDO) {
    return $db;
  }

  $config = require __DIR__ . '/config.php';
  $path = (string)($config['pdf_template_db_path'] ?? (__DIR__ . '/pdf_templates.sqlite'));

  $db = new PDO('sqlite:' . $path);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('PRAGMA foreign_keys = ON;');

  pdf_template_init_schema($db);

  return $db;
}

function pdf_template_init_schema(PDO $db): void {
  $db->exec('CREATE TABLE IF NOT EXISTS pdf_templates (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    tool_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT "draft",
    payload_json TEXT NOT NULL,
    owner_user_id INTEGER NOT NULL,
    owner_username TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by_user_id INTEGER NOT NULL,
    updated_by_username TEXT NOT NULL,
    deleted_at TEXT
  )');

  $db->exec('CREATE TABLE IF NOT EXISTS pdf_template_revisions (
    id INTEGER PRIMARY KEY,
    template_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    tool_key TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by_user_id INTEGER NOT NULL,
    updated_by_username TEXT NOT NULL,
    FOREIGN KEY(template_id) REFERENCES pdf_templates(id)
  )');

  $db->exec('CREATE INDEX IF NOT EXISTS idx_pdf_templates_tool ON pdf_templates(tool_key)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_pdf_templates_status ON pdf_templates(status)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_pdf_templates_updated ON pdf_templates(updated_at)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_pdf_templates_deleted ON pdf_templates(deleted_at)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_pdf_template_revisions_template ON pdf_template_revisions(template_id, version)');
}

function pdf_template_iso_now(): string {
  return gmdate('c');
}

function pdf_template_require_admin_tool_access(): void {
  // Admin-Status allein genügt für API-Zugriff; der UI-Zugang über toolserve.php
  // wird durch die Tool-Zuordnung in der Session kontrolliert.
  require_admin();
}

function pdf_template_require_tool_access(string $toolKey): void {
  require_login();
  if (!empty($_SESSION['is_admin'])) {
    return;
  }

  $allowed = $_SESSION['tools'] ?? [];
  if (!is_array($allowed) || !in_array($toolKey, $allowed, true)) {
    http_response_code(403);
    echo '403';
    exit;
  }
}

function pdf_template_current_uid(): int {
  return (int)($_SESSION['uid'] ?? 0);
}

function pdf_template_current_username(): string {
  return (string)($_SESSION['username'] ?? '');
}

function pdf_template_allowed_tool_keys(): array {
  static $cache = null;
  if (is_array($cache)) {
    return $cache;
  }

  $preferred = ['nti_tool', 'dguv_v3', 'cuesheet', 'patchmatrix'];
  $excluded = ['pdf_template_builder', 'dev_todo'];

  $keys = [];
  foreach ($preferred as $key) {
    $keys[$key] = true;
  }

  $config = require __DIR__ . '/config.php';
  $toolsDir = (string)($config['tools_dir'] ?? '');
  $toolsBase = realpath($toolsDir);
  if ($toolsBase !== false) {
    foreach (glob($toolsBase . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
      $name = basename($dir);
      if ($name === '' || in_array($name, $excluded, true)) {
        continue;
      }
      if (!preg_match('/^[a-zA-Z0-9_-]+$/', $name)) {
        continue;
      }
      $keys[$name] = true;
    }
  }

  try {
    $db = pdf_template_db();
    $stmt = $db->query('SELECT DISTINCT tool_key FROM pdf_templates WHERE deleted_at IS NULL');
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $toolKey) {
      $name = trim((string)$toolKey);
      if ($name === '' || in_array($name, $excluded, true)) {
        continue;
      }
      if (!preg_match('/^[a-zA-Z0-9_-]+$/', $name)) {
        continue;
      }
      $keys[$name] = true;
    }
  } catch (Throwable $e) {
    // Bei Erstinitialisierung ohne Tabelleninhalt still weiterarbeiten.
  }

  $ordered = [];
  foreach ($preferred as $key) {
    if (!empty($keys[$key])) {
      $ordered[] = $key;
      unset($keys[$key]);
    }
  }

  $extra = array_keys($keys);
  sort($extra, SORT_STRING);
  $cache = array_merge($ordered, $extra);
  return $cache;
}

function pdf_template_field_catalog(): array {
  $catalog = [
    'nti_tool' => [
      ['key' => 'project_name', 'label' => 'Projektname', 'group' => 'Projekt'],
      ['key' => 'measurement_date', 'label' => 'Messdatum', 'group' => 'Messung'],
      ['key' => 'operator_name', 'label' => 'Operator', 'group' => 'Beteiligte'],
      ['key' => 'result_laeq', 'label' => 'Ergebnis LAeq', 'group' => 'Ergebnisse'],
      ['key' => 'result_laeq_g30', 'label' => 'Ergebnis LAeq,30min', 'group' => 'Ergebnisse'],
      ['key' => 'result_peak', 'label' => 'Ergebnis Peak', 'group' => 'Ergebnisse'],
      ['key' => 'customer', 'label' => 'Kunde', 'group' => 'Beteiligte'],
      ['key' => 'location', 'label' => 'Location', 'group' => 'Projekt'],
      ['key' => 'environment', 'label' => 'Umgebung', 'group' => 'Projekt'],
      ['key' => 'measurement_position', 'label' => 'Messposition', 'group' => 'Messung'],
      ['key' => 'loudest_position', 'label' => 'Lauteste Position', 'group' => 'Messung'],
      ['key' => 'organiser', 'label' => 'Organisator', 'group' => 'Beteiligte'],
      ['key' => 'description', 'label' => 'Beschreibung', 'group' => 'Projekt'],
      ['key' => 'report_date', 'label' => 'Berichtdatum', 'group' => 'Bericht'],
      ['key' => 'report_name', 'label' => 'Berichtname', 'group' => 'Bericht'],
      ['key' => 'device_model', 'label' => 'Messgerät', 'group' => 'Gerät'],
      ['key' => 'device_sn', 'label' => 'Messgerät S/N', 'group' => 'Gerät'],
      ['key' => 'calibrator_model', 'label' => 'Kalibrator', 'group' => 'Gerät'],
      ['key' => 'calibrator_sn', 'label' => 'Kalibrator S/N', 'group' => 'Gerät'],
      ['key' => 'firmware', 'label' => 'Firmware', 'group' => 'Gerät'],
      ['key' => 'log_interval', 'label' => 'Log-Intervall', 'group' => 'Messung'],
      ['key' => 'kset_date', 'label' => 'k-Werte gesetzt', 'group' => 'Korrektur'],
      ['key' => 'correction_k1', 'label' => 'Korrekturwert k1', 'group' => 'Korrektur'],
      ['key' => 'correction_k2', 'label' => 'Korrekturwert k2', 'group' => 'Korrektur'],
      ['key' => 'pa_setup', 'label' => 'Anlagen-Setup', 'group' => 'Anlage'],
      ['key' => 'chart_laeq_series', 'label' => 'Diagramm LAeq-Verlauf', 'group' => 'Diagramme'],
      ['key' => 'chart_lcpeak_series', 'label' => 'Diagramm LCpeak-Verlauf', 'group' => 'Diagramme'],
    ],
    'dguv_v3' => [
      ['key' => 'asset_uid', 'label' => 'Inventarnummer', 'group' => 'Objekt'],
      ['key' => 'asset_name', 'label' => 'Name', 'group' => 'Objekt'],
      ['key' => 'location', 'label' => 'Standort', 'group' => 'Objekt'],
      ['key' => 'inspection_date', 'label' => 'Prüfdatum', 'group' => 'Prüfung'],
      ['key' => 'next_due_date', 'label' => 'Nächste Prüfung', 'group' => 'Prüfung'],
      ['key' => 'inspection_result', 'label' => 'Ergebnis', 'group' => 'Prüfung'],
    ],
    'cuesheet' => [
      ['key' => 'title', 'label' => 'Titel', 'group' => 'Metadaten'],
      ['key' => 'owner_username', 'label' => 'Eigentümer', 'group' => 'Metadaten'],
      ['key' => 'updated_at', 'label' => 'Letztes Update', 'group' => 'Metadaten'],
    ],
    'patchmatrix' => [
      ['key' => 'title', 'label' => 'Titel', 'group' => 'Metadaten'],
      ['key' => 'created_by', 'label' => 'Erstellt von', 'group' => 'Metadaten'],
      ['key' => 'updated_at', 'label' => 'Letztes Update', 'group' => 'Metadaten'],
    ],
  ];

  foreach (pdf_template_allowed_tool_keys() as $toolKey) {
    if (!array_key_exists($toolKey, $catalog)) {
      $catalog[$toolKey] = [];
    }

    $items = $catalog[$toolKey];
    usort($items, static function (array $a, array $b): int {
      $groupA = (string)($a['group'] ?? 'Allgemein');
      $groupB = (string)($b['group'] ?? 'Allgemein');
      $groupCmp = strcasecmp($groupA, $groupB);
      if ($groupCmp !== 0) {
        return $groupCmp;
      }

      $labelA = (string)($a['label'] ?? $a['key'] ?? '');
      $labelB = (string)($b['label'] ?? $b['key'] ?? '');
      $labelCmp = strcasecmp($labelA, $labelB);
      if ($labelCmp !== 0) {
        return $labelCmp;
      }

      return strcasecmp((string)($a['key'] ?? ''), (string)($b['key'] ?? ''));
    });
    $catalog[$toolKey] = $items;
  }

  return $catalog;
}

function pdf_template_allowed_bindings(string $toolKey): array {
  $catalog = pdf_template_field_catalog();
  $items = $catalog[$toolKey] ?? [];
  $keys = [];
  foreach ($items as $item) {
    $keys[] = (string)($item['key'] ?? '');
  }
  return array_values(array_filter($keys, static fn(string $v): bool => $v !== ''));
}

function pdf_template_normalize_status(string $status): string {
  return in_array($status, ['draft', 'published'], true) ? $status : 'draft';
}

function pdf_template_default_payload(string $toolKey): array {
  return pdf_template_normalize_payload([
    'schema_version' => 2,
    'tool_key' => $toolKey,
    'page' => [
      'format' => 'a4',
      'orientation' => 'portrait',
      'unit' => 'mm',
      'width' => 210,
      'height' => 297,
    ],
    'elements' => [
      [
        'id' => 'el_' . bin2hex(random_bytes(4)),
        'type' => 'text',
        'x' => 20,
        'y' => 20,
        'w' => 170,
        'h' => 10,
        'text' => 'Neue Vorlage',
        'bind' => '',
        'font_size' => 13,
        'font_weight' => 'bold',
        'align' => 'left',
        'line_height_factor' => 1.2,
        'baseline_offset_mm' => 0,
        'overflow_mode' => 'clip',
        'max_lines' => 0,
        'font_family_id' => 'helvetica',
      ],
    ],
  ], $toolKey);
}

function pdf_template_starter_payload(string $toolKey): array {
  $base = [
    'schema_version' => 2,
    'tool_key' => $toolKey,
    'page' => [
      'format' => 'a4',
      'orientation' => 'portrait',
      'unit' => 'mm',
      'width' => 210,
      'height' => 297,
    ],
    'elements' => [
      [
        'id' => 'hdr_title',
        'type' => 'text',
        'x' => 15,
        'y' => 15,
        'w' => 120,
        'h' => 10,
        'text' => 'Standardvorlage',
        'bind' => '',
        'font_size' => 14,
        'font_weight' => 'bold',
        'align' => 'left',
        'text_color' => '#1b1f23',
        'stroke_color' => '#1f2937',
        'fill_color' => '#cdeed6',
        'stroke_width' => 1,
        'image_src' => '',
      ],
      [
        'id' => 'rule_top',
        'type' => 'line',
        'x' => 15,
        'y' => 28,
        'w' => 180,
        'h' => 5,
        'text' => '',
        'bind' => '',
        'font_size' => 11,
        'font_weight' => 'normal',
        'align' => 'left',
        'text_color' => '#1b1f23',
        'stroke_color' => '#334155',
        'fill_color' => 'transparent',
        'stroke_width' => 1,
        'image_src' => '',
      ],
    ],
  ];

  if ($toolKey === 'dguv_v3') {
    $base['elements'][] = [
      'id' => 'asset_uid',
      'type' => 'text',
      'x' => 15,
      'y' => 38,
      'w' => 90,
      'h' => 10,
      'text' => 'Inventarnummer:',
      'bind' => 'asset_uid',
      'font_size' => 11,
      'font_weight' => 'bold',
      'align' => 'left',
      'text_color' => '#0f172a',
      'stroke_color' => '#1f2937',
      'fill_color' => 'transparent',
      'stroke_width' => 1,
      'image_src' => '',
    ];
    $base['elements'][] = [
      'id' => 'asset_result',
      'type' => 'rect_fill',
      'x' => 15,
      'y' => 55,
      'w' => 180,
      'h' => 25,
      'text' => '',
      'bind' => '',
      'font_size' => 11,
      'font_weight' => 'normal',
      'align' => 'left',
      'text_color' => '#1b1f23',
      'stroke_color' => '#0f766e',
      'fill_color' => '#d9fbe2',
      'stroke_width' => 1,
      'image_src' => '',
    ];
  } elseif ($toolKey === 'cuesheet') {
    $base['elements'][] = [
      'id' => 'cue_title',
      'type' => 'text',
      'x' => 15,
      'y' => 38,
      'w' => 140,
      'h' => 10,
      'text' => 'Titel:',
      'bind' => 'title',
      'font_size' => 12,
      'font_weight' => 'bold',
      'align' => 'left',
      'text_color' => '#0f172a',
      'stroke_color' => '#1f2937',
      'fill_color' => 'transparent',
      'stroke_width' => 1,
      'image_src' => '',
    ];
  } elseif ($toolKey === 'patchmatrix') {
    $base['elements'][] = [
      'id' => 'patch_title',
      'type' => 'text',
      'x' => 15,
      'y' => 38,
      'w' => 160,
      'h' => 10,
      'text' => 'Patchmatrix:',
      'bind' => 'title',
      'font_size' => 12,
      'font_weight' => 'bold',
      'align' => 'left',
      'text_color' => '#0f172a',
      'stroke_color' => '#1f2937',
      'fill_color' => 'transparent',
      'stroke_width' => 1,
      'image_src' => '',
    ];
  } else {
    $base['elements'][] = [
      'id' => 'nti_project',
      'type' => 'text',
      'x' => 15,
      'y' => 38,
      'w' => 150,
      'h' => 10,
      'text' => 'Projekt:',
      'bind' => 'project_name',
      'font_size' => 12,
      'font_weight' => 'bold',
      'align' => 'left',
      'text_color' => '#0f172a',
      'stroke_color' => '#1f2937',
      'fill_color' => 'transparent',
      'stroke_width' => 1,
      'image_src' => '',
    ];
  }

  return pdf_template_normalize_payload($base, $toolKey);
}

function pdf_template_nti_detailed_payload(): array {
  $M = 12;   // left/right margin in mm
  $pageW = 186; // 210 - 2*12
  // column positions (fieldPair: col2 starts at M + pageW/2 + 2 = 105)
  $col2 = 105;
  // fieldTriple: gap=4, colW=(186-8)/3≈59.3 → x1=12, x2=75, x3=138
  $t3x2 = 75;
  $t3x3 = 138;
  $t3w  = 59;

  $el = static function(
    string $id, string $type,
    float $x, float $y, float $w, float $h,
    string $text = '', string $bind = '',
    float $fontSize = 9, string $weight = 'normal', string $align = 'left',
    string $textColor = '#323232', string $strokeColor = 'transparent',
    string $fillColor = 'transparent', float $strokeWidth = 0.2,
    string $imageSrc = ''
  ): array {
    if ($type === 'text') {
      // jsPDF nutzt bei text() die Y-Koordinate als Baseline. Der Builder und
      // unser Renderer arbeiten dagegen mit einer Box-Oberkante. Für die aus
      // dem NTI-Layout übernommene Vorlage konvertieren wir deshalb die
      // Baseline-Position einmalig in eine obere Textkante.
      $y = max(0, $y - ($fontSize * 25.4 / 72.0));
    }

    return [
      'id' => $id, 'type' => $type,
      'x' => $x, 'y' => $y, 'w' => $w, 'h' => $h,
      'text' => $text, 'bind' => $bind,
      'font_size' => $fontSize, 'font_weight' => $weight, 'align' => $align,
      'text_color' => $textColor,
      'stroke_color' => $strokeColor,
      'fill_color' => $fillColor,
      'stroke_width' => $strokeWidth,
      'image_src' => $imageSrc,
    ];
  };

  $blue = '#0c4391';
  $lbl  = '#646464';
  $txt  = '#323232';
  $lt   = '#969696';

  return [
    'schema_version' => 2,
    'tool_key' => 'nti_tool',
    'page' => ['format' => 'a4', 'orientation' => 'portrait', 'unit' => 'mm', 'width' => 210, 'height' => 297],
    'elements' => [
      // ── Header ──────────────────────────────────────────────────
      $el('hdr_logo',     'image',    170,  6, 28, 12, '', '', 11, 'normal', 'left', $txt, '#cccccc', 'transparent', 0.3, '/assets/evenTools%20Logo.png'),
      $el('hdr_title',    'text',      14, 12,120,  8, 'Schallpegelmessung',   '', 16, 'bold',   'left', $txt),
      $el('hdr_subtitle', 'text',      14, 22,110,  5, 'gemäß DIN 15905-5',   '',  11, 'normal', 'left', $txt),
      $el('rule_header',  'line',      $M, 24,$pageW, 1,'','', 9,'normal','left',$txt,'#c8c8c8','transparent',0.5),

      // ── Section: Details ─────────────────────────────────────────
      $el('sec_details',  'text',      $M, 31,$pageW, 7,'Details','',          11,'bold','left',$blue,$blue,'transparent',0.5),
      $el('rule_details', 'line',      $M, 32,$pageW, 1,'','',                  9,'normal','left',$blue,$blue,'transparent',0.5),

      // fieldPair row 1: Veranstaltung / Datum
      $el('lbl_event',    'text',      $M, 40, 88,  4,'Veranstaltung','',        9,'bold',  'left',$lbl),
      $el('val_event',    'text',      $M, 45, 88,  5,'{{Veranstaltung}}','project_name', 9,'normal','left',$txt),
      $el('lbl_datum',    'text',   $col2, 40, 91,  4,'Datum','',                9,'bold',  'left',$lbl),
      $el('val_datum',    'text',   $col2, 45, 91,  5,'{{Datum}}','measurement_date', 9,'normal','left',$txt),

      // fieldPair row 2: Location / Umgebung
      $el('lbl_loc',      'text',      $M, 53, 88,  4,'Location','',             9,'bold',  'left',$lbl),
      $el('val_loc',      'text',      $M, 58, 88,  5,'{{Location}}','',         9,'normal','left',$txt),
      $el('lbl_umwelt',   'text',   $col2, 53, 91,  4,'Umgebung','',             9,'bold',  'left',$lbl),
      $el('val_umwelt',   'text',   $col2, 58, 91,  5,'{{Umgebung}}','',         9,'normal','left',$txt),

      // Boxen: Organisator / Beschreibung
      $el('lbl_org',      'text',      $M, 67, 88,  5,'Organisator:','',        10,'bold',  'left',$txt),
      $el('box_org',      'rect',      $M, 71, 88, 26,'','',                     9,'normal','left',$txt,'#d2d2d2','transparent',0.3),
      $el('lbl_beschr',   'text',   $col2, 67, 91,  5,'Beschreibung:','',       10,'bold',  'left',$txt),
      $el('box_beschr',   'rect',   $col2, 71, 91, 26,'','',                     9,'normal','left',$txt,'#d2d2d2','transparent',0.3),

      // ── Section: Messbeteiligte ───────────────────────────────────
      $el('sec_beteiligte','text',     $M,104,$pageW, 7,'Messbeteiligte','',    11,'bold','left',$blue,$blue,'transparent',0.5),
      $el('rule_beteiligte','line',    $M,105,$pageW, 1,'','',                   9,'normal','left',$blue,$blue,'transparent',0.5),

      $el('lbl_messVon',  'text',      $M,113, 88,  4,'Messung durchgeführt von','', 9,'bold',  'left',$lbl),
      $el('val_messVon',  'text',      $M,118, 88,  5,'{{Operator}}','operator_name',   9,'normal','left',$txt),
      $el('lbl_foh',      'text',   $col2,113, 91,  4,'FOH-Techniker','',        9,'bold',  'left',$lbl),
      $el('val_foh',      'text',   $col2,118, 91,  5,'{{FOH-Techniker}}','customer',    9,'normal','left',$txt),

      $el('lbl_messpos',  'text',      $M,127, 88,  4,'Messposition','',         9,'bold',  'left',$lbl),
      $el('val_messpos',  'text',      $M,132, 88,  5,'{{Messposition}}','',     9,'normal','left',$txt),
      $el('lbl_lauteste', 'text',   $col2,127, 91,  4,'Lauteste Position','',   9,'bold',  'left',$lbl),
      $el('val_lauteste', 'text',   $col2,132, 91,  5,'{{Lauteste Position}}','',9,'normal','left',$txt),

      // ── Section: Messgerät & Kalibrierung ────────────────────────
      $el('sec_mg',       'text',      $M,143,$pageW, 7,'Messgerät & Kalibrierung','', 11,'bold','left',$blue,$blue,'transparent',0.5),
      $el('rule_mg',      'line',      $M,144,$pageW, 1,'','',                    9,'normal','left',$blue,$blue,'transparent',0.5),

      // fieldTriple row 1: Messgerät / Kalibrator / k1
      $el('lbl_mg',       'text',      $M,151,$t3w,  4,'Messgerät','',            9,'bold',  'left',$lbl),
      $el('val_mg',       'text',      $M,156,$t3w,  5,'{{Messgerät}}','device_model',        9,'normal','left',$txt),
      $el('lbl_kal',      'text',   $t3x2,151,$t3w,  4,'Kalibrator','',           9,'bold',  'left',$lbl),
      $el('val_kal',      'text',   $t3x2,156,$t3w,  5,'{{Kalibrator}}','calibrator_model',       9,'normal','left',$txt),
      $el('lbl_k1',       'text',   $t3x3,151, 60,  4,'Korrekturwert k1','',     9,'bold',  'left',$lbl),
      $el('val_k1',       'text',   $t3x3,156, 60,  5,'—','correction_k1',                     9,'normal','left',$txt),

      // fieldTriple row 2: S/N Messgerät / S/N Kalibrator / k2
      $el('lbl_mg_sn',    'text',      $M,165,$t3w,  4,'Messgerät S/N','',        9,'bold',  'left',$lbl),
      $el('val_mg_sn',    'text',      $M,170,$t3w,  5,'{{SN}}','device_sn',               9,'normal','left',$txt),
      $el('lbl_kal_sn',   'text',   $t3x2,165,$t3w,  4,'Kalibrator S/N','',       9,'bold',  'left',$lbl),
      $el('val_kal_sn',   'text',   $t3x2,170,$t3w,  5,'{{Kal. SN}}','calibrator_sn',          9,'normal','left',$txt),
      $el('lbl_k2',       'text',   $t3x3,165, 60,  4,'Korrekturwert k2','',     9,'bold',  'left',$lbl),
      $el('val_k2',       'text',   $t3x3,170, 60,  5,'—','correction_k2',                     9,'normal','left',$txt),

      // fieldTriple row 3: Firmware / Log-Intervall / k-Werte gesetzt
      $el('lbl_fw',       'text',      $M,179,$t3w,  4,'Firmware','',             9,'bold',  'left',$lbl),
      $el('val_fw',       'text',      $M,184,$t3w,  5,'{{Firmware}}','firmware', 9,'normal','left',$txt),
      $el('lbl_log',      'text',   $t3x2,179,$t3w,  4,'Log-Intervall','',        9,'bold',  'left',$lbl),
      $el('val_log',      'text',   $t3x2,184,$t3w,  5,'{{Log-Intervall}}','log_interval', 9,'normal','left',$txt),
      $el('lbl_kset',     'text',   $t3x3,179, 60,  4,'k-Werte gesetzt','',      9,'bold',  'left',$lbl),
      $el('val_kset',     'text',   $t3x3,184, 60,  5,'{{k-Werte gesetzt}}','kset_date', 9,'normal','left',$txt),

      // ── Section: Anlagen-Setup ───────────────────────────────────
      $el('sec_pa',       'text',      $M,192,$pageW, 7,'Anlagen-Setup','',      11,'bold','left',$blue,$blue,'transparent',0.5),
      $el('rule_pa',      'line',      $M,193,$pageW, 1,'','',                    9,'normal','left',$blue,$blue,'transparent',0.5),
      $el('box_pa',       'rect',      $M,199,$pageW,16,'','',                    9,'normal','left',$txt,'#d2d2d2','transparent',0.3),
      $el('val_pa',       'text',      $M+2,204,$pageW-4,10,'{{Anlagen-Setup}}','pa_setup',9,'normal','left',$txt),

      // ── Section: Messergebnisse ───────────────────────────────────
      $el('sec_erg',      'text',      $M,223,$pageW, 7,'Messergebnisse','',     11,'bold','left',$blue,$blue,'transparent',0.5),
      $el('rule_erg',     'line',      $M,224,$pageW, 1,'','',                    9,'normal','left',$blue,$blue,'transparent',0.5),

      // Tabellenkopf (gefülltes Rechteck + Texte)
      $el('tbl_hdr_bg',   'rect_fill', $M,230,$pageW, 7,'','',                    9,'bold','left','#505050','#c8c8c8','#f0f0f0',0.3),
      $el('tbl_h_par',    'text',      14,235, 56,  4,'Parameter','',             9,'bold','left','#505050'),
      $el('tbl_h_wert',   'text',      72,235, 22,  4,'Messwert','',              9,'bold','left','#505050'),
      $el('tbl_h_dauer',  'text',      96,235, 34,  4,'Dauer','',                 9,'bold','left','#505050'),
      $el('tbl_h_grenz',  'text',     132,235, 22,  4,'Grenzwert','',             9,'bold','left','#505050'),
      $el('tbl_h_stat',   'text',     170,235, 26,  4,'Status','',                9,'bold','left','#505050'),

      // Tabellenzeile 1: LAeq,30min
      $el('tbl_r1_bg',    'rect',      $M,237,$pageW, 6,'','',                    9,'normal','left',$txt,'#e6e6e6','transparent',0.3),
      $el('tbl_r1_par',   'text',      14,242, 56,  4,'LAeq,30min (g30)','',      9,'normal','left',$txt),
      $el('tbl_r1_val',   'text',      72,242, 22,  4,'{{LAeq,30min}}','result_laeq_g30',   9,'normal','left',$txt),
      $el('tbl_r1_dur',   'text',      96,242, 34,  4,'0:00','',                   9,'normal','left',$txt),
      $el('tbl_r1_grenz', 'text',     132,242, 22,  4,'99 dB','',                  9,'normal','left',$txt),
      $el('tbl_r1_ok',    'text',     170,242, 26,  4,'OK','',                     9,'normal','left','#4caf50'),

      // Tabellenzeile 2: LCpeak (max)
      $el('tbl_r2_bg',    'rect',      $M,243,$pageW, 6,'','',                    9,'normal','left',$txt,'#e6e6e6','transparent',0.3),
      $el('tbl_r2_par',   'text',      14,248, 56,  4,'LCpeak (max)','',          9,'normal','left',$txt),
      $el('tbl_r2_val',   'text',      72,248, 22,  4,'{{Peak}}','result_peak',   9,'normal','left',$txt),
      $el('tbl_r2_dur',   'text',      96,248, 34,  4,'0:00','',                   9,'normal','left',$txt),
      $el('tbl_r2_grenz', 'text',     132,248, 22,  4,'135 dB','',                 9,'normal','left',$txt),
      $el('tbl_r2_ok',    'text',     170,248, 26,  4,'OK','',                     9,'normal','left','#4caf50'),

      // Tabellenzeile 3: LAeq (Gesamt)
      $el('tbl_r3_bg',    'rect',      $M,249,$pageW, 6,'','',                    9,'normal','left',$txt,'#e6e6e6','transparent',0.3),
      $el('tbl_r3_par',   'text',      14,254, 56,  4,'LAeq (Gesamt)','',         9,'normal','left',$txt),
      $el('tbl_r3_val',   'text',      72,254, 22,  4,'{{LAeq}}','result_laeq',   9,'normal','left',$txt),
      $el('tbl_r3_dur',   'text',      96,254, 34,  4,'—','',                      9,'normal','left',$txt),
      $el('tbl_r3_grenz', 'text',     132,254, 22,  4,'99 dB','',                  9,'normal','left',$txt),
      $el('tbl_r3_ok',    'text',     170,254, 26,  4,'OK','',                     9,'normal','left','#4caf50'),

      // ── Unterschrift ─────────────────────────────────────────────
      $el('lbl_sig',      'text',      $M,261,$pageW, 7,'Unterschrift','',       11,'bold','left',$txt),
      $el('lbl_sig_dt',   'text',      $M,270, 50,  4,'Datum','',                9,'bold',  'left',$lbl),
      $el('val_sig_dt',   'text',      30,270, 60,  5,'{{Datum}}','report_date',9,'normal','left',$txt),
      $el('lbl_sig_nm',   'text',   $col2,270, 50,  4,'Name','',                 9,'bold',  'left',$lbl),
      $el('val_sig_nm',   'text',     125,270, 73,  5,'{{Name}}','report_name',9,'normal','left',$txt),
      $el('box_sig',      'rect',      $M,275,$pageW,18,'Unterschrift (Platzhalter)','',9,'normal','left','#787878','#c8c8c8','transparent',0.3),

      // ── Fußzeile ─────────────────────────────────────────────────
      $el('rule_footer',  'line',      $M,283,$pageW, 1,'','',                    9,'normal','left',$lt,'#e1e1e1','transparent',0.3),
      $el('footer_page',  'text',      $M,288, 50,  4,'Seite 1/2','',             9,'normal','left',$lt),
      $el('footer_date',  'text',     158,288, 40,  4,'Erstellt: TT.MM.JJJJ','', 9,'normal','right',$lt),
    ],
  ];
}

function pdf_template_ensure_starter_templates(PDO $db, int $uid, string $username): void {
  $now = pdf_template_iso_now();

  // NTI-spezifische Detailvorlage (basiert auf dem echten jsPDF-Layout)
  $ntiTitle = 'Messbericht · DIN 15905-5';
  $ntiCheck = $db->prepare('SELECT id FROM pdf_templates WHERE tool_key = ? AND title = ? AND deleted_at IS NULL LIMIT 1');
  $ntiCheck->execute(['nti_tool', $ntiTitle]);
  $ntiPayload = pdf_template_normalize_payload(pdf_template_nti_detailed_payload(), 'nti_tool');
  $ntiErrors  = pdf_template_validate_payload($ntiPayload, 'nti_tool');
  if ($ntiErrors === []) {
    $canonicalPayloadJson = json_encode($ntiPayload, JSON_THROW_ON_ERROR);
    $existingNti = $ntiCheck->fetch(PDO::FETCH_ASSOC);
    if (is_array($existingNti)) {
      $row = pdf_template_fetch_row($db, (int)$existingNti['id']);
      $existingSchemaVersion = 0;
      if (is_array($row)) {
        try {
          $existingPayload = json_decode((string)($row['payload_json'] ?? ''), true, 512, JSON_THROW_ON_ERROR);
          $existingSchemaVersion = (int)($existingPayload['schema_version'] ?? 0);
        } catch (Throwable $e) {
          $existingSchemaVersion = 0;
        }
      }
      if (is_array($row) && $existingSchemaVersion < 2 && (string)($row['payload_json'] ?? '') !== $canonicalPayloadJson) {
        $update = $db->prepare('UPDATE pdf_templates
          SET payload_json = ?, updated_at = ?, updated_by_user_id = ?, updated_by_username = ?
          WHERE id = ?');
        $update->execute([$canonicalPayloadJson, $now, $uid, $username, (int)$existingNti['id']]);

        $updateRev = $db->prepare('UPDATE pdf_template_revisions
          SET payload_json = ?, updated_at = ?, updated_by_user_id = ?, updated_by_username = ?
          WHERE template_id = ? AND version = 1');
        $updateRev->execute([$canonicalPayloadJson, $now, $uid, $username, (int)$existingNti['id']]);
      }
    } else {
      $ins = $db->prepare('INSERT INTO pdf_templates (title, tool_key, status, payload_json, owner_user_id, owner_username, version, created_at, updated_at, updated_by_user_id, updated_by_username)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)');
      $ins->execute([$ntiTitle, 'nti_tool', 'draft', $canonicalPayloadJson, $uid, $username, $now, $now, $uid, $username]);
      $ntiId = (int)$db->lastInsertId();
      $rev = $db->prepare('INSERT INTO pdf_template_revisions (template_id, version, title, tool_key, status, payload_json, updated_at, updated_by_user_id, updated_by_username)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)');
      $rev->execute([$ntiId, $ntiTitle, 'nti_tool', 'draft', $canonicalPayloadJson, $now, $uid, $username]);
    }
  }

  foreach (pdf_template_allowed_tool_keys() as $toolKey) {
    $title = 'Standardvorlage · ' . $toolKey;
    $check = $db->prepare('SELECT id FROM pdf_templates WHERE tool_key = ? AND title = ? AND deleted_at IS NULL LIMIT 1');
    $check->execute([$toolKey, $title]);
    $existing = $check->fetch(PDO::FETCH_ASSOC);
    if (is_array($existing)) {
      continue;
    }

    $payload = pdf_template_normalize_payload(pdf_template_starter_payload($toolKey), $toolKey);
    $errors = pdf_template_validate_payload($payload, $toolKey);
    if ($errors !== []) {
      continue;
    }

    $insert = $db->prepare('INSERT INTO pdf_templates (title, tool_key, status, payload_json, owner_user_id, owner_username, version, created_at, updated_at, updated_by_user_id, updated_by_username)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)');
    $insert->execute([
      $title,
      $toolKey,
      'draft',
      json_encode($payload, JSON_THROW_ON_ERROR),
      $uid,
      $username,
      $now,
      $now,
      $uid,
      $username,
    ]);

    $id = (int)$db->lastInsertId();
    $rev = $db->prepare('INSERT INTO pdf_template_revisions (template_id, version, title, tool_key, status, payload_json, updated_at, updated_by_user_id, updated_by_username)
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)');
    $rev->execute([
      $id,
      $title,
      $toolKey,
      'draft',
      json_encode($payload, JSON_THROW_ON_ERROR),
      $now,
      $uid,
      $username,
    ]);
  }
}

function pdf_template_normalize_page_settings(array $page): array {
  $orientation = (($page['orientation'] ?? 'portrait') === 'landscape') ? 'landscape' : 'portrait';
  $width = max(1.0, (float)($page['width'] ?? 210));
  $height = max(1.0, (float)($page['height'] ?? 297));

  if ($orientation === 'landscape') {
    $normalizedWidth = max($width, $height);
    $normalizedHeight = min($width, $height);
  } else {
    $normalizedWidth = min($width, $height);
    $normalizedHeight = max($width, $height);
  }

  return [
    'format' => 'a4',
    'orientation' => $orientation,
    'unit' => 'mm',
    'width' => $normalizedWidth,
    'height' => $normalizedHeight,
  ];
}

function pdf_template_normalize_element(array $element): array {
  $id = trim((string)($element['id'] ?? ''));
  if ($id === '') {
    $id = 'el_' . bin2hex(random_bytes(4));
  }

  $type = trim((string)($element['type'] ?? 'text'));
  if (!in_array($type, ['text', 'line', 'rect', 'rect_fill', 'image', 'chart'], true)) {
    $type = 'text';
  }

  $strokeColor = trim((string)($element['stroke_color'] ?? '#1f2937'));
  $fillColor = trim((string)($element['fill_color'] ?? '#cdeed6'));
  $textColor = trim((string)($element['text_color'] ?? '#1b1f23'));
  $imageSrc = trim((string)($element['image_src'] ?? ''));
  $groupId = trim((string)($element['group_id'] ?? ''));
  if ($groupId !== '' && !preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $groupId)) {
    $groupId = '';
  }

  $lineHeightFactor = (float)($element['line_height_factor'] ?? 1.2);
  if ($lineHeightFactor < 0.8 || $lineHeightFactor > 2.0) {
    $lineHeightFactor = 1.2;
  }

  $baselineOffsetMm = (float)($element['baseline_offset_mm'] ?? 0.0);
  if ($baselineOffsetMm < -5.0 || $baselineOffsetMm > 5.0) {
    $baselineOffsetMm = 0.0;
  }

  $overflowMode = trim((string)($element['overflow_mode'] ?? 'clip'));
  if (!in_array($overflowMode, ['clip', 'ellipsis'], true)) {
    $overflowMode = 'clip';
  }

  $maxLines = (int)($element['max_lines'] ?? 0);
  if ($maxLines < 0 || $maxLines > 200) {
    $maxLines = 0;
  }

  $fontFamilyId = trim((string)($element['font_family_id'] ?? 'helvetica'));
  if (!in_array($fontFamilyId, ['helvetica'], true)) {
    $fontFamilyId = 'helvetica';
  }

  $chartVariant = trim((string)($element['chart_variant'] ?? 'line'));
  if (!in_array($chartVariant, ['line'], true)) {
    $chartVariant = 'line';
  }

  return [
    'id' => $id,
    'type' => $type,
    'x' => (float)($element['x'] ?? 0),
    'y' => (float)($element['y'] ?? 0),
    'w' => (float)($element['w'] ?? 50),
    'h' => (float)($element['h'] ?? 6),
    'text' => trim((string)($element['text'] ?? '')),
    'bind' => trim((string)($element['bind'] ?? '')),
    'snap' => !empty($element['snap']),
    'font_size' => (float)($element['font_size'] ?? 11),
    'font_weight' => ((string)($element['font_weight'] ?? 'normal')) === 'bold' ? 'bold' : 'normal',
    'align' => in_array((string)($element['align'] ?? 'left'), ['left', 'center', 'right'], true)
      ? (string)$element['align']
      : 'left',
    'stroke_color' => $strokeColor,
    'fill_color' => $fillColor,
    'text_color' => $textColor,
    'stroke_width' => (float)($element['stroke_width'] ?? 1),
    'image_src' => $imageSrc,
    'group_id' => $groupId,
    'line_height_factor' => $lineHeightFactor,
    'baseline_offset_mm' => $baselineOffsetMm,
    'overflow_mode' => $overflowMode,
    'max_lines' => $maxLines,
    'font_family_id' => $fontFamilyId,
    'chart_variant' => $chartVariant,
    'chart_show_legend' => !empty($element['chart_show_legend']),
    'chart_show_limit' => array_key_exists('chart_show_limit', $element) ? !empty($element['chart_show_limit']) : true,
  ];
}

function pdf_template_normalize_page_entry(array $pageEntry, int $index): array {
  $elements = is_array($pageEntry['elements'] ?? null) ? $pageEntry['elements'] : [];
  $normalizedElements = [];
  foreach ($elements as $element) {
    if (!is_array($element)) {
      continue;
    }
    $normalizedElements[] = pdf_template_normalize_element($element);
  }

  $id = trim((string)($pageEntry['id'] ?? ''));
  if ($id === '') {
    $id = 'page_' . ($index + 1);
  }

  $name = trim((string)($pageEntry['name'] ?? ''));
  if ($name === '') {
    $name = 'Seite ' . ($index + 1);
  }

  return [
    'id' => $id,
    'name' => $name,
    'elements' => $normalizedElements,
  ];
}

function pdf_template_normalize_payload(array $payload, string $toolKey): array {
  $page = is_array($payload['page'] ?? null) ? $payload['page'] : [];
  $elements = is_array($payload['elements'] ?? null) ? $payload['elements'] : [];
  $pages = is_array($payload['pages'] ?? null) ? $payload['pages'] : [];
  $schemaVersion = (int)($payload['schema_version'] ?? 1);
  if ($schemaVersion < 1 || $schemaVersion > 100) {
    $schemaVersion = 1;
  }

  if ($pages === []) {
    $pages = [[
      'id' => 'page_1',
      'name' => 'Seite 1',
      'elements' => $elements,
    ]];
  }

  $normalizedPages = [];
  foreach ($pages as $index => $pageEntry) {
    if (!is_array($pageEntry)) {
      continue;
    }
    $normalizedPages[] = pdf_template_normalize_page_entry($pageEntry, $index);
  }

  if ($normalizedPages === []) {
    $normalizedPages[] = pdf_template_normalize_page_entry(['elements' => []], 0);
  }

  return [
    'schema_version' => max(3, $schemaVersion),
    'tool_key' => $toolKey,
    'pdf_title_template' => trim((string)($payload['pdf_title_template'] ?? '')),
    'page' => pdf_template_normalize_page_settings($page),
    'pages' => $normalizedPages,
  ];
}

function pdf_template_validate_payload(array $payload, string $toolKey): array {
  $errors = [];

  $encoded = json_encode($payload, JSON_THROW_ON_ERROR);
  if (strlen((string)$encoded) > 2000000) {
    $errors[] = 'payload_too_large';
  }

  $page = is_array($payload['page'] ?? null) ? $payload['page'] : [];
  $pageWidth = (float)($page['width'] ?? 210);
  $pageHeight = (float)($page['height'] ?? 297);

  $pages = $payload['pages'] ?? null;
  if (!is_array($pages)) {
    $errors[] = 'pages_must_be_array';
    return $errors;
  }

  if ($pages === []) {
    $errors[] = 'pages_required';
    return $errors;
  }

  $pdfTitleTemplate = trim((string)($payload['pdf_title_template'] ?? ''));
  if (mb_strlen($pdfTitleTemplate) > 240) {
    $errors[] = 'pdf_title_template_too_long';
  }

  $allowedBindings = pdf_template_allowed_bindings($toolKey);
  $restrictBindings = $allowedBindings !== [];

  foreach ($pages as $pageIdx => $pageEntry) {
    if (!is_array($pageEntry)) {
      $errors[] = 'page_not_object:' . $pageIdx;
      continue;
    }

    $elements = $pageEntry['elements'] ?? null;
    if (!is_array($elements)) {
      $errors[] = 'elements_must_be_array:' . $pageIdx;
      continue;
    }

    if (count($elements) > 200) {
      $errors[] = 'too_many_elements:' . $pageIdx;
    }

    foreach ($elements as $idx => $el) {
      if (!is_array($el)) {
        $errors[] = 'element_not_object:' . $pageIdx . ':' . $idx;
        continue;
      }

      $x = (float)($el['x'] ?? -1);
      $y = (float)($el['y'] ?? -1);
      $w = (float)($el['w'] ?? -1);
      $h = (float)($el['h'] ?? -1);
      $fontSize = (float)($el['font_size'] ?? 11);
      $text = (string)($el['text'] ?? '');
      $bind = trim((string)($el['bind'] ?? ''));
      $type = (string)($el['type'] ?? 'text');
      $strokeWidth = (float)($el['stroke_width'] ?? 1);
      $strokeColor = trim((string)($el['stroke_color'] ?? '#1f2937'));
      $fillColor = trim((string)($el['fill_color'] ?? '#cdeed6'));
      $textColor = trim((string)($el['text_color'] ?? '#1b1f23'));
      $imageSrc = trim((string)($el['image_src'] ?? ''));
      $groupId = trim((string)($el['group_id'] ?? ''));
      $lineHeightFactor = (float)($el['line_height_factor'] ?? 1.2);
      $baselineOffsetMm = (float)($el['baseline_offset_mm'] ?? 0.0);
      $overflowMode = trim((string)($el['overflow_mode'] ?? 'clip'));
      $maxLines = (int)($el['max_lines'] ?? 0);
      $fontFamilyId = trim((string)($el['font_family_id'] ?? 'helvetica'));
      $chartVariant = trim((string)($el['chart_variant'] ?? 'line'));
      $prefix = $pageIdx . ':' . $idx;

      if (!in_array($type, ['text', 'line', 'rect', 'rect_fill', 'image', 'chart'], true)) {
        $errors[] = 'type_not_supported:' . $prefix;
      }

      if ($x < 0 || $x > $pageWidth) {
        $errors[] = 'x_out_of_bounds:' . $prefix;
      }
      if ($y < 0 || $y > $pageHeight) {
        $errors[] = 'y_out_of_bounds:' . $prefix;
      }
      if ($w < 1 || $w > $pageWidth) {
        $errors[] = 'w_out_of_bounds:' . $prefix;
      }
      if ($h < 1 || $h > $pageHeight) {
        $errors[] = 'h_out_of_bounds:' . $prefix;
      }
      if ($fontSize < 6 || $fontSize > 40) {
        $errors[] = 'font_size_out_of_bounds:' . $prefix;
      }
      if ($strokeWidth < 0.2 || $strokeWidth > 10) {
        $errors[] = 'stroke_width_out_of_bounds:' . $prefix;
      }
      if (mb_strlen($text) > 2000) {
        $errors[] = 'text_too_long:' . $prefix;
      }
      if ($bind !== '' && $restrictBindings && !in_array($bind, $allowedBindings, true)) {
        $errors[] = 'binding_not_allowed:' . $prefix;
      }
      foreach ([$strokeColor, $fillColor, $textColor] as $colorValue) {
        if ($colorValue !== 'transparent' && !preg_match('/^#[0-9a-fA-F]{6}$/', $colorValue)) {
          $errors[] = 'invalid_color:' . $prefix;
          break;
        }
      }
      if ($imageSrc !== '' && mb_strlen($imageSrc) > 1500000) {
        $errors[] = 'image_source_too_large:' . $prefix;
      }
      if ($groupId !== '' && !preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $groupId)) {
        $errors[] = 'invalid_group_id:' . $prefix;
      }
      if ($lineHeightFactor < 0.8 || $lineHeightFactor > 2.0) {
        $errors[] = 'line_height_factor_out_of_bounds:' . $prefix;
      }
      if ($baselineOffsetMm < -5.0 || $baselineOffsetMm > 5.0) {
        $errors[] = 'baseline_offset_mm_out_of_bounds:' . $prefix;
      }
      if (!in_array($overflowMode, ['clip', 'ellipsis'], true)) {
        $errors[] = 'overflow_mode_not_supported:' . $prefix;
      }
      if ($maxLines < 0 || $maxLines > 200) {
        $errors[] = 'max_lines_out_of_bounds:' . $prefix;
      }
      if (!in_array($fontFamilyId, ['helvetica'], true)) {
        $errors[] = 'font_family_not_supported:' . $prefix;
      }
      if (!in_array($chartVariant, ['line'], true)) {
        $errors[] = 'chart_variant_not_supported:' . $prefix;
      }
    }
  }

  return $errors;
}

function pdf_template_find_active_template_for_tool(PDO $db, string $toolKey): ?array {
  $publishedStmt = $db->prepare('SELECT *
    FROM pdf_templates
    WHERE deleted_at IS NULL AND tool_key = ? AND status = "published"
    ORDER BY updated_at DESC, version DESC, id DESC
    LIMIT 1');
  $publishedStmt->execute([$toolKey]);
  $published = $publishedStmt->fetch(PDO::FETCH_ASSOC);
  if (is_array($published)) {
    return $published;
  }

  $fallbackStmt = $db->prepare('SELECT *
    FROM pdf_templates
    WHERE deleted_at IS NULL AND tool_key = ?
    ORDER BY updated_at DESC, version DESC, id DESC
    LIMIT 1');
  $fallbackStmt->execute([$toolKey]);
  $fallback = $fallbackStmt->fetch(PDO::FETCH_ASSOC);
  return is_array($fallback) ? $fallback : null;
}

function pdf_template_fetch_row(PDO $db, int $id): ?array {
  $stmt = $db->prepare('SELECT * FROM pdf_templates WHERE id = ? AND deleted_at IS NULL LIMIT 1');
  $stmt->execute([$id]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  return is_array($row) ? $row : null;
}

function pdf_template_example_data(string $toolKey): array {
  $today = gmdate('Y-m-d');

  if ($toolKey === 'dguv_v3') {
    return [
      'asset_uid' => 'DG-10024',
      'asset_name' => 'Messgeraet Flur 2',
      'location' => 'Standort Nord / Ebene 2',
      'inspection_date' => $today,
      'next_due_date' => gmdate('Y-m-d', strtotime('+1 year')),
      'inspection_result' => 'bestanden',
    ];
  }

  if ($toolKey === 'cuesheet') {
    return [
      'title' => 'Abendveranstaltung Freitag',
      'owner_username' => (string)($_SESSION['username'] ?? 'admin'),
      'updated_at' => gmdate('c'),
    ];
  }

  if ($toolKey === 'patchmatrix') {
    return [
      'title' => 'Patchmatrix A / Segment 04',
      'created_by' => (string)($_SESSION['username'] ?? 'admin'),
      'updated_at' => gmdate('c'),
    ];
  }

  return [
    'project_name' => 'Messung Halle Ost',
    'measurement_date' => $today,
    'operator_name' => (string)($_SESSION['username'] ?? 'admin'),
    'result_laeq' => '73.4 dB(A)',
    'result_peak' => '98.1 dB(C)',
    'customer' => 'Musterkunde GmbH',
    'chart_laeq_series' => [
      'title' => 'LAeq Verlauf',
      'unit' => 'dB(A)',
      'limit' => 99,
      'points' => [
        ['label' => '18:00', 'value' => 92.4],
        ['label' => '18:15', 'value' => 95.1],
        ['label' => '18:30', 'value' => 98.3],
        ['label' => '18:45', 'value' => 96.8],
        ['label' => '19:00', 'value' => 93.9],
      ],
    ],
    'chart_lcpeak_series' => [
      'title' => 'LCpeak Verlauf',
      'unit' => 'dB(C)',
      'limit' => 135,
      'points' => [
        ['label' => '18:00', 'value' => 124.2],
        ['label' => '18:15', 'value' => 129.7],
        ['label' => '18:30', 'value' => 133.8],
        ['label' => '18:45', 'value' => 131.4],
        ['label' => '19:00', 'value' => 126.6],
      ],
    ],
  ];
}

function pdf_template_resolve_text(array $element, array $data): string {
  $bound = trim((string)($element['bind'] ?? ''));
  if ($bound !== '' && array_key_exists($bound, $data)) {
    $value = $data[$bound];
    if (is_scalar($value) || $value === null) {
      return trim((string)$value);
    }
    return '';
  }

  $text = trim((string)($element['text'] ?? ''));
  if ($text === '') {
    return '';
  }

  // Fallback: erlaubt {{Platzhalter}} auch ohne bind-Feld.
  $resolved = preg_replace_callback('/\{\{\s*([^}]+)\s*\}\}/u', static function(array $m) use ($data): string {
    $rawKey = trim((string)($m[1] ?? ''));
    if ($rawKey === '') {
      return '';
    }

    $candidates = [];
    $candidates[] = $rawKey;

    $norm = mb_strtolower($rawKey, 'UTF-8');
    $norm = strtr($norm, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss']);
    $norm = preg_replace('/[^a-z0-9]+/u', '_', $norm) ?? $norm;
    $norm = trim($norm, '_');
    if ($norm !== '') {
      $candidates[] = $norm;
    }

    $aliasMap = [
      'veranstaltung' => 'project_name',
      'datum' => 'measurement_date',
      'location' => 'location',
      'umgebung' => 'environment',
      'operator' => 'operator_name',
      'foh_techniker' => 'customer',
      'messposition' => 'measurement_position',
      'lauteste_position' => 'loudest_position',
      'messgeraet' => 'device_model',
      'kalibrator' => 'calibrator_model',
      'sn' => 'device_sn',
      'kal_sn' => 'calibrator_sn',
      'laeq' => 'result_laeq',
      'peak' => 'result_peak',
      'name' => 'report_name',
    ];
    if ($norm !== '' && isset($aliasMap[$norm])) {
      $candidates[] = $aliasMap[$norm];
    }

    foreach ($candidates as $key) {
      if (!array_key_exists($key, $data)) {
        continue;
      }
      $value = $data[$key];
      if (is_scalar($value) || $value === null) {
        return trim((string)$value);
      }
    }

    return $m[0];
  }, $text);

  return trim((string)$resolved);
}

function pdf_template_resolve_data_token(string $rawKey, array $data): ?string {
  $rawKey = trim($rawKey);
  if ($rawKey === '') {
    return null;
  }

  // Built-in tokens for filename templates.
  $builtins = [
    'today' => date('Y-m-d'),
    'date' => date('Y-m-d'),
    'now' => date('Y-m-d_H-i'),
    'datetime' => date('Y-m-d_H-i'),
    'time' => date('H-i'),
  ];
  $builtinKey = mb_strtolower($rawKey, 'UTF-8');
  if (array_key_exists($builtinKey, $builtins)) {
    return $builtins[$builtinKey];
  }

  $candidates = [];
  $candidates[] = $rawKey;

  $norm = mb_strtolower($rawKey, 'UTF-8');
  $norm = strtr($norm, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss']);
  $norm = preg_replace('/[^a-z0-9]+/u', '_', $norm) ?? $norm;
  $norm = trim($norm, '_');
  if ($norm !== '') {
    $candidates[] = $norm;
  }

  $aliasMap = [
    'veranstaltung' => 'project_name',
    'name_der_veranstaltung' => 'project_name',
    'datum' => 'measurement_date',
    'datum_der_veranstaltung' => 'measurement_date',
    'location' => 'location',
    'umgebung' => 'environment',
    'operator' => 'operator_name',
    'foh_techniker' => 'customer',
    'messposition' => 'measurement_position',
    'lauteste_position' => 'loudest_position',
    'messgeraet' => 'device_model',
    'kalibrator' => 'calibrator_model',
    'sn' => 'device_sn',
    'kal_sn' => 'calibrator_sn',
    'laeq' => 'result_laeq',
    'peak' => 'result_peak',
    'name' => 'report_name',
  ];
  if ($norm !== '' && isset($aliasMap[$norm])) {
    $candidates[] = $aliasMap[$norm];
  }

  foreach ($candidates as $key) {
    if (!array_key_exists($key, $data)) {
      continue;
    }
    $value = $data[$key];
    if (is_scalar($value) || $value === null) {
      return trim((string)$value);
    }
  }

  // Allow nested token paths like [report.title] for structured payloads.
  if (str_contains($rawKey, '.')) {
    $path = array_values(array_filter(array_map('trim', explode('.', $rawKey)), static fn(string $seg): bool => $seg !== ''));
    if ($path !== []) {
      $cursor = $data;
      foreach ($path as $segment) {
        if (!is_array($cursor) || !array_key_exists($segment, $cursor)) {
          $cursor = null;
          break;
        }
        $cursor = $cursor[$segment];
      }
      if (is_scalar($cursor) || $cursor === null) {
        return trim((string)$cursor);
      }
    }
  }

  return null;
}

function pdf_template_resolve_title_template(string $template, array $data, string $fallback = 'PDF Export'): string {
  $template = trim($template);
  if ($template === '') {
    $template = trim($fallback);
  }
  if ($template === '') {
    $template = 'PDF Export';
  }

  $resolved = preg_replace_callback('/\[([^\]]+)\]|\{\{\s*([^}]+)\s*\}\}/u', static function(array $m) use ($data): string {
    $rawKey = trim((string)($m[1] ?? $m[2] ?? ''));
    $value = pdf_template_resolve_data_token($rawKey, $data);
    if ($value === null) {
      return '';
    }
    return $value;
  }, $template);

  $resolved = preg_replace('/\s{2,}/u', ' ', (string)$resolved) ?? (string)$resolved;
  $resolved = trim((string)$resolved, " \t\n\r\0\x0B-_.");
  $resolved = trim((string)$resolved);
  if ($resolved === '') {
    return trim($fallback) !== '' ? trim($fallback) : 'PDF Export';
  }
  return $resolved;
}

function pdf_template_wrap_text(string $text, float $maxWidthPt, float $fontSizePt): array {
  $text = str_replace(["\r\n", "\r"], "\n", $text);
  $baseLines = explode("\n", $text);
  $wrapped = [];

  foreach ($baseLines as $line) {
    $line = trim((string)$line);
    if ($line === '') {
      $wrapped[] = '';
      continue;
    }

    if (pdf_template_estimate_text_width_pt($line, $fontSizePt) <= $maxWidthPt) {
      $wrapped[] = $line;
      continue;
    }

    $tokens = preg_split('/(\s+)/u', $line, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [];
    $current = '';
    foreach ($tokens as $token) {
      if ($token === '') {
        continue;
      }

      $candidate = $current . $token;
      if (pdf_template_estimate_text_width_pt($candidate, $fontSizePt) <= $maxWidthPt) {
        $current = $candidate;
        continue;
      }

      if (trim($current) !== '') {
        $wrapped[] = rtrim($current);
        $current = ltrim($token);
      } else {
        $current = trim($token);
      }

      if ($current === '') {
        continue;
      }

      while ($current !== '' && pdf_template_estimate_text_width_pt($current, $fontSizePt) > $maxWidthPt) {
        $part = '';
        foreach (pdf_template_split_chars($current) as $char) {
          $probe = $part . $char;
          if (pdf_template_estimate_text_width_pt($probe, $fontSizePt) > $maxWidthPt) {
            break;
          }
          $part = $probe;
        }

        if ($part === '') {
          break;
        }

        $wrapped[] = rtrim($part);
        $current = ltrim((string)mb_substr($current, mb_strlen($part)));
      }
    }

    if (trim($current) !== '') {
      $wrapped[] = rtrim($current);
    }
  }

  return $wrapped;
}

function pdf_template_split_chars(string $text): array {
  $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
  if (is_array($chars) && $chars !== []) {
    return $chars;
  }
  return str_split($text);
}

function pdf_template_estimate_text_width_pt(string $text, float $fontSizePt): float {
  $sum = 0.0;
  foreach (pdf_template_split_chars($text) as $char) {
    if (preg_match('/\s/u', $char)) {
      $sum += 0.32;
      continue;
    }
    if (preg_match('/[ilI1\.,:;\'"\|`]/u', $char)) {
      $sum += 0.28;
      continue;
    }
    if (preg_match('/[MW@%&QO0]/u', $char)) {
      $sum += 0.78;
      continue;
    }
    if (preg_match('/[A-Z]/u', $char)) {
      $sum += 0.62;
      continue;
    }
    $sum += 0.52;
  }
  return max(0.0, $sum * $fontSizePt);
}

function pdf_template_apply_ellipsis(string $line, float $maxWidthPt, float $fontSizePt): string {
  $line = trim($line);
  if ($line === '') {
    return '';
  }

  if (pdf_template_estimate_text_width_pt($line, $fontSizePt) <= $maxWidthPt) {
    return $line;
  }

  $ellipsis = '...';
  $ellipsisWidth = pdf_template_estimate_text_width_pt($ellipsis, $fontSizePt);
  if ($ellipsisWidth >= $maxWidthPt) {
    return '';
  }

  $allowed = $maxWidthPt - $ellipsisWidth;
  $out = '';
  foreach (pdf_template_split_chars($line) as $char) {
    $probe = $out . $char;
    if (pdf_template_estimate_text_width_pt($probe, $fontSizePt) > $allowed) {
      break;
    }
    $out = $probe;
  }

  $out = rtrim($out);
  if ($out === '') {
    return '';
  }

  return $out . $ellipsis;
}

function pdf_template_pdf_escape_text(string $text): string {
  $latin = @iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $text);
  if ($latin === false) {
    $latin = preg_replace('/[^\x20-\x7E]/', '?', $text) ?? '';
  }
  return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $latin);
}

function pdf_template_color_to_rgb(string $hex): array {
  if ($hex === 'transparent') {
    return [0.0, 0.0, 0.0];
  }
  if (!preg_match('/^#([0-9a-fA-F]{6})$/', $hex, $m)) {
    return [0.0, 0.0, 0.0];
  }
  $raw = $m[1];
  $r = hexdec(substr($raw, 0, 2)) / 255.0;
  $g = hexdec(substr($raw, 2, 2)) / 255.0;
  $b = hexdec(substr($raw, 4, 2)) / 255.0;
  return [$r, $g, $b];
}

function pdf_template_decode_jpeg_data_url(string $src): ?array {
  if (!preg_match('/^data:image\/(jpeg|jpg);base64,(.+)$/i', $src, $m)) {
    return null;
  }

  $decoded = base64_decode($m[2], true);
  if ($decoded === false || $decoded === '') {
    return null;
  }

  $info = @getimagesizefromstring($decoded);
  if (!is_array($info) || empty($info[0]) || empty($info[1]) || ($info['mime'] ?? '') !== 'image/jpeg') {
    return null;
  }

  return [
    'width' => (int)$info[0],
    'height' => (int)$info[1],
    'data' => $decoded,
  ];
}

function pdf_template_load_local_image_bytes(string $src): ?string {
  $toolserveBytes = pdf_template_load_toolserve_image_bytes($src);
  if ($toolserveBytes !== null) {
    return $toolserveBytes;
  }

  if ($src === '' || $src[0] !== '/') {
    return null;
  }

  $root = dirname(__DIR__);
  $pathPart = (string)(parse_url($src, PHP_URL_PATH) ?: '');
  if ($pathPart === '') {
    return null;
  }

  $rootReal = realpath($root);
  if ($rootReal === false) {
    return null;
  }

  $candidates = [];
  $candidates[] = $pathPart;
  $decodedPath = rawurldecode($pathPart);
  if ($decodedPath !== $pathPart) {
    $candidates[] = $decodedPath;
  }

  foreach ($candidates as $candidatePath) {
    if ($candidatePath === '' || str_contains($candidatePath, '..')) {
      continue;
    }

    $fullPath = realpath($root . $candidatePath);
    if ($fullPath === false) {
      continue;
    }

    if (strncmp($fullPath, $rootReal . DIRECTORY_SEPARATOR, strlen($rootReal . DIRECTORY_SEPARATOR)) !== 0) {
      continue;
    }

    $bytes = @file_get_contents($fullPath);
    if ($bytes !== false && $bytes !== '') {
      return $bytes;
    }
  }

  return null;
}

function pdf_template_load_toolserve_image_bytes(string $src): ?string {
  $parts = parse_url($src);
  if (!is_array($parts)) {
    return null;
  }

  $path = (string)($parts['path'] ?? '');
  if ($path !== '/toolserve.php') {
    return null;
  }

  $query = [];
  parse_str((string)($parts['query'] ?? ''), $query);

  $toolName = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($query['name'] ?? ''));
  $file = str_replace("\0", '', (string)($query['file'] ?? ''));
  $file = ltrim(str_replace('\\', '/', $file), '/');

  if ($toolName === '' || $file === '' || str_contains($file, '..')) {
    return null;
  }

  $config = require __DIR__ . '/config.php';
  $toolsDir = (string)($config['tools_dir'] ?? '');
  $toolsBase = realpath($toolsDir);
  if ($toolsBase === false) {
    return null;
  }

  $toolBase = realpath($toolsBase . DIRECTORY_SEPARATOR . $toolName);
  if ($toolBase === false) {
    return null;
  }

  $target = realpath($toolBase . DIRECTORY_SEPARATOR . $file);
  if ($target === false) {
    return null;
  }

  if ($target !== $toolBase && strncmp($target, $toolBase . DIRECTORY_SEPARATOR, strlen($toolBase . DIRECTORY_SEPARATOR)) !== 0) {
    return null;
  }

  $bytes = @file_get_contents($target);
  if ($bytes === false || $bytes === '') {
    return null;
  }

  return $bytes;
}

function pdf_template_convert_image_bytes_to_jpeg(string $raw): ?array {
  $info = @getimagesizefromstring($raw);
  if (!is_array($info) || empty($info[0]) || empty($info[1])) {
    return null;
  }

  if (($info['mime'] ?? '') === 'image/jpeg') {
    return [
      'width' => (int)$info[0],
      'height' => (int)$info[1],
      'data' => $raw,
    ];
  }

  if (!function_exists('imagecreatefromstring') || !function_exists('imagejpeg')) {
    return null;
  }

  $img = @imagecreatefromstring($raw);
  if ($img === false) {
    return null;
  }

  $width = imagesx($img);
  $height = imagesy($img);
  $canvas = imagecreatetruecolor($width, $height);
  if ($canvas === false) {
    return null;
  }

  $white = imagecolorallocate($canvas, 255, 255, 255);
  imagefill($canvas, 0, 0, $white);
  imagecopy($canvas, $img, 0, 0, 0, 0, $width, $height);

  ob_start();
  imagejpeg($canvas, null, 90);
  $jpeg = ob_get_clean();

  if (!is_string($jpeg) || $jpeg === '') {
    return null;
  }

  return [
    'width' => $width,
    'height' => $height,
    'data' => $jpeg,
  ];
}

function pdf_template_resolve_image_source(string $src): ?array {
  $src = trim($src);
  if ($src === '') {
    return null;
  }

  $jpegData = pdf_template_decode_jpeg_data_url($src);
  if (is_array($jpegData)) {
    return $jpegData;
  }

  $raw = null;
  if (preg_match('/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/i', $src, $m)) {
    $raw = base64_decode($m[1], true) ?: null;
  } else {
    $raw = pdf_template_load_local_image_bytes($src);
  }

  if (!is_string($raw) || $raw === '') {
    return null;
  }

  return pdf_template_convert_image_bytes_to_jpeg($raw);
}

function pdf_template_build_pdf(array $pages): string {
  $objects = [];
  $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  $objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  $objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  $kids = [];
  $nextObjectId = 5;

  foreach ($pages as $pageSpec) {
    if (!is_array($pageSpec)) {
      continue;
    }

    $pageWidthMm = (float)($pageSpec['width'] ?? 210);
    $pageHeightMm = (float)($pageSpec['height'] ?? 297);
    $pageWidthPt = $pageWidthMm * 72.0 / 25.4;
    $pageHeightPt = $pageHeightMm * 72.0 / 25.4;
    $contentStream = (string)($pageSpec['content'] ?? '');
    $images = is_array($pageSpec['images'] ?? null) ? $pageSpec['images'] : [];
    $resourceParts = ['/Font << /F1 3 0 R /F2 4 0 R >>'];
    $imageObjectByName = [];

    foreach ($images as $name => $img) {
      if (!is_array($img)) {
        continue;
      }
      $w = (int)($img['width'] ?? 0);
      $h = (int)($img['height'] ?? 0);
      $bin = (string)($img['data'] ?? '');
      if ($w <= 0 || $h <= 0 || $bin === '') {
        continue;
      }

      $objectId = $nextObjectId;
      $nextObjectId++;
      $imageObjectByName[$name] = $objectId;
      $len = strlen($bin);
      $objects[$objectId] = "<< /Type /XObject /Subtype /Image /Width {$w} /Height {$h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {$len} >>\nstream\n{$bin}\nendstream";
    }

    if ($imageObjectByName !== []) {
      $xObjRefs = [];
      foreach ($imageObjectByName as $name => $objId) {
        $xObjRefs[] = '/' . $name . ' ' . $objId . ' 0 R';
      }
      $resourceParts[] = '/XObject << ' . implode(' ', $xObjRefs) . ' >>';
    }

    $contentId = $nextObjectId;
    $nextObjectId++;
    $objects[$contentId] = "<< /Length " . strlen($contentStream) . " >>\nstream\n{$contentStream}\nendstream";

    $pageId = $nextObjectId;
    $nextObjectId++;
    $kids[] = $pageId . ' 0 R';
    $objects[$pageId] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' . sprintf('%.2f %.2f', $pageWidthPt, $pageHeightPt) . '] /Resources << ' . implode(' ', $resourceParts) . ' >> /Contents ' . $contentId . ' 0 R >>';
  }

  if ($kids === []) {
    $objects[5] = "<< /Length 0 >>\nstream\n\nendstream";
    $objects[6] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 5 0 R >>';
    $kids[] = '6 0 R';
  }

  $objects[2] = '<< /Type /Pages /Count ' . count($kids) . ' /Kids [' . implode(' ', $kids) . '] >>';

  ksort($objects);

  $pdf = "%PDF-1.4\n";
  $offsets = [0];
  $count = count($objects);

  for ($i = 1; $i <= $count; $i++) {
    $offsets[$i] = strlen($pdf);
    $pdf .= $i . " 0 obj\n" . $objects[$i] . "\nendobj\n";
  }

  $xrefOffset = strlen($pdf);
  $pdf .= "xref\n0 " . ($count + 1) . "\n";
  $pdf .= "0000000000 65535 f \n";

  for ($i = 1; $i <= $count; $i++) {
    $pdf .= str_pad((string)$offsets[$i], 10, '0', STR_PAD_LEFT) . " 00000 n \n";
  }

  $pdf .= "trailer\n<< /Size " . ($count + 1) . " /Root 1 0 R >>\nstartxref\n{$xrefOffset}\n%%EOF";
  return $pdf;
}

function pdf_template_render_pdf(array $payload, array $data, string $title = 'PDF-Vorlage'): string {
  $page = is_array($payload['page'] ?? null) ? $payload['page'] : [];
  $pages = is_array($payload['pages'] ?? null) ? $payload['pages'] : [];

  $pageWidthMm = (float)($page['width'] ?? 210);
  $pageHeightMm = (float)($page['height'] ?? 297);
  $orientation = (string)($page['orientation'] ?? 'portrait');
  if ($orientation === 'landscape' && $pageHeightMm > $pageWidthMm) {
    [$pageWidthMm, $pageHeightMm] = [$pageHeightMm, $pageWidthMm];
  }

  $ptPerMm = 72.0 / 25.4;
  $pdfPages = [];

  foreach ($pages as $pageIndex => $pageEntry) {
    if (!is_array($pageEntry)) {
      continue;
    }

    $elements = is_array($pageEntry['elements'] ?? null) ? $pageEntry['elements'] : [];
    $commands = [];
    $images = [];
    $imageCounter = 1;

    foreach ($elements as $element) {
      if (!is_array($element)) {
        continue;
      }

    $type = (string)($element['type'] ?? 'text');

    $xMm = (float)($element['x'] ?? 0);
    $yMm = (float)($element['y'] ?? 0);
    $wMm = max(1.0, (float)($element['w'] ?? 60));
    $hMm = max(1.0, (float)($element['h'] ?? 8));
    $fontSize = (float)($element['font_size'] ?? 11);
    $fontSize = max(6.0, min(40.0, $fontSize));
    $align = (string)($element['align'] ?? 'left');
    $lineHeightFactor = (float)($element['line_height_factor'] ?? 1.2);
    if ($lineHeightFactor < 0.8 || $lineHeightFactor > 2.0) {
      $lineHeightFactor = 1.2;
    }
    $baselineOffsetMm = (float)($element['baseline_offset_mm'] ?? 0.0);
    if ($baselineOffsetMm < -5.0 || $baselineOffsetMm > 5.0) {
      $baselineOffsetMm = 0.0;
    }
    $overflowMode = (string)($element['overflow_mode'] ?? 'clip');
    if (!in_array($overflowMode, ['clip', 'ellipsis'], true)) {
      $overflowMode = 'clip';
    }
    $configuredMaxLines = (int)($element['max_lines'] ?? 0);
    if ($configuredMaxLines < 0 || $configuredMaxLines > 200) {
      $configuredMaxLines = 0;
    }
    $fontRef = ((string)($element['font_weight'] ?? 'normal')) === 'bold' ? 'F2' : 'F1';
    $strokeWidth = max(0.2, min(10.0, (float)($element['stroke_width'] ?? 1.0)));
    $strokeColor = (string)($element['stroke_color'] ?? '#1f2937');
    $fillColor = (string)($element['fill_color'] ?? '#cdeed6');
    $textColor = (string)($element['text_color'] ?? '#1b1f23');
    [$sr, $sg, $sb] = pdf_template_color_to_rgb($strokeColor);
    [$fr, $fg, $fb] = pdf_template_color_to_rgb($fillColor);
    [$tr, $tg, $tb] = pdf_template_color_to_rgb($textColor);

    $xPt = $xMm * $ptPerMm;
    $yTopPt = $pageHeightMm * $ptPerMm - ($yMm * $ptPerMm);
    $yBottomPt = $yTopPt - ($hMm * $ptPerMm);
    $maxWidthPt = $wMm * $ptPerMm;

    if ($type === 'line') {
      $lineHeightPt = max(0.5, $hMm * $ptPerMm);
      $commands[] = sprintf('%.3f w %.3f %.3f %.3f RG %.3f %.3f %.3f %.3f re f', $lineHeightPt, $sr, $sg, $sb, $xPt, $yBottomPt, $maxWidthPt, $lineHeightPt);
      continue;
    }

    if ($type === 'rect' || $type === 'rect_fill') {
      $cmd = sprintf('%.3f w %.3f %.3f %.3f RG ', $strokeWidth, $sr, $sg, $sb);
      if ($type === 'rect_fill' && $fillColor !== 'transparent') {
        $cmd .= sprintf('%.3f %.3f %.3f rg ', $fr, $fg, $fb);
      }
      $cmd .= sprintf('%.3f %.3f %.3f %.3f re ', $xPt, $yBottomPt, $maxWidthPt, $hMm * $ptPerMm);
      $cmd .= ($type === 'rect_fill' && $fillColor !== 'transparent') ? 'B' : 'S';
      $commands[] = $cmd;
      continue;
    }

      if ($type === 'image') {
      $src = trim((string)($element['image_src'] ?? ''));
      $imgData = $src !== '' ? pdf_template_resolve_image_source($src) : null;
      if (is_array($imgData)) {
        $name = 'Im' . $imageCounter;
        $imageCounter++;
        $images[$name] = $imgData;

        $imgW = (float)($imgData['width'] ?? 0);
        $imgH = (float)($imgData['height'] ?? 0);
        if ($imgW > 0 && $imgH > 0) {
          $boxWPt = $maxWidthPt;
          $boxHPt = $hMm * $ptPerMm;
          $imgAspect = $imgW / $imgH;
          $boxAspect = ($boxHPt > 0.0) ? ($boxWPt / $boxHPt) : 1.0;

          $drawWPt = $boxWPt;
          $drawHPt = $boxHPt;
          if ($imgAspect > $boxAspect) {
            $drawHPt = $boxWPt / $imgAspect;
          } else {
            $drawWPt = $boxHPt * $imgAspect;
          }

          $offsetXPt = $xPt + (($boxWPt - $drawWPt) / 2.0);
          $offsetYPt = $yBottomPt + (($boxHPt - $drawHPt) / 2.0);
          $commands[] = sprintf('q %.3f 0 0 %.3f %.3f %.3f cm /%s Do Q', $drawWPt, $drawHPt, $offsetXPt, $offsetYPt, $name);
        } else {
          $commands[] = sprintf('q %.3f 0 0 %.3f %.3f %.3f cm /%s Do Q', $maxWidthPt, $hMm * $ptPerMm, $xPt, $yBottomPt, $name);
        }
      } else {
        $commands[] = sprintf('0.92 0.92 0.92 RG %.3f w %.3f %.3f %.3f %.3f re S', 0.4, $xPt, $yBottomPt, $maxWidthPt, $hMm * $ptPerMm);
      }
        continue;
      }

      if ($type === 'chart') {
        $chartSource = $element['bind'] !== '' && array_key_exists((string)$element['bind'], $data) ? $data[(string)$element['bind']] : null;
        $chartPoints = [];
        $chartTitle = trim((string)($element['text'] ?? ''));
        $chartLimit = null;
        $chartUnit = '';
        if (is_array($chartSource)) {
          $sourcePoints = is_array($chartSource['points'] ?? null) ? $chartSource['points'] : $chartSource;
          foreach ($sourcePoints as $point) {
            if (is_array($point)) {
              $value = $point['value'] ?? $point['y'] ?? null;
              $label = trim((string)($point['label'] ?? $point['time'] ?? $point['x'] ?? ''));
            } else {
              $value = $point;
              $label = '';
            }
            if (!is_numeric($value)) {
              continue;
            }
            $chartPoints[] = [
              'value' => (float)$value,
              'label' => $label,
            ];
          }
          if ($chartTitle === '') {
            $chartTitle = trim((string)($chartSource['title'] ?? ''));
          }
          if (is_numeric($chartSource['limit'] ?? null)) {
            $chartLimit = (float)$chartSource['limit'];
          }
          $chartUnit = trim((string)($chartSource['unit'] ?? ''));
        }

        $boxFill = $fillColor === 'transparent' ? [1.0, 1.0, 1.0] : [$fr, $fg, $fb];
        $commands[] = sprintf('%.3f w %.3f %.3f %.3f RG %.3f %.3f %.3f rg %.3f %.3f %.3f %.3f re B', $strokeWidth, $sr, $sg, $sb, $boxFill[0], $boxFill[1], $boxFill[2], $xPt, $yBottomPt, $maxWidthPt, $hMm * $ptPerMm);

        if ($chartTitle !== '') {
          $commands[] = 'BT ' . sprintf('%.3f %.3f %.3f', $tr, $tg, $tb) . ' rg /F2 ' . sprintf('%.2f', max(8.0, $fontSize)) . ' Tf ' . sprintf('%.2f', $xPt + (3 * $ptPerMm)) . ' ' . sprintf('%.2f', $yTopPt - (6 * $ptPerMm)) . ' Td (' . pdf_template_pdf_escape_text($chartTitle) . ') Tj ET';
        }

        if (count($chartPoints) >= 2) {
          $plotLeft = $xPt + (8 * $ptPerMm);
          $plotBottom = $yBottomPt + (8 * $ptPerMm);
          $plotWidth = max(10.0, $maxWidthPt - (14 * $ptPerMm));
          $plotHeight = max(10.0, ($hMm * $ptPerMm) - (18 * $ptPerMm));
          $values = array_map(static fn(array $point): float => (float)$point['value'], $chartPoints);
          $minValue = min($values);
          $maxValue = max($values);
          if ($chartLimit !== null) {
            $minValue = min($minValue, $chartLimit);
            $maxValue = max($maxValue, $chartLimit);
          }
          if (abs($maxValue - $minValue) < 0.001) {
            $maxValue = $minValue + 1.0;
          }

          $commands[] = sprintf('0.760 0.780 0.820 RG 0.500 w %.3f %.3f m %.3f %.3f l S', $plotLeft, $plotBottom, $plotLeft + $plotWidth, $plotBottom);
          $commands[] = sprintf('0.760 0.780 0.820 RG 0.500 w %.3f %.3f m %.3f %.3f l S', $plotLeft, $plotBottom, $plotLeft, $plotBottom + $plotHeight);

          if (!empty($element['chart_show_limit']) && $chartLimit !== null) {
            $limitRatio = ($chartLimit - $minValue) / ($maxValue - $minValue);
            $limitY = $plotBottom + ($plotHeight * $limitRatio);
            $commands[] = sprintf('0.850 0.320 0.180 RG 0.900 w [3 2] 0 d %.3f %.3f m %.3f %.3f l S [] 0 d', $plotLeft, $limitY, $plotLeft + $plotWidth, $limitY);
          }

          $segments = [];
          $pointCount = count($chartPoints);
          foreach ($chartPoints as $idx => $point) {
            $ratioX = $pointCount <= 1 ? 0.0 : ($idx / ($pointCount - 1));
            $ratioY = (((float)$point['value']) - $minValue) / ($maxValue - $minValue);
            $px = $plotLeft + ($plotWidth * $ratioX);
            $py = $plotBottom + ($plotHeight * $ratioY);
            $segments[] = sprintf('%.3f %.3f %s', $px, $py, $idx === 0 ? 'm' : 'l');
          }
          $commands[] = sprintf('%.3f %.3f %.3f RG 1.200 w %s S', $sr, $sg, $sb, implode(' ', $segments));

          if ($chartUnit !== '') {
            $commands[] = 'BT ' . sprintf('%.3f %.3f %.3f', $tr, $tg, $tb) . ' rg /F1 7.00 Tf ' . sprintf('%.2f', $xPt + (3 * $ptPerMm)) . ' ' . sprintf('%.2f', $yBottomPt + (2 * $ptPerMm)) . ' Td (' . pdf_template_pdf_escape_text($chartUnit) . ') Tj ET';
          }
        } else {
          $fallbackText = $element['bind'] !== '' ? 'Keine Diagrammdaten fuer ' . (string)$element['bind'] : 'Keine Diagrammdaten';
          $commands[] = 'BT 0.450 0.450 0.450 rg /F1 9.00 Tf ' . sprintf('%.2f', $xPt + (3 * $ptPerMm)) . ' ' . sprintf('%.2f', $yBottomPt + (($hMm * $ptPerMm) / 2.0)) . ' Td (' . pdf_template_pdf_escape_text($fallbackText) . ') Tj ET';
        }
        continue;
      }

      $text = pdf_template_resolve_text($element, $data);
      if ($text === '') {
        continue;
      }

    $lineHeightPt = max(6.0, $fontSize * $lineHeightFactor);
    $maxLinesByBox = (int)max(1, floor(($hMm * $ptPerMm) / $lineHeightPt));
    $maxLines = $configuredMaxLines > 0 ? min($maxLinesByBox, $configuredMaxLines) : $maxLinesByBox;

    $lines = pdf_template_wrap_text($text, $maxWidthPt, $fontSize);
    if (count($lines) > $maxLines) {
      $lines = array_slice($lines, 0, $maxLines);
      if ($overflowMode === 'ellipsis' && $maxLines > 0) {
        $lastIdx = $maxLines - 1;
        $lines[$lastIdx] = pdf_template_apply_ellipsis((string)$lines[$lastIdx], $maxWidthPt, $fontSize);
      }
    }

      foreach ($lines as $lineIdx => $line) {
        $rawLine = trim((string)$line);
        if ($rawLine === '') {
          continue;
        }

        $lineWidthPt = pdf_template_estimate_text_width_pt($rawLine, $fontSize);
        $lineX = $xPt;
        if ($align === 'center') {
          $lineX = $xPt + max(0.0, ($maxWidthPt - $lineWidthPt) / 2.0);
        } elseif ($align === 'right') {
          $lineX = $xPt + max(0.0, $maxWidthPt - $lineWidthPt);
        }

        $baseline = $yTopPt - ($lineIdx * $lineHeightPt) - ($fontSize * 0.82) - ($baselineOffsetMm * $ptPerMm);
        if ($baseline < 0) {
          continue;
        }

        $safe = pdf_template_pdf_escape_text($rawLine);
        $commands[] = 'BT ' . sprintf('%.3f %.3f %.3f', $tr, $tg, $tb) . ' rg /' . $fontRef . ' ' . sprintf('%.2f', $fontSize) . ' Tf ' . sprintf('%.2f', $lineX) . ' ' . sprintf('%.2f', $baseline) . ' Td (' . $safe . ') Tj ET';
      }
    }

    $pdfPages[] = [
      'width' => $pageWidthMm,
      'height' => $pageHeightMm,
      'content' => implode("\n", $commands) . "\n",
      'images' => $images,
      'page_index' => $pageIndex,
      'title' => $title,
    ];
  }

  return pdf_template_build_pdf($pdfPages);
}
