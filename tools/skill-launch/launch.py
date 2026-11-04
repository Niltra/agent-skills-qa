#!/usr/bin/env python3
"""skill-launch: turn a skill folder into a public-facing repo page.

Reads SKILL.md, writes social.png, demo.gif, README.md and launch.md.
Offline. No API keys. No models.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")

# Design DNA, declared before drawing. Not defaults.
INK = "#141110"
PAPER = "#F2EEE4"
SIGNAL = "#C9411B"
MEASURE = "#2A5F5A"
LINE = "#DBD3C2"
NIGHT = "#171513"
NIGHT_TEXT = "#E8E2D6"
NIGHT_DIM = "#8C867A"

FONTS = Path("C:/Windows/Fonts")
FALLBACK = Path("/usr/share/fonts")


def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    names = {
        "display": ["georgiab.ttf", "DejaVuSerif-Bold.ttf"],
        "mono": ["consolab.ttf", "DejaVuSansMono-Bold.ttf"],
        "mono_regular": ["consola.ttf", "DejaVuSansMono.ttf"],
        "text": ["seguisb.ttf", "DejaVuSans-Bold.ttf"],
    }[kind]
    for base in (FONTS, FALLBACK):
        for n in names:
            p = base / n
            if p.exists():
                return ImageFont.truetype(str(p), size)
    return ImageFont.load_default(size=size)


# ---------- reading the skill ----------

FRONT = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)


def parse_skill(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    meta: dict[str, str] = {}
    m = FRONT.match(text)
    if m:
        for line in m.group(1).splitlines():
            if ":" not in line or line[:1].isspace():
                continue
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip().strip("\"'")
    return meta, text[m.end():] if m else text


def sections(body: str) -> list[str]:
    out = []
    for line in body.splitlines():
        if line.startswith("## "):
            out.append(re.sub(r"[*`]", "", line[3:]).strip())
    return out


def bullets_under(body: str, titles: tuple[str, ...]) -> list[str]:
    for t in titles:
        m = re.search(rf"^##\s+{re.escape(t)}\s*$(.*?)(?=^##\s|\Z)", body, re.M | re.S)
        if not m:
            continue
        out = [
            re.sub(r"^[-*]\s+", "", ln).strip()
            for ln in m.group(1).splitlines()
            if re.match(r"^\s*[-*]\s+\S", ln)
        ]
        if out:
            return out
    return []


def shorten(s: str, limit: int) -> str:
    s = re.sub(r"\s+", " ", s).strip(" .")
    return s if len(s) <= limit else s[: limit - 1].rstrip(" ,;:") + "…"


# ---------- drawing helpers ----------


def wrap_px(draw, text: str, f, max_px: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=f) <= max_px or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit(draw, text: str, kind: str, size: int, max_px: int, floor: int = 40):
    while size > floor and draw.textlength(text, font=font(kind, size)) > max_px:
        size -= 4
    return font(kind, size)


# ---------- social card ----------


def social_card(meta: dict[str, str], body_sections: list[str], out: Path) -> None:
    W, H = 1280, 640
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    for x in range(0, W, 40):
        d.line([(x, 0), (x, H)], fill=LINE)
    for y in range(0, H, 40):
        d.line([(0, y), (W, y)], fill=LINE)

    d.rectangle([0, 0, 10, H], fill=SIGNAL)

    left, right = 72, 812
    d.line([(right - 44, 96), (right - 44, H - 96)], fill=INK, width=2)

    label = font("mono", 21)
    d.text((left, 62), "AGENT SKILL", font=label, fill=MEASURE)
    d.text((left + 178, 62), "/", font=label, fill=INK)
    d.text((left + 194, 62), meta["name"].upper(), font=label, fill=INK)

    name_f = fit(d, meta["name"], "display", 104, right - left - 80)
    y = 128
    for line in wrap_px(d, meta["name"], name_f, right - left - 80):
        d.text((left, y), line, font=name_f, fill=INK)
        y += int(name_f.size * 1.02)

    y += 26
    body_f = font("mono_regular", 23)
    desc = wrap_px(d, meta["description"], body_f, right - left - 90)
    if len(desc) > 5:
        desc = desc[:5]
        desc[-1] = desc[-1].rstrip(" ,;:") + "…"
    for line in desc:
        d.text((left, y), line, font=body_f, fill="#3B3530")
        y += 34

    foot = font("mono", 19)
    d.text((left, H - 84), "claude code  ·  codex  ·  opencode  ·  antigravity", font=foot, fill=INK)

    if body_sections:
        d.text((right, 96), f"{len(body_sections):02d} SECCIONES", font=font("mono", 18), fill=MEASURE)
        sy = 146
        for i, s in enumerate(body_sections[:8], 1):
            d.text((right, sy), f"{i:02d}", font=font("mono", 17), fill=SIGNAL)
            d.text((right + 44, sy), shorten(s, 24), font=font("text", 18), fill=INK)
            sy += 42

    img.save(out, "PNG", optimize=True)


# ---------- terminal gif ----------


def terminal_gif(meta: dict[str, str], lines: list[str], out: Path) -> int:
    W, H = 960, 560
    base = Image.new("RGB", (W, H), NIGHT)
    d = ImageDraw.Draw(base)
    d.rounded_rectangle([18, 18, W - 18, H - 18], radius=10, fill="#0F0E0C", outline="#2A2723", width=2)
    d.rectangle([18, 18, W - 18, 74], fill="#1E1B18")
    for i, c in enumerate(("#E05B3C", "#C9A227", "#4E7F63")):
        d.ellipse([44 + i * 30, 40, 58 + i * 30, 54], fill=c)
    d.text((160, 40), f"~/{meta['name']}", font=font("mono", 20), fill=NIGHT_DIM)

    mono = font("mono", 24)
    prompt = f"$ npx skills add {meta['name']}"
    pad_x, start_y, step = 52, 118, 40

    def render(typed: str, shown: int) -> Image.Image:
        img = base.copy()
        dd = ImageDraw.Draw(img)
        dd.text((pad_x, start_y), typed, font=mono, fill=NIGHT_TEXT)
        if typed:
            w = dd.textlength(typed, font=mono)
            dd.rectangle([pad_x + w + 4, start_y + 2, pad_x + w + 18, start_y + 28], fill=SIGNAL)
        y = start_y + step + 24
        for ln in lines[:shown]:
            dd.text((pad_x, y), shorten(ln, 62), font=font("mono_regular", 23), fill=NIGHT_DIM)
            y += step
        return img

    frames, durations = [], []
    for i in range(0, len(prompt) + 1, 3):
        frames.append(render(prompt[:i], 0))
        durations.append(70)
    frames.append(render(prompt, 0))
    durations.append(700)
    for i in range(1, len(lines) + 1):
        frames.append(render(prompt, i))
        durations.append(620)
    frames.append(render(prompt, len(lines)))
    durations.append(2400)

    frames[0].save(
        out,
        "GIF",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )
    return len(frames)


# ---------- text outputs ----------


def write_readme(meta, body_sections, out: Path, lang: str) -> None:
    name, desc = meta["name"], meta["description"]
    if lang == "es":
        parts = [
            f"# {name}\n",
            f"{desc}\n",
            "![demo](assets/demo.gif)\n",
            "## Qué hace\n",
            *[f"- {s}" for s in body_sections],
            "\n## Instalar\n",
            f"Copia esta carpeta en `~/.config/opencode/skill/{name}/` o en `~/.claude/skills/{name}/`.\n",
            "<!-- Si lo publicas en npm / npx skills add, cambia esta sección por el comando real. -->\n",
            "\n## Uso\n",
            "Abre tu agente y pídelo en lenguaje normal. La skill se activa por su descripción:\n",
            f"> {shorten(desc, 200)}\n",
            "\n## Licencia\n",
            "MIT.\n",
        ]
    else:
        parts = [
            f"# {name}\n",
            f"{desc}\n",
            "![demo](assets/demo.gif)\n",
            "## What it does\n",
            *[f"- {s}" for s in body_sections],
            "\n## Install\n",
            f"Copy this folder to `~/.config/opencode/skill/{name}/` or `~/.claude/skills/{name}/`.\n",
            "<!-- If you publish to npm / npx skills add, replace this section with the real command. -->\n",
            "\n## Usage\n",
            "Ask your agent in plain language. The skill activates from its description:\n",
            f"> {shorten(desc, 200)}\n",
            "\n## License\n",
            "MIT.\n",
        ]
    out.write_text("\n".join(parts), encoding="utf-8")


def write_launch(meta, body_sections, out: Path, lang: str) -> None:
    n = meta["name"]
    first = body_sections[0] if body_sections else "lo que hace"
    hook = shorten(meta["description"], 120)
    if lang == "es":
        text = f"""# Lanzamiento: {n}

## X
Une una skill que hace una cosa y la hace con evidencia: {hook}

Gratis, sin clave de API, funciona en Claude Code, Codex y opencode.
Repo: <url>

## LinkedIn
He publicado {n}: {shorten(meta["description"], 180)}

Lo que no hace: prometer. Lo que hace: {first.lower()}.
Si te dedicas a esto, dime dónde se rompe.

## Reddit (r/ClaudeAI, r/LocalLLaMA)
[{n}] {hook}

Instalación: copiar la carpeta. Sin dependencias, sin claves.
Busco casos donde falle, no cumplidos.

## Hacker News
Show HN: {n} – {shorten(meta["description"], 70)}

## dev.to
Título: Por qué escribí {n} y qué se rompe cuando lo usas mal

## Checklist
- [ ] Captura de social.png subida al repo
- [ ] demo.gif pesa menos de 1 MB
- [ ] README con un comando que funciona en limpio
- [ ] Repo público con topics: ai-agents, skills, {n}
- [ ] Release v0.1.0
- [ ] Post el martes o miércoles, 9-11h CET
- [ ] Responder los primeros 5 comentarios el mismo día
- [ ] Abrir 3 issues con "good first issue" y etiqueta help wanted
"""
    else:
        text = f"""# Launch: {n}

## X
I shipped a skill that does one thing and proves it: {hook}

Free, no API key, works in Claude Code, Codex and opencode.
Repo: <url>

## LinkedIn
I published {n}: {shorten(meta["description"], 180)}

What it does not do: promise. What it does: {first.lower()}.
If you work on this, tell me where it breaks.

## Reddit (r/ClaudeAI, r/LocalLLaMA)
[{n}] {hook}

Install: copy the folder. No dependencies, no keys.
I want the cases where it fails, not compliments.

## Hacker News
Show HN: {n} – {shorten(meta["description"], 70)}

## dev.to
Title: Why I wrote {n} and what breaks when you use it wrong

## Checklist
- [ ] social.png uploaded to the repo
- [ ] demo.gif under 1 MB
- [ ] README with a command that works on a clean machine
- [ ] Public repo with topics: ai-agents, skills, {n}
- [ ] Release v0.1.0
- [ ] Post on Tuesday or Wednesday, 9-11 CET
- [ ] Answer the first 5 comments the same day
- [ ] Open 3 "good first issue" tickets
"""
    out.write_text(text, encoding="utf-8")


# ---------- main ----------


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate launch assets for an agent skill.")
    ap.add_argument("skill_dir", type=Path)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--lang", choices=["es", "en"], default="es")
    args = ap.parse_args()

    src = args.skill_dir / "SKILL.md"
    if not src.exists():
        print(f"error: no SKILL.md in {args.skill_dir}", file=sys.stderr)
        return 2

    meta, body = parse_skill(src)
    meta.setdefault("name", args.skill_dir.name)
    if not meta.get("description"):
        print("error: SKILL.md needs a description in the frontmatter", file=sys.stderr)
        return 2

    secs = sections(body)
    demo = bullets_under(body, ("Cuándo se activa", "When to use", "When to Use", "Cuándo usar", "Uso"))
    if not demo:
        demo = secs[:4] or [meta["description"]]

    out = args.out or Path("launch-out") / meta["name"]
    assets = out / "assets"
    assets.mkdir(parents=True, exist_ok=True)

    name = meta["name"]
    social_card(meta, secs, assets / "social.png")
    frames = terminal_gif(meta, demo, assets / "demo.gif")
    write_readme(meta, secs, out / "README.md", args.lang)
    write_launch(meta, secs, out / "launch.md", args.lang)

    gif_kb = (assets / "demo.gif").stat().st_size // 1024
    print(f"{name}: {len(secs)} secciones, {len(demo)} líneas de demo")
    print(f"  {assets / 'social.png'}  1280x640")
    print(f"  {assets / 'demo.gif'}  {frames} frames, {gif_kb} KB")
    print(f"  {out / 'README.md'}")
    print(f"  {out / 'launch.md'}")
    if gif_kb > 1024:
        print("  aviso: el GIF pasa de 1 MB, baja la resolución antes de publicarlo", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
