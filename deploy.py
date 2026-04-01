#!/usr/bin/env python3
"""
Sicheres SFTP-Deploy für Toolsapp.

- Deployt nur definierte Code-Pfade
- Löscht nur innerhalb definierter Code-Pfade
- Sichert optionale Laufzeitdaten (SQLite) vor Deploy
"""

from __future__ import annotations

import fnmatch
import hashlib
import json
import os
import posixpath
import re
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

import paramiko

PROJECT_ROOT = Path(__file__).parent.resolve()


def int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default

HOST = os.getenv("STRATO_HOST")
USER = os.getenv("STRATO_USER")
PASSWORD = os.getenv("STRATO_PASS")
REMOTE_BASE = os.getenv("STRATO_PATH")
REMOTE_DATA_PATH = os.getenv("STRATO_DATA_PATH")
REMOTE_BACKUP_PATH = os.getenv("STRATO_BACKUP_PATH")
BACKUP_ENABLED = os.getenv("DEPLOY_BACKUP_ENABLED", "1") == "1"
IS_GITHUB_ACTIONS = os.getenv("GITHUB_ACTIONS", "").lower() == "true"
STRICT_DATA_PATH = os.getenv("DEPLOY_STRICT_DATA_PATH", "1") == "1"
BACKUP_INTERVAL_SECONDS = int_env("DEPLOY_BACKUP_INTERVAL_SECONDS", 21600)
DEPLOY_COMMIT_MESSAGE = os.getenv("DEPLOY_COMMIT_MESSAGE", "")

if not all([HOST, USER, PASSWORD, REMOTE_BASE]):
    env_file = PROJECT_ROOT / ".env.local"
    if env_file.exists():
        with env_file.open(encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()
                if key == "STRATO_HOST" and not HOST:
                    HOST = value
                elif key == "STRATO_USER" and not USER:
                    USER = value
                elif key == "STRATO_PASS" and not PASSWORD:
                    PASSWORD = value
                elif key == "STRATO_PATH" and not REMOTE_BASE:
                    REMOTE_BASE = value
                elif key == "STRATO_DATA_PATH" and not REMOTE_DATA_PATH:
                    REMOTE_DATA_PATH = value
                elif key == "STRATO_BACKUP_PATH" and not REMOTE_BACKUP_PATH:
                    REMOTE_BACKUP_PATH = value

if not all([HOST, USER, PASSWORD, REMOTE_BASE]):
    print("❌ Deploy-Konfiguration unvollständig (STRATO_HOST/USER/PASS/PATH)")
    sys.exit(1)

if IS_GITHUB_ACTIONS and STRICT_DATA_PATH and not REMOTE_DATA_PATH:
    print("❌ STRATO_DATA_PATH fehlt: CI-Deploy wird aus Sicherheitsgründen abgebrochen")
    print("   Bitte Secret STRATO_DATA_PATH setzen oder DEPLOY_STRICT_DATA_PATH=0 konfigurieren")
    sys.exit(1)

ROOT_FILES = {
    ".htaccess",
    "_bootstrap.php",
    "admin_edit.php",
    "admin_users.php",
    "clock.php",
    "cuesheet_api.php",
    "dguv_api.php",
    "dguv_print_agent.php",
    "index.php",
    "login.php",
    "logout.php",
    "pdf_template_api.php",
    "tool.php",
    "toolserve.php",
}

ROOT_DIRS = {
    "app",
    "assets",
}

EXCLUDE_NAMES = {
    ".git",
    ".github",
    ".vscode",
    "node_modules",
    "deploy.sh",
    "deploy.py",
    ".env",
    ".env.local",
    ".DS_Store",
    ".htrouter.php",
    "users.sqlite",
    "dguv.sqlite",
    "cuesheet.sqlite",
}

EXCLUDE_PATTERNS = {
    "*.sqlite",
    "*.bak_*",
    "*.log",
    "*.pyc",
}

INCLUDE_DOTFILES = {
    ".htaccess",
}

PROTECTED_REMOTE_PATTERNS = {
    "*.sqlite",
    "backups",
}

BACKUP_DB_FILES = ["users.sqlite", "dguv.sqlite", "cuesheet.sqlite"]
BACKUP_DIR_PREFIX = "deploy_"
DEPLOY_MANIFEST_FILE = ".deploy-manifest.json"


def list_remote_entries_map(sftp: paramiko.SFTPClient, remote_dir: str) -> Dict[str, paramiko.SFTPAttributes]:
    try:
        return {entry.filename: entry for entry in sftp.listdir_attr(remote_dir)}
    except OSError:
        return {}


def read_remote_text_file(sftp: paramiko.SFTPClient, remote_file: str) -> Optional[str]:
    try:
        with sftp.open(remote_file, "r") as handle:
            data = handle.read()
    except OSError:
        return None

    if isinstance(data, bytes):
        return data.decode("utf-8")
    return str(data)


def write_remote_text_file(sftp: paramiko.SFTPClient, remote_file: str, content: str) -> None:
    ensure_remote_dir(sftp, posixpath.dirname(remote_file))
    with sftp.open(remote_file, "w") as handle:
        handle.write(content)


def load_remote_manifest(sftp: paramiko.SFTPClient, remote_base: str) -> Dict[str, str]:
    remote_manifest_file = remote_join(remote_base, DEPLOY_MANIFEST_FILE)
    text = read_remote_text_file(sftp, remote_manifest_file)
    if text is None:
        return {}

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        print("⚠️ Ungueltiges Remote-Manifest, baue Manifest neu auf")
        return {}

    if not isinstance(parsed, dict):
        return {}

    manifest: Dict[str, str] = {}
    for key, value in parsed.items():
        if isinstance(key, str) and isinstance(value, str):
            manifest[key] = value
    return manifest


def save_remote_manifest(sftp: paramiko.SFTPClient, remote_base: str, manifest: Dict[str, str]) -> None:
    remote_manifest_file = remote_join(remote_base, DEPLOY_MANIFEST_FILE)
    content = json.dumps(manifest, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    write_remote_text_file(sftp, remote_manifest_file, content)


def file_sha256(local_file: Path, hash_cache: Dict[str, str]) -> str:
    cache_key = str(local_file)
    cached = hash_cache.get(cache_key)
    if cached is not None:
        return cached

    hasher = hashlib.sha256()
    with local_file.open("rb") as handle:
        for chunk in iter(lambda: handle.read(64 * 1024), b""):
            hasher.update(chunk)
    digest = hasher.hexdigest()
    hash_cache[cache_key] = digest
    return digest


def should_upload_from_manifest(
    local_file: Path,
    relative_path: str,
    remote_manifest: Dict[str, str],
    next_manifest: Dict[str, str],
    hash_cache: Dict[str, str],
) -> bool:
    local_hash = file_sha256(local_file, hash_cache)
    next_manifest[relative_path] = local_hash
    remote_hash = remote_manifest.get(relative_path)
    return remote_hash != local_hash


def commit_requests_forced_backup(message: str) -> bool:
    if not message:
        return False
    first_line = message.splitlines()[0].strip()
    return first_line.upper().startswith("#BACKUP")


def parse_backup_timestamp(dirname: str) -> Optional[datetime]:
    match = re.fullmatch(r"deploy_(\d{8}T\d{6}Z)", dirname)
    if not match:
        return None
    try:
        return datetime.strptime(match.group(1), "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def get_last_deploy_backup_timestamp(sftp: paramiko.SFTPClient, backup_base: str) -> Optional[datetime]:
    newest: Optional[datetime] = None
    for entry in list_remote_entries_map(sftp, backup_base).values():
        if not stat.S_ISDIR(entry.st_mode):
            continue
        ts = parse_backup_timestamp(entry.filename)
        if ts is None:
            continue
        if newest is None or ts > newest:
            newest = ts
    return newest


def should_run_backup(sftp: paramiko.SFTPClient, backup_base: str) -> bool:
    if commit_requests_forced_backup(DEPLOY_COMMIT_MESSAGE):
        print("ℹ️ Backup erzwungen durch Commit-Message (#BACKUP)")
        return True

    if BACKUP_INTERVAL_SECONDS <= 0:
        return True

    ensure_remote_dir(sftp, backup_base)
    last_backup = get_last_deploy_backup_timestamp(sftp, backup_base)
    if last_backup is None:
        return True

    elapsed_seconds = (datetime.now(timezone.utc) - last_backup).total_seconds()
    if elapsed_seconds < BACKUP_INTERVAL_SECONDS:
        remaining = int(BACKUP_INTERVAL_SECONDS - elapsed_seconds)
        print(f"ℹ️ Letztes Backup vor weniger als {BACKUP_INTERVAL_SECONDS // 3600}h, überspringe Backup (noch ~{remaining // 60} min)")
        return False

    return True


def normalize_remote(path: str) -> str:
    path = path.strip()
    if path == "":
        return "."
    return posixpath.normpath(path)


def remote_join(base: str, *parts: str) -> str:
    combined = base
    for part in parts:
        if not part:
            continue
        combined = posixpath.join(combined, part.replace("\\", "/"))
    return normalize_remote(combined)


def remote_rel(base: str, target: str) -> str:
    base_norm = normalize_remote(base)
    target_norm = normalize_remote(target)
    return posixpath.relpath(target_norm, base_norm)


def is_excluded_name(name: str) -> bool:
    if name in INCLUDE_DOTFILES:
        return False
    if name.startswith("."):
        return True
    if name in EXCLUDE_NAMES:
        return True
    return any(fnmatch.fnmatch(name, pattern) for pattern in EXCLUDE_PATTERNS)


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    remote_dir = normalize_remote(remote_dir)
    if remote_dir in {".", "/"}:
        return

    path_parts = []
    if remote_dir.startswith("/"):
        current = "/"
        tokens = [part for part in remote_dir.split("/") if part]
    else:
        current = "."
        tokens = [part for part in remote_dir.split("/") if part and part != "."]

    for token in tokens:
        path_parts.append(token)
        current = "/" + "/".join(path_parts) if remote_dir.startswith("/") else "/".join(path_parts)
        try:
            sftp.stat(current)
        except OSError:
            sftp.mkdir(current)


def is_remote_dir(sftp: paramiko.SFTPClient, remote_path: str) -> bool:
    try:
        attrs = sftp.stat(remote_path)
    except OSError:
        return False
    return stat.S_ISDIR(attrs.st_mode)


def safe_remove_dir(sftp: paramiko.SFTPClient, remote_dir: str, remote_base: str) -> None:
    entries = sftp.listdir_attr(remote_dir)
    for entry in entries:
        child = remote_join(remote_dir, entry.filename)
        rel = remote_rel(remote_base, child)
        if is_protected_remote(rel):
            continue
        if stat.S_ISDIR(entry.st_mode):
            safe_remove_dir(sftp, child, remote_base)
            try:
                sftp.rmdir(child)
            except OSError:
                pass
        else:
            sftp.remove(child)


def is_protected_remote(relative_path: str) -> bool:
    normalized = relative_path.replace("\\", "/").strip("./")
    if normalized == "":
        return False
    for pattern in PROTECTED_REMOTE_PATTERNS:
        if fnmatch.fnmatch(posixpath.basename(normalized), pattern):
            return True
        if fnmatch.fnmatch(normalized, pattern):
            return True
    return False


def upload_file_if_needed(
    sftp: paramiko.SFTPClient,
    local_file: Path,
    remote_file: str,
    display_path: str,
    remote_manifest: Dict[str, str],
    next_manifest: Dict[str, str],
    hash_cache: Dict[str, str],
) -> None:
    if should_upload_from_manifest(local_file, display_path, remote_manifest, next_manifest, hash_cache):
        ensure_remote_dir(sftp, posixpath.dirname(remote_file))
        sftp.put(str(local_file), remote_file)
        print(f"📤 {display_path}")


def sync_directory(
    sftp: paramiko.SFTPClient,
    local_dir: Path,
    remote_dir: str,
    remote_base: str,
    remote_manifest: Dict[str, str],
    next_manifest: Dict[str, str],
    hash_cache: Dict[str, str],
) -> None:
    ensure_remote_dir(sftp, remote_dir)
    remote_entries = list_remote_entries_map(sftp, remote_dir)

    local_dirs = set()
    local_files = set()

    for item in sorted(local_dir.iterdir(), key=lambda p: p.name):
        if is_excluded_name(item.name):
            continue

        remote_item = remote_join(remote_dir, item.name)
        relative_display = str(item.relative_to(PROJECT_ROOT)).replace("\\", "/")

        if item.is_dir():
            local_dirs.add(item.name)
            sync_directory(sftp, item, remote_item, remote_base, remote_manifest, next_manifest, hash_cache)
        elif item.is_file():
            local_files.add(item.name)
            if should_upload_from_manifest(item, relative_display, remote_manifest, next_manifest, hash_cache):
                ensure_remote_dir(sftp, posixpath.dirname(remote_item))
                sftp.put(str(item), remote_item)
                print(f"📤 {relative_display}")

    for entry in remote_entries.values():
        name = entry.filename
        remote_item = remote_join(remote_dir, name)
        rel_from_base = remote_rel(remote_base, remote_item)

        if is_protected_remote(rel_from_base):
            continue

        if stat.S_ISDIR(entry.st_mode):
            if name not in local_dirs:
                print(f"🧹 Entferne Verzeichnis: {rel_from_base}")
                safe_remove_dir(sftp, remote_item, remote_base)
                try:
                    sftp.rmdir(remote_item)
                except OSError:
                    pass
        else:
            if name not in local_files:
                print(f"🧹 Entferne Datei: {rel_from_base}")
                sftp.remove(remote_item)


def sync_root_files(
    sftp: paramiko.SFTPClient,
    remote_base: str,
    remote_manifest: Dict[str, str],
    next_manifest: Dict[str, str],
    hash_cache: Dict[str, str],
) -> None:
    ensure_remote_dir(sftp, remote_base)
    remote_entries = list_remote_entries_map(sftp, remote_base)

    deployed_files = set()
    for file_name in sorted(ROOT_FILES):
        local_file = PROJECT_ROOT / file_name
        if not local_file.exists() or not local_file.is_file():
            continue
        deployed_files.add(file_name)
        remote_file = remote_join(remote_base, file_name)
        if should_upload_from_manifest(local_file, file_name, remote_manifest, next_manifest, hash_cache):
            ensure_remote_dir(sftp, posixpath.dirname(remote_file))
            sftp.put(str(local_file), remote_file)
            print(f"📤 {file_name}")

    for entry in remote_entries.values():
        if not stat.S_ISREG(entry.st_mode):
            continue

        name = entry.filename
        if not name.endswith(".php"):
            continue
        if name in deployed_files:
            continue

        rel = remote_rel(remote_base, remote_join(remote_base, name))
        if is_protected_remote(rel):
            continue

        print(f"🧹 Entferne Root-Datei: {name}")
        sftp.remove(remote_join(remote_base, name))


def remote_copy_file(sftp: paramiko.SFTPClient, source: str, target: str) -> None:
    ensure_remote_dir(sftp, posixpath.dirname(target))
    with sftp.open(source, "rb") as src_handle:
        with sftp.open(target, "wb") as dst_handle:
            while True:
                chunk = src_handle.read(64 * 1024)
                if not chunk:
                    break
                dst_handle.write(chunk)


def backup_runtime_data(sftp: paramiko.SFTPClient) -> None:
    if not BACKUP_ENABLED:
        print("ℹ️ Backup deaktiviert (DEPLOY_BACKUP_ENABLED=0)")
        return

    if not REMOTE_DATA_PATH:
        if IS_GITHUB_ACTIONS and STRICT_DATA_PATH:
            raise RuntimeError("STRATO_DATA_PATH fehlt trotz strict mode")
        print("ℹ️ Kein STRATO_DATA_PATH gesetzt, Backup wird übersprungen")
        return

    data_base = normalize_remote(REMOTE_DATA_PATH)
    backup_base = normalize_remote(REMOTE_BACKUP_PATH) if REMOTE_BACKUP_PATH else remote_join(data_base, "backups")

    if not should_run_backup(sftp, backup_base):
        return

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_backup_dir = remote_join(backup_base, f"deploy_{timestamp}")

    ensure_remote_dir(sftp, run_backup_dir)
    backed_up_any = False

    for db_name in BACKUP_DB_FILES:
        source = remote_join(data_base, db_name)
        target = remote_join(run_backup_dir, db_name)
        try:
            sftp.stat(source)
        except OSError:
            continue
        remote_copy_file(sftp, source, target)
        backed_up_any = True
        print(f"💾 Backup: {remote_rel(data_base, source)} -> {remote_rel(backup_base, target)}")

    if not backed_up_any:
        print("ℹ️ Keine Runtime-DB-Dateien zum Sichern gefunden")


def main() -> int:
    print(f"🔌 Verbinde zu {HOST}...")

    transport = paramiko.Transport((HOST, 22))
    transport.connect(username=USER, password=PASSWORD)
    sftp = paramiko.SFTPClient.from_transport(transport)

    remote_base = normalize_remote(REMOTE_BASE)

    try:
        backup_runtime_data(sftp)

        print(f"📦 Deploy nach {remote_base}")
        remote_manifest = load_remote_manifest(sftp, remote_base)
        next_manifest: Dict[str, str] = {}
        hash_cache: Dict[str, str] = {}

        sync_root_files(sftp, remote_base, remote_manifest, next_manifest, hash_cache)

        for directory in sorted(ROOT_DIRS):
            local_dir = PROJECT_ROOT / directory
            if not local_dir.exists() or not local_dir.is_dir():
                continue
            remote_dir = remote_join(remote_base, directory)
            sync_directory(sftp, local_dir, remote_dir, remote_base, remote_manifest, next_manifest, hash_cache)

        migration_file = PROJECT_ROOT / "app" / "migrate.php"
        if migration_file.exists():
            remote_migration = remote_join(remote_base, "app", "migrate.php")
            upload_file_if_needed(
                sftp,
                migration_file,
                remote_migration,
                "app/migrate.php",
                remote_manifest,
                next_manifest,
                hash_cache,
            )

        save_remote_manifest(sftp, remote_base, next_manifest)

        print("✅ Deployment abgeschlossen")
        if REMOTE_DATA_PATH:
            print("ℹ️ Hinweis: Migration auf dem Server mit 'php app/migrate.php' ausführen")
        return 0
    finally:
        sftp.close()
        transport.close()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"❌ Fehler: {exc}")
        sys.exit(1)
