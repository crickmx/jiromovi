"""
Pantallas simuladas para las capturas de tienda. Datos 100% ficticios.
Cada pantalla: (archivo, titular, subtítulo, html_de_la_pantalla, tema)
El HTML se dibuja en un lienzo lógico de ~390 px de ancho (iPhone) y se escala.
"""

SB_DARK = '<div class="sb" style="color:#fff"><span>9:41</span><span class="ic">●●● <span class="bat"></span></span></div>'
SB = '<div class="sb"><span>9:41</span><span class="ic">●●● <span class="bat"></span></span></div>'

def tab(items, on):
    return '<div class="tab">' + ''.join(
        f'<div class="{"on" if i == on else ""}"><span class="dot" style="opacity:{1 if i == on else .35}"></span>{t}</div>'
        for i, t in enumerate(items)) + '</div>'

# ───────────────────────── SEGUWALLET ─────────────────────────
SW_TABS = ['Inicio', 'Pólizas', 'Chava', 'Cotizar', 'Perfil']
AZ = '#1c37e0'

def sw_poliza(icono, color, tipo, aseg, num, vig, chip, chipc):
    return f'''<div class="card row" style="margin-top:10px">
      <div class="ico" style="background:{color}22;color:{color}">{icono}</div>
      <div style="flex:1;min-width:0"><div class="h" style="font-size:15px">{tipo}</div>
      <div class="mut">{aseg} · {num}</div><div class="mut" style="font-size:12px">Vigente hasta {vig}</div></div>
      <span class="chip" style="background:{chipc}1f;color:{chipc}">{chip}</span></div>'''

sw_inicio = f'''
<div style="background:linear-gradient(160deg,#071a5c,{AZ});color:#fff;padding-bottom:70px">
 {SB_DARK}
 <div class="pad"><div class="row" style="justify-content:space-between"><div><div style="opacity:.75;font-size:13px">Hola,</div>
 <div class="h" style="font-size:24px">Mariana López</div></div><div class="av" style="background:#ffffff33">ML</div></div>
 <div class="row" style="gap:10px;margin-top:20px">
  <div style="flex:1;background:#ffffff1f;border-radius:18px;padding:14px"><div style="font-size:12px;opacity:.8">Pólizas activas</div><div class="h" style="font-size:28px">4</div></div>
  <div style="flex:1;background:#ffffff1f;border-radius:18px;padding:14px"><div style="font-size:12px;opacity:.8">Próximo pago</div><div class="h" style="font-size:20px">$2,480</div><div style="font-size:11px;opacity:.8">15 de diciembre</div></div>
 </div></div></div>
<div class="pad" style="margin-top:-56px">
 <div class="card" style="border-left:5px solid #ef4444"><div class="row"><div class="ico" style="background:#fee2e2;color:#ef4444">🚨</div>
  <div><div class="h" style="font-size:15px">¿Tuviste un siniestro?</div><div class="mut">Te conectamos con tu aseguradora al instante</div></div></div></div>
 <div class="h" style="font-size:17px;margin:18px 0 2px">Mis pólizas</div>
 {sw_poliza('🚗', AZ, 'Auto · Mazda 3 2024', 'GNP Seguros', 'Póliza 0912-AX', '12/08/2027', 'Al corriente', '#059669')}
 {sw_poliza('❤️', '#e11d48', 'Gastos Médicos Mayores', 'AXA Seguros', 'Póliza GM-55301', '01/03/2027', 'Al corriente', '#059669')}
 {sw_poliza('🏠', '#d97706', 'Hogar', 'Qualitas', 'Póliza H-77120', '20/01/2027', 'Pago pendiente', '#d97706')}
 {sw_poliza('🛡️', '#7c3aed', 'Vida', 'Seguros Monterrey', 'Póliza V-10021', '30/06/2040', 'Al corriente', '#059669')}
</div>{tab(SW_TABS, 0)}'''

sw_detalle = f'''{SB}
<div class="pad"><div class="mut">‹ Mis pólizas</div>
 <div class="card" style="margin-top:10px;background:linear-gradient(135deg,{AZ},#4d65ff);color:#fff">
  <div style="font-size:12px;opacity:.8">GNP Seguros · Auto</div><div class="h" style="font-size:22px;margin:4px 0">Mazda 3 Sedán 2024</div>
  <div style="font-size:13px;opacity:.9">Póliza 0912-AX · Placas ABC-123-D</div>
  <div class="row" style="justify-content:space-between;margin-top:14px;font-size:12px"><span>Vigencia<br><b style="font-size:14px">12/08/2026 – 12/08/2027</b></span><span class="chip" style="background:#ffffff33;color:#fff">Vigente</span></div></div>
 <div class="row" style="gap:8px;margin-top:14px">{''.join(f'<div style="flex:1;text-align:center;padding:9px;border-radius:12px;font-size:12px;font-weight:800;{s}">{t}</div>' for t,s in [('Coberturas','background:#fff;color:'+AZ+';box-shadow:0 2px 8px #0f172a14'),('Recibos','color:#64748b'),('Documentos','color:#64748b')])}</div>
 <div class="card" style="margin-top:12px">
 {''.join(f'<div class="row" style="justify-content:space-between;padding:11px 0;border-bottom:1px solid #f1f5f9"><span style="font-weight:700;font-size:14px">{c}</span><span class="mut" style="font-weight:700">{v}</span></div>' for c,v in [('Daños materiales','Valor comercial'),('Robo total','Valor comercial'),('Responsabilidad civil','$3,000,000'),('Gastos médicos ocupantes','$200,000'),('Asistencia vial','Amparada'),('Defensa legal','Amparada')])}
 <div class="mut" style="padding-top:10px">Deducible daños materiales: 5%</div></div>
 <div class="btn" style="margin-top:14px">⬇  Descargar póliza en PDF</div>
 <div style="margin-top:10px;text-align:center;font-weight:800;color:{AZ};padding:12px;border:2px solid {AZ}33;border-radius:16px">Compartir con mi familia</div>
</div>{tab(SW_TABS, 1)}'''

sw_siniestro = f'''<div style="position:absolute;inset:0;background:#0f172a99"></div>{SB}
<div class="pad" style="opacity:.4"><div class="h" style="font-size:22px">Mis pólizas</div>{sw_poliza('🚗', AZ, 'Auto · Mazda 3 2024', 'GNP Seguros', 'Póliza 0912-AX', '12/08/2027', 'Al corriente', '#059669')}</div>
<div style="position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:28px 28px 0 0;padding:22px 18px 40px">
 <div style="width:44px;height:5px;border-radius:9px;background:#cbd5e1;margin:0 auto 16px"></div>
 <div class="row"><div class="ico" style="background:#fee2e2;color:#ef4444">🚨</div><div><div class="h" style="font-size:19px">Reportar siniestro</div><div class="mut">Mantén la calma, te ayudamos.</div></div></div>
 <div class="mut" style="margin:16px 0 6px;font-weight:800">¿Qué póliza?</div>
 <div class="card row" style="border:2px solid {AZ}"><span style="font-size:20px">🚗</span><div style="flex:1"><b>Auto · Mazda 3 2024</b><div class="mut">GNP Seguros · 0912-AX</div></div><span style="color:{AZ};font-weight:900">✓</span></div>
 <div class="btn" style="margin-top:16px;background:#ef4444">📞  Llamar a cabina GNP</div>
 <div class="btn" style="margin-top:10px;background:#16a34a">💬  Avisar a mi asesor por WhatsApp</div>
 <div style="margin-top:10px;text-align:center;font-weight:800;padding:13px;border:2px solid #e2e8f0;border-radius:16px">📷  Adjuntar fotos del siniestro</div>
 <div class="mut" style="text-align:center;margin-top:14px;font-size:12px">Ten a la mano tu número de póliza: <b>0912-AX</b></div>
</div>'''

def burbuja(t, yo=False):
    st = f'background:{AZ};color:#fff;margin-left:auto;border-radius:20px 20px 6px 20px' if yo else 'background:#fff;border-radius:20px 20px 20px 6px;box-shadow:0 2px 8px #0f172a12'
    return f'<div style="max-width:80%;padding:12px 14px;font-size:14px;line-height:1.45;margin-top:10px;{st}">{t}</div>'

sw_chava = f'''{SB}
<div class="pad row" style="border-bottom:1px solid #e2e8f0;padding-bottom:12px"><div class="av" style="background:linear-gradient(135deg,#60a5fa,{AZ})">🐘</div>
 <div><div class="h" style="font-size:17px">Chava</div><div style="font-size:12px;color:#16a34a;font-weight:800">● Asistente de seguros 24/7</div></div></div>
<div class="pad">
 {burbuja('¡Hola Mariana! Soy Chava 👋 Pregúntame lo que quieras sobre tus pólizas.')}
 {burbuja('¿Mi seguro de gastos médicos cubre maternidad?', True)}
 {burbuja('Sí. Tu póliza <b>GM-55301</b> de AXA incluye la cobertura de maternidad con un periodo de espera de <b>10 meses</b>, y una suma de <b>$40,000</b> para parto o cesárea. 🤰')}
 {burbuja('¿Y cuándo vence mi próximo pago?', True)}
 {burbuja('Tu próximo recibo es de <b>$2,480</b> y vence el <b>15 de diciembre</b>. ¿Quieres que le avise a tu asesor para domiciliarlo?')}
</div>
<div style="position:absolute;left:14px;right:14px;bottom:100px;background:#fff;border-radius:22px;padding:14px 16px;box-shadow:0 4px 16px #0f172a1a;color:#94a3b8;font-size:14px" class="row"><span style="flex:1">Escribe tu pregunta…</span><span class="av" style="width:34px;height:34px;background:{AZ};font-size:14px">➤</span></div>
{tab(SW_TABS, 2)}'''

sw_asesor = f'''{SB}
<div class="pad"><div class="h" style="font-size:24px">Mi Agente</div>
 <div class="card" style="margin-top:14px;text-align:center;padding:24px">
  <div class="av" style="width:84px;height:84px;font-size:28px;margin:0 auto;background:linear-gradient(135deg,{AZ},#60a5fa)">RG</div>
  <div class="h" style="font-size:20px;margin-top:12px">Roberto García</div><div class="mut">Agente de seguros certificado</div>
  <div class="mut" style="font-size:12px">Oficina Guadalajara · Red Grupo JIRO</div>
  <div class="row" style="gap:10px;margin-top:18px"><div class="btn" style="flex:1;background:#16a34a">WhatsApp</div><div class="btn" style="flex:1">Llamar</div></div></div>
 <div class="h" style="font-size:17px;margin:20px 0 4px">Lo que puede hacer por ti</div>
 {''.join(f'<div class="card row" style="margin-top:10px"><div class="ico" style="background:{AZ}14">{i}</div><div><b style="font-size:14px">{t}</b><div class="mut">{d}</div></div></div>' for i,t,d in [('📝','Cotizar un seguro nuevo','Auto, gastos médicos, vida, hogar'),('🔄','Renovar tus pólizas','Te avisa antes de que venzan'),('🧾','Aclarar un cobro','Revisa tus recibos contigo')])}
</div>{tab(SW_TABS, 4)}'''

sw_login = f'''<div style="position:absolute;inset:0;background:linear-gradient(150deg,#050e24,#0a2260 40%,#0d2e80 60%,#091a50)"></div>
<div style="position:relative;color:#fff">{SB_DARK}
<div class="pad" style="padding:60px 26px"><div style="text-align:center"><img src="LOGO_SW" style="height:96px"></div>
 <div class="h" style="font-size:30px;margin-top:56px">Ingresar</div><div style="opacity:.6;margin-top:6px">Te enviamos un código de 6 dígitos</div>
 <div style="font-size:12px;font-weight:800;opacity:.7;margin-top:30px;letter-spacing:.05em">CÓDIGO DE ACCESO</div>
 <div class="row" style="gap:8px;margin-top:10px">{''.join(f'<div style="flex:1;height:56px;border-radius:14px;background:#ffffff1a;border:1.5px solid #ffffff40;display:grid;place-items:center;font:800 24px Sora">{d}</div>' for d in '4819  ')}</div>
 <div style="background:#fff;color:#0a2260;border-radius:18px;padding:16px;text-align:center;font-weight:800;margin-top:24px">Entrar a mi cartera →</div>
 <div style="text-align:center;opacity:.55;font-size:13px;margin-top:18px">Sin contraseñas · Llega por correo y WhatsApp</div>
</div></div>'''

SEGUWALLET = [
    ('01-cartera', 'Todas tus pólizas en un solo lugar', 'Auto, gastos médicos, vida y hogar, siempre contigo', sw_inicio),
    ('02-poliza', 'Consulta coberturas y descarga tu póliza', 'Tu PDF oficial a un toque de distancia', sw_detalle),
    ('03-siniestro', 'Ayuda inmediata si tienes un siniestro', 'Llama a tu aseguradora o avisa a tu asesor', sw_siniestro),
    ('04-chava', 'Pregúntale a Chava, tu asistente 24/7', 'Respuestas claras sobre tus seguros', sw_chava),
    ('05-asesor', 'Tu asesor siempre a la mano', 'Escríbele por WhatsApp desde la app', sw_asesor),
    ('06-acceso', 'Entra seguro, sin contraseñas', 'Un código único por correo o WhatsApp', sw_login),
]

# ───────────────────────── MOVI ─────────────────────────
MV = '#2563eb'
MV_TABS = ['Inicio', 'Trámites', 'Comisiones', 'CRM', 'Más']

def kpi(t, v, s, c):
    return f'<div class="card" style="flex:1;padding:13px"><div class="mut" style="font-size:11px;font-weight:800">{t}</div><div class="h" style="font-size:21px;color:{c}">{v}</div><div class="mut" style="font-size:11px">{s}</div></div>'

mv_inicio = f'''{SB}
<div class="pad"><div class="row" style="justify-content:space-between"><div><div class="mut">Buenos días,</div><div class="h" style="font-size:23px">Carlos Méndez</div></div><div class="av" style="background:{MV}">CM</div></div>
 <div class="card" style="margin-top:14px;background:linear-gradient(135deg,#1e3a8a,{MV});color:#fff">
  <div style="font-size:12px;opacity:.85;font-weight:700">Mi producción 2026</div><div class="h" style="font-size:28px;margin:4px 0">$1,284,500</div>
  <div class="bar" style="background:#ffffff33"><i style="width:78%;background:#fff"></i></div>
  <div style="font-size:12px;margin-top:6px;opacity:.9">78% de tu meta anual · faltan $356,000</div></div>
 <div class="row" style="gap:10px;margin-top:10px">{kpi('Trámites activos','12','3 requieren atención','#d97706')}{kpi('Comisión del mes','$48,230','Pagada el 15/11','#059669')}</div>
 <div class="card" style="margin-top:10px"><div class="row" style="justify-content:space-between"><b>🏆 Convención 2027</b><span class="chip" style="background:#fef3c7;color:#b45309">Nivel Oro</span></div>
  <div class="row" style="gap:6px;margin-top:12px">{''.join(f'<div style="flex:1;height:8px;border-radius:9px;background:{c}"></div>' for c in ['#94a3b8','#f59e0b','#e2e8f0'])}</div>
  <div class="mut" style="margin-top:8px">Te faltan $120,000 para Platino</div></div>
 <div class="h" style="font-size:16px;margin:16px 0 8px">Accesos rápidos</div>
 <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;text-align:center;font-size:11px;font-weight:800">{''.join(f'<div><div class="ico" style="margin:0 auto 6px;background:{c}1c;color:{c}">{i}</div>{t}</div>' for i,t,c in [('📋','Nuevo trámite',MV),('🧮','Cotizar','#7c3aed'),('👥','Mi CRM','#059669'),('🎓','Aula','#d97706')])}</div>
</div>{tab(MV_TABS, 0)}'''

def tram(folio, tit, cli, est, ec, prio=None):
    p = f'<span class="chip" style="background:#fee2e2;color:#dc2626">Alta</span>' if prio else ''
    return f'''<div class="card" style="margin-top:10px;padding:14px"><div class="row" style="justify-content:space-between"><span class="mut" style="font-weight:800">{folio}</span><span style="display:flex;gap:6px">{p}<span class="chip" style="background:{ec}1c;color:{ec}">{est}</span></span></div>
    <div style="font-weight:800;font-size:15px;margin-top:6px">{tit}</div><div class="mut">{cli}</div></div>'''

mv_tramites = f'''{SB}
<div class="pad"><div class="h" style="font-size:24px">Trámites</div>
 <div class="row" style="gap:8px;margin-top:12px;font-size:12px;font-weight:800">{''.join(f'<span style="padding:8px 12px;border-radius:12px;{s}">{t}</span>' for t,s in [('Requiere atención 3','background:#fef3c7;color:#b45309'),('En proceso 9','background:#fff;border:1px solid #e2e8f0'),('Terminados','background:#fff;border:1px solid #e2e8f0')])}</div>
 {tram('TK4A92F','Emisión de póliza de auto','Cliente: Laura Ríos · GNP','Póliza emitida','#059669')}
 {tram('TK7C11B','Cotización Gastos Médicos','Cliente: Familia Ortega · 4 asegurados','En revisión','#2563eb',True)}
 {tram('TK2E8D0','Endoso de cambio de placas','Cliente: Pedro Salas · Qualitas','Esperando documentos','#d97706')}
 {tram('TK90F3A','Renovación seguro de hogar','Cliente: Ana Torres · AXA','Iniciado','#64748b')}
 {tram('TK5B6C2','Aclaración de comisión','Periodo octubre 2026','En proceso','#2563eb')}
</div>
<div style="position:absolute;right:20px;bottom:104px;width:58px;height:58px;border-radius:20px;background:{MV};color:#fff;display:grid;place-items:center;font-size:30px;box-shadow:0 10px 24px {MV}66">+</div>
{tab(MV_TABS, 1)}'''

def com(q, a, t, c):
    return f'<div class="row" style="gap:10px;margin-top:12px"><div class="av" style="width:36px;height:36px;font-size:12px;background:{c}">{q}</div><div class="card" style="flex:1;padding:12px"><div class="row" style="justify-content:space-between"><b style="font-size:13px">{a}</b><span class="mut" style="font-size:11px">{t[1]}</span></div><div style="font-size:14px;margin-top:4px;line-height:1.4">{t[0]}</div></div></div>'

mv_detalle = f'''{SB}
<div class="pad"><div class="mut">‹ Trámites</div>
 <div class="row" style="justify-content:space-between;margin-top:8px"><span class="mut" style="font-weight:800">TK7C11B · Comercial</span><span class="chip" style="background:#dbeafe;color:{MV}">En revisión</span></div>
 <div class="h" style="font-size:21px;margin-top:4px">Cotización Gastos Médicos</div>
 <div class="card" style="margin-top:12px;padding:12px">{''.join(f'<div class="row" style="justify-content:space-between;padding:7px 0;font-size:13px"><span class="mut">{a}</span><b>{b}</b></div>' for a,b in [('Solicitante','Carlos Méndez'),('Responsable','Mesa de Control GDL'),('Promesa de entrega','12 nov 2026')])}</div>
 <div class="row" style="gap:8px;margin-top:12px;font-size:12px;font-weight:800">{''.join(f'<span style="padding:8px 12px;border-radius:12px;{s}">{t}</span>' for t,s in [('Comentarios','background:'+MV+';color:#fff'),('Archivos 4','background:#fff;border:1px solid #e2e8f0'),('Historial','background:#fff;border:1px solid #e2e8f0')])}</div>
 {com('MC','Mesa de Control',('Ya tenemos la propuesta de AXA y GNP. Adjunto el comparativo en PDF.','10:42'),'#7c3aed')}
 {com('CM','Carlos Méndez',('¡Gracias! El cliente prefiere AXA, ¿podemos emitir hoy?','10:58'),MV)}
 {com('MC','Mesa de Control',('Claro, solo falta la solicitud firmada. @Carlos te la dejé en Archivos.','11:03'),'#7c3aed')}
</div>
<div style="position:absolute;left:14px;right:14px;bottom:100px;background:#fff;border-radius:18px;padding:13px 16px;box-shadow:0 4px 16px #0f172a1a;color:#94a3b8;font-size:14px">Escribe un comentario… usa @ para mencionar</div>
{tab(MV_TABS, 1)}'''

mv_comisiones = f'''{SB}
<div class="pad"><div class="h" style="font-size:24px">Mis comisiones</div><div class="mut">Noviembre 2026</div>
 <div class="card" style="margin-top:12px;text-align:center;padding:20px"><div class="mut" style="font-weight:800">Total a pagar</div><div class="h" style="font-size:34px;color:#059669">$48,230.50</div><div class="mut">Depósito programado: 15 de noviembre</div></div>
 <div class="card" style="margin-top:10px"><b>Por aseguradora</b>
 {''.join(f'<div style="margin-top:12px"><div class="row" style="justify-content:space-between;font-size:13px"><b>{a}</b><span class="mut" style="font-weight:800">{m}</span></div><div class="bar" style="margin-top:6px"><i style="width:{w}%;background:{c}"></i></div></div>' for a,m,w,c in [('GNP Seguros','$19,840',82,MV),('AXA Seguros','$14,210',60,'#7c3aed'),('Qualitas','$9,630',40,'#059669'),('Seguros Monterrey','$4,550',20,'#d97706')])}</div>
 <div class="card" style="margin-top:10px">{''.join(f'<div class="row" style="justify-content:space-between;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span>{a}<div class="mut" style="font-size:11px">{d}</div></span><b>{m}</b></div>' for a,d,m in [('Póliza 0912-AX','Auto · L. Ríos','$1,840.00'),('Póliza GM-55301','GMM · Fam. Ortega','$6,120.50'),('Póliza H-77120','Hogar · A. Torres','$980.00')])}</div>
 <div class="btn" style="margin-top:12px">⬇  Descargar estado de cuenta</div>
</div>{tab(MV_TABS, 2)}'''

mv_cotizar = f'''{SB}
<div class="pad"><div class="h" style="font-size:24px">Multicotizador</div><div class="mut">Auto · Mazda 3 Sedán 2024 · CP 44100</div>
 {''.join(f'<div class="card" style="margin-top:10px;{"border:2px solid "+MV if b else ""}"><div class="row" style="justify-content:space-between"><b style="font-size:16px">{a}</b>{"<span class=chip style=background:#dcfce7;color:#15803d>Mejor precio</span>" if b else ""}</div><div class="row" style="justify-content:space-between;margin-top:8px"><span class="mut">{c}</span><span class="h" style="font-size:21px">{p}</span></div><div class="mut" style="font-size:12px">Anual · Deducible DM {d}</div></div>' for a,c,p,d,b in [('Qualitas','Amplia','$11,840',"5%",True),('GNP Seguros','Amplia','$12,390',"5%",False),('AXA Seguros','Amplia','$12,960',"3%",False),('HDI Seguros','Amplia','$13,105',"5%",False)])}
 <div class="btn" style="margin-top:14px;background:#16a34a">Enviar comparativo al cliente por WhatsApp</div>
</div>{tab(MV_TABS, 4)}'''

MOVI = [
    ('01-inicio', 'Tu oficina de seguros en el bolsillo', 'Producción, metas y convención de un vistazo', mv_inicio),
    ('02-tramites', 'Todos tus trámites, en tiempo real', 'Emisiones, endosos y renovaciones con seguimiento', mv_tramites),
    ('03-colaboracion', 'Colabora con Mesa de Control', 'Comentarios, archivos y menciones en cada trámite', mv_detalle),
    ('04-comisiones', 'Tus comisiones, claras y a tiempo', 'Detalle por aseguradora y por póliza', mv_comisiones),
    ('05-cotizar', 'Cotiza y comparte en minutos', 'Compara aseguradoras y envíalo a tu cliente', mv_cotizar),
]
