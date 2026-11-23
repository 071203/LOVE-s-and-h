from __future__ import annotations

import json
import os
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "work" / "pet3d"
MANIFEST = Path(__file__).with_name("photo-manifest.json")


def remove_background(image: Image.Image) -> Image.Image:
    try:
        from rembg import new_session, remove
    except ImportError:
        return image.convert("RGBA")

    model_path = os.environ.get("REMBG_MODEL_PATH")
    session = (
        new_session("u2net_custom", model_path=model_path)
        if model_path
        else new_session("u2net")
    )
    return remove(image.convert("RGBA"), session=session).convert("RGBA")


def normalize_image(source: Path, destination: Path) -> None:
    with Image.open(source) as image:
        image = image.convert("RGB")
        alpha = remove_background(image)
        alpha.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        alpha.save(destination, "PNG")


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for pet_slug, pet in manifest["pets"].items():
        destination_dir = WORK / "prepared" / pet_slug
        for item in pet["sources"]:
            source = WORK / "source" / pet_slug / item["file"]
            if not source.is_file():
                raise FileNotFoundError(source)
            normalize_image(source, destination_dir / f"{Path(item['file']).stem}.png")


if __name__ == "__main__":
    main()
