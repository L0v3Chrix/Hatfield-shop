#!/usr/bin/env python3
"""Prepare Hatfield McCoy Shopify image assets for static framework previews.

The script is intentionally non-destructive: it reads from Shopify-images-good,
writes optimized derivatives into the brand design pack, and emits a manifest
that can later inform Shopify media uploads.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "Shopify-images-good"
OUTPUT_DIR = ROOT / "deliverables" / "brand-design-pack" / "assets" / "shopify-images"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"

IMAGE_ROLES = {
    "neon-print.jpg": {
        "slug": "custom-dtf-transfers",
        "title": "Custom DTF transfers",
        "collection": "DTF transfers",
        "usage": ["home hero", "product detail", "collection card"],
        "alt": "Neon Hatfield McCoy DTF transfer print sample",
    },
    "vibrant-transfers.jpg": {
        "slug": "vibrant-transfer-stack",
        "title": "Vibrant transfer stack",
        "collection": "DTF transfers",
        "usage": ["shop card", "related product"],
        "alt": "Stack of bright full color DTF transfer samples",
    },
    "car-gang-sheet.jpg": {
        "slug": "car-gang-sheet",
        "title": "Car gang sheet",
        "collection": "Gang sheets",
        "usage": ["builder page", "gang sheet collection"],
        "alt": "DTF gang sheet layout with vehicle graphics",
    },
    "hat-transfer.jpg": {
        "slug": "hat-transfer",
        "title": "Hat transfer",
        "collection": "Hat transfers",
        "usage": ["product card", "specialty route"],
        "alt": "Custom transfer applied to a blank hat",
    },
    "neon-transfer-hoodie.jpg": {
        "slug": "neon-hoodie-transfer",
        "title": "Neon hoodie transfer",
        "collection": "Apparel transfers",
        "usage": ["homepage route", "PDP lifestyle"],
        "alt": "Neon DTF transfer on a hoodie",
    },
    "woman-hoodie-neon.jpg": {
        "slug": "woman-hoodie-neon",
        "title": "Neon hoodie lifestyle",
        "collection": "Apparel transfers",
        "usage": ["hero lifestyle", "wholesale proof"],
        "alt": "Model wearing a hoodie with neon Hatfield McCoy style print",
    },
    "blank-sweatshirt.jpg": {
        "slug": "blank-sweatshirt",
        "title": "Blank sweatshirt",
        "collection": "Blanks and apparel",
        "usage": ["blank product card"],
        "alt": "Blank sweatshirt ready for custom transfer printing",
    },
    "blank-hats.jpg": {
        "slug": "blank-hats",
        "title": "Blank hats",
        "collection": "Blanks and apparel",
        "usage": ["hat transfer product card"],
        "alt": "Blank hats ready for custom transfers",
    },
    "blank-items.jpg": {
        "slug": "blank-items",
        "title": "Blank product assortment",
        "collection": "Blanks and apparel",
        "usage": ["shop collection banner"],
        "alt": "Blank apparel and merchandise assortment",
    },
    "blank-items1.jpg": {
        "slug": "blank-items-alt",
        "title": "Blank product assortment alternate",
        "collection": "Blanks and apparel",
        "usage": ["contact quote support"],
        "alt": "Blank items prepared for custom print production",
    },
    "Cute-sticker-sheet.jpg": {
        "slug": "cute-sticker-sheet",
        "title": "Cute sticker sheet",
        "collection": "Stickers",
        "usage": ["sticker product card"],
        "alt": "Colorful custom sticker sheet",
    },
    "boy-sticker-sheet.jpg": {
        "slug": "boy-sticker-sheet",
        "title": "Youth sticker sheet",
        "collection": "Stickers",
        "usage": ["sticker collection card"],
        "alt": "Youth themed custom sticker sheet",
    },
    "sticker-rolls.jpg": {
        "slug": "sticker-rolls",
        "title": "Sticker rolls",
        "collection": "Stickers",
        "usage": ["sticker collection support"],
        "alt": "Rolls of custom printed stickers",
    },
    "patches.jpg": {
        "slug": "custom-patches",
        "title": "Custom patches",
        "collection": "Patches",
        "usage": ["specialty product card"],
        "alt": "Custom patch samples for apparel and merchandise",
    },
    "hatfield-tags.jpg": {
        "slug": "hatfield-tags",
        "title": "Hatfield tags",
        "collection": "Labels and tags",
        "usage": ["brand detail", "quality proof"],
        "alt": "Hatfield McCoy branded tags",
    },
    "quality-tags.jpg": {
        "slug": "quality-tags",
        "title": "Quality tags",
        "collection": "Labels and tags",
        "usage": ["trust proof", "detail image"],
        "alt": "Close-up quality tags for finished merchandise",
    },
    "dtf-process.jpg": {
        "slug": "dtf-process",
        "title": "DTF process",
        "collection": "Guides",
        "usage": ["guide page", "process module"],
        "alt": "DTF printing process close-up",
    },
    "neon-print-WV.jpg": {
        "slug": "neon-wv-print",
        "title": "Neon WV print",
        "collection": "West Virginia DTF",
        "usage": ["local SEO", "home proof"],
        "alt": "West Virginia themed neon DTF print",
    },
    "neon-basketball.jpg": {
        "slug": "neon-basketball",
        "title": "Neon basketball print",
        "collection": "Sports and teams",
        "usage": ["sports collection card"],
        "alt": "Neon basketball transfer design sample",
    },
    "Generated Image May 27, 2026 - 10_53AM.jpg": {
        "slug": "featured-merch-scene",
        "title": "Featured merchandise scene",
        "collection": "Campaign imagery",
        "usage": ["campaign hero", "social preview"],
        "alt": "Hatfield McCoy DTF featured merchandise scene",
    },
}

SIZES = {
    "hero": 1600,
    "card": 900,
    "thumb": 360,
}


def export_webp(source: Path, slug: str, size_name: str, max_edge: int) -> dict:
    with Image.open(source) as img:
        img = img.convert("RGB")
        img.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        output = OUTPUT_DIR / f"{slug}-{size_name}.webp"
        img.save(output, "WEBP", quality=84, method=6)
        return {
            "file": output.relative_to(ROOT).as_posix(),
            "width": img.width,
            "height": img.height,
            "bytes": output.stat().st_size,
        }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "sourceDirectory": SOURCE_DIR.relative_to(ROOT).as_posix(),
        "outputDirectory": OUTPUT_DIR.relative_to(ROOT).as_posix(),
        "policy": "Original source files are preserved. Framework uses optimized derivatives.",
        "images": [],
        "warnings": [],
    }

    for source in sorted(SOURCE_DIR.glob("*.jpg")):
        role = IMAGE_ROLES.get(source.name, {
            "slug": source.stem.lower().replace(" ", "-").replace("_", "-"),
            "title": source.stem,
            "collection": "Unassigned",
            "usage": ["review"],
            "alt": source.stem.replace("-", " "),
        })
        item = {
            "source": source.relative_to(ROOT).as_posix(),
            "sourceBytes": source.stat().st_size,
            **role,
            "derivatives": {},
        }
        try:
            for size_name, max_edge in SIZES.items():
                item["derivatives"][size_name] = export_webp(source, role["slug"], size_name, max_edge)
        except Exception as exc:  # keep the run useful even if one image is corrupt.
            item["status"] = "needs-review"
            item["error"] = str(exc)
            manifest["warnings"].append({
                "source": source.relative_to(ROOT).as_posix(),
                "issue": str(exc),
            })
        else:
            item["status"] = "ready"
        manifest["images"].append(item)

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {MANIFEST_PATH.relative_to(ROOT)}")
    print(f"Ready images: {sum(1 for i in manifest['images'] if i['status'] == 'ready')}")
    print(f"Warnings: {len(manifest['warnings'])}")


if __name__ == "__main__":
    main()
