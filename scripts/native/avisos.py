#!/usr/bin/env python3
"""
Genera los avisos de privacidad de las apps (public/legal/privacidad-*.html).
Una sola plantilla para las dos, para que no diverjan en lo legal.

  python3 scripts/native/avisos.py

Datos del responsable tomados del Aviso de Privacidad Integral de JIRO
(https://jiro.mx/privacidad/, actualizado el 9 de septiembre de 2025).
Si cambian, se actualizan aquí y se vuelve a correr.
"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]

RESPONSABLE = 'JIRO Y ASOCIADOS AGENTE DE SEGUROS Y FIANZAS, S.A. DE C.V.'
DOMICILIO = 'Marsella No. 14, Col. Juárez, Alcaldía Cuauhtémoc, C.P. 06600, Ciudad de México'
CORREO_PRIVACIDAD = 'contacto@jiro.mx'
INTEGRAL = 'https://jiro.mx/privacidad/'
FECHA = '7 de noviembre de 2026'

APPS = {
  'movi': dict(
    archivo='privacidad-movi.html', titulo='MOVI Digital', logo='/movirecurso_7.png', logo_style='',
    sitio='<a href="https://app.movi.digital">app.movi.digital</a>', soporte='contacto@movi.digital',
    quien='''<p>La app está dirigida exclusivamente a agentes, colaboradores y gerentes de la red de JIRO a
    quienes la empresa o su oficina les asignó una cuenta. No está dirigida al público en general ni a menores de edad.</p>''',
    datos=[
      ('Identificación y contacto', 'Nombre, correo, celular, oficina, puesto, fotografía de perfil.'),
      ('Laborales y comerciales', 'Clave de agente, cédula, producción, metas, equipo al que perteneces.'),
      ('Patrimoniales y financieros', 'RFC, régimen fiscal, cuenta bancaria y CLABE para el pago de comisiones; importes de comisiones.'),
      ('De terceros que tú registras', 'Datos de tus clientes y prospectos (nombre, contacto, pólizas, cotizaciones, documentos). Los tratamos por cuenta tuya y de JIRO, solo para operar tu cartera; tú debes contar con el consentimiento de esos clientes.'),
      ('Ubicación (opcional)', 'Solo si la compartes en tu perfil: la zona de tu oficina para asignarte prospectos cercanos.'),
      ('Cámara y micrófono (opcional)', 'Solo mientras los usas: fotos de documentos, videollamadas y Aula Virtual. No se graban sin aviso.'),
      ('Uso y diagnóstico', 'Registro de actividad en la plataforma; al reportar un problema, una captura de la pantalla, navegador, dirección consultada y errores técnicos.'),
    ],
    sensibles='''<p>La app no te pide datos personales sensibles. Puede contener <strong>datos de salud de tus clientes</strong>
    cuando un trámite de gastos médicos o vida lo requiere; se tratan con medidas reforzadas, solo para gestionar
    ese trámite ante la aseguradora y con el consentimiento expreso que el cliente otorga en su solicitud de seguro.</p>''',
    primarias=['Crear y administrar tu cuenta, y darte acceso según tu rol, oficina y equipo.',
      'Levantar, asignar y dar seguimiento a trámites ante aseguradoras y afianzadoras.',
      'Calcular, conciliar y pagar comisiones, y emitir los comprobantes correspondientes.',
      'Operar tu cartera (CRM), cotizaciones, renovaciones y producción.',
      'Enviarte avisos operativos por la app, correo o WhatsApp.',
      'Seguridad de la información, auditoría interna y corrección de fallas.',
      'Cumplir obligaciones legales, fiscales y regulatorias.'],
    secundarias=['Invitarte a capacitaciones, convenciones y campañas comerciales de la red.',
      'Encuestas de satisfacción y mejora de la plataforma.'],
  ),
  'seguwallet': dict(
    archivo='privacidad-seguwallet.html', titulo='Seguwallet by MOVI Digital', logo='/seguwallet-logo.png',
    logo_style='background:#0a2260;border-radius:10px;padding:4px', sitio='<a href="https://seguwallet.mx">seguwallet.mx</a>',
    soporte='seguwallet@movi.digital',
    quien='''<p>Seguwallet está dirigida a personas mayores de 18 años que son contratantes, aseguradas o
    beneficiarias de una póliza gestionada por un asesor de la red de JIRO. Tu asesor es quien te da de alta.</p>''',
    datos=[
      ('Identificación y contacto', 'Nombre, correo, WhatsApp, estado, municipio, fecha de nacimiento, género y fotografía de perfil.'),
      ('Patrimoniales y financieros', 'Pólizas, coberturas, sumas aseguradas, primas, recibos y estado de pago.'),
      ('Documentos', 'Pólizas, identificación oficial y otros documentos que tú o tu asesor suban.'),
      ('Siniestros', 'Los reportes que hagas y las fotografías o documentos que adjuntes.'),
      ('Conversaciones con Chava', 'Las preguntas que escribes al asistente y sus respuestas.'),
      ('Cámara y fotos (opcional)', 'Solo cuando eliges adjuntar una imagen.'),
      ('Uso', 'Registro de accesos, descargas de documentos y uso del botón de siniestro.'),
    ],
    sensibles='''<p>Si tienes una póliza de <strong>gastos médicos mayores, vida o accidentes</strong>, la app muestra
    información que puede revelar datos sobre tu <strong>estado de salud</strong>, que la ley considera
    <strong>datos personales sensibles</strong>. Solo se usan para mostrarte tu póliza y atender tus trámites y
    siniestros, con medidas de seguridad reforzadas. Al aceptar los términos de Seguwallet otorgas tu
    <strong>consentimiento expreso</strong> para ello; puedes revocarlo en cualquier momento (ver abajo), aunque sin él no
    podremos mostrarte esas pólizas en la app. La app no te pide tu ubicación.</p>''',
    primarias=['Crear tu cuenta y enviarte tu código de acceso.',
      'Mostrarte tus pólizas, coberturas, recibos y documentos, y permitirte descargarlos.',
      'Canalizar tus reportes de siniestro a tu asesor y a tu aseguradora.',
      'Responder tus preguntas mediante el asistente Chava.',
      'Que tu asesor te atienda, te cotice y te renueve.',
      'Seguridad de tu cuenta y cumplimiento de obligaciones legales.'],
    secundarias=['Enviarte recordatorios de renovación y ofertas de seguros de tu asesor.',
      'Encuestas de satisfacción y mejora del servicio.'],
  ),
}

def pagina(cfg):
    filas = '\n'.join(f'    <tr><td><strong>{a}</strong></td><td>{b}</td></tr>' for a, b in cfg['datos'])
    prim = '\n'.join(f'    <li>{x}</li>' for x in cfg['primarias'])
    sec = '\n'.join(f'    <li>{x}</li>' for x in cfg['secundarias'])
    app = 'seguwallet' if 'Seguwallet' in cfg['titulo'] else 'movi'
    return f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aviso de privacidad — {cfg['titulo']}</title>
<meta name="description" content="Aviso de privacidad de la app {cfg['titulo']}: responsable, datos que usa, finalidades, transferencias y derechos ARCO.">
<link rel="stylesheet" href="/legal/estilos.css">
</head>
<body>
<!-- Generado por scripts/native/avisos.py — editar allá, no aquí. -->
<main>
  <header class="marca"><img src="{cfg['logo']}" alt="" style="{cfg['logo_style']}"><strong>{cfg['titulo']}</strong></header>
  <h1>Aviso de privacidad de {cfg['titulo']}</h1>
  <p class="fecha">Última actualización: {FECHA}</p>

  <h2>1. Responsable</h2>
  <p><strong>{RESPONSABLE}</strong> (“JIRO”), con domicilio en {DOMICILIO}, es responsable del tratamiento de los datos
  personales que se recaban a través de la app {cfg['titulo']} para iOS y Android y del sitio {cfg['sitio']},
  operados con la plataforma MOVI Digital. Este aviso se emite conforme a la Ley Federal de Protección de Datos
  Personales en Posesión de los Particulares y complementa el
  <a href="{INTEGRAL}">Aviso de Privacidad Integral de JIRO</a>.</p>
  <p>El Comité de Protección de Datos de JIRO, en el mismo domicilio y en
  <a href="mailto:{CORREO_PRIVACIDAD}">{CORREO_PRIVACIDAD}</a>, atiende las solicitudes relacionadas con tus datos.</p>

  <h2>2. A quién va dirigida</h2>
  {cfg['quien']}

  <h2>3. Datos personales que tratamos</h2>
  <table>
{filas}
  </table>

  <h2>4. Datos personales sensibles</h2>
  {cfg['sensibles']}

  <h2>5. Finalidades</h2>
  <p><strong>Primarias</strong> (necesarias para darte el servicio):</p>
  <ul>
{prim}
  </ul>
  <p><strong>Secundarias</strong> (no son necesarias; puedes negarte sin que eso afecte el servicio):</p>
  <ul>
{sec}
  </ul>
  <p>Si no quieres que usemos tus datos para las finalidades secundarias, escríbenos a
  <a href="mailto:{CORREO_PRIVACIDAD}">{CORREO_PRIVACIDAD}</a> indicándolo. No usamos tus datos para publicidad de
  terceros, no los vendemos y no te rastreamos en otras apps o sitios.</p>

  <h2>6. Transferencias</h2>
  <table>
    <tr><th>Destinatario</th><th>Finalidad</th><th>¿Requiere tu consentimiento?</th></tr>
    <tr><td>Aseguradoras y afianzadoras</td><td>Cotizar, emitir, renovar y dar servicio a pólizas; atender siniestros.</td><td>No: es necesaria para el contrato de seguro que celebraste o solicitaste.</td></tr>
    <tr><td>Autoridades competentes</td><td>Cumplir obligaciones legales, fiscales o requerimientos de autoridad.</td><td>No: obligación legal.</td></tr>
    <tr><td>Empresas y agentes de la red JIRO</td><td>Que tu asesor u oficina te atienda.</td><td>No: mismo grupo y mismas finalidades.</td></tr>
  </table>
  <p>Además, nos apoyamos en <strong>encargados</strong> que tratan datos por cuenta nuestra, bajo contrato y solo para
  prestarnos el servicio: alojamiento y base de datos (Supabase, con servidores fuera de México), envío de correos y de
  mensajes de WhatsApp, verificación anti-abuso (Google reCAPTCHA) y procesamiento de inteligencia artificial
  (asistente Chava). Estas remisiones no son transferencias y no requieren tu consentimiento.</p>

  <h2>7. Derechos ARCO y revocación del consentimiento</h2>
  <p>Tienes derecho a <strong>acceder</strong> a tus datos, <strong>rectificarlos</strong>, <strong>cancelarlos</strong> y
  <strong>oponerte</strong> a su uso, así como a <strong>revocar el consentimiento</strong> que nos hayas dado. Envía tu
  solicitud a <a href="mailto:{CORREO_PRIVACIDAD}">{CORREO_PRIVACIDAD}</a> o al domicilio indicado, con:</p>
  <ul>
    <li>Tu nombre completo y un correo o domicilio para responderte.</li>
    <li>Copia de tu identificación oficial (o, si actúa un representante, su poder e identificación).</li>
    <li>La descripción clara de los datos y del derecho que quieres ejercer; si es rectificación, las correcciones y su soporte.</li>
  </ul>
  <p>Te responderemos en un máximo de <strong>20 días hábiles</strong> y, si procede, la haremos efectiva dentro de los
  <strong>15 días hábiles</strong> siguientes. En la cancelación, los datos se bloquean primero y se suprimen al terminar
  los plazos legales de conservación.</p>

  <h2>8. Eliminar tu cuenta</h2>
  <p>Desde la app: <strong>{'Perfil → Seguridad → Eliminar mi cuenta' if app == 'seguwallet' else 'Mi perfil → Eliminar mi cuenta'}</strong>,
  o en la <a href="/legal/eliminar-cuenta.html?app={app}">página de eliminación de cuenta</a>. La atendemos en un máximo de
  30 días. Conservamos solo lo que la ley o los contratos con aseguradoras obligan a guardar, por el plazo legal.</p>

  <h2>9. Cómo limitar el uso de tus datos</h2>
  <p>Puedes desactivar los avisos que no quieras desde la app o pedirnos por correo que dejemos de enviarte
  comunicaciones secundarias. También puedes inscribirte en el Registro Público para Evitar Publicidad (REPEP) de la PROFECO.
  Los permisos de cámara{', micrófono, fotos y ubicación' if app == 'movi' else ' y fotos'} los controlas desde los ajustes de tu teléfono.</p>

  <h2>10. Tecnologías de seguimiento</h2>
  <p>La app guarda en tu dispositivo únicamente lo necesario para mantener tu sesión y tus preferencias. No usa cookies
  publicitarias, web beacons ni identificadores de publicidad, y no comparte tu actividad con redes de anuncios.</p>

  <h2>11. Seguridad y conservación</h2>
  <p>La información viaja cifrada (HTTPS), el acceso está limitado por rol y la app no envía tus datos al respaldo en la
  nube del teléfono. Conservamos tus datos mientras tengas cuenta y después solo por los plazos que marcan las
  leyes fiscales, mercantiles y de seguros.</p>

  <h2>12. Cambios a este aviso</h2>
  <p>Cualquier cambio se publicará en esta misma dirección, con su nueva fecha, y te lo avisaremos dentro de la app
  cuando sea relevante.</p>

  <h2>13. Autoridad</h2>
  <p>Si consideras que tu derecho a la protección de datos fue vulnerado, puedes acudir a la autoridad competente en
  materia de protección de datos personales, actualmente la Secretaría Anticorrupción y Buen Gobierno.</p>

  <footer>{cfg['titulo']} · {RESPONSABLE} · Soporte de la app: <a href="mailto:{cfg['soporte']}">{cfg['soporte']}</a> ·
  <a href="/legal/soporte.html?app={app}">Ayuda</a></footer>
</main>
</body>
</html>
'''

for cfg in APPS.values():
    (ROOT / 'public' / 'legal' / cfg['archivo']).write_text(pagina(cfg))
print('Avisos generados.')
