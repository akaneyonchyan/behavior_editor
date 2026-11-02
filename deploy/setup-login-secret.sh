#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077
target=/home/ubuntu/pps-editor/private
sudo install -d -m 700 -o 1000 -g 1000 "$target" /home/ubuntu/pps-editor/auth-data
if sudo test -e "$target/feishu-app-secret"; then
  printf 'App Secret 已存在，未覆盖。需要轮换时请由部署者单独处理。\n'
  exit 0
fi
IFS= read -r -s -p '请粘贴飞书 App Secret（输入不会显示），然后按回车：' editor_secret </dev/tty
printf '\n'
if [[ ! "$editor_secret" =~ ^[a-zA-Z0-9_-]{16,512}$ ]]; then
  unset editor_secret
  printf '输入格式不正确，未写入，请重新运行。\n' >&2
  exit 1
fi
printf '%s' "$editor_secret" | sudo tee "$target/feishu-app-secret" >/dev/null
unset editor_secret
sudo chown 1000:1000 "$target/feishu-app-secret"
sudo chmod 600 "$target/feishu-app-secret"
printf '已安全保存 App Secret，没有输出密码。请回复：已保存。\n'
