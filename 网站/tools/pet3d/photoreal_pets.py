from __future__ import annotations

import argparse
from functools import lru_cache
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image, ImageFilter
from trimesh.transformations import rotation_matrix
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial

try:
    from tools.pet3d.sculpt_pets import material, srgb
except ModuleNotFoundError:
    from sculpt_pets import material, srgb


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "work/pet3d/eval/candidates"
CAT_BODY_SOURCE = SOURCE_DIR / "fantasy-cat.glb"
DOG_BODY_SOURCE = SOURCE_DIR / "fantasy-dog.glb"
LAYERED_EYE_SOURCE = SOURCE_DIR / "3dcat-cat.glb"

EYE_SOURCE_NAMES = {
    "EyeSclera": "CatFaceMesh",
    "EyeIrisDeep": "CatFaceMesh_1",
    "EyeIris": "CatFaceMesh_2",
    "EyeIrisInner": "CatFaceMesh_3",
    "EyeIrisOuter": "CatFaceMesh_4",
    "EyePupil": "CatFaceMesh_5",
    "EyeCornea": "CatFaceMesh_6",
    "EyeGlint": "CatFaceMesh_7",
}

EYE_COLOURS = {
    "tom": {
        "EyeSclera": "#707a82",
        "EyeIrisDeep": "#8b5b1d",
        "EyeIris": "#d09b42",
        "EyeIrisInner": "#f0ca6b",
        "EyeIrisOuter": "#8f612d",
        "EyePupil": "#080604",
        "EyeCornea": "#fffaf1",
        "EyeGlint": "#fff6dc",
        "EyeLid": "#626c73",
    },
    "pipi": {
        "EyeSclera": "#8b6a4e",
        "EyeIrisDeep": "#7a4d22",
        "EyeIris": "#b07638",
        "EyeIrisInner": "#dba964",
        "EyeIrisOuter": "#7f552d",
        "EyePupil": "#070504",
        "EyeCornea": "#fffaf3",
        "EyeGlint": "#fff8e7",
        "EyeLid": "#86684f",
    },
}


def _largest_mesh(scene: trimesh.Scene) -> trimesh.Trimesh:
    meshes = [
        (name, geometry)
        for name, geometry in scene.geometry.items()
        if isinstance(geometry, trimesh.Trimesh)
    ]
    if not meshes:
        raise ValueError("source GLB contains no triangle meshes")
    geometry_name, source_mesh = max(meshes, key=lambda item: len(item[1].faces))
    mesh = source_mesh.copy()
    for edge in scene.graph.to_edgelist():
        if edge[2].get("geometry") != geometry_name:
            continue
        world_transform, _ = scene.graph.get(edge[1], "world")
        mesh.apply_transform(world_transform)
        break
    return mesh


def _resize_texture(texture: Image.Image | None, size: int) -> Image.Image | None:
    if texture is None:
        return None
    image = texture.convert("RGB")
    return image.resize((size, size), Image.Resampling.LANCZOS)


def _recolour_fur(texture: Image.Image, colour: str, size: int) -> Image.Image:
    image = texture.convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
    luminosity = np.asarray(image.convert("L"), dtype=np.float32) / 255.0
    target = np.array(
        [int(colour[index : index + 2], 16) for index in (1, 3, 5)],
        dtype=np.float32,
    )
    # Keep the scan's pores, strand contrast and shadowing, but remove the
    # reference animal's coat colour. The floor prevents accidental pure-white
    # socks on TOM while preserving highlights around the muzzle and paws.
    shade = np.clip(0.55 + luminosity * 0.62, 0.38, 1.16)
    pixels = np.clip(target[None, None, :] * shade[..., None], 0.0, 255.0)
    result = Image.fromarray(pixels.astype(np.uint8), mode="RGB")
    # The source scan is soft around the face. Restore local strand and muzzle
    # contrast without inventing new fur patterns or changing the silhouette.
    return result.filter(ImageFilter.UnsharpMask(radius=1.2, percent=180, threshold=3))


def _photo_fur_material(
    source: PBRMaterial,
    *,
    name: str,
    colour: str,
    texture_size: int,
) -> PBRMaterial:
    base = source.baseColorTexture
    if base is None:
        raise ValueError(f"{source.name}: source body has no colour texture")
    normal = _resize_texture(source.normalTexture, max(512, texture_size // 2))
    metallic_roughness = _resize_texture(source.metallicRoughnessTexture, texture_size)
    return PBRMaterial(
        name=name,
        baseColorFactor=[1.0, 1.0, 1.0, 1.0],
        baseColorTexture=_recolour_fur(base, colour, texture_size),
        normalTexture=normal,
        metallicRoughnessTexture=metallic_roughness,
        metallicFactor=0.0,
        roughnessFactor=0.92,
        doubleSided=False,
    )


def _body_from_photo_scan(
    source_path: Path,
    *,
    name: str,
    colour: str,
) -> trimesh.Trimesh:
    if not source_path.is_file():
        raise FileNotFoundError(
            f"missing photo-sculpt source {source_path}; keep the downloaded GitHub "
            "candidate in work/pet3d/eval/candidates before rebuilding"
        )
    source_scene = trimesh.load(source_path, force="scene", process=False)
    body = _largest_mesh(source_scene)
    source_material = body.visual.material
    uv = body.visual.uv.copy() if getattr(body.visual, "uv", None) is not None else None
    if uv is None:
        raise ValueError(f"{source_path.name}: source body has no UV map")

    # The imported scans face +Z. Existing pet choreography expects +X so both
    # pets continue to share the same room orientation and touch controls.
    body.apply_transform(rotation_matrix(np.pi / 2.0, [0.0, 1.0, 0.0]))
    body.visual = TextureVisuals(
        material=_photo_fur_material(
            source_material,
            name=name,
            colour=colour,
            texture_size=2048,
        ),
        uv=uv,
    )
    return body


@lru_cache(maxsize=1)
def _layered_eye_source() -> trimesh.Scene:
    if not LAYERED_EYE_SOURCE.is_file():
        raise FileNotFoundError(
            f"missing layered eye source {LAYERED_EYE_SOURCE}; expected the MIT "
            "edkhv/3D-cat model"
        )
    return trimesh.load(LAYERED_EYE_SOURCE, force="scene", process=False)


def _eye_material(
    species: str,
    layer: str,
) -> PBRMaterial:
    colour = EYE_COLOURS[species][layer]
    if layer == "EyeCornea":
        return PBRMaterial(
            name=f"{species.title()}{layer}",
            baseColorFactor=[*srgb(colour), 0.075],
            alphaMode="BLEND",
            metallicFactor=0.0,
            roughnessFactor=0.025,
            doubleSided=True,
        )
    roughness = 0.08 if layer in {"EyeGlint", "EyePupil"} else 0.22
    return PBRMaterial(
        name=f"{species.title()}{layer}",
        baseColorFactor=[*srgb(colour), 1.0],
        metallicFactor=0.0,
        roughnessFactor=roughness,
        doubleSided=False,
    )


def _add_layered_eyes(
    scene: trimesh.Scene,
    *,
    species: str,
    target_y: float,
    side_x: dict[str, float],
    scale: float,
    vertical_scale: float,
    pupil_width: float,
    lateral_spacing: float,
) -> None:
    source = _layered_eye_source()
    source_center = np.array([0.225, 0.289, 0.0], dtype=float)
    for layer, geometry_name in EYE_SOURCE_NAMES.items():
        geometry = source.geometry[geometry_name]
        parts = geometry.split(only_watertight=False)
        if len(parts) != 2:
            raise ValueError(f"{layer}: expected two eye islands, found {len(parts)}")
        parts.sort(key=lambda part: float(part.bounds.mean(axis=0)[2]))
        for side, part in zip(("R", "L"), parts):
            side_sign = -1.0 if side == "R" else 1.0
            shaped = part.copy()
            if layer == "EyePupil" and pupil_width != 1.0:
                centre_z = float(shaped.bounds.mean(axis=0)[2])
                shaped.vertices[:, 2] = centre_z + (
                    shaped.vertices[:, 2] - centre_z
                ) * pupil_width
            shaped.vertices = shaped.vertices - source_center
            shaped.vertices[:, 1] *= scale * vertical_scale
            shaped.vertices[:, [0, 2]] *= scale
            centre = shaped.bounds.mean(axis=0)
            shaped.vertices += np.asarray(
                [
                    side_x[side] - centre[0],
                    target_y - centre[1],
                    side_sign * lateral_spacing - centre[2],
                ]
            )
            uv = getattr(shaped.visual, "uv", None)
            if uv is None:
                uv = np.zeros((len(shaped.vertices), 2), dtype=float)
            shaped.visual = TextureVisuals(
                material=_eye_material(species, layer),
                uv=np.clip(uv, 0.0, 1.0),
            )
            scene.add_geometry(
                shaped,
                node_name=f"{layer}{side}",
                geom_name=f"{layer}{side}",
            )
    # The source model's torus-shaped eyelids are what turn the exposed eye
    # spheres into believable almond/round apertures. They carry the same skin
    # colour as the fur so the layered eye reads as part of the face.
    lid_geometry = source.geometry["CatFaceMesh_8"]
    lid_parts = lid_geometry.split(only_watertight=False)
    if len(lid_parts) != 2:
        raise ValueError(f"EyeLid: expected two islands, found {len(lid_parts)}")
    lid_parts.sort(key=lambda part: float(part.bounds.mean(axis=0)[2]))
    lid_material = material(
        f"{species.title()}LayeredEyeLid",
        EYE_COLOURS[species]["EyeLid"],
        0.8,
    )
    for side, part in zip(("R", "L"), lid_parts):
        side_sign = -1.0 if side == "R" else 1.0
        shaped = part.copy()
        if species == "pipi":
            centre_z = float(shaped.bounds.mean(axis=0)[2])
            shaped.vertices[:, 2] = centre_z + (
                shaped.vertices[:, 2] - centre_z
            ) * 1.18
        shaped.vertices = shaped.vertices - source_center
        shaped.vertices[:, 1] *= scale * vertical_scale
        shaped.vertices[:, [0, 2]] *= scale
        centre = shaped.bounds.mean(axis=0)
        shaped.vertices += np.asarray(
            [
                side_x[side] - centre[0],
                target_y - centre[1],
                side_sign * lateral_spacing - centre[2],
            ]
        )
        shaped.visual = TextureVisuals(material=lid_material)
        scene.add_geometry(
            shaped,
            node_name=f"EyeLid{side}",
            geom_name=f"EyeLid{side}",
        )


def _add_nose(
    scene: trimesh.Scene,
    *,
    name: str,
    colour: str,
    centre: tuple[float, float, float],
    size: tuple[float, float, float],
) -> None:
    nose = trimesh.creation.icosphere(subdivisions=3, radius=1.0)
    nose.vertices *= np.asarray(size)
    nose.vertices += np.asarray(centre)
    nose.visual = TextureVisuals(
        material=material(name, colour, 0.2)
    )
    scene.add_geometry(nose, node_name="Nose", geom_name="Nose")


def build_tom() -> trimesh.Scene:
    body = _body_from_photo_scan(
        CAT_BODY_SOURCE,
        name="TomBlueGrayPhotoFur",
        colour="#788086",
    )
    scene = trimesh.Scene()
    scene.add_geometry(body, node_name="Body", geom_name="Body")
    _add_layered_eyes(
        scene,
        species="tom",
        target_y=0.43,
        side_x={"R": 0.281, "L": 0.292},
        scale=0.58,
        vertical_scale=0.72,
        pupil_width=0.85,
        lateral_spacing=0.024,
    )
    _add_nose(
        scene,
        name="TomNose",
        colour="#29272b",
        centre=(0.293, 0.379, 0.0),
        size=(0.008, 0.006, 0.012),
    )
    return scene


def build_pipi() -> trimesh.Scene:
    body = _body_from_photo_scan(
        DOG_BODY_SOURCE,
        name="PipiWarmPhotoFur",
        colour="#b58a64",
    )
    scene = trimesh.Scene()
    scene.add_geometry(body, node_name="Body", geom_name="Body")
    _add_layered_eyes(
        scene,
        species="pipi",
        target_y=0.402,
        side_x={"R": 0.267, "L": 0.267},
        scale=0.62,
        vertical_scale=0.9,
        pupil_width=0.95,
        lateral_spacing=0.025,
    )
    _add_nose(
        scene,
        name="PipiBlackNose",
        colour="#1a1715",
        centre=(0.315, 0.361, 0.0),
        size=(0.009, 0.006, 0.012),
    )
    return scene


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default=str(ROOT / "work/pet3d/output"))
    args = parser.parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    for slug, builder in (("tom", build_tom), ("pipi", build_pipi)):
        scene = builder()
        path = output_dir / f"{slug}-sculpt.glb"
        scene.export(path, file_type="glb")
        print(f"PHOTOREAL {slug}: {len(scene.geometry)} parts -> {path}")


if __name__ == "__main__":
    main()
