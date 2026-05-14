export const FORM_COVERAGES: Record<string, string[]> = {
  hogar_casa_habitacion: [
    'Incendio edificio', 'Incendio contenidos', 'Remocion de escombros', 'Perdidas consecuenciales',
    'Responsabilidad Civil familiar', 'Responsabilidad Civil arrendatario', 'Rotura de cristales',
    'Robo de contenidos', 'Robo fuera del domicilio', 'Dinero y valores', 'Equipo electronico',
    'Asistencia en el hogar', 'Asistencia en viajes', 'Terremoto y/o erupcion volcanica',
    'Fenomenos hidrometeorologicos',
  ],
  casa_con_negocio: [
    'Incendio edificio', 'Incendio contenidos hogar', 'Contenidos comercio',
    'Robo de mercancias', 'Dinero y valores comercio', 'Responsabilidad Civil familiar',
    'Responsabilidad Civil actividades comercio', 'Cristales', 'Equipo electronico hogar',
    'Equipo electronico comercio', 'Utilidades, salarios y gastos fijos', 'Remocion de escombros',
    'Terremoto', 'Fenomenos hidrometeorologicos', 'Servicios de asistencia',
  ],
  pyme_comercio: [
    'Incendio edificio', 'Incendio contenidos', 'Remocion de escombros', 'Perdidas consecuenciales',
    'Utilidades, salarios y gastos fijos', 'Robo de mercancias', 'Dinero y valores',
    'Responsabilidad Civil actividades e inmuebles', 'Responsabilidad Civil productos',
    'Responsabilidad Civil arrendatario', 'RC estacionamiento', 'Equipo electronico',
    'Rotura de maquinaria', 'Calderas', 'Cristales', 'Anuncios luminosos',
    'Terremoto', 'Riesgos hidrometeorologicos',
  ],
  empresa_paquete: [
    'Incendio edificio', 'Incendio contenido', 'Remocion de escombros', 'Perdidas consecuenciales',
    'Responsabilidad Civil actividades e inmuebles', 'RC productos y trabajos terminados',
    'Cristales', 'Anuncios luminosos', 'Robo con violencia y asalto', 'Dinero y valores',
    'Equipo electronico', 'Rotura de maquinaria', 'Calderas y recipientes sujetos a presion',
    'Terremoto', 'Fenomenos hidrometeorologicos',
  ],
  incendio: [
    'Incendio edificio', 'Incendio contenidos', 'Remocion de escombros', 'Extension de cubierta',
    'Endoso inflacionario', 'Riesgos hidrometeorologicos', 'Terremoto y/o erupcion volcanica',
    'Utilidades, salarios y gastos fijos', 'Ganancias brutas', 'Perdidas consecuenciales',
  ],
  gasolinera: [
    'Incendio edificio', 'Bienes a la intemperie', 'Bienes subterraneos',
    'Maquinaria y equipo a la intemperie', 'Contenidos dentro de edificio',
    'Perdidas consecuenciales', 'Robo con violencia', 'Vales de gasolina', 'Dinero y valores',
    'Responsabilidad Civil actividades', 'RC contaminacion', 'Equipo electronico',
    'Rotura de maquinaria', 'Cristales', 'Anuncios luminosos',
  ],
  rc_general: [
    'Responsabilidad Civil actividades e inmuebles', 'Arrendatario',
    'Productos y trabajos terminados', 'Carga y descarga', 'Asumida',
    'Contaminacion', 'Bienes bajo custodia', 'Contratistas', 'Demoliciones sin explosivos',
    'Trabajos de soldadura', 'Cruzada entre contratistas', 'Uso de maquinaria',
    'Hoteleria', 'Estacionamiento', 'Taller mecanico',
  ],
  rc_profesional: [
    'RC profesional general', 'Gastos de defensa', 'Retroactividad', 'Periodo extendido de reporte',
  ],
  rc_agentes_seguros: [
    'RC profesional E&O', 'Gastos de defensa', 'Retroactividad', 'Periodo extendido de reporte',
    'Perdida de documentos', 'Difamacion', 'Infidelidad de empleados',
  ],
  rc_estancias_infantiles: [
    'Responsabilidad Civil actividades', 'Gastos medicos menores', 'Asistencia medica',
    'RC productos alimentos', 'Responsabilidad Civil arrendatario',
  ],
  rc_ambiental: [
    'Responsabilidad Civil contaminacion', 'Gastos de limpieza y remediacion',
    'Danos a terceros en bienes o personas', 'Gastos de defensa', 'Monitoreo ambiental',
  ],
  rc_viajero: [
    'Muerte accidental', 'Invalidez total y permanente', 'Gastos medicos', 'Gastos funerarios',
    'Responsabilidad Civil frente a terceros',
  ],
  transporte_carga: [
    'Riesgos ordinarios de transito', 'Robo de bulto por entero', 'Robo parcial',
    'Mojadura', 'Oxidacion', 'Rotura o rajadura', 'Merma o derrame',
    'Maniobras de carga y descarga', 'Estadia', 'Bodega a bodega',
    'Huelgas y alborotos populares', 'Contacto con otras cargas',
  ],
  aviacion: [
    'Casco (danos al avion)', 'Responsabilidad Civil a terceros en superficie',
    'Responsabilidad Civil a pasajeros', 'RC a equipaje de pasajeros',
    'Gastos medicos tripulacion', 'Guerra y secuestro',
  ],
  buques: [
    'Averia particular', 'Casco', 'Responsabilidad Civil por abordaje',
    'Responsabilidad Civil legal', 'Proteccion e indemnizacion',
    'Huelgas', 'Barateria',
  ],
  todo_riesgo_construccion: [
    'Cobertura basica (danos materiales)', 'Terremoto y/o erupcion volcanica',
    'Ciclon, huracan, vientos e inundacion', 'RC danos a terceros en bienes o personas',
    'RC extracontractual',
  ],
  montaje_maquinaria: [
    'Cobertura A principal', 'Terremoto y/o erupcion volcanica',
    'Ciclon, huracan, vientos e inundacion', 'Danos por errores en diseno',
    'RC danos a bienes de terceros', 'RC danos a terceras personas',
    'Gastos de desmontaje y remocion de escombros',
  ],
  equipo_contratista: [
    'Danos materiales', 'Localizador satelital', 'Huelgas', 'Multiclausula',
    'Robo total', 'Volcadura',
  ],
  rotura_maquinaria: [
    'Explosion fisica', 'Explosion en motores de combustion interna', 'Fuerza centrifuga',
    'Flete aereo', 'Casco para maquinaria movil', 'Inundacion y enfangamiento',
    'Derrame de tanques', 'Bandas y cadenas transportadoras',
  ],
  calderas_presion: [
    'Danos materiales', 'Gastos extraordinarios', 'Contenidos de recipientes', 'Tuberias',
  ],
  equipo_electronico: [
    'Danos materiales', 'Terremoto', 'Inundacion', 'Huelgas y vandalismo',
    'Flete expreso', 'Flete aereo', 'Equipos moviles y portatiles',
    'Climatizacion', 'Portadores externos de datos', 'Incremento en costo de operacion',
  ],
  auto_alta_gama: [
    'Danos materiales', 'Robo total', 'Responsabilidad Civil', 'Gastos medicos ocupantes',
    'Asistencia vial', 'Auto sustituto', 'Defensa legal',
  ],
  gmm_individual: [
    'Hospitalizacion', 'Cirugia', 'Honorarios medicos', 'Medicamentos',
    'Complicaciones de maternidad', 'Padecimientos congenitos', 'Trasplantes',
    'Emergencia en el extranjero', 'Asistencia en el extranjero',
  ],
  accidentes_escolares: [
    'Muerte accidental', 'Perdidas organicas', 'Gastos funerarios',
    'Reembolso de gastos medicos', 'Escala de indemnizacion A', 'Escala de indemnizacion B',
  ],
};
