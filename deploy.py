#!/usr/bin/env python3
"""
SFTP Deploy Script für Toolsapp → Strato
Liest Credentials aus Umgebungsvariablen oder .env.local und deployt Dateien via SFTP
"""

import os
import sys
import paramiko
from pathlib import Path

# Versuche Credentials aus Umgebungsvariablen zu lesen (für GitHub Actions)
host = os.getenv('STRATO_HOST')
user = os.getenv('STRATO_USER')
password = os.getenv('STRATO_PASS')
remote_path = os.getenv('STRATO_PATH')

# Fallback: Lese aus .env.local wenn Umgebungsvariablen nicht gesetzt
if not all([host, user, password, remote_path]):
    env_file = Path(__file__).parent / '.env.local'
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    if key == 'STRATO_HOST':
                        host = host or value
                    elif key == 'STRATO_USER':
                        user = user or value
                    elif key == 'STRATO_PASS':
                        password = password or value
                    elif key == 'STRATO_PATH':
                        remote_path = remote_path or value
local_path = Path(__file__).parent

if not all([host, user, password, remote_path]):
    print("❌ Credentials in .env.local unvollständig!")
    sys.exit(1)

# Dateien zum Excludieren
EXCLUDE = {'.git', '.env', '.env.local', '.vscode', 'node_modules', '.htrouter.php', 'deploy.sh', 'deploy.py', '.DS_Store', '.gitignore'}

def upload_directory(sftp, local, remote):
    """Rekursiv Verzeichnis uploaden"""
    # Stelle sicher, dass das Remote-Verzeichnis existiert
    try:
        sftp.stat(remote)
    except IOError:
        sftp.mkdir(remote)
    
    for item in local.iterdir():
        if item.name in EXCLUDE or item.name.startswith('.'):
            continue
        
        remote_item = f"{remote}/{item.name}"
        
        if item.is_dir():
            try:
                sftp.stat(remote_item)
            except IOError:
                sftp.mkdir(remote_item)
            upload_directory(sftp, item, remote_item)
        else:
            print(f"📤 {item.relative_to(local_path)}", end=' ')
            sftp.put(str(item), remote_item)
            print("✓")

try:
    print(f"🔌 Verbinde zu {host}...")
    transport = paramiko.Transport((host, 22))
    transport.connect(username=user, password=password)
    sftp = paramiko.SFTPClient.from_transport(transport)
    
    print(f"📦 Deploye Dateien...")
    upload_directory(sftp, local_path, '.')
    
    sftp.close()
    transport.close()
    print("✅ Deployment abgeschlossen!")
    
except Exception as e:
    print(f"❌ Fehler: {e}")
    sys.exit(1)
