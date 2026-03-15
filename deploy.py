#!/usr/bin/env python3
"""
Sicheres SFTP-Deploy für Toolsapp.

- Deployt nur definierte Code-Pfade
- Löscht nur innerhalb definierter Code-Pfade
- Sichert optionale Laufzeitdaten (SQLite) vor Deploy
"""

from __future__ import annotations

import fnmatch
import os
import posixpath
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path

import paramiko

PROJECT_ROOT = Path(__file__).parent.resolve()

HOST = os.getenv("STRATO_HOST")
USER = os.getenv("STRATO_USER")
PASSWORD = os.getenv("STRATO_PASS")
REMOTE_BASE = os.getenv("STRATO_PATH")
REMOTE_DATA_PATH = os.getenv("STRATO_DATA_PATH")
REMOTE_BACKUP_PATH = os.getenv("STRATO_BACKUP_PATH")
BACKUP_ENABLED = os.getenv("DEPLOY_BACKUP_ENABLED", "1") == "1"
IS_GITHUB_ACTIONS = os.getenv("GITHUB_ACTIONS", "").lower() == "true"
STRICT_DATA_PATH = os.getenv("DEPLOY_STRICT_DATA_PATH", "1") == "1"

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
    "*.log",
    "*.pyc",
}

PROTECTED_REMOTE_PATTERNS = {
    "*.sqlite",
    "backups",
}

BACKUP_DB_FILES = ["users.sqlite", "dguv.sqlite", "cuesheet.sqlite"]


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
) -> None:
    should_upload = True
    try:
        remote_stat = sftp.stat(remote_file)
        local_stat = local_file.stat()
        if int(remote_stat.st_size) == int(local_stat.st_size) and int(remote_stat.st_mtime) >= int(local_stat.st_mtime):
            should_upload = False
    except OSError:
        should_upload = True

    if should_upload:
        ensure_remote_dir(sftp, posixpath.dirname(remote_file))
        sftp.put(str(local_file), remote_file)
        print(f"📤 {display_path}")


def sync_directory(
    sftp: paramiko.SFTPClient,
    local_dir: Path,
    remote_dir: str,
    remote_base: str,
) -> None:
    ensure_remote_dir(sftp, remote_dir)

    local_dirs = set()
    local_files = set()

    for item in sorted(local_dir.iterdir(), key=lambda p: p.name):
        if is_excluded_name(item.name):
            continue

        remote_item = remote_join(remote_dir, item.name)
        relative_display = str(item.relative_to(PROJECT_ROOT)).replace("\\", "/")

        if item.is_dir():
            local_dirs.add(item.name)
            sync_directory(sftp, item, remote_item, remote_base)
        elif item.is_file():
            local_files.add(item.name)
            upload_file_if_needed(sftp, item, remote_item, relative_display)

    for entry in sftp.listdir_attr(remote_dir):
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


def sync_root_files(sftp: paramiko.SFTPClient, remote_base: str) -> None:
    ensure_remote_dir(sftp, remote_base)

    deployed_files = set()
    for file_name in sorted(ROOT_FILES):
        local_file = PROJECT_ROOT / file_name
        if not local_file.exists() or not local_file.is_file():
            continue
        deployed_files.add(file_name)
        remote_file = remote_join(remote_base, file_name)
        upload_file_if_needed(sftp, local_file, remote_file, file_name)

    for entry in sftp.listdir_attr(remote_base):
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
        sync_root_files(sftp, remote_base)

        for directory in sorted(ROOT_DIRS):
            local_dir = PROJECT_ROOT / directory
            if not local_dir.exists() or not local_dir.is_dir():
                continue
            remote_dir = remote_join(remote_base, directory)
            sync_directory(sftp, local_dir, remote_dir, remote_base)

        migration_file = PROJECT_ROOT / "app" / "migrate.php"
        if migration_file.exists():
            remote_migration = remote_join(remote_base, "app", "migrate.php")
            upload_file_if_needed(sftp, migration_file, remote_migration, "app/migrate.php")

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
