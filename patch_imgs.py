#!/usr/bin/env python3
# Usage: python3 patch_imgs.py  (reads "query<TAB>url" lines from stdin)
import sys
f = "packages/web/src/services/catalog-presets.ts"
s = open(f).read()
cnt = miss = 0
for line in sys.stdin:
    line = line.rstrip("\n")
    if not line.strip():
        continue
    q, url = line.split("\t", 1)
    old = f'imageQuery: "{q}", image: ""'
    new = f'imageQuery: "{q}", image: "{url}"'
    if old in s:
        s = s.replace(old, new)
        cnt += 1
    else:
        print("MISS:", q, file=sys.stderr)
        miss += 1
open(f, "w").write(s)
print(f"patched {cnt}, missed {miss}")
