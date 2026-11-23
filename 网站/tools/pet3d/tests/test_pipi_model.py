import unittest

from tools.pet3d.validate_model import validate_model


class PipiModelTests(unittest.TestCase):
    def test_pipi_is_a_textured_quadruped_mesh(self):
        model = validate_model("public/pets/models/pipi.glb", "dog")
        self.assertGreaterEqual(model.triangle_count, 1_200)
        self.assertLessEqual(model.triangle_count, 5_000)
        self.assertTrue(model.has_texture)
        self.assertGreaterEqual(model.bounds[0], 0.4)


if __name__ == "__main__":
    unittest.main()
