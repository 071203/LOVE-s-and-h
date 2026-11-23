from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

import trimesh

Species = Literal["cat", "dog"]


class ModelValidationError(ValueError):
    """Raised when a reconstructed GLB cannot represent a plausible pet."""


@dataclass(frozen=True)
class ModelReport:
    path: str
    species: Species
    triangle_count: int
    has_texture: bool
    largest_component_ratio: float
    bounds: list[float]


def _scene_geometries(scene: trimesh.Scene) -> list[trimesh.Trimesh]:
    return [
        geometry
        for geometry in scene.geometry.values()
        if isinstance(geometry, trimesh.Trimesh)
    ]


def validate_model(model_path: str | Path, species: Species) -> ModelReport:
    path = Path(model_path)
    if not path.is_file():
        raise ModelValidationError("model file not found")

    try:
        loaded = trimesh.load(path, force="scene", process=False)
    except Exception as exc:
        raise ModelValidationError(f"model file is not readable: {exc}") from exc

    if isinstance(loaded, trimesh.Trimesh):
        scene = trimesh.Scene(loaded)
    elif isinstance(loaded, trimesh.Scene):
        scene = loaded
    else:
        raise ModelValidationError("model did not load as a mesh scene")

    geometries = _scene_geometries(scene)
    if not geometries:
        raise ModelValidationError("model contains no triangle meshes")

    extents = scene.bounds[1] - scene.bounds[0]
    longest = float(max(extents))
    shortest = float(max(min(extents), 1e-9))
    if longest < 0.1 or longest / shortest > 4.2:
        raise ModelValidationError("implausible quadruped bounds")

    triangle_count = sum(len(geometry.faces) for geometry in geometries)
    if triangle_count < 100:
        raise ModelValidationError("model geometry is too sparse")

    has_texture = any(
        getattr(geometry.visual, "kind", None) == "texture"
        for geometry in geometries
    )

    legacy_articulated = {"Body", "HeadCore", "EyeL", "EyeR", "Nose", "Tail01"}.issubset(
        scene.geometry.keys()
    )
    layered_eye_parts = {
        "Body",
        "EyeScleraL",
        "EyeScleraR",
        "EyeIrisL",
        "EyeIrisR",
        "EyePupilL",
        "EyePupilR",
        "EyeCorneaL",
        "EyeCorneaR",
        "EyeLidL",
        "EyeLidR",
    }.issubset(scene.geometry.keys())
    articulated = legacy_articulated or layered_eye_parts
    combined = trimesh.util.concatenate(geometries)
    # Texture baking duplicates vertices along UV seams. Rebuild topology from
    # positions before measuring fragments so seams are not mistaken for
    # disconnected props or background artifacts.
    topology = trimesh.Trimesh(
        vertices=combined.vertices,
        faces=combined.faces,
        process=True,
        validate=False,
    )
    components = topology.split(only_watertight=False)
    total_area = max(float(topology.area), 1e-9)
    largest_component_ratio = (
        max((float(component.area) for component in components), default=0.0)
        / total_area
    )
    if largest_component_ratio < 0.55 and not articulated:
        raise ModelValidationError("model is fragmented by background artifacts")

    return ModelReport(
        path=str(path),
        species=species,
        triangle_count=triangle_count,
        has_texture=has_texture,
        largest_component_ratio=largest_component_ratio,
        bounds=[round(float(value), 6) for value in extents],
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--species", required=True, choices=["cat", "dog"])
    args = parser.parse_args()

    try:
        report = validate_model(args.model, args.species)
    except ModelValidationError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    print(json.dumps(asdict(report), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
