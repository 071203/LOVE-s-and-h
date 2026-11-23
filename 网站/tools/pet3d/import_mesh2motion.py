"""Convert the CC0 Mesh2Motion cat/dog variants into site-ready pet assets."""

from pathlib import Path

import numpy as np
import trimesh
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "work/pet3d/eval/mesh2motion"
OUTPUT_DIR = ROOT / "public/pets/models"


def load_static_scene(path: Path) -> trimesh.Scene:
    scene = trimesh.load(path, force="scene", process=False)
    if not scene.geometry:
        raise ValueError(f"no pet geometry in {path}")
    return scene


def primary_mesh(scene: trimesh.Scene) -> trimesh.Trimesh:
    return max(scene.geometry.values(), key=lambda mesh: len(mesh.faces))


def recolour_cat_texture(texture: Image.Image) -> Image.Image:
    """Turn the source orange tabby fur into a cool British-blue coat."""
    rgb = np.asarray(texture.convert("RGB"), dtype=np.float32) / 255.0
    hsv = np.asarray(texture.convert("HSV"), dtype=np.float32) / 255.0
    hue, saturation, value = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    fur = (
        (((hue < 0.17) | (hue > 0.985)) & (saturation > 0.12) & (value > 0.08))
        | ((hue > 0.9) & (saturation > 0.2) & (value < 0.35))
    )
    cool = np.stack(
        [value * 0.46, value * 0.53, value * 0.61],
        axis=-1,
    )
    rgb[fur] = cool[fur]
    return Image.fromarray(np.clip(rgb * 255.0, 0, 255).astype(np.uint8), "RGB")


def export_pet(source_name: str, output_name: str, recolour: bool = False) -> Path:
    scene = load_static_scene(SOURCE_DIR / source_name)
    if recolour:
        material = primary_mesh(scene).visual.material
        material.baseColorTexture = recolour_cat_texture(material.baseColorTexture)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_DIR / output_name
    output.write_bytes(scene.export(file_type="glb"))
    return output


if __name__ == "__main__":
    for source, output, recolour in (
        ("cat-static.glb", "tom.glb", True),
        ("dog-static.glb", "pipi.glb", False),
    ):
        result = export_pet(source, output, recolour)
        print(f"{result.relative_to(ROOT)} {result.stat().st_size} bytes")
