"""Self-check for launch.py. Runs the real CLI, no mocks."""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
CLI = HERE / "launch.py"

SKILL = """---
name: demo-skill
description: Hace una cosa concreta y la verifica con evidencia antes de decir que está lista.
---

# Demo

## Cuándo se activa

- Al revisar una web antes de publicarla
- Cuando hay que medir algo en vez de suponerlo

## Chequeos

1. Consola limpia
2. Sin overflow a 375px
"""


def run(*args):
    return subprocess.run(
        [sys.executable, str(CLI), *map(str, args)],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        skill = root / "demo-skill"
        skill.mkdir()
        (skill / "SKILL.md").write_text(SKILL, encoding="utf-8")
        out = root / "dist"

        r = run(skill, "--out", out)
        assert r.returncode == 0, r.stderr
        assert "2 secciones" in r.stdout, r.stdout
        assert "2 líneas de demo" in r.stdout, r.stdout

        social = out / "assets" / "social.png"
        gif = out / "assets" / "demo.gif"
        assert social.exists() and gif.exists()

        with Image.open(social) as im:
            assert im.size == (1280, 640), im.size

        with Image.open(gif) as im:
            frames = getattr(im, "n_frames", 1)
        assert frames >= 10, frames
        assert gif.stat().st_size < 1_500_000, gif.stat().st_size

        readme = (out / "README.md").read_text(encoding="utf-8")
        assert "# demo-skill" in readme
        assert "assets/demo.gif" in readme
        assert "Al revisar una web" not in readme  # bullets are for the gif, not claims
        assert "## Qué hace" in readme
        assert "## Instalar" in readme

        launch = (out / "launch.md").read_text(encoding="utf-8")
        for platform in ("## X", "## LinkedIn", "## Reddit", "## Hacker News", "## dev.to", "## Checklist"):
            assert platform in launch, platform

        # a skill without description must fail loudly, not produce a blank page
        (skill / "SKILL.md").write_text("---\nname: x\n---\n\n# x\n", encoding="utf-8")
        assert run(skill, "--out", root / "bad").returncode == 2

    print("ok: 4 assets, sizes, content and failure path")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
