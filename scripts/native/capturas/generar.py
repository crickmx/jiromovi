#!/usr/bin/env python3
"""
Capturas SIMULADAS para App Store y Google Play (datos ficticios).

  python3 scripts/native/capturas/generar.py

Requiere Playwright con Chromium (node) y haber corrido `npm install`
(usa las fuentes Sora/Manrope de node_modules). Escribe en store/<app>/capturas/.
"""
import json, pathlib, shutil, subprocess, sys

AQUI = pathlib.Path(__file__).resolve().parent
ROOT = AQUI.parents[2]
sys.path.insert(0, str(AQUI))
from pantallas import SEGUWALLET, MOVI  # noqa: E402

TMP = AQUI / '_tmp'
shutil.rmtree(TMP, ignore_errors=True); TMP.mkdir()

TAMANOS = {
    'ios-6.9': (1320, 2868),      # iPhone 6.9" (obligatorio en App Store Connect)
    'android': (1080, 1920),      # Google Play, teléfono
}
TEMAS = {
    'seguwallet': dict(bg='linear-gradient(170deg,#050e24 0%,#0a2260 45%,#1c37e0 100%)', accent='#1c37e0'),
    'movi': dict(bg='linear-gradient(170deg,#0b1f6b 0%,#1d4ed8 55%,#38bdf8 100%)', accent='#2563eb'),
}
LOGO_SW = (ROOT / 'public' / 'seguwallet-logo.png').as_uri()

trabajos = []
for app, pantallas in (('seguwallet', SEGUWALLET), ('movi', MOVI)):
    t = TEMAS[app]
    for nombre, titular, sub, html in pantallas:
        for tam, (w, h) in TAMANOS.items():
            zoom = (w * 0.76) / 390
            pagina = f'''<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../base.css">
<style>:root{{--W:{w}px;--H:{h}px;--Z:{zoom:.4f};--bg:{t['bg']};--accent:{t['accent']}}}
.phone{{height:calc(var(--H)*.735)}}</style></head><body>
<div class="cap"><h1>{titular}</h1><p>{sub}</p></div>
<div class="phone"><div class="screen"><div class="island"></div>{html.replace('LOGO_SW', LOGO_SW)}</div></div>
</body></html>'''
            f = TMP / f'{app}-{nombre}-{tam}.html'
            f.write_text(pagina)
            out = ROOT / 'store' / app / 'capturas' / tam / f'{nombre}.png'
            out.parent.mkdir(parents=True, exist_ok=True)
            trabajos.append(dict(html=f.as_uri(), out=str(out), w=w, h=h))

# Gráfico destacado de Google Play (1024×500)
for app, titular in (('seguwallet', 'Tu cartera de seguros, en tu bolsillo'), ('movi', 'Tu oficina de seguros, en tu bolsillo')):
    t = TEMAS[app]
    icono = (ROOT / 'store' / app / 'graficos' / 'play-icono-512.png').as_uri()
    nombre = 'Seguwallet' if app == 'seguwallet' else 'MOVI Digital'
    f = TMP / f'{app}-feature.html'
    f.write_text(f'''<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../base.css">
<style>:root{{--W:1024px;--H:500px;--bg:{t['bg']}}} .w{{position:absolute;inset:0;display:flex;align-items:center;gap:48px;padding:0 72px;color:#fff}}
.w img{{width:200px;height:200px;border-radius:46px;box-shadow:0 20px 60px #0006}}</style></head><body>
<div class="w"><img src="{icono}"><div><div class="h" style="font:800 30px Sora;opacity:.8">{nombre}</div>
<div style="font:800 52px/1.1 Sora;letter-spacing:-.02em;margin-top:8px">{titular}</div></div></div></body></html>''')
    trabajos.append(dict(html=f.as_uri(), out=str(ROOT / 'store' / app / 'graficos' / 'play-grafico-destacado-1024x500.png'), w=1024, h=500))

js = '''
const { chromium } = require('playwright');
const jobs = JSON.parse(process.argv[1]);
(async () => {
  const b = await chromium.launch();
  for (const j of jobs) {
    const p = await b.newPage({ viewport: { width: j.w, height: j.h } });
    await p.goto(j.html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
    await p.screenshot({ path: j.out, type: 'png' }); await p.close();
  }
  await b.close();
})();'''
subprocess.run(['node', '-e', js, json.dumps(trabajos)], check=True, cwd=ROOT)
shutil.rmtree(TMP, ignore_errors=True)

# App Store rechaza PNG con canal alfa en capturas: se aplanan a RGB.
from PIL import Image
for j in trabajos:
    Image.open(j['out']).convert('RGB').save(j['out'], optimize=True)
print(f'{len(trabajos)} imágenes en store/*/capturas y store/*/graficos')
