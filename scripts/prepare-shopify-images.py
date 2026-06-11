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
    "250th-anniversary.jpg": {
        "slug": "250th-anniversary",
        "title": "250th anniversary patch",
        "collection": "Patches",
        "usage": ["product card"],
        "alt": "America's 250th anniversary 1 inch circle patch sample",
        "focalPoint": "center",
    },
    "Ai-warehouse-DTF.jpg": {
        "slug": "ai-warehouse-dtf",
        "title": "Production floor",
        "collection": "Production",
        "usage": ["about", "trust proof"],
        "alt": "DTF production floor with wide format printers and transfer rolls",
        "focalPoint": "center",
    },
    "DTF-builder.jpg": {
        "slug": "dtf-builder",
        "title": "Gang sheet builder canvas",
        "collection": "Gang sheet builder",
        "usage": ["builder page", "product card"],
        "alt": "Gang sheet builder canvas with artwork arranged on a sheet",
        "focalPoint": "center",
    },
    "DTF-builder1.jpg": {
        "slug": "dtf-builder1",
        "title": "Gang sheet builder layout",
        "collection": "Gang sheet builder",
        "usage": ["builder page"],
        "alt": "Gang sheet builder layout preview for a wide format sheet",
        "focalPoint": "center",
    },
    "DTF-printer.jpg": {
        "slug": "dtf-printer",
        "title": "Wide format DTF printer",
        "collection": "Software and RIP",
        "usage": ["product card", "guides"],
        "alt": "Wide format DTF printer printing film in the shop",
        "focalPoint": "center",
    },
    "Generated Image May 28, 2026 - 12_10PM.jpg": {
        "slug": "tumbler-mascot-navy",
        "title": "Navy tumbler (third-party collegiate marks — archive only)",
        "collection": "Archive - third-party marks",
        "usage": ["archive"],
        "alt": "Navy insulated tumbler with printed mascot graphic",
        "focalPoint": "center",
    },
    "Generated Image May 28, 2026 - 2_46PM.jpg": {
        "slug": "glitter-football-tee",
        "title": "Glitter football tee",
        "collection": "Specialty glitter",
        "usage": ["product card", "apparel"],
        "alt": "Red tee with sequin glitter football print in a flat lay",
        "focalPoint": "center",
    },
    "Glitter-sticker.jpg": {
        "slug": "glitter-sticker",
        "title": "Glitter sticker",
        "collection": "Stickers",
        "usage": ["product card"],
        "alt": "Glitter UV DTF sticker close up with sparkle finish",
        "focalPoint": "center",
    },
    "H-M-jersey.jpg": {
        "slug": "h-m-jersey",
        "title": "Custom team jersey",
        "collection": "Sports and teams",
        "usage": ["product card", "sports collection"],
        "alt": "Custom team jersey front with DTF transfer print",
        "focalPoint": "center",
    },
    "h-m-jersey-back.jpg": {
        "slug": "h-m-jersey-back",
        "title": "Custom jersey back",
        "collection": "Sports and teams",
        "usage": ["sports collection"],
        "alt": "Custom jersey back with name and number transfer",
        "focalPoint": "center",
    },
    "H-M-storefront.jpg": {
        "slug": "h-m-storefront",
        "title": "Shop storefront",
        "collection": "Brand",
        "usage": ["about", "contact", "local trust"],
        "alt": "Hatfield McCoy DTF storefront in Logan West Virginia",
        "focalPoint": "center",
    },
    "Large-icon-gangsheet.jpg": {
        "slug": "large-icon-gangsheet",
        "title": "Large icon gang sheet",
        "collection": "Gang sheets",
        "usage": ["gang sheet collection"],
        "alt": "Gang sheet with large icon artwork layout",
        "focalPoint": "center",
    },
    "Puff-transfers.png": {
        "slug": "puff-transfers",
        "title": "3D puff transfer sheets",
        "collection": "3D puff",
        "usage": ["product card"],
        "alt": "3D puff transfer sheet samples",
        "focalPoint": "center",
    },
    "Small-tumbler-engraved.jpg": {
        "slug": "small-tumbler-engraved",
        "title": "Engraved tumbler",
        "collection": "Tumblers",
        "usage": ["product card"],
        "alt": "Small engraved tumbler with custom design",
        "focalPoint": "center",
    },
    "Softball.jpg": {
        "slug": "softball",
        "title": "Custom softball",
        "collection": "Sports and teams",
        "usage": ["product card"],
        "alt": "Custom printed softball",
        "focalPoint": "center",
    },
    "Tumbler-WV.jpg": {
        "slug": "tumbler-wv",
        "title": "West Virginia tumbler",
        "collection": "Tumblers",
        "usage": ["product card"],
        "alt": "West Virginia themed personalized tumbler",
        "focalPoint": "center",
    },
    "baseball.jpg": {
        "slug": "baseball",
        "title": "Custom baseball",
        "collection": "Sports and teams",
        "usage": ["product card"],
        "alt": "Custom printed baseball",
        "focalPoint": "center",
    },
    "big-gangsheet.jpg": {
        "slug": "big-gangsheet",
        "title": "Wide gang sheet",
        "collection": "Gang sheets",
        "usage": ["product card", "builder page"],
        "alt": "Wide gang sheet packed with customer artwork",
        "focalPoint": "center",
    },
    "floor-graphic.jpg": {
        "slug": "floor-graphic",
        "title": "Floor graphic",
        "collection": "Signs and graphics",
        "usage": ["product card"],
        "alt": "Indoor floor graphic decal applied to shop floor",
        "focalPoint": "center",
    },
    "gangsheets.jpg": {
        "slug": "gangsheets",
        "title": "Printed gang sheets",
        "collection": "Gang sheets",
        "usage": ["collection card"],
        "alt": "Stack of printed DTF gang sheets",
        "focalPoint": "center",
    },
    "guru-pack.jpg": {
        "slug": "guru-pack",
        "title": "Brand starter pack",
        "collection": "Artwork and brand services",
        "usage": ["product card"],
        "alt": "Brand starter kit sample pack",
        "focalPoint": "center",
    },
    "h-m-bag.jpg": {
        "slug": "h-m-bag",
        "title": "Branded packaging",
        "collection": "Brand",
        "usage": ["trust proof"],
        "alt": "Hatfield McCoy DTF branded packaging bag",
        "focalPoint": "center",
    },
    "h-m-may4th.jpg": {
        "slug": "h-m-may4th",
        "title": "Customer artwork sample (third-party characters — archive only)",
        "collection": "Archive - third-party marks",
        "usage": ["archive"],
        "alt": "Printed character artwork panel sample",
        "focalPoint": "center",
    },
    "h-m-tumblers.jpg": {
        "slug": "h-m-tumblers",
        "title": "Personalized tumbler lineup",
        "collection": "Tumblers",
        "usage": ["product card", "collection card"],
        "alt": "Lineup of personalized tumblers with custom prints",
        "focalPoint": "center",
    },
    "hoodies-blank.jpg": {
        "slug": "hoodies-blank",
        "title": "Blank hoodies",
        "collection": "Blanks and apparel",
        "usage": ["product card"],
        "alt": "Blank hoodies ready for custom transfers",
        "focalPoint": "center",
    },
    "items-stickerd.jpg": {
        "slug": "items-stickerd",
        "title": "Sticker-decorated merchandise",
        "collection": "Stickers",
        "usage": ["home tile", "collection card"],
        "alt": "Merchandise items decorated with custom stickers",
        "focalPoint": "center",
    },
    "mermaid-patch.jpg": {
        "slug": "mermaid-patch",
        "title": "Mermaid patch",
        "collection": "Patches",
        "usage": ["product card"],
        "alt": "Decorative mermaid custom patch sample",
        "focalPoint": "center",
    },
    "neon-items.jpg": {
        "slug": "neon-items",
        "title": "Neon merchandise",
        "collection": "Fluorescent",
        "usage": ["collection card"],
        "alt": "Neon custom merchandise samples",
        "focalPoint": "center",
    },
    "party-banner2.jpg": {
        "slug": "party-banner2",
        "title": "Party banner",
        "collection": "Signs and banners",
        "usage": ["product card"],
        "alt": "Custom printed party banner",
        "focalPoint": "center",
    },
    "party-banner3.jpg": {
        "slug": "party-banner3",
        "title": "Celebration banner",
        "collection": "Signs and banners",
        "usage": ["collection card"],
        "alt": "Custom celebration banner print",
        "focalPoint": "center",
    },
    "pickleball.jpg": {
        "slug": "pickleball",
        "title": "Custom pickleball",
        "collection": "Sports and teams",
        "usage": ["product card"],
        "alt": "Custom printed pickleball",
        "focalPoint": "center",
    },
    "pro-kit.jpg": {
        "slug": "pro-kit",
        "title": "Pro setup kit",
        "collection": "Artwork and brand services",
        "usage": ["product card"],
        "alt": "Pro setup kit sample bundle",
        "focalPoint": "center",
    },
    "pro-vector.jpg": {
        "slug": "pro-vector",
        "title": "Vector artwork service",
        "collection": "Artwork and brand services",
        "usage": ["product card"],
        "alt": "Professional vector artwork cleanup sample",
        "focalPoint": "center",
    },
    "puff-shirt.jpg": {
        "slug": "puff-shirt",
        "title": "Puff transfer shirt",
        "collection": "3D puff",
        "usage": ["product card"],
        "alt": "Raised 3D puff transfer on a shirt",
        "focalPoint": "center",
    },
    "puff-shirt2.jpg": {
        "slug": "puff-shirt2",
        "title": "Puff transfer detail",
        "collection": "3D puff",
        "usage": ["detail image"],
        "alt": "Raised puff transfer detail on shirt",
        "focalPoint": "center",
    },
    "rush-order.jpg": {
        "slug": "rush-order",
        "title": "Rush order transfers",
        "collection": "Service add-ons",
        "usage": ["product card"],
        "alt": "Rush order DTF transfers packed for fast turnaround",
        "focalPoint": "center",
    },
    "uv-stickers.jpg": {
        "slug": "uv-stickers",
        "title": "UV DTF stickers",
        "collection": "Stickers",
        "usage": ["product card"],
        "alt": "UV DTF sticker samples",
        "focalPoint": "center",
    },
    "window-front.jpg": {
        "slug": "window-front",
        "title": "Storefront window graphics",
        "collection": "Signs and graphics",
        "usage": ["product card"],
        "alt": "Custom storefront window graphics",
        "focalPoint": "center",
    },
    "window-vinyl-decal.jpg": {
        "slug": "window-vinyl-decal",
        "title": "Window vinyl decal",
        "collection": "Signs and graphics",
        "usage": ["product card"],
        "alt": "Window vinyl decal applied to glass",
        "focalPoint": "center",
    },
    # Generated brand set (D4/D5) — curated 2026-06-11; photoreal, no text/logos.
    "gen-dtf-transfer-peel.png": {
        "slug": "gen-dtf-transfer-peel",
        "title": "Transfer peel",
        "collection": "DTF transfers",
        "usage": ["product card", "guides"],
        "alt": "Peeling DTF film off a freshly pressed shirt to reveal the print",
        "focalPoint": "center",
    },
    "gen-gang-sheet-roll.png": {
        "slug": "gen-gang-sheet-roll",
        "title": "Gang sheet roll",
        "collection": "Gang sheets",
        "usage": ["product card"],
        "alt": "Printed gang sheet roll packed with colorful artwork",
        "focalPoint": "center",
    },
    "gen-builder-canvas-layout.png": {
        "slug": "gen-builder-canvas-layout",
        "title": "Gang sheet layout",
        "collection": "Gang sheet builder",
        "usage": ["builder page", "collection card"],
        "alt": "Gang sheet with abstract designs arranged edge to edge",
        "focalPoint": "center",
    },
    "gen-glitter-film-sheet.png": {
        "slug": "gen-glitter-film-sheet",
        "title": "Glitter transfer sheet",
        "collection": "Specialty glitter",
        "usage": ["product card"],
        "alt": "Glitter transfer sheet close up with sparkling flake",
        "focalPoint": "center",
    },
    "gen-glow-film-sheet.png": {
        "slug": "gen-glow-film-sheet",
        "title": "Glow transfer sheet",
        "collection": "Specialty glow",
        "usage": ["product card"],
        "alt": "Glow in the dark transfer sheet shown glowing and in daylight",
        "focalPoint": "center",
    },
    "gen-uv-dtf-sticker-pack.png": {
        "slug": "gen-uv-dtf-sticker-pack",
        "title": "UV DTF sticker pack",
        "collection": "Stickers",
        "usage": ["product card"],
        "alt": "UV DTF sticker sheet with decals applied to a dark tumbler",
        "focalPoint": "center",
    },
    "gen-apparel-samples-stack.png": {
        "slug": "gen-apparel-samples-stack",
        "title": "Blank apparel stack",
        "collection": "Blanks and apparel",
        "usage": ["product card", "collection card"],
        "alt": "Stack of folded blank tees ready for custom printing",
        "focalPoint": "center",
    },
    "gen-blank-shirt-transfer.png": {
        "slug": "gen-blank-shirt-transfer",
        "title": "Transfer placement",
        "collection": "Apparel transfers",
        "usage": ["product card", "guides"],
        "alt": "Blank tee with a transfer positioned before pressing",
        "focalPoint": "center",
    },
    "gen-heat-press-shirt.png": {
        "slug": "gen-heat-press-shirt",
        "title": "Heat press",
        "collection": "Production",
        "usage": ["guides", "process module"],
        "alt": "Heat press pressing a custom shirt with steam rising",
        "focalPoint": "center",
    },
    "gen-pressed-shirt-front.png": {
        "slug": "gen-pressed-shirt-front",
        "title": "Finished shirt",
        "collection": "Apparel transfers",
        "usage": ["product card"],
        "alt": "Finished shirt with a vivid freshly pressed design",
        "focalPoint": "center",
    },
    "gen-printer-output-film.png": {
        "slug": "gen-printer-output-film",
        "title": "Printer output",
        "collection": "Production",
        "usage": ["product card", "guides"],
        "alt": "Wide format printer outputting printed DTF film",
        "focalPoint": "center",
    },
    "gen-shipping-pouch-transfers.png": {
        "slug": "gen-shipping-pouch-transfers",
        "title": "Order packed to ship",
        "collection": "Service add-ons",
        "usage": ["product card"],
        "alt": "Rolled printed transfers boxed and ready to ship",
        "focalPoint": "center",
    },
    "gen-sublimation-tumbler.png": {
        "slug": "gen-sublimation-tumbler",
        "title": "Sublimation tumbler",
        "collection": "Sublimation",
        "usage": ["product card"],
        "alt": "Tumbler with a vibrant full wrap sublimation print",
        "focalPoint": "center",
    },
    "gen-wide-format-roll.png": {
        "slug": "gen-wide-format-roll",
        "title": "Wide format roll",
        "collection": "Signs and graphics",
        "usage": ["product card"],
        "alt": "Wide format print roll with a bold colorful graphic",
        "focalPoint": "center",
    },
    "gen-appalachian-ridge-film.png": {
        "slug": "gen-appalachian-ridge-film",
        "title": "Appalachian ridge film",
        "collection": "Brand",
        "usage": ["brand", "collection card"],
        "alt": "Appalachian mountain ridge design printed on transfer film",
        "focalPoint": "center",
    },
    "gen-service-sample-bundle.png": {
        "slug": "gen-service-sample-bundle",
        "title": "Sample bundle",
        "collection": "Artwork and brand services",
        "usage": ["product card"],
        "alt": "Fanned printed sample swatches on a dark workbench",
        "focalPoint": "center",
    },
    "gen-magnet-truck-door.png": {
        "slug": "gen-magnet-truck-door",
        "title": "Vehicle magnet",
        "collection": "Signs and graphics",
        "usage": ["product card"],
        "alt": "Printed magnetic sign mounted on a work truck door",
        "focalPoint": "center",
    },
    "gen-perf-window-vinyl.png": {
        "slug": "gen-perf-window-vinyl",
        "title": "Perforated window vinyl",
        "collection": "Signs and graphics",
        "usage": ["product card"],
        "alt": "Perforated window vinyl graphic on a storefront window",
        "focalPoint": "center",
    },
    "gen-rip-software-station.png": {
        "slug": "gen-rip-software-station",
        "title": "Production workstation",
        "collection": "Software and RIP",
        "usage": ["product card"],
        "alt": "Print production workstation beside a wide format printer",
        "focalPoint": "center",
    },
    "gen-hockey-puck.png": {
        "slug": "gen-hockey-puck",
        "title": "Printed hockey puck",
        "collection": "Sports and teams",
        "usage": ["product card"],
        "alt": "Hockey puck with a full color printed top face",
        "focalPoint": "center",
    },
    "gen-coin-display.png": {
        "slug": "gen-coin-display",
        "title": "Custom coins",
        "collection": "Promo and gifts",
        "usage": ["product card"],
        "alt": "Tray of custom printed commemorative coins",
        "focalPoint": "center",
    },
    "gen-vector-cleanup.png": {
        "slug": "gen-vector-cleanup",
        "title": "Vector cleanup",
        "collection": "Artwork and brand services",
        "usage": ["product card"],
        "alt": "Rough sketch beside its clean vector version",
        "focalPoint": "center",
    },
}

# Derivative sets kept on disk without a live source (referenced by asset-map
# families until D5 regenerates them). Excluded from the stale-derivative scan.
LEGACY_PINNED_SLUGS = {"featured-merch-scene"}

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

    sources = sorted([*SOURCE_DIR.glob("*.jpg"), *SOURCE_DIR.glob("*.png")])
    for source in sources:
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

    # Flag derivative sets whose source slug no longer exists (warn only — never
    # auto-delete; LEGACY_PINNED_SLUGS are intentional keepers).
    manifest_slugs = {item["slug"] for item in manifest["images"]}
    for derivative in sorted(OUTPUT_DIR.glob("*.webp")):
        stem = derivative.stem
        for size_name in SIZES:
            suffix = f"-{size_name}"
            if stem.endswith(suffix):
                slug = stem[: -len(suffix)]
                if slug not in manifest_slugs and slug not in LEGACY_PINNED_SLUGS:
                    manifest["warnings"].append({
                        "issue": "stale-derivative",
                        "file": derivative.name,
                    })
                break

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {MANIFEST_PATH.relative_to(ROOT)}")
    print(f"Ready images: {sum(1 for i in manifest['images'] if i['status'] == 'ready')}")
    print(f"Warnings: {len(manifest['warnings'])}")
    for warning in manifest["warnings"]:
        print(f"  warn: {warning.get('issue', 'issue')} — {warning.get('file', warning.get('source', ''))}")


if __name__ == "__main__":
    main()
