from __future__ import annotations

import argparse
import json
import os
import sys
import types
from pathlib import Path

import numpy as np
import torch
import trimesh
from PIL import Image
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial


ROOT = Path(__file__).resolve().parents[2]
TRIPO_ROOT = ROOT / "work" / "pet3d" / "repos" / "TripoSR-main"
if not TRIPO_ROOT.is_dir():
    raise SystemExit(f"TripoSR source not found: {TRIPO_ROOT}")


def install_marching_cubes_fallback() -> None:
    try:
        import torchmcubes  # noqa: F401
        return
    except ImportError:
        pass

    from skimage import measure

    module = types.ModuleType("torchmcubes")

    def marching_cubes(volume: torch.Tensor, level: float):
        vertices, faces, _, _ = measure.marching_cubes(
            volume.detach().cpu().numpy(),
            level=float(level),
            allow_degenerate=False,
        )
        # skimage returns xyz; torchmcubes returned zyx to this codebase.
        vertices = vertices[:, [2, 1, 0]].copy()
        return torch.from_numpy(vertices).float(), torch.from_numpy(faces.astype(np.int64))

    module.marching_cubes = marching_cubes
    sys.modules["torchmcubes"] = module


install_marching_cubes_fallback()
sys.path.insert(0, str(TRIPO_ROOT))

from tsr.bake_texture import bake_texture  # noqa: E402
from tsr.system import TSR  # noqa: E402
from tsr.utils import remove_background, resize_foreground  # noqa: E402
from tsr.models.tokenizers import image as image_tokenizer_module  # noqa: E402


def prepare_image(source: Path, foreground_ratio: float) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    alpha = np.asarray(image)[..., 3]
    if alpha.min() > 250:
        import rembg

        image = remove_background(image, rembg.new_session())
    image = resize_foreground(image, foreground_ratio)
    rgba = np.asarray(image).astype(np.float32) / 255.0
    composite = rgba[:, :, :3] * rgba[:, :, 3:4] + (1 - rgba[:, :, 3:4]) * 0.5
    return Image.fromarray((composite * 255).astype(np.uint8))


def export_textured_glb(mesh: trimesh.Trimesh, baked: dict, texture: Image.Image, output: Path) -> None:
    material = PBRMaterial(
        baseColorTexture=texture,
        metallicFactor=0.0,
        roughnessFactor=0.82,
    )
    visual = TextureVisuals(uv=baked["uvs"], material=material)
    textured = trimesh.Trimesh(
        vertices=mesh.vertices[baked["vmapping"]],
        faces=baked["indices"],
        vertex_normals=mesh.vertex_normals[baked["vmapping"]],
        visual=visual,
        process=False,
    )
    textured.export(output, file_type="glb")


def remove_tiny_components(
    mesh: trimesh.Trimesh, min_area_ratio: float
) -> tuple[trimesh.Trimesh, list[float]]:
    components = mesh.split(only_watertight=False)
    total_area = max(float(mesh.area), 1e-12)
    kept = []
    removed = []
    for component in components:
        ratio = float(component.area) / total_area
        if ratio < min_area_ratio:
            removed.append(ratio)
        else:
            kept.append(component)
    if not kept:
        raise RuntimeError("mesh cleanup removed every connected component")
    cleaned = trimesh.util.concatenate(kept)
    cleaned.remove_unreferenced_vertices()
    return cleaned, removed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pet", required=True, choices=["tom", "pipi"])
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model-dir", default=str(ROOT / "work" / "pet3d" / "models" / "triposr"))
    parser.add_argument("--texture-resolution", type=int, default=2048)
    parser.add_argument("--mc-resolution", type=int, default=256)
    parser.add_argument("--chunk-size", type=int, default=8192)
    parser.add_argument("--foreground-ratio", type=float, default=0.78)
    parser.add_argument("--min-component-ratio", type=float, default=0.005)
    parser.add_argument("--raw-output")
    args = parser.parse_args()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    texture_path = output.with_name(f"{output.stem}-texture.png")
    meta_path = output.with_name(f"{output.stem}-meta.json")
    raw_path = (
        Path(args.raw_output)
        if args.raw_output
        else output.with_name(f"{output.stem}-raw.glb")
    )

    original_hf_hub_download = image_tokenizer_module.hf_hub_download

    def local_or_remote_hf_download(*, repo_id: str, filename: str, **kwargs):
        local_candidate = Path(repo_id) / filename
        if local_candidate.is_file():
            return str(local_candidate)
        return original_hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            **kwargs,
        )

    image_tokenizer_module.hf_hub_download = local_or_remote_hf_download

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = TSR.from_pretrained(args.model_dir, "config.yaml", "model.ckpt")
    model.renderer.set_chunk_size(args.chunk_size)
    model.to(device)
    model.eval()

    image = prepare_image(Path(args.source), args.foreground_ratio)
    with torch.inference_mode():
        scene_codes = model([image], device=device)
        mesh = model.extract_mesh(scene_codes, False, resolution=args.mc_resolution)[0]
        mesh = trimesh.smoothing.filter_laplacian(mesh, lamb=0.28, iterations=1)
        mesh.update_faces(mesh.nondegenerate_faces())
        mesh.remove_unreferenced_vertices()
        mesh, removed_components = remove_tiny_components(
            mesh, args.min_component_ratio
        )
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        mesh.export(raw_path, file_type="glb")
        baked = bake_texture(mesh, model, scene_codes[0], args.texture_resolution)

    texture = Image.fromarray((baked["colors"] * 255.0).astype(np.uint8)).transpose(
        Image.Transpose.FLIP_TOP_BOTTOM
    )
    texture.save(texture_path)
    export_textured_glb(mesh, baked, texture, output)

    meta = {
        "pet": args.pet,
        "source": str(Path(args.source)),
        "output": str(output),
        "texture": str(texture_path),
        "raw_output": str(raw_path),
        "device": device,
        "triangles": int(len(mesh.faces)),
        "vertices": int(len(mesh.vertices)),
        "mc_resolution": args.mc_resolution,
        "texture_resolution": args.texture_resolution,
        "foreground_ratio": args.foreground_ratio,
        "removed_components": len(removed_components),
        "removed_component_ratios": [round(value, 6) for value in removed_components],
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == "__main__":
    os.environ.setdefault("USE_TF", "0")
    os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")
    main()
