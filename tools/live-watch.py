#!/usr/bin/env python3
"""Emit one stdout line per new live-screen entry written by employees.
Sources: team/live/*.jsonl (appended lines) and team/live/*.json (one line per file)."""
import glob, json, os, sys, time
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "team", "live")
os.makedirs(root, exist_ok=True)
pos, seen = {}, set(glob.glob(os.path.join(root, "*.json")))
for f in glob.glob(os.path.join(root, "*.jsonl")): pos[f] = os.path.getsize(f)
def emit(raw):
    raw = raw.strip()
    if not raw: return
    try:
        d = json.loads(raw); print(json.dumps({"who": d.get("who",""), "kind": d.get("kind","note"), "text": str(d.get("text",""))[:200]}, ensure_ascii=False), flush=True)
    except Exception: pass
while True:
    for f in glob.glob(os.path.join(root, "*.jsonl")):
        size = os.path.getsize(f); start = pos.get(f, 0)
        if size > start:
            with open(f, encoding="utf-8", errors="replace") as h: h.seek(start); chunk = h.read()
            pos[f] = size
            for line in chunk.splitlines(): emit(line)
    for f in glob.glob(os.path.join(root, "*.json")):
        if f in seen: continue
        seen.add(f)
        try: emit(open(f, encoding="utf-8").read())
        except Exception: pass
    time.sleep(2)
