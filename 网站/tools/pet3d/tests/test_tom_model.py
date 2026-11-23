import unittest
from pathlib import Path

from tools.pet3d.validate_model import validate_model


class TomModelTests(unittest.TestCase):
    def test_tom_is_a_textured_quadruped_mesh(self):
        model = validate_model("public/pets/models/tom.glb", "cat")
        self.assertGreaterEqual(model.triangle_count, 1_200)
        self.assertLessEqual(model.triangle_count, 5_000)
        self.assertTrue(model.has_texture)
        self.assertGreaterEqual(model.bounds[0], 0.4)


if __name__ == "__main__":
    unittest.main()
