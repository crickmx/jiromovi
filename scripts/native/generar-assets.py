#!/usr/bin/env python3
"""
Genera íconos y pantallas de arranque de las dos apps nativas, más los
gráficos de las tiendas, a partir de los logos de store/marca/.

  python3 scripts/native/generar-assets.py

Requiere Pillow y numpy (pip install pillow numpy). `rasterizar_svg` (Playwright) queda para
cuando haya un logo en SVG de mayor resolución.
Las salidas ya están versionadas: solo hay que correrlo si cambia un logo.
"""
import json, pathlib, subprocess, sys, tempfile
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[2]
MARCA = ROOT / 'store' / 'marca'

def rasterizar_svg(svg: pathlib.Path, ancho: int) -> Image.Image:
    """SVG → PNG transparente con Chromium (Playwright)."""
    out = pathlib.Path(tempfile.mkdtemp()) / 'logo.png'
    js = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const b = await chromium.launch(); const p = await b.newPage({{ viewport: {{ width: {ancho}, height: {ancho} }} }});
  const svg = require('fs').readFileSync({json.dumps(str(svg))}, 'utf8');
  await p.setContent(`<html><body style="margin:0;background:transparent">${{svg.replace('<svg', '<svg style="width:{ancho}px;height:auto;display:block"')}}</body></html>`);
  const el = await p.$('svg'); await el.screenshot({{ path: {json.dumps(str(out))}, omitBackground: true }});
  await b.close();
}})();"""
    subprocess.run(['node', '-e', js], check=True, cwd=ROOT)
    return Image.open(out).convert('RGBA')

def recortar(img: Image.Image) -> Image.Image:
    return img.crop(img.getbbox())

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from escalar_logo import escalar_plano  # noqa: E402

# Los logos del repo son chicos (512 y 177 px); se reconstruyen por color a 1400 px
# para que el ícono de 1024 salga nítido (ver escalar_logo.py). Requiere numpy.
LOGOS = {
    'movi': recortar(escalar_plano(Image.open(MARCA / 'movi-icono-512.png'),
                                   ['#3238f5', '#0f24e3', '#365aff', '#0889e6'], 1400)),
    'seguwallet': recortar(escalar_plano(Image.open(MARCA / 'seguwallet-icono.png'),
                                         ['#0e23e2', '#365aff', '#172ca5'], 1400)),
}
FONDO = {'movi': (255, 255, 255, 255), 'seguwallet': (255, 255, 255, 255)}

def lienzo(app, w, h, escala, fondo=None, opaco=True):
    """Logo centrado ocupando `escala` del lado menor."""
    bg = fondo or FONDO[app]
    c = Image.new('RGBA', (w, h), bg if opaco else (0, 0, 0, 0))
    logo = LOGOS[app]
    lado = int(min(w, h) * escala)
    r = min(lado / logo.width, lado / logo.height)
    l = logo.resize((max(1, int(logo.width * r)), max(1, int(logo.height * r))), Image.LANCZOS)
    c.alpha_composite(l, ((w - l.width) // 2, (h - l.height) // 2))
    return c

def guardar(img, path, opaco=True):
    path.parent.mkdir(parents=True, exist_ok=True)
    (img.convert('RGB') if opaco else img).save(path, optimize=True)

def redondo(img):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).ellipse((0, 0, img.width - 1, img.height - 1), fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0)); out.paste(img, (0, 0), m); return out

DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

for app in ('movi', 'seguwallet'):
    nat = ROOT / 'native' / app
    store = ROOT / 'store' / app / 'graficos'

    # ── iOS ── ícono único 1024 (sin transparencia ni esquinas: Apple las pone)
    icon1024 = lienzo(app, 1024, 1024, 0.66)
    guardar(icon1024, nat / 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
    guardar(icon1024, store / 'ios-icono-1024.png')
    splash = lienzo(app, 2732, 2732, 0.18)
    for n in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
        guardar(splash, nat / 'ios/App/App/Assets.xcassets/Splash.imageset' / n)

    # ── Android ── legado (48dp), redondo y adaptativo (108dp, zona segura 66dp)
    res = nat / 'android/app/src/main/res'
    for d, f in DENS.items():
        s = int(48 * f)
        guardar(lienzo(app, s, s, 0.62), res / f'mipmap-{d}/ic_launcher.png')
        guardar(redondo(lienzo(app, s, s, 0.58)), res / f'mipmap-{d}/ic_launcher_round.png', opaco=False)
        fg = int(108 * f)
        guardar(lienzo(app, fg, fg, 0.42, opaco=False), res / f'mipmap-{d}/ic_launcher_foreground.png', opaco=False)
    for p in res.glob('drawable*/splash.png'):
        w, h = Image.open(p).size
        guardar(lienzo(app, w, h, 0.28), p)
    (res / 'values/ic_launcher_background.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n')

    # ── Google Play ── ícono 512 (32 bits con alfa permitido, se entrega opaco)
    guardar(lienzo(app, 512, 512, 0.66), store / 'play-icono-512.png')

print('Assets generados en native/*/ y store/*/graficos/')
