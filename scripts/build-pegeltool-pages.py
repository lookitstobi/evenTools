#!/usr/bin/env python3
"""Build a static pegelTool preview without modifying the production application."""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "app" / "tools" / "pegelTool"
DEST = ROOT / "dist" / "pegeltool-preview"
ASSETS = [
    "import/nti-xl3.js",
    "evaluation/engine.js",
    "protocol/protocol.js",
    "report/report.js",
    "report/pdf.js",
    "ui/workflow.js",
    "ui/pa-selection.js",
    "vendor/chart.umd.min.js",
    "vendor/jspdf.umd.min.js",
    "vendor/pdf-lib.min.js",
]

if DEST.exists():
    shutil.rmtree(DEST)
DEST.mkdir(parents=True)
html = (SOURCE / "index.html").read_text(encoding="utf-8")
for relative in ASSETS:
    file = SOURCE / relative
    if not file.is_file():
        raise FileNotFoundError(f"Required frontend asset not found: {file}")
    target = DEST / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(file, target)
    remote = f"/toolserve.php?name=pegelTool&file={relative}"
    if remote not in html:
        raise ValueError(f"Missing expected script reference: {remote}")
    html = html.replace(remote, relative)
css = ROOT / "assets" / "app.css"
if not css.is_file():
    raise FileNotFoundError(css)
(DEST / "assets").mkdir(exist_ok=True)
shutil.copy2(css, DEST / "assets" / "app.css")
html = html.replace('href="/assets/app.css"', 'href="assets/app.css"')
# The legacy server-side PDF preview endpoint is not supported by static hosting.
# Phase 5's client-side jsPDF export remains available.
html = html.replace("</head>", '<meta name="robots" content="noindex,nofollow" />\n</head>', 1)
(DEST / "index.html").write_text(html, encoding="utf-8")
(DEST / ".nojekyll").write_text("", encoding="utf-8")
if re.search(r'<script[^>]+src="/toolserve\\.php', html):
    raise RuntimeError("Server-dependent script reference remained in preview")
print(f"Static preview built at {DEST}")
