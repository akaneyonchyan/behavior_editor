#!/usr/bin/env python3
"""Install the authenticated RPC route on the existing behavior-editor HTTPS host."""
from pathlib import Path
import datetime
import subprocess

path = Path('/etc/nginx/sites-available/behavior-editor')
original = path.read_text()
marker = '    # PPS collaboration RPC (service bearer authentication)'
snippet = '''    # PPS collaboration RPC (service bearer authentication)
    location = /collaboration/rpc {
        client_max_body_size 5m;
        limit_except POST { deny all; }
        proxy_pass http://127.0.0.1:5112/rpc;
        proxy_set_header Host behavior-editor.online;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 90s;
        proxy_send_timeout 90s;
        proxy_hide_header X-Powered-By;
    }
'''
if marker in original:
    raise SystemExit('RPC route already exists; inspect it before changing.')
if original.count('    location / {') != 1 or 'server_name behavior-editor.online;' not in original:
    raise SystemExit('Unexpected nginx configuration; no changes made.')
backup = path.with_name(path.name + '.before-collaboration-' + datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
backup.write_text(original)
path.write_text(original.replace('    location / {', snippet + '    location / {'))
try:
    subprocess.run(['nginx', '-t'], check=True)
except Exception:
    path.write_text(original)
    raise
subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
print('Authenticated collaboration RPC route installed; original site route retained.')
