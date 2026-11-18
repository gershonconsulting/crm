#!/usr/bin/env bash
# Points crm.gershon.ai at the pilot (127.0.0.1:5002), replacing the older stack's
# basic-auth gate with the app's own sign-in. Backs up the Caddyfile first.
# Rollback: bash switch-caddy.sh --rollback
set -euo pipefail
CF=/etc/caddy/Caddyfile
if [ "${1:-}" = "--rollback" ]; then
  last=$(ls -1t /etc/caddy/Caddyfile.pre-crm-pilot-* | head -1)
  cp "$last" "$CF"; caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1 && systemctl reload caddy
  echo "[pilot] restored $last"; exit 0
fi
cp "$CF" "$CF.pre-crm-pilot-$(date -u +%Y%m%dT%H%M%SZ)"
python3 -I - "$CF" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
start = s.index("crm.gershon.ai {")
depth = 0
for i in range(start, len(s)):
    if s[i] == "{": depth += 1
    elif s[i] == "}":
        depth -= 1
        if depth == 0: end = i + 1; break
block = """crm.gershon.ai {
\tencode gzip
\treverse_proxy 127.0.0.1:5002
}"""
open(p, "w").write(s[:start] + block + s[end:])
PY
if caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1; then
  systemctl reload caddy; echo "[pilot] crm.gershon.ai now served by the pilot on 127.0.0.1:5002"
else
  last=$(ls -1t /etc/caddy/Caddyfile.pre-crm-pilot-* | head -1); cp "$last" "$CF"
  echo "[pilot] new Caddyfile failed validation; original restored"; exit 1
fi
