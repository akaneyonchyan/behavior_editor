#!/usr/bin/env python3
"""Generate a service pairing secret without accepting or printing credential values."""
import os
from pathlib import Path
import secrets

root = Path(__file__).resolve().parent / "private"
os.umask(0o077)
root.mkdir(mode=0o700, exist_ok=True)
service = root / "service-token"
if service.exists():
    raise SystemExit("已存在凭据文件，未覆盖。轮换请按部署说明单独处理。")
with service.open("x", encoding="utf8") as f:
    f.write(secrets.token_urlsafe(48))
print("服务间凭据已生成，文件权限仅限当前账号。未启动服务；每个人的 GitLab Token 在网页输入。")
print("稍后需要将 private/service-token 的内容填入 XD Sites 的 COLLAB_SERVICE_TOKEN 安全输入卡；不要发到聊天。")
