"""
Agranda un logo de colores planos sin que se vea borroso.

Los logos que hay en el repo miden 512 px (MOVI) y 177 px (Seguwallet). Para el
ícono de 1024 px de App Store, agrandarlos tal cual da bordes suaves y halos. Como
son colores planos, se reconstruyen por color: cada color se vuelve una máscara,
se agranda la máscara (que es una forma, no una foto), se vuelve a cortar en
duro y al final se reduce 2× para tener un antialias limpio.

No inventa detalle: reproduce las mismas formas con bordes nítidos.
Si algún día hay el logo en vector (SVG/AI), usarlo en su lugar.
"""
import numpy as np
from PIL import Image, ImageFilter


def _hex(c):
    c = c.lstrip('#')
    return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def escalar_plano(img: Image.Image, colores: list[str], lado: int) -> Image.Image:
    """Devuelve el logo a `lado` px en su lado mayor, con fondo transparente."""
    img = img.convert('RGBA')
    arr = np.asarray(img).astype(np.float32)
    rgb, alfa = arr[..., :3], arr[..., 3] / 255.0
    pal = np.stack([_hex(c) for c in colores])                        # (k,3)
    dist = ((rgb[:, :, None, :] - pal[None, None]) ** 2).sum(-1)      # (h,w,k)
    idx = dist.argmin(-1)
    # Los píxeles de antialias (mezcla de dos colores) no votan por ningún color:
    # si votaran, dejarían un filo del color equivocado en los bordes.
    puro = (dist.min(-1) < 45 ** 2) & (alfa > 0.9)

    w, h = img.size
    esc = lado * 2 / max(w, h)
    W, H = round(w * esc), round(h * esc)

    def agrandar(m):
        im = Image.fromarray((m * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        return np.asarray(im.filter(ImageFilter.GaussianBlur(esc * 0.9))).astype(np.float32) / 255

    forma = agrandar(alfa) > 0.5
    pesos = np.stack([agrandar(((idx == k) & puro).astype(np.float32)) for k in range(len(pal))], -1)
    color = pal[pesos.argmax(-1)]
    out = np.zeros((H, W, 4), dtype=np.uint8)
    out[..., :3] = color.astype(np.uint8)
    out[..., 3] = forma * 255
    grande = Image.fromarray(out, 'RGBA')
    return grande.resize((W // 2, H // 2), Image.LANCZOS)
