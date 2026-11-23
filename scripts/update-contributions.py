#!/usr/bin/env python3
"""Fetch mjanthony819's public GitHub contribution calendar and rewrite gh-contributions.json.

Parses the public calendar fragment at github.com/users/<user>/contributions
(no auth needed). Writes the last 90 days in the shape the site's heatmap
widget expects. Exits non-zero on any fetch/parse problem so a bad run never
overwrites good data.
"""
import datetime
import json
import re
import sys
import urllib.request

USER = "mjanthony819"
URL = "https://github.com/users/%s/contributions" % USER
OUT = "gh-contributions.json"

req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (contributions-widget)"})
with urllib.request.urlopen(req, timeout=30) as resp:
    html = resp.read().decode("utf-8", "replace")

cells = re.findall(
    r'<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="(contribution-day-component-[^"]+)"[^>]*data-level="(\d)"',
    html,
)
tips = dict(
    re.findall(
        r'<tool-tip[^>]*for="(contribution-day-component-[^"]+)"[^>]*>\s*(?:<!--[^>]*-->)?\s*([^<]+)</tool-tip>',
        html,
    )
)
if len(cells) < 300:
    sys.exit("parse failed: only %d day cells found" % len(cells))

days = []
for date, cid, level in cells:
    text = tips.get(cid, "")
    m = re.match(r"(\d[\d,]*) contribution", text)
    count = int(m.group(1).replace(",", "")) if m else 0
    days.append({"date": date, "count": count, "level": int(level)})

days.sort(key=lambda d: d["date"])
last90 = days[-90:]
if len(last90) != 90:
    sys.exit("parse failed: got %d days, need 90" % len(last90))

payload = {
    "updated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "username": USER,
    "total": sum(d["count"] for d in last90),
    "days": last90,
}
with open(OUT, "w") as f:
    json.dump(payload, f, separators=(",", ":"))
    f.write("\n")
print("wrote %s: %s..%s, total %d" % (OUT, last90[0]["date"], last90[-1]["date"], payload["total"]))
