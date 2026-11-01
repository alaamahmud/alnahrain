#!/usr/bin/env bash
# يرسل سؤالاً لصابرين (Grok bot عبر Cursor Automation webhook) ويسجّله.
# الاستخدام: tools/ask-sabreen.sh "<السؤال>" [سياق اختياري]
# المتغيرات المطلوبة (من إعدادات البيئة، لا تُكتب في الريبو أبداً):
#   SABREEN_WEBHOOK_URL  SABREEN_WEBHOOK_KEY
set -euo pipefail
: "${SABREEN_WEBHOOK_URL:?SABREEN_WEBHOOK_URL غير موجود في البيئة}"
: "${SABREEN_WEBHOOK_KEY:?SABREEN_WEBHOOK_KEY غير موجود في البيئة}"
q="${1:?اكتب السؤال}"; ctx="${2:-}"
id="q-$(TZ=Asia/Baghdad date +%Y%m%d-%H%M%S)"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
body=$(python3 - "$id" "$q" "$ctx" <<'PY'
import json,sys
i,q,c=sys.argv[1:4]
print(json.dumps({"from":"زيد - المدير التنفيذي لشركة فاي الافتراضية","request_id":i,"question":q,"context":c,
 "reply_instructions":"اكتبي جوابك بملف team/sabreen/replies/%s.md في الريبو alaamahmud/alnahrain (فرع ccr-08555dcd-s4cb1u). اسحبي آخر نسخة قبل الرفع وغيّري هذا الملف بس واذكري request_id بأول سطر."%i},ensure_ascii=False))
PY
)
resp=$(curl -sS --max-time 60 -X POST "$SABREEN_WEBHOOK_URL" -H "Authorization: Bearer $SABREEN_WEBHOOK_KEY" -H "Content-Type: application/json" -d "$body")
run=$(python3 -c 'import json,sys;d=json.loads(sys.argv[1]);print(d.get("runUuid","") if d.get("success") else "FAILED")' "$resp" 2>/dev/null || echo FAILED)
printf '| %s | %s | %s | %s | بانتظار الجواب |\n' "$id" "$(TZ=Asia/Baghdad date '+%Y-%m-%d %I:%M %p')" "$(printf %s "$q" | tr "\n" " " | cut -c1-120 | sed "s/|/\\\\|/g")" "$run" >> "$repo_root/team/sabreen/requests.md"
echo "$id $run"
