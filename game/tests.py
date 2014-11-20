from game.models import Game

class GameYAMLParsingTests(TestCase):
    def test_yaml_sets_(self):
        """
        Tests game parsing.
        """
        self.assertEqual(1 + 1, 2)
