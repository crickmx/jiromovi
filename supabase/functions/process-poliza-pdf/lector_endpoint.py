"""
INSTRUCCIONES DE INSTALACIÓN EN LECTOR.MOVI.DIGITAL
=====================================================
1. Sube este archivo como:
   /var/www/vhosts/movi.digital/lector.movi.digital/app/api/routers/registro_poliza.py

2. En tu main.py agrega:
       from api.routers.registro_poliza import router as registro_poliza_router
       app.include_router(registro_poliza_router)

3. Reinicia el servicio.
"""

from __future__ import annotations
import logging

import fitz  # PyMuPDF
from fastapi import APIRouter, File, UploadFile, HTTPException

# ── Importar extractores ya existentes en el proyecto ───────────────────────
try:
    from api.extractores_especializados.qualitas import extraer as _extraer_qualitas
    _QUALITAS_OK = True
except ImportError:
    _QUALITAS_OK = False
    logging.getLogger(__name__).warning("No se pudo importar qualitas.extraer")

try:
    from api.extractores_especializados.gnp import extraer as _extraer_gnp
    _GNP_OK = True
except ImportError:
    _GNP_OK = False
    logging.getLogger(__name__).warning("No se pudo importar gnp.extraer")

router = APIRouter()

# ── Detección de aseguradora por scoring de keywords ───────────────────────

_ASEGURADORAS = {
    "Quálitas": {
        "keywords": ["QUALITAS", "QUÁLITAS"],
        "ramo": "Vehículos",
        "sub_ramo": "Automóviles",
        "extraer": lambda t, b: _extraer_qualitas(t, b) if _QUALITAS_OK else {},
    },
    "GNP Seguros": {
        "keywords": ["GNP SEGUROS", "GRUPO NACIONAL PROVINCIAL"],
        "ramo": "Vehículos",
        "sub_ramo": "Automóviles",
        "extraer": lambda t, b: _extraer_gnp(t, b) if _GNP_OK else {},
    },
}


def _detectar(texto: str):
    tu = texto.upper()
    scores = {
        nombre: sum(tu.count(kw) for kw in cfg["keywords"])
        for nombre, cfg in _ASEGURADORAS.items()
    }
    mejor = max(scores, key=scores.get)
    if scores[mejor] == 0:
        return None
    return _ASEGURADORAS[mejor] | {"nombre": mejor}


def _leer_fitz(pdf_bytes: bytes) -> str:
    texto = ""
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for p in doc:
            texto += p.get_text()
    return texto


# ── Endpoint ────────────────────────────────────────────────────────────────

@router.post("/extraer-poliza-registro")
async def extraer_poliza_registro(files: UploadFile = File(...)):
    """
    Recibe un PDF de póliza (multipart, campo 'files').
    Detecta aseguradora, extrae campos y devuelve JSON estandarizado.

    Respuesta:
    {
      "aseguradora": "Quálitas",
      "ramo": "Vehículos",
      "sub_ramo": "Automóviles",
      "estado": "ok",      # ok | no_reconocida | error
      "campos": { ... }
    }
    """
    if not files.filename or not files.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Se requiere un archivo PDF")

    pdf_bytes = await files.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Archivo vacío")

    try:
        texto = _leer_fitz(pdf_bytes)
    except Exception as e:
        return {"aseguradora": None, "ramo": None, "sub_ramo": None,
                "estado": "error", "campos": {}, "detalle": str(e)}

    cfg = _detectar(texto)
    if not cfg:
        return {"aseguradora": None, "ramo": None, "sub_ramo": None,
                "estado": "no_reconocida", "campos": {}}

    try:
        campos = cfg["extraer"](texto, pdf_bytes)
    except Exception as e:
        logging.getLogger(__name__).exception("Error extrayendo campos de %s", cfg["nombre"])
        return {"aseguradora": cfg["nombre"], "ramo": cfg["ramo"], "sub_ramo": cfg["sub_ramo"],
                "estado": "error", "campos": {}, "detalle": str(e)}

    return {
        "aseguradora": cfg["nombre"],
        "ramo":        cfg["ramo"],
        "sub_ramo":    cfg["sub_ramo"],
        "estado":      "ok",
        "campos":      campos,
    }
