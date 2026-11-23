import unittest
from pathlib import Path

import numpy as np
import trimesh

from tools.pet3d.validate_model import validate_model


ROOT = Path(__file__).resolve().parents[3]
MODEL_DIR = ROOT / "public/pets/models"


def primary_mesh(path: Path) -> trimesh.Trimesh:
    scene = trimesh.load(path, force="scene", process=False)
    return max(scene.geometry.values(), key=lambda mesh: len(mesh.faces))


class Mesh2MotionModelTests(unittest.TestCase):
    def test_tom_uses_a_lightweight_blue_grey_textured_mesh(self):
        path = MODEL_DIR / "tom.glb"
        model = validate_model(str(path), "cat")
        self.assertGreaterEqual(model.triangle_count, 1_200)
        self.assertLessEqual(model.triangle_count, 5_000)
        self.assertTrue(model.has_texture)

        texture = primary_mesh(path).visual.material.baseColorTexture.convert("RGB")
        mean = np.asarray(texture, dtype=np.float32).mean(axis=(0, 1))
        self.assertGreater(
            float(mean[2]),
            float(mean[0]) + 4,
            "TOM should read as a cool blue-grey cat",
        )

    def test_pipi_uses_a_lightweight_yellow_textured_mesh(self):
        path = MODEL_DIR / "pipi.glb"
        model = validate_model(str(path), "dog")
        self.assertGreaterEqual(model.triangle_count, 1_200)
        self.assertLessEqual(model.triangle_count, 5_000)
        self.assertTrue(model.has_texture)

        texture = primary_mesh(path).visual.material.baseColorTexture.convert("RGB")
        mean = np.asarray(texture, dtype=np.float32).mean(axis=(0, 1))
        self.assertGreater(
            float(mean[0]),
            float(mean[2]) + 12,
            "PIPI should read as a yellow-gold dog",
        )
        self.assertGreater(float(mean[1]), float(mean[2]))


if __name__ == "__main__":
    unittest.main()
