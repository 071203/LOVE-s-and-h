import tempfile
import unittest
from pathlib import Path

import numpy as np
import trimesh

from tools.pet3d.validate_model import ModelValidationError, validate_model


class ValidateModelTests(unittest.TestCase):
    def test_missing_glb_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "missing.glb"
            with self.assertRaisesRegex(ModelValidationError, "model file not found"):
                validate_model(missing, "cat")

    def test_cat_bounds_must_fit_quadruped_profile(self):
        with tempfile.TemporaryDirectory() as tmp:
            model_path = Path(tmp) / "tiny-cat.glb"
            mesh = trimesh.creation.box(extents=[0.01, 0.01, 0.01])
            mesh.export(model_path)

            with self.assertRaisesRegex(
                ModelValidationError, "implausible quadruped bounds"
            ):
                validate_model(model_path, "cat")

    def test_texture_seams_are_not_treated_as_background_fragments(self):
        with tempfile.TemporaryDirectory() as tmp:
            model_path = Path(tmp) / "seamed-cat.glb"
            box = trimesh.creation.icosphere(subdivisions=2, radius=0.5)
            box.apply_scale([0.8, 1.1, 0.7])
            exploded = trimesh.Trimesh(
                vertices=box.vertices[box.faces].reshape((-1, 3)),
                faces=np.arange(len(box.faces) * 3).reshape((-1, 3)),
                process=False,
            )
            exploded.export(model_path)

            model = validate_model(model_path, "cat")
            self.assertGreaterEqual(model.largest_component_ratio, 0.99)


if __name__ == "__main__":
    unittest.main()
