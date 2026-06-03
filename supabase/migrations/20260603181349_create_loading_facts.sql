/*
  # Create loading_facts table

  ## Summary
  Creates a catalog of educational facts shown during loading screens
  to improve user experience on the MOVI Digital platform.

  ## New Tables
  - `loading_facts`
    - `id` (uuid, primary key)
    - `categoria` (text) — 'seguros' | 'tecnologia' | 'agentes' | 'mexico' | 'curiosidades'
    - `titulo` (text) — short headline for the fact
    - `hecho` (text) — the full fact text
    - `fuente` (text, nullable) — source name
    - `fuente_url` (text, nullable) — source URL
    - `activo` (boolean, default true)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can SELECT (read facts for display)
  - Only admin role can INSERT/UPDATE/DELETE

  ## Seed Data
  - 100 curated facts across 5 categories
*/

CREATE TABLE IF NOT EXISTS loading_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL CHECK (categoria IN ('seguros', 'tecnologia', 'agentes', 'mexico', 'curiosidades')),
  titulo text NOT NULL,
  hecho text NOT NULL,
  fuente text,
  fuente_url text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loading_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read loading facts"
  ON loading_facts FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Admins can manage loading facts"
  ON loading_facts FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update loading facts"
  ON loading_facts FOR UPDATE
  TO authenticated
  USING ((SELECT rol FROM usuarios WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT rol FROM usuarios WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can delete loading facts"
  ON loading_facts FOR DELETE
  TO authenticated
  USING ((SELECT rol FROM usuarios WHERE id = auth.uid()) = 'admin');

-- ─── Seed 100 facts ─────────────────────────────────────────────────────────

INSERT INTO loading_facts (categoria, titulo, hecho, fuente) VALUES

-- SEGUROS (30)
('seguros', 'El primer seguro de vida', 'El primer contrato de seguro de vida registrado data de 1583 en Londres; aseguró la vida de William Gybbons por un año por una prima del 8%.', 'Lloyds of London'),
('seguros', 'Orígenes del seguro marítimo', 'El seguro marítimo es el más antiguo del mundo; en el siglo XIV los comerciantes italianos ya contrataban pólizas para proteger sus cargamentos en el Mediterráneo.', 'IAIS'),
('seguros', 'El reaseguro', 'El reaseguro —el seguro de las aseguradoras— existe desde 1370 cuando se emitió el primer contrato en Génova, permitiendo a las compañías distribuir riesgos catastróficos.', 'Munich Re'),
('seguros', 'El incendio de Londres', 'Tras el Gran Incendio de Londres de 1666, surgió la primera compañía de seguros contra incendios del mundo: Fire Office, fundada en 1681.', 'Chartered Insurance Institute'),
('seguros', 'La Ley de los Grandes Números', 'La industria aseguradora se basa en la Ley de los Grandes Números, formulada por Jakob Bernoulli en 1713: entre más pólizas, más predecible es la frecuencia de siniestros.', 'Swiss Re'),
('seguros', 'Prima de riesgo', 'La prima pura de un seguro representa solo el costo estadístico del riesgo; los gastos administrativos y utilidad representan entre el 25% y 40% de la prima total que paga el asegurado.', 'AMIS'),
('seguros', 'Seguro de vida en América', 'La primera compañía de seguros de vida de Estados Unidos fue The Presbyterian Ministers Fund, fundada en Filadelfia en 1759.', 'Insurance Information Institute'),
('seguros', 'El principio de indemnización', 'El seguro opera bajo el principio de indemnización: el objetivo no es generar ganancia al asegurado, sino restituirlo a su condición económica previa al siniestro.', 'IAIS'),
('seguros', 'Seguro de salud colectivo', 'El primer plan de seguro médico colectivo en Estados Unidos fue lanzado por Blue Cross en 1929, ofreciendo hospitalización a maestros de Dallas, Texas, por $6 anuales.', 'Blue Cross Blue Shield'),
('seguros', 'Catástrofes naturales y seguros', 'Solo el 40% de las pérdidas económicas por catástrofes naturales a nivel mundial están aseguradas; la brecha de protección restante representa billones de dólares en riesgo no cubierto.', 'Swiss Re Sigma'),
('seguros', 'Seguros de crédito', 'Los seguros de crédito y caución protegen a empresas contra el impago de sus clientes; en México este mercado creció 12% en 2023, impulsado por el comercio electrónico.', 'AMIS'),
('seguros', 'Efecto del seguro en el PIB', 'Cada punto porcentual adicional en la penetración de seguros en el PIB está asociado con una reducción del 13% en el impacto económico de desastres naturales, según estudios del FMI.', 'FMI'),
('seguros', 'Seguros de mascota', 'El primer seguro para mascotas fue emitido en Suecia en 1890; hoy el mercado mundial supera los $10 mil millones de dólares anuales con crecimiento del 15% anual.', 'Swiss Re'),
('seguros', 'El rol del actuario', 'Los actuarios —matemáticos del seguro— calculan la probabilidad y costo de eventos futuros inciertos. La profesión actuarial es considerada una de las más estables y mejor remuneradas del mundo.', 'Society of Actuaries'),
('seguros', 'Seguros paramétricos', 'Los seguros paramétricos pagan automáticamente al activarse un parámetro predefinido (como un terremoto de 6.5 magnitud), eliminando el proceso de ajuste y acelerando la indemnización.', 'World Bank'),
('seguros', 'Penetración de seguros global', 'La penetración global de seguros promedia el 7% del PIB mundial; los países desarrollados promedian 10%, mientras mercados emergentes como México están por debajo del 3%.', 'Swiss Re Sigma'),
('seguros', 'Microseguros en el mundo', 'Los microseguros diseñados para poblaciones de bajos ingresos protegen hoy a más de 300 millones de personas en países en desarrollo, principalmente en África y Asia.', 'Munich Re Foundation'),
('seguros', 'Coaseguro', 'El coaseguro es la práctica donde múltiples aseguradoras comparten un riesgo de gran volumen. Los proyectos de infraestructura como plantas eléctricas o aeropuertos suelen requerir coaseguro obligatorio.', 'IAIS'),
('seguros', 'Subrogación', 'La subrogación permite a la aseguradora recuperar el dinero pagado en una indemnización demandando al tercero responsable del siniestro, protegiendo así la sustentabilidad del sistema.', 'Chartered Insurance Institute'),
('seguros', 'Pólizas todo riesgo', 'Las pólizas todo riesgo cubren cualquier evento no expresamente excluido, mientras las pólizas de riesgos nombrados solo cubren los riesgos explícitamente listados; la diferencia impacta enormemente en cobertura.', 'AMIS'),
('seguros', 'Seguros de vida universal', 'Los seguros de vida universal —flexibles y con componente de inversión— representan más del 30% de las primas de vida en países como Estados Unidos y Canadá.', 'LIMRA'),
('seguros', 'Reservas técnicas', 'Las aseguradoras están obligadas por ley a mantener reservas técnicas suficientes para pagar todos los siniestros estimados; en México la CNSF supervisa estas reservas trimestralmente.', 'CNSF'),
('seguros', 'Fraude en seguros', 'El fraude en seguros representa entre el 10% y 20% del total de siniestros pagados en muchos mercados, elevando las primas para todos los asegurados en un efecto colectivo.', 'Coalition Against Insurance Fraud'),
('seguros', 'Seguros cibernéticos', 'Los ciberataques costaron globalmente $8 billones en 2023; el mercado de seguros cibernéticos creció 50% ese año, aunque muchas empresas aún no cuentan con cobertura.', 'Cybersecurity Ventures'),
('seguros', 'Seguros de transporte', 'El seguro de carga transportada es obligatorio para exportadores hacia Estados Unidos; protege mercancías por valor de billones de dólares en tránsito aéreo, marítimo y terrestre cada año.', 'ICC'),
('seguros', 'GMM y deducible', 'El deducible en un seguro de Gastos Médicos Mayores es el monto que el asegurado paga antes de que la aseguradora comience a cubrir; a mayor deducible, menor prima anual.', 'AMIS'),
('seguros', 'Exclusiones en pólizas', 'Las exclusiones son cláusulas que delimitan el alcance de un seguro. Conocerlas es tan importante como conocer las coberturas: el 60% de disputas entre aseguradoras y asegurados involucra exclusiones.', 'CONDUSEF'),
('seguros', 'Vigencia y renovación', 'La mayoría de pólizas de daños en México tienen vigencia anual; la renovación oportuna es crítica porque cualquier siniestro ocurrido en periodos sin vigencia no está cubierto.', 'CNSF'),
('seguros', 'Suma asegurada', 'La suma asegurada es el límite máximo de indemnización que pagará la aseguradora; definirla correctamente es clave: una suma insuficiente puede dejar al asegurado con pérdidas parciales no cubiertas.', 'AMIS'),
('seguros', 'Seguro y ahorro forzado', 'Los seguros de vida con ahorro funcionan como un ahorro forzado: el componente de ahorro crece con los años y puede rescatarse parcialmente en emergencias o al final de la vigencia pactada.', 'LIMRA'),

-- MEXICO (25)
('mexico', 'Mercado asegurador mexicano', 'México es uno de los mercados aseguradores más grandes de América Latina con primas totales superiores a los $25 mil millones de dólares anuales, representando cerca del 2.3% del PIB.', 'AMIS'),
('mexico', 'CNSF: el regulador', 'La Comisión Nacional de Seguros y Fianzas (CNSF) supervisa más de 100 aseguradoras y 18 afianzadoras autorizadas en México, velando por su solvencia y cumplimiento normativo.', 'CNSF'),
('mexico', 'Seguro de auto obligatorio', 'Desde 2012, el seguro de responsabilidad civil para autos es obligatorio en México gracias a la Ley de Caminos, Puentes y Autotransporte Federal; sin embargo, el 65% de vehículos circula sin seguro.', 'AMIS'),
('mexico', 'Acceso a seguros en México', 'Solo el 30% de los mexicanos cuenta con algún tipo de seguro de vida; en países de la OCDE este promedio supera el 70%, evidenciando una brecha de protección significativa.', 'OCDE'),
('mexico', 'Desastres naturales en México', 'México es el sexto país más expuesto a desastres naturales en el mundo; los sismos, huracanes e inundaciones generan pérdidas anuales promedio de $3 mil millones de dólares.', 'CENAPRED'),
('mexico', 'Historia del seguro en México', 'La primera aseguradora en México fue La Fraternal, fundada en 1895; desde entonces el sector creció para convertirse en uno de los más dinámicos de América Latina.', 'AMIS'),
('mexico', 'CONDUSEF y protección', 'La CONDUSEF recibe miles de reclamaciones anuales contra aseguradoras y fomenta la educación financiera; el usuario tiene derecho a presentar quejas formales y obtener resolución en 45 días hábiles.', 'CONDUSEF'),
('mexico', 'Penetración de seguros', 'La penetración de seguros en México es del 2.3% del PIB, comparada con el 12% en Estados Unidos y el 4.5% en Brasil, lo que indica un enorme potencial de crecimiento para agentes y aseguradoras.', 'AMIS'),
('mexico', 'Digitalización del sector', 'Entre 2019 y 2023, las contrataciones de seguros por canales digitales en México crecieron un 180%, impulsadas por las insurtech y la pandemia que aceleró la adopción tecnológica.', 'Finnovista'),
('mexico', 'IMSS-Bienestar', 'El IMSS-Bienestar sustituyó al Seguro Popular en 2021, buscando atender a 60 millones de mexicanos sin seguridad social; el sistema complementa —no sustituye— al seguro médico privado.', 'IMSS'),
('mexico', 'Agentes en México', 'México cuenta con más de 120,000 agentes de seguros certificados registrados ante la CNSF; de estos, alrededor del 40% son agentes exclusivos de una sola aseguradora.', 'CNSF'),
('mexico', 'GNP: aseguradora centenaria', 'GNP Seguros, fundada en 1901, es la aseguradora con mayor historia en México y una de las líderes en vida y gastos médicos mayores, con presencia en todos los estados del país.', 'GNP'),
('mexico', 'Seguros y deducción fiscal', 'En México, las primas de seguros de gastos médicos mayores son deducibles de impuestos para personas físicas, representando un incentivo fiscal para su contratación ante el SAT.', 'SAT'),
('mexico', 'Terremoto 1985 y seguros', 'El terremoto de 1985 en la Ciudad de México fue un punto de inflexión; impulsó la modernización regulatoria del sector asegurador y la obligatoriedad del seguro de terremoto en inmuebles comerciales.', 'CENAPRED'),
('mexico', 'Remesas y seguros de vida', 'Millones de familias mexicanas que reciben remesas del extranjero son candidatos ideales para seguros de vida; sin embargo, menos del 10% de este segmento cuenta con protección formal.', 'Banxico'),
('mexico', 'Seguros agrícolas', 'AGROASEMEX es la aseguradora agropecuaria del Estado mexicano; gestiona el programa de subsidios a la prima del seguro agropecuario que beneficia a más de 2 millones de productores.', 'AGROASEMEX'),
('mexico', 'Microseguros en México', 'Los microseguros de vida con primas menores a $50 pesos mensuales han crecido exponencialmente en México, llegando a través de tiendas de conveniencia, bancos y plataformas digitales.', 'AMIS'),
('mexico', 'Ley de Instituciones de Seguros', 'La Ley de Instituciones de Seguros y de Fianzas (LISF) de 2013 modernizó el marco regulatorio mexicano, incorporando principios de Solvencia II europeos para fortalecer la solidez del sector.', 'CNSF'),
('mexico', 'Solvencia II en México', 'México fue el primer país latinoamericano en adoptar los principios de Solvencia II, el estándar internacional más exigente para la gestión de riesgos y capital en aseguradoras.', 'IAIS'),
('mexico', 'Canal bancario', 'La bancaseguros —distribución de seguros a través de bancos— representa el 25% del mercado mexicano, siendo el canal de mayor crecimiento en los últimos 5 años.', 'AMIS'),
('mexico', 'Seguros de caución en México', 'Las fianzas y seguros de caución garantizan el cumplimiento de obligaciones contractuales; son herramienta clave en licitaciones de obra pública en México, donde son requisito legal.', 'CNSF'),
('mexico', 'Inflación médica', 'La inflación médica en México supera consistentemente la inflación general, creciendo al 8-10% anual; este factor eleva las primas de GMM cada año y refuerza la importancia de contratarlos oportunamente.', 'AMIS'),
('mexico', 'Seguros de retiro', 'Los seguros dotales y de retiro en México complementan las AFORE; con rendimientos garantizados y protección de vida, son vehículos populares para planeación del retiro a largo plazo.', 'CONSAR'),
('mexico', 'Sismos y cobertura', 'El seguro de terremoto es un endoso adicional en la mayoría de pólizas de hogar en México; en zonas sísmicas como la CDMX, Guerrero y Oaxaca, su contratación es especialmente recomendable.', 'CENAPRED'),
('mexico', 'Seguros de vida grupales', 'Los seguros de vida colectivos de empresas en México cubren a más de 15 millones de trabajadores del sector formal; son el principal punto de contacto de muchos empleados con el sistema asegurador privado.', 'AMIS'),

-- TECNOLOGIA (20)
('tecnologia', 'Insurtech en el mundo', 'Las insurtech —startups de tecnología aplicada a seguros— recibieron más de $15 mil millones en inversiones globales entre 2020 y 2023, transformando desde la suscripción hasta los siniestros.', 'CB Insights'),
('tecnologia', 'Inteligencia artificial en seguros', 'La inteligencia artificial puede analizar miles de variables en segundos para personalizar primas; en seguros de auto, los modelos de ML reducen la tasa de siniestralidad hasta un 15%.', 'McKinsey'),
('tecnologia', 'Telemática y seguros de auto', 'Los seguros de auto por uso utilizan telemática —GPS y sensores— para calcular primas según el comportamiento real del conductor; conductores seguros pueden pagar hasta 30% menos de prima.', 'Swiss Re'),
('tecnologia', 'Blockchain en seguros', 'Los contratos inteligentes en blockchain automatizan el pago de siniestros paramétricos; un seguro de vuelo con smart contract puede pagar automáticamente si el vuelo se retrasa más de 2 horas.', 'Ethereum Foundation'),
('tecnologia', 'IoT en el hogar asegurado', 'Los sensores IoT en hogares —detectores de humo, fugas de agua, temperatura— permiten a las aseguradoras ofrecer descuentos a quienes mitigan activamente sus riesgos y previenen siniestros.', 'Gartner'),
('tecnologia', 'Big Data y suscripción', 'Las aseguradoras modernas procesan petabytes de datos para suscribir pólizas; fuentes como historial médico, datos satelitales y comportamiento digital refinan los modelos de riesgo con mayor precisión.', 'Accenture'),
('tecnologia', 'Chatbots en seguros', 'Más del 50% de las aseguradoras globales utiliza chatbots de IA para atención al cliente; estos sistemas resuelven el 80% de consultas frecuentes sin intervención humana, reduciendo costos operativos.', 'Deloitte'),
('tecnologia', 'Open Insurance', 'El Open Insurance —inspirado en el Open Banking— permitirá compartir datos de seguros entre instituciones autorizadas con consentimiento del cliente, fomentando competencia y productos personalizados.', 'EIOPA'),
('tecnologia', 'Drones en siniestros', 'Los drones equipados con cámaras 4K y sensores LIDAR inspeccionan siniestros de propiedad con mayor precisión y seguridad que los ajustadores tradicionales, reduciendo el tiempo de liquidación de días a horas.', 'Insurance Innovation Reporter'),
('tecnologia', 'Reconocimiento de imágenes', 'Los modelos de visión por computadora pueden evaluar el daño de un automóvil a partir de fotografías; algunas aseguradoras ya ofrecen indemnización en menos de una hora usando esta tecnología.', 'Tractable'),
('tecnologia', 'Nube en aseguradoras', 'El 70% de las aseguradoras globales ha migrado sus sistemas core a la nube; esto reduce costos operativos hasta un 40% y habilita el lanzamiento de nuevos productos en semanas en lugar de meses.', 'Gartner'),
('tecnologia', 'Wearables y salud', 'Los seguros de vida y salud que integran wearables para monitorear actividad física reportan hasta 20% menos reclamaciones; algunos ofrecen beneficios por mantener hábitos saludables verificables.', 'Munich Re'),
('tecnologia', 'Automatización robótica', 'La Automatización Robótica de Procesos (RPA) en aseguradoras automatiza tareas repetitivas como la emisión de pólizas, reduciendo tiempos de procesamiento de horas a minutos sin errores humanos.', 'EY'),
('tecnologia', 'Modelos de lenguaje en siniestros', 'Los grandes modelos de lenguaje ya leen y clasifican automáticamente reclamaciones de siniestros, extraen información clave y sugieren coberturas aplicables, reduciendo el tiempo de ajuste en 60%.', 'Majesco'),
('tecnologia', 'Firma electrónica en México', 'La firma electrónica avanzada tiene plena validez legal en México desde 2014; habilita la contratación 100% digital de seguros, eliminando la necesidad de documentos físicos y acelerando la emisión.', 'SAT'),
('tecnologia', 'APIs y ecosistemas de seguros', 'Las APIs abiertas permiten a los agentes integrar cotizadores de múltiples aseguradoras en un solo flujo de trabajo; esto reduce el tiempo de comparación de productos de horas a segundos.', 'Accenture'),
('tecnologia', 'Gemelos digitales', 'Los gemelos digitales —réplicas virtuales de edificios o fábricas— permiten simular escenarios de riesgo sin exponer activos reales, revolucionando la suscripción de seguros industriales y catastróficos.', 'Swiss Re'),
('tecnologia', 'Plataformas de gestión para agentes', 'Las plataformas digitales especializadas para agentes de seguros aumentan su productividad hasta 3 veces al centralizar cotización, emisión, cobranza y servicio al cliente en un solo sistema.', 'Celent'),
('tecnologia', 'Procesamiento de lenguaje natural', 'El procesamiento de lenguaje natural (NLP) permite a las aseguradoras analizar automáticamente pólizas complejas de decenas de páginas, identificando brechas de cobertura y oportunidades de mejora.', 'Lemonade'),
('tecnologia', 'Seguridad cibernética en seguros', 'El sector asegurador es uno de los más atacados cibernéticamente por el valor de los datos médicos y financieros que maneja; una brecha de datos puede costar en promedio $7 millones de dólares.', 'IBM Security'),

-- AGENTES (15)
('agentes', 'El agente como asesor', 'Un buen agente de seguros no solo vende pólizas: actúa como asesor de riesgos integrales, ayudando a sus clientes a construir un patrimonio protegido durante toda su vida.', 'LIMRA'),
('agentes', 'Cédula CNSF', 'Para ejercer legalmente en México, todo agente debe contar con una cédula expedida por la CNSF, que requiere aprobar exámenes de conocimientos por cada ramo que desea operar.', 'CNSF'),
('agentes', 'Productividad del agente', 'El agente de seguros promedio en México atiende entre 150 y 300 clientes activos; los agentes de alto rendimiento superan los 500 clientes gracias al uso de herramientas digitales de gestión.', 'AMIS'),
('agentes', 'Retención de clientes', 'Retener a un cliente existente cuesta 5 veces menos que adquirir uno nuevo; los agentes con mayor rentabilidad enfocan el 60% de su tiempo en servicios postventa y renovaciones oportunas.', 'Bain & Company'),
('agentes', 'Referidos como canal principal', 'El 75% de los clientes de seguros contratan a través de recomendación de un familiar o amigo; un agente con excelente servicio puede generar 3 a 5 referidos por cada cliente satisfecho.', 'LIMRA'),
('agentes', 'Educación continua', 'Los agentes de seguros exitosos dedican en promedio 40 horas anuales a capacitación; estar actualizado en productos, regulación y técnicas de ventas es la diferencia entre estancarse y crecer.', 'CNSF'),
('agentes', 'Comisiones por ramo', 'Las comisiones de seguros varían significativamente por ramo: vida individual puede llegar al 30-40% de la prima en el primer año, mientras autos ronda el 10-15% y GMM entre el 15-25%.', 'AMIS'),
('agentes', 'Especialización y rentabilidad', 'Los agentes especializados en un nicho —salud, empresas, agro, marítimo— generan entre 40% y 60% más ingresos que los agentes generalistas, según estudios de productividad sectorial.', 'LIMRA'),
('agentes', 'El perfil del agente exitoso', 'Los rasgos más correlacionados con el éxito en la agencia de seguros son: alta empatía, disciplina en seguimiento, capacidad de escucha activa y habilidad para explicar conceptos complejos con simplicidad.', 'LIMRA'),
('agentes', 'Gamificación en agencias', 'Las agencias que implementan sistemas de gamificación —rankings, metas visuales, reconocimientos— reportan hasta un 25% de incremento en producción entre sus agentes más jóvenes.', 'Salesforce'),
('agentes', 'Bróker vs. agente', 'Un agente representa a una o varias aseguradoras específicas; un bróker actúa en nombre del cliente y puede colocar riesgos en cualquier aseguradora del mercado. Ambas figuras coexisten en México.', 'CNSF'),
('agentes', 'CRM para agentes', 'Los agentes que usan CRM registran hasta 35% más renovaciones que quienes no lo hacen; la gestión estructurada de la relación con el cliente es el activo más valioso de un agente a largo plazo.', 'HubSpot Research'),
('agentes', 'Red de contactos', 'Construir y mantener una red de contactos activa es la estrategia número 1 reportada por agentes con más de 20 años de trayectoria; cada persona en su red es un potencial cliente o referidor.', 'LIMRA'),
('agentes', 'Ventas consultivas', 'La venta consultiva —donde el agente diagnostica antes de proponer— genera un ticket promedio 2.5 veces mayor que la venta transaccional, porque el cliente adquiere coberturas realmente adecuadas.', 'Challenger Sale'),
('agentes', 'Presencia digital del agente', 'Los agentes con sitio web y presencia en redes sociales generan el doble de prospectos que aquellos sin presencia digital; el 70% de los menores de 45 años busca a su agente por internet.', 'Google / LIMRA'),

-- CURIOSIDADES (10)
('curiosidades', 'El seguro más caro del mundo', 'El cuadro Los Nenúfares de Claude Monet está asegurado por más de $1 mil millones de dólares, siendo una de las pólizas de arte más valiosas del mundo en las que ha participado Lloyd of London.', 'AXA Art'),
('curiosidades', 'Seguros de partes del cuerpo', 'Muchas celebridades aseguran partes específicas de su cuerpo: David Beckham sus piernas por $70M, Mariah Carey su voz por $35M, y las manos de pianistas famosos han sido aseguradas por décadas.', 'Insurance Information Institute'),
('curiosidades', 'El seguro del espacio exterior', 'Los satélites se aseguran desde el lanzamiento; si no llegan a la órbita correcta, la póliza paga. SpaceX y otras empresas han hecho del seguro espacial un mercado de miles de millones de dólares.', 'Space Insurance'),
('curiosidades', 'Torneos de golf y el hoyo en uno', 'Muchos organizadores de torneos de golf contratan seguros contra hoyo en uno que pagan premios de autos o viajes; el costo de la póliza es mucho menor que el valor del premio ofrecido.', 'Golf Industry'),
('curiosidades', 'El primer seguro en América Latina', 'La primera aseguradora en América Latina fue fundada en Argentina en 1886; México le siguió en 1895 con La Fraternal, marcando el inicio formal del sector en la región.', 'AMIS'),
('curiosidades', 'Seguro soberano contra huracanes', 'Los países del Caribe crearon en 2007 el Caribbean Catastrophe Risk Insurance Facility (CCRIF), el primer sistema multilateral de seguro contra huracanes y terremotos para gobiernos soberanos.', 'CCRIF'),
('curiosidades', 'El Titanic y los seguros', 'El Titanic estaba asegurado por 1 millón de libras esterlinas; la aseguradora pagó el siniestro y con el tiempo resultó una operación rentable dado el tiempo que llevaba cobrando primas marítimas.', 'Lloyds of London'),
('curiosidades', 'Seguros de lluvia para eventos', 'Los seguros de evento climático protegen contra lluvia, granizo o nieve en fechas específicas; bodas, conciertos y partidos de fútbol en estadios abiertos son clientes frecuentes de este tipo de póliza.', 'Weather Risk Management Association'),
('curiosidades', 'El índice de El Niño', 'El fenómeno El Niño es tan bien modelado por actuarios que existe un mercado de derivados climáticos que permite a empresas cubrirse financieramente contra sus efectos en producción y siniestros.', 'CME Group'),
('curiosidades', 'Seguros y bienestar mental', 'Estudios en 15 países demuestran que las personas aseguradas reportan niveles de ansiedad financiera un 40% menores; la certeza de estar protegido tiene un efecto directo y medible en la salud mental.', 'Swiss Re / WHO');
