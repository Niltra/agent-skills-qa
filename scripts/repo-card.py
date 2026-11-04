"""Tarjeta social del repo, con el mismo ADN visual que skill-launch."""
import sys
from pathlib import Path

HERE = Path(__file__).parent.parent
sys.path.insert(0, str(HERE / "tools" / "skill-launch"))

from launch import social_card  # noqa: E402

meta = {
    "name": "agent-skills-qa",
    "description": (
        "Cinco skills para agentes que auditan una web con evidencia: "
        "dónde se rompe al traducir, contraste real sobre fotos, formularios "
        "que mienten y lo que el agente dice que ha hecho."
    ),
}

sections = [
    "Rompelayout",
    "Contraste real",
    "Formulario",
    "Dice vs hace",
    "Declaración EAA",
]

out = HERE / "docs" / "social.png"
out.parent.mkdir(parents=True, exist_ok=True)
social_card(meta, sections, out)
print(out)
