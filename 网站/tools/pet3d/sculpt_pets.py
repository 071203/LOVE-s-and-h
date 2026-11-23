from __future__ import annotations

import argparse
import math
from functools import lru_cache
from pathlib import Path
from typing import Callable

import numpy as np
import trimesh
from PIL import Image
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes
from trimesh.transformations import rotation_matrix, translation_matrix
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial


ROOT = Path(__file__).resolve().parents[2]
Sdf = Callable[[np.ndarray], np.ndarray]


def srgb(hex_color: str) -> list[float]:
    values = np.array(
        [int(hex_color[index : index + 2], 16) for index in (1, 3, 5)],
        dtype=float,
    ) / 255.0
    linear = np.where(
        values <= 0.04045,
        values / 12.92,
        ((values + 0.055) / 1.055) ** 2.4,
    )
    return [float(value) for value in linear]


def material(
    name: str,
    color: str,
    roughness: float,
    metallic: float = 0.0,
) -> PBRMaterial:
    return PBRMaterial(
        name=name,
        baseColorFactor=srgb(color),
        roughnessFactor=roughness,
        metallicFactor=metallic,
        doubleSided=False,
    )


@lru_cache(maxsize=12)
def fur_material(
    name: str,
    color: str,
    frequency: float,
    strength: float,
    seed: int,
) -> PBRMaterial:
    size = 512
    rng = np.random.default_rng(seed)
    strand_sigma = max(0.45, 5.8 / max(frequency, 1.0))
    fine_strands = gaussian_filter(
        rng.standard_normal((size, size)),
        sigma=(strand_sigma * 0.58, strand_sigma * 2.4),
        mode="wrap",
    )
    broken_strands = gaussian_filter(
        rng.standard_normal((size, size)),
        sigma=(strand_sigma * 1.25, strand_sigma * 3.8),
        mode="wrap",
    )
    clumps = gaussian_filter(
        rng.standard_normal((size, size)),
        sigma=(7.0, 10.0),
        mode="wrap",
    )
    fibers = fine_strands * 0.62 + broken_strands * 0.28 + clumps * 0.10
    fibers = np.clip(fibers / max(float(np.std(fibers)), 1e-6), -2.4, 2.4)
    color_rgb = np.array(
        [int(color[index : index + 2], 16) for index in (1, 3, 5)],
        dtype=np.float32,
    )
    variation = np.clip(fibers[..., None] * 8.5 * strength, -12.0, 12.0)
    base_color = np.clip(color_rgb + variation, 0.0, 255.0).astype(np.uint8)

    gradient_y, gradient_x = np.gradient(fibers)
    strength_pixels = 2.1 * strength
    normal = np.stack(
        (-gradient_x * strength_pixels, -gradient_y * strength_pixels, np.ones_like(fibers)),
        axis=-1,
    )
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    normal_image = ((normal * 0.5 + 0.5) * 255.0).astype(np.uint8)

    roughness = np.clip(
        228.0 + fibers * 13.0,
        214.0,
        248.0,
    ).astype(np.uint8)
    metallic_roughness = np.empty((size, size, 3), dtype=np.uint8)
    metallic_roughness[..., 0] = 255
    metallic_roughness[..., 1] = roughness
    metallic_roughness[..., 2] = 0

    return PBRMaterial(
        name=name,
        metallicFactor=0.0,
        roughnessFactor=1.0,
        baseColorTexture=Image.fromarray(base_color, mode="RGB"),
        normalTexture=Image.fromarray(normal_image, mode="RGB"),
        metallicRoughnessTexture=Image.fromarray(metallic_roughness, mode="RGB"),
        doubleSided=False,
    )


def project_uv(
    mesh: trimesh.Trimesh,
    bounds: tuple[tuple[float, float], tuple[float, float], tuple[float, float]],
) -> np.ndarray:
    (min_x, max_x), (min_y, max_y), _ = bounds
    vertices = mesh.vertices
    u = (vertices[:, 0] - min_x) / max(max_x - min_x, 1e-6)
    v = (vertices[:, 1] - min_y) / max(max_y - min_y, 1e-6)
    u = np.mod(u + np.sin(vertices[:, 2] * 4.0) * 0.012, 1.0)
    return np.column_stack((np.clip(u, 0.0, 1.0), np.clip(v, 0.0, 1.0)))


def spherical_uv(mesh: trimesh.Trimesh) -> np.ndarray:
    vertices = mesh.vertices
    unit = vertices / np.maximum(np.linalg.norm(vertices, axis=1, keepdims=True), 1e-9)
    u = np.arctan2(unit[:, 1], unit[:, 0]) / (2.0 * math.pi) + 0.5
    v = np.arccos(np.clip(unit[:, 2], -1.0, 1.0)) / math.pi
    return np.column_stack((u, v))


def apply_fur_relief(
    mesh: trimesh.Trimesh,
    amplitude: float,
    seed: float,
) -> None:
    vertices = mesh.vertices
    normals = mesh.vertex_normals.copy()
    phase = (
        vertices[:, 0] * 73.0
        + vertices[:, 1] * 91.0
        + vertices[:, 2] * 137.0
        + seed
    )
    relief = np.mod(np.sin(phase) * 43758.5453, 1.0) * 2.0 - 1.0
    mesh.vertices = vertices + normals * relief[:, None] * amplitude
    mesh.vertex_normals = None


def ellipsoid_sdf(
    center: tuple[float, float, float],
    radii: tuple[float, float, float],
    rotation: np.ndarray | None = None,
) -> Sdf:
    center_array = np.asarray(center, dtype=float)
    radii_array = np.asarray(radii, dtype=float)

    def distance(points: np.ndarray) -> np.ndarray:
        local = points - center_array
        if rotation is not None:
            local = local @ rotation
        scaled = local / radii_array
        return (np.linalg.norm(scaled, axis=-1) - 1.0) * float(radii_array.min())

    return distance


def capsule_sdf(
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    start_radius: float,
    end_radius: float | None = None,
) -> Sdf:
    start_array = np.asarray(start, dtype=float)
    end_array = np.asarray(end, dtype=float)
    segment = end_array - start_array
    segment_length_sq = float(np.dot(segment, segment))
    final_radius = start_radius if end_radius is None else end_radius

    def distance(points: np.ndarray) -> np.ndarray:
        relative = points - start_array
        amount = np.clip(
            np.einsum("...i,i->...", relative, segment) / segment_length_sq,
            0.0,
            1.0,
        )
        closest = start_array + amount[..., None] * segment
        radius = start_radius + (final_radius - start_radius) * amount
        return np.linalg.norm(points - closest, axis=-1) - radius

    return distance


def smooth_union(
    current: np.ndarray,
    additional: np.ndarray,
    blend: float,
) -> np.ndarray:
    amount = np.clip(0.5 + 0.5 * (additional - current) / blend, 0.0, 1.0)
    return additional + (current - additional) * amount - blend * amount * (1.0 - amount)


def organic_mesh(
    bounds: tuple[tuple[float, float], tuple[float, float], tuple[float, float]],
    shapes: list[Sdf],
    face_material: PBRMaterial,
    spacing: float = 0.009,
    blend: float = 0.045,
    relief: float = 0.0,
    seed: float = 0.0,
) -> trimesh.Trimesh:
    axes = [
        np.arange(low, high + spacing * 0.5, spacing, dtype=np.float32)
        for low, high in bounds
    ]
    x, y, z = np.meshgrid(*axes, indexing="ij")
    points = np.stack((x, y, z), axis=-1)
    field = None
    for shape in shapes:
        candidate = shape(points)
        field = candidate if field is None else smooth_union(field, candidate, blend)
    field = gaussian_filter(field, sigma=0.55)
    vertices, faces, _, _ = marching_cubes(field, level=0.0, spacing=(spacing,) * 3)
    vertices += np.asarray([axis[0] for axis in axes], dtype=float)
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.merge_vertices()
    mesh.remove_unreferenced_vertices()
    components = mesh.split(only_watertight=False)
    mesh = max(components, key=lambda component: len(component.faces))
    mesh.fix_normals()
    if relief > 0.0:
        apply_fur_relief(mesh, relief, seed)
    mesh.visual = TextureVisuals(material=face_material, uv=project_uv(mesh, bounds))
    return mesh


def ellipsoid_mesh(
    scale: tuple[float, float, float],
    face_material: PBRMaterial,
    center: tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotation: np.ndarray | None = None,
    count: tuple[int, int] = (56, 34),
) -> trimesh.Trimesh:
    mesh = trimesh.creation.uv_sphere(radius=1.0, count=count)
    uv = spherical_uv(mesh)
    mesh.apply_scale(scale)
    if rotation is not None:
        mesh.apply_transform(rotation)
    mesh.apply_translation(center)
    mesh.visual = TextureVisuals(material=face_material, uv=uv)
    return mesh


def cat_ear_mesh(
    side: int,
    fur: PBRMaterial,
) -> trimesh.Trimesh:
    mesh = trimesh.creation.uv_sphere(radius=1.0, count=(64, 40))
    uv = spherical_uv(mesh)
    vertices = mesh.vertices.copy()
    height = np.clip((vertices[:, 1] + 1.0) * 0.5, 0.0, 1.0)
    vertices[:, 0] *= 1.0 - height * 0.48
    vertices[:, 2] *= 1.0 - height * 0.20
    mesh.vertices = vertices
    mesh.apply_scale((0.17, 0.24, 0.085))
    mesh.apply_transform(rotation_matrix(side * 0.18, [1, 0, 0]))
    mesh.apply_transform(rotation_matrix(-0.08, [0, 0, 1]))
    mesh.apply_translation((0.60, 1.255, side * 0.205))
    mesh.visual = TextureVisuals(material=fur, uv=uv)
    return mesh


def dog_ear_mesh(
    side: int,
    dog_ear: PBRMaterial,
) -> trimesh.Trimesh:
    center_y = 0.75 if side > 0 else 0.71
    center_z = 0.295 if side > 0 else 0.315
    mesh = trimesh.creation.uv_sphere(radius=1.0, count=(64, 40))
    uv = spherical_uv(mesh)
    vertices = mesh.vertices.copy()
    height = np.clip((vertices[:, 1] + 1.0) * 0.5, 0.0, 1.0)
    taper = 0.60 + 0.40 * (1.0 - height)
    vertices[:, 0] *= taper
    vertices[:, 2] *= taper
    mesh.vertices = vertices
    mesh.apply_scale((0.095, 0.30, 0.105))
    mesh.apply_transform(rotation_matrix(side * 0.06, [1, 0, 0]))
    mesh.apply_transform(rotation_matrix(side * 0.10, [0, 1, 0]))
    mesh.apply_translation((0.74, center_y, side * center_z))
    mesh.visual = TextureVisuals(material=dog_ear, uv=uv)
    return mesh


def add_eye_pair(
    scene: trimesh.Scene,
    *,
    center_x: float,
    center_y: float,
    side: float,
    eye_material: PBRMaterial,
    pupil_material: PBRMaterial,
    pupil_scale: tuple[float, float, float],
    eye_scale: tuple[float, float, float] = (0.025, 0.055, 0.066),
) -> None:
    for suffix, sign in (("L", 1), ("R", -1)):
        z = sign * side
        scene.add_geometry(
            ellipsoid_mesh(
                eye_scale,
                eye_material,
                (center_x, center_y, z),
                rotation=rotation_matrix(sign * 0.08, [0, 1, 0]),
            ),
            node_name=f"Eye{suffix}",
            geom_name=f"Eye{suffix}",
        )
        scene.add_geometry(
            ellipsoid_mesh(
                pupil_scale,
                pupil_material,
                (center_x + 0.023, center_y, z),
            ),
            node_name=f"Pupil{suffix}",
            geom_name=f"Pupil{suffix}",
        )
        shine = ellipsoid_mesh(
            (0.005, 0.010, 0.009),
            material("EyeGlint", "#fffaf2", 0.05),
            (center_x + 0.038, center_y + 0.022, z + sign * 0.014),
            count=(24, 14),
        )
        scene.add_geometry(shine, node_name=f"Glint{suffix}", geom_name=f"Glint{suffix}")


def cylinder_between(
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    face_material: PBRMaterial,
) -> trimesh.Trimesh:
    start_array = np.asarray(start, dtype=float)
    end_array = np.asarray(end, dtype=float)
    direction = end_array - start_array
    length = float(np.linalg.norm(direction))
    mesh = trimesh.creation.cylinder(radius=radius, height=length, sections=10)
    transform = trimesh.geometry.align_vectors([0.0, 0.0, 1.0], direction)
    mesh.apply_transform(transform)
    mesh.apply_translation((start_array + end_array) * 0.5)
    mesh.visual = TextureVisuals(material=face_material)
    return mesh


def add_whiskers(
    scene: trimesh.Scene,
    origin: tuple[float, float, float],
    whisker_material: PBRMaterial,
) -> None:
    origin_x, origin_y, _ = origin
    for suffix, sign in (("L", 1), ("R", -1)):
        for index, (dy, dz) in enumerate(((0.03, 0.17), (0.0, 0.20), (-0.025, 0.17))):
            start = (origin_x, origin_y + dy, sign * (0.075 if sign > 0 else -0.075))
            end = (origin_x + 0.23, origin_y + dy * 1.2 - 0.025, sign * (0.075 + dz))
            scene.add_geometry(
                cylinder_between(start, end, 0.0026, whisker_material),
                node_name=f"Whisker{suffix}{index}",
                geom_name=f"Whisker{suffix}{index}",
            )


def build_tom() -> trimesh.Scene:
    scene = trimesh.Scene()
    fur = fur_material("TomBlueGrayFur", "#6d7378", 78.0, 0.9, 3)
    soft_fur = fur_material("TomSoftMuzzle", "#9a9a98", 82.0, 0.55, 5)
    inner_ear = material("TomInnerEar", "#8c7072", 0.9)
    nose = material("TomDarkNose", "#3e3335", 0.3)
    eye = material("TomAmberEye", "#c79a48", 0.16)
    pupil = material("TomPupil", "#17120f", 0.08)
    whisker = material("TomWhisker", "#e8e0d6", 0.55)
    mouth = material("TomMouth", "#45373a", 0.7)

    shapes: list[Sdf] = [
        ellipsoid_sdf((0.0, 0.64, 0.0), (0.58, 0.33, 0.31)),
        ellipsoid_sdf((0.30, 0.70, 0.0), (0.33, 0.31, 0.30)),
        ellipsoid_sdf((0.40, 0.84, 0.0), (0.25, 0.27, 0.27)),
        ellipsoid_sdf((0.63, 1.02, 0.0), (0.34, 0.30, 0.34)),
        ellipsoid_sdf((0.72, 0.98, 0.17), (0.20, 0.17, 0.17)),
        ellipsoid_sdf((0.72, 0.98, -0.17), (0.20, 0.17, 0.17)),
        ellipsoid_sdf((-0.35, 0.59, 0.0), (0.33, 0.31, 0.30)),
    ]
    for x, z in ((0.34, 0.18), (0.34, -0.18), (-0.34, 0.18), (-0.34, -0.18)):
        shapes.append(capsule_sdf((x, 0.58, z), (x, 0.13, z), 0.105, 0.09))
        shapes.append(ellipsoid_sdf((x + 0.055, 0.095, z), (0.15, 0.085, 0.12)))
    for start, end, radii in (
        ((-0.53, 0.66, 0.03), (-0.76, 0.69, 0.08), (0.11, 0.105)),
        ((-0.76, 0.69, 0.08), (-0.88, 0.86, 0.12), (0.105, 0.095)),
        ((-0.88, 0.86, 0.12), (-0.84, 0.98, 0.12), (0.095, 0.082)),
        ((-0.84, 0.98, 0.12), (-0.73, 1.06, 0.10), (0.082, 0.072)),
    ):
        shapes.append(capsule_sdf(start, end, *radii))

    scene.add_geometry(
        organic_mesh(
            ((-1.02, 1.03), (-0.01, 1.39), (-0.43, 0.43)),
            shapes,
            fur,
            spacing=0.0085,
            blend=0.05,
            relief=0.0011,
            seed=4.0,
        ),
        node_name="Body",
        geom_name="Body",
    )
    scene.add_geometry(
        ellipsoid_mesh((0.13, 0.105, 0.18), soft_fur, (0.925, 0.94, 0.0)),
        node_name="Muzzle",
        geom_name="Muzzle",
    )
    scene.add_geometry(
        ellipsoid_mesh((0.038, 0.042, 0.065), nose, (1.052, 0.965, 0.0)),
        node_name="Nose",
        geom_name="Nose",
    )
    add_eye_pair(
        scene,
        center_x=0.952,
        center_y=1.075,
        side=0.16,
        eye_material=eye,
        pupil_material=pupil,
        pupil_scale=(0.014, 0.042, 0.011),
    )
    for suffix, sign in (("L", 1), ("R", -1)):
        scene.add_geometry(
            cat_ear_mesh(sign, fur),
            node_name=f"Ear{suffix}",
            geom_name=f"Ear{suffix}",
        )
        scene.add_geometry(
            ellipsoid_mesh(
                (0.026, 0.16, 0.050),
                inner_ear,
                (0.705, 1.285, sign * 0.218),
                rotation=rotation_matrix(sign * 0.18, [1, 0, 0]),
                count=(40, 24),
            ),
            node_name=f"EarInner{suffix}",
            geom_name=f"EarInner{suffix}",
        )
    scene.add_geometry(
        cylinder_between((0.965, 0.915, 0.0), (0.975, 0.865, 0.0), 0.006, mouth),
        node_name="Mouth",
        geom_name="Mouth",
    )
    add_whiskers(scene, (0.965, 0.93, 0.0), whisker)
    return scene


def build_pipi() -> trimesh.Scene:
    scene = trimesh.Scene()
    fur = fur_material("PipiGoldenFur", "#b5855b", 58.0, 1.0, 9)
    ear_fur = fur_material("PipiEarFur", "#806047", 49.0, 1.1, 12)
    cream = fur_material("PipiCreamFur", "#e1d2bb", 63.0, 0.75, 15)
    brow_fur = fur_material("PipiBrowFur", "#c8b697", 58.0, 0.5, 17)
    nose = material("PipiBlackNose", "#211c1b", 0.28)
    eye = material("PipiBrownEye", "#3d281b", 0.12)
    pupil = material("PipiPupil", "#0d0b0a", 0.06)
    tongue = material("PipiTongue", "#d87f87", 0.46)
    mouth = material("PipiMouth", "#4a2b2b", 0.65)
    whisker = material("PipiWhisker", "#eee5d8", 0.6)

    shapes: list[Sdf] = [
        ellipsoid_sdf((0.0, 0.57, 0.0), (0.55, 0.29, 0.27)),
        ellipsoid_sdf((0.30, 0.60, 0.0), (0.31, 0.30, 0.27)),
        ellipsoid_sdf((0.40, 0.73, 0.0), (0.24, 0.24, 0.25)),
        ellipsoid_sdf((0.59, 0.87, 0.0), (0.29, 0.255, 0.30)),
        ellipsoid_sdf((0.57, 0.97, 0.0), (0.24, 0.16, 0.27)),
        ellipsoid_sdf((0.70, 0.82, 0.17), (0.18, 0.16, 0.16)),
        ellipsoid_sdf((0.70, 0.82, -0.17), (0.18, 0.16, 0.16)),
        ellipsoid_sdf((-0.36, 0.56, 0.0), (0.28, 0.27, 0.25)),
    ]
    for x, z in ((0.34, 0.17), (0.34, -0.17), (-0.35, 0.17), (-0.35, -0.17)):
        shapes.append(capsule_sdf((x, 0.52, z), (x, 0.13, z), 0.09, 0.075))
        shapes.append(ellipsoid_sdf((x + 0.055, 0.095, z), (0.14, 0.08, 0.11)))
    for start, end, radii in (
        ((-0.52, 0.61, 0.0), (-0.69, 0.72, 0.0), (0.085, 0.075)),
        ((-0.69, 0.72, 0.0), (-0.66, 0.94, 0.0), (0.075, 0.06)),
    ):
        shapes.append(capsule_sdf(start, end, *radii))

    scene.add_geometry(
        organic_mesh(
            ((-0.83, 0.98), (-0.01, 1.18), (-0.40, 0.40)),
            shapes,
            fur,
            spacing=0.0085,
            blend=0.05,
            relief=0.0018,
            seed=10.0,
        ),
        node_name="Body",
        geom_name="Body",
    )
    scene.add_geometry(
        ellipsoid_mesh((0.20, 0.13, 0.16), cream, (0.90, 0.80, 0.0)),
        node_name="Muzzle",
        geom_name="Muzzle",
    )
    scene.add_geometry(
        ellipsoid_mesh((0.11, 0.14, 0.13), cream, (0.86, 0.67, 0.0)),
        node_name="Beard",
        geom_name="Beard",
    )
    for suffix, sign in (("L", 1), ("R", -1)):
        scene.add_geometry(
            ellipsoid_mesh(
                (0.085, 0.072, 0.058),
                cream,
                (0.92, 0.765, sign * 0.16),
                rotation=rotation_matrix(sign * 0.34, [1, 0, 0]),
                count=(48, 30),
            ),
            node_name=f"CheekTuft{suffix}",
            geom_name=f"CheekTuft{suffix}",
        )
    scene.add_geometry(
        ellipsoid_mesh((0.032, 0.16, 0.135), cream, (0.66, 0.62, 0.0), count=(52, 32)),
        node_name="ChestPatch",
        geom_name="ChestPatch",
    )
    for suffix, sign in (("L", 1), ("R", -1)):
        scene.add_geometry(
            ellipsoid_mesh(
                (0.036, 0.017, 0.052),
                brow_fur,
                (0.845, 1.002, sign * 0.112),
                rotation=rotation_matrix(-sign * 0.08, [1, 0, 0]),
                count=(44, 26),
            ),
            node_name=f"Brow{suffix}",
            geom_name=f"Brow{suffix}",
        )
        scene.add_geometry(
            dog_ear_mesh(sign, ear_fur),
            node_name=f"Ear{suffix}",
            geom_name=f"Ear{suffix}",
        )
    scene.add_geometry(
        ellipsoid_mesh((0.044, 0.046, 0.066), nose, (1.055, 0.86, 0.0)),
        node_name="Nose",
        geom_name="Nose",
    )
    scene.add_geometry(
        ellipsoid_mesh((0.045, 0.085, 0.075), mouth, (0.98, 0.72, 0.0)),
        node_name="Mouth",
        geom_name="Mouth",
    )
    scene.add_geometry(
        ellipsoid_mesh((0.040, 0.092, 0.050), tongue, (1.00, 0.69, 0.028)),
        node_name="Tongue",
        geom_name="Tongue",
    )
    add_eye_pair(
        scene,
        center_x=0.875,
        center_y=0.94,
        side=0.14,
        eye_material=eye,
        pupil_material=pupil,
        pupil_scale=(0.012, 0.024, 0.022),
        eye_scale=(0.021, 0.048, 0.060),
    )
    add_whiskers(scene, (0.99, 0.79, 0.0), whisker)
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
        print(f"SCULPTED {slug}: {len(scene.geometry)} parts -> {path}")


if __name__ == "__main__":
    main()
