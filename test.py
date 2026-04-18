#!/usr/bin/env python3
"""
iFixit Device URL resolver (single-file, function-based)

Public function:
  resolve_ifixit_device_url(term: str) -> str | None

How it works:
  1) Generate likely CATEGORY wiki titles (device pages are CATEGORY wikis) and verify via:
       GET https://www.ifixit.com/api/2.0/wikis/CATEGORY/{title}
     If it exists, return:
       https://www.ifixit.com/Device/{title}

  2) If NOT found, use a hashmap fallback:
       family -> manufacturer
     Example: "galaxy-s25-ultra" fails, so retry with "Samsung_" prefixed:
       Samsung_Galaxy_S25_Ultra

  3) If still NOT found, fallback to:
       GET https://www.ifixit.com/api/2.0/suggest/{query}?doctypes=all
     Return the first /Device/... URL.

Requires:
  pip install requests
"""

from __future__ import annotations

import re
import time
import urllib.parse
from typing import Dict, List, Optional, Tuple

import requests

API_BASE = "https://www.ifixit.com/api/2.0"
SITE_BASE = "https://www.ifixit.com"
UA = "ifixit-device-url-resolver/3.1"


# Hashmap fallback: product-family token -> manufacturer prefix
FAMILY_TO_MANUFACTURER: Dict[str, str] = {
    "galaxy": "Samsung",
    "pixel": "Google",
    "iphone": "Apple",
    "ipad": "Apple",
    "macbook": "Apple",
    "xbox": "Microsoft",
    "surface": "Microsoft",
    "playstation": "Sony",
    "ps": "Sony",
}

# Tokens we usually want uppercase in iFixit-style titles
UPPER_TOKENS = {"xl", "xxl", "pro", "max", "ultra", "se"}


class IFixitResolver:
    def __init__(self, timeout: float = 10.0, max_retries: int = 2, backoff: float = 0.25):
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff = backoff
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": UA})

    # -----------------------
    # HTTP helpers
    # -----------------------
    def _get_json(self, url: str, params: Optional[dict] = None) -> Tuple[int, Optional[dict]]:
        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                r = self.session.get(url, params=params, timeout=self.timeout)
                if r.status_code == 200:
                    return 200, r.json()
                return r.status_code, None
            except Exception as e:
                last_exc = e
                if attempt < self.max_retries:
                    time.sleep(self.backoff * (attempt + 1))
        raise RuntimeError(f"HTTP failed after retries: {url}") from last_exc

    # -----------------------
    # iFixit API calls
    # -----------------------
    def wiki_exists_category(self, title: str) -> bool:
        safe_title = urllib.parse.quote(title, safe="")
        url = f"{API_BASE}/wikis/CATEGORY/{safe_title}"
        status, _ = self._get_json(url)
        return status == 200

    def suggest(self, query: str) -> List[dict]:
        enc_q = urllib.parse.quote(query, safe="")
        url = f"{API_BASE}/suggest/{enc_q}"
        status, data = self._get_json(url, params={"doctypes": "all"})
        if status != 200 or not data:
            return []
        return data.get("results", []) or []

    # -----------------------
    # Normalization helpers
    # -----------------------
    @staticmethod
    def _clean(term: str) -> str:
        s = term.strip()
        s = s.replace("/", " ")
        s = re.sub(r"[^\w\s-]+", " ", s)  # keep word chars, spaces, hyphens
        s = re.sub(r"\s+", " ", s).strip()
        return s

    @staticmethod
    def _tokens(term: str) -> List[str]:
        s = IFixitResolver._clean(term)
        parts = re.split(r"[\s_-]+", s)
        return [p for p in parts if p]

    @staticmethod
    def _title_token(tok: str) -> str:
        if not tok:
            return tok
        if tok.isdigit():
            return tok
        low = tok.lower()
        if low in UPPER_TOKENS:
            return low.upper()
        # Keep patterns like S25 if provided that way
        if re.fullmatch(r"[A-Za-z]\d+", tok):
            return tok[0].upper() + tok[1:]
        return low[:1].upper() + low[1:]

    @staticmethod
    def _join_underscores(tokens: List[str]) -> str:
        return re.sub(r"_+", "_", "_".join(tokens)).strip("_")

    # -----------------------
    # Candidate generation
    # -----------------------
    def generate_candidates(self, term: str) -> List[str]:
        toks = self._tokens(term)
        if not toks:
            return []

        title = self._join_underscores([self._title_token(t) for t in toks])
        lower = self._join_underscores([t.lower() for t in toks])

        candidates = [title, lower]

        seen = set()
        out = []
        for c in candidates:
            if c and c not in seen:
                seen.add(c)
                out.append(c)
        return out

    # -----------------------
    # Manufacturer hashmap fallback
    # -----------------------
    def manufacturer_fallback_title(self, term: str) -> Optional[str]:
        toks = self._tokens(term)
        if not toks:
            return None

        family = toks[0].lower()
        manufacturer = FAMILY_TO_MANUFACTURER.get(family)
        if not manufacturer:
            return None

        # Build: Samsung_Galaxy_S25_Ultra
        title_tokens = [manufacturer] + [self._title_token(t) for t in toks]
        return self._join_underscores(title_tokens)

    # -----------------------
    # Resolve pipeline
    # -----------------------
    def resolve(self, term: str) -> Optional[str]:
        # PASS 1: normal candidates
        for title in self.generate_candidates(term):
            if self.wiki_exists_category(title):
                return f"{SITE_BASE}/Device/{title}"

        # PASS 2: hashmap manufacturer fallback (prepend maker AFTER failure)
        fallback_title = self.manufacturer_fallback_title(term)
        if fallback_title and self.wiki_exists_category(fallback_title):
            return f"{SITE_BASE}/Device/{fallback_title}"

        # PASS 3: Suggest fallback
        q = self._clean(term).replace("_", " ").replace("-", " ").strip()
        for r in self.suggest(q):
            url = (r.get("url") or "").strip()
            if "/Device/" in url:
                return url

        return None


# -----------------------
# Public function
# -----------------------
_resolver_singleton: Optional[IFixitResolver] = None


def resolve_ifixit_device_url(term: str) -> Optional[str]:
    """
    Resolve an iFixit device page URL from a fuzzy term.

    Examples:
      resolve_ifixit_device_url("galaxy-s25-ultra")
        -> https://www.ifixit.com/Device/Samsung_Galaxy_S25_Ultra   (if that page exists)

      resolve_ifixit_device_url("pixel-10-pro-xl")
      resolve_ifixit_device_url("xbox-series-s")

    Returns:
      URL string if found, else None
    """
    global _resolver_singleton
    if _resolver_singleton is None:
        _resolver_singleton = IFixitResolver()
    return _resolver_singleton.resolve(term)

def motorola_cpr_style_test_slugs():
    """
    Returns a large list of CPR-style slugs to test your iFixit resolver.
    Style: lowercase, hyphen-separated (common CPR device URL / catalog slug style).
    """

    def slug(*parts):
        return "-".join(str(p).strip().lower().replace("_", "-").replace(" ", "-") for p in parts if p)

    tests = set()

    # ---- Core families CPR commonly sees ----
    # Moto G / E are long-running. :contentReference[oaicite:1]{index=1}
    # Edge series models. :contentReference[oaicite:2]{index=2}
    # Razr foldables. :contentReference[oaicite:3]{index=3}

def motorola_cpr_style_test_slugs():
    def slug(*parts):
        return "-".join(
            str(p).strip().lower().replace("_", "-").replace(" ", "-")
            for p in parts if p
        )

    tests = set()

    # Moto G series
    for year in range(2019, 2027):
        tests |= {
            slug("moto", "g", year),
            slug("moto", "g", "play", year),
            slug("moto", "g", "power", year),
            slug("moto", "g", "stylus", year),
            slug("moto", "g", "5g", year),
            slug("moto", "g", "power", "5g", year),
            slug("moto", "g", "stylus", "5g", year),
        }

    # Moto E series
    for year in range(2019, 2027):
        tests |= {
            slug("moto", "e", year),
            slug("moto", "e", "plus", year),
            slug("moto", "e", "5g", year),
        }

    # Edge series
    for n in [20, 30, 40, 50, 60]:
        tests.add(slug("motorola", "edge", n))
        for suffix in ["pro", "plus", "neo", "fusion", "ultra", "lite"]:
            tests.add(slug("motorola", "edge", n, suffix))

    for year in range(2020, 2027):
        tests |= {
            slug("motorola", "edge", year),
            slug("motorola", "edge", "plus", year),
        }

    # Razr
    for year in range(2020, 2027):
        tests.add(slug("motorola", "razr", year))
        tests.add(slug("motorola", "razr", "plus", year))

    # Legacy / misc
    tests |= {
        # slug("moto", "g", "pure"),
        # slug("moto", "one"),
        # slug("moto", "one", "5g"),
        # slug("moto", "one", "ace"),
        # slug("moto", "one", "zoom"),
        # slug("droid", "razr"),
        # slug("droid", "razr", "hd"),
        # slug("droid", "razr", "maxx"),
        slug("macbook", "air", '15"'),

    }

    # tests |= slug()

    return sorted(tests)



def main():
    slugs = motorola_cpr_style_test_slugs()

    found = []
    missing = []

    print(f"Testing {len(slugs)} Motorola CPR-style devices...\n")

    for slug in slugs:
        url = resolve_ifixit_device_url(slug)

        if url:
            print(f"FOUND     {slug:40} -> {url}")
            found.append((slug, url))
        else:
            print(f"NOT FOUND {slug}")
            missing.append(slug)

    print("\n" + "=" * 60)
    print(f"SUMMARY")
    print(f"  Total tested : {len(slugs)}")
    print(f"  Found        : {len(found)}")
    print(f"  Not found    : {len(missing)}")
    print("=" * 60)

    if missing:
        print("\nMissing devices:")
        for m in missing:
            print(f"  - {m}")

main()



