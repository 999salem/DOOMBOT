#!/usr/bin/env python3
"""Refresh data/live-intel.json from public RSS feeds without deleting curated anchor intel."""
from __future__ import annotations
import json, re, sys, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
FEEDS = DATA / 'feeds.json'
TIERS = DATA / 'source-tiers.json'
OUT = DATA / 'live-intel.json'

feeds = json.loads(FEEDS.read_text(encoding='utf-8'))
tiers = json.loads(TIERS.read_text(encoding='utf-8'))

def text(node, name):
    el = node.find(name)
    return (el.text or '').strip() if el is not None else ''

def tier_for(url, source_name=''):
    host = urllib.parse.urlparse(url).netloc.lower().removeprefix('www.')
    low = source_name.lower()
    if any(x in low for x in ('marvel', 'disney')):
        return 'S'
    if 'associated press' in low or low == 'ap':
        return 'A'
    for tier in ('S', 'A', 'B'):
        for domain in tiers[tier]['domains']:
            d = domain.lower().removeprefix('www.')
            if host == d or host.endswith('.' + d):
                return tier
    return 'C'

def confidence(tier):
    return int(tiers.get(tier, tiers['C'])['confidence'])

def clean_title(s):
    return re.sub(r'\s+', ' ', s).strip()

def fetch(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'S.A.L.E.M.-Doomsday-Intel/1.1 (+GitHub Pages RSS refresher)'
    })
    with urllib.request.urlopen(req, timeout=25) as response:
        return response.read()

def title_key(title):
    return re.sub(r'[^a-z0-9]', '', title.lower())

# Keep manually curated / official anchor cards already in the database.
try:
    existing = json.loads(OUT.read_text(encoding='utf-8'))
except Exception:
    existing = {'items': []}
pinned = [x for x in existing.get('items', []) if x.get('kind') != 'AUTO WATCH']

fresh = []
for feed in feeds.get('feeds', []):
    if not feed.get('enabled', True):
        continue
    try:
        root = ET.fromstring(fetch(feed['url']))
    except Exception as exc:
        print(f"WARN {feed.get('name')}: {exc}", file=sys.stderr)
        continue
    for item in root.findall('.//item'):
        title = clean_title(text(item, 'title'))
        link = text(item, 'link')
        pub = text(item, 'pubDate')
        source_el = item.find('source')
        source = (source_el.text or '').strip() if source_el is not None else feed.get('name', 'RSS')
        source_url = source_el.attrib.get('url', '') if source_el is not None else ''
        canonical = source_url or link
        if not title or not link:
            continue
        tier = tier_for(canonical, source)
        fresh.append({
            'id': re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')[:90],
            'title': title,
            'summary': 'Fresh public-source result. Open the original report and review it before promoting it into a theory or leak chain.',
            'analysis': 'Auto-collected RSS item. Source tier is estimated from the publisher; corroboration is not automatically assumed.',
            'url': link,
            'source': source,
            'tier': tier,
            'confidence': confidence(tier),
            'kind': 'AUTO WATCH',
            'published': pub or 'DATE UNKNOWN'
        })

seen = {title_key(x.get('title', '')) for x in pinned}
unique = []
for item in fresh:
    key = title_key(item['title'])
    if not key or key in seen:
        continue
    seen.add(key)
    unique.append(item)

max_items = max(int(feeds.get('maxItems', 20)), len(pinned))
items = (pinned + unique)[:max_items]
out = {
    'updatedAt': datetime.now(timezone.utc).isoformat(),
    'generatedBy': 'github-actions-rss',
    'items': items
}
OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(f"Wrote {len(items)} items ({len(pinned)} curated + {len(items)-len(pinned)} auto)")
