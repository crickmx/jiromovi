/*
  # Seguwallet Terms & Conditions v2.0 - May 25, 2026

  Inserts a new published version of Seguwallet's Terms and Conditions.

  ## Changes
  - Inserts version "2.0" with full legal text provided by JIRO Y ASOCIADOS
  - Sets is_active = true immediately (DB trigger deactivates previous version)
  - Sets published_at to now()

  ## Content Summary
  17-section legal document covering:
  1. Identificación del responsable (JIRO Y ASOCIADOS, Marsella 14, CDMX)
  2. Objeto de la plataforma
  3. Aceptación de los términos
  4. Registro de usuario
  5. Documentos y contenido cargado por el usuario
  6. Autorización para consulta y gestión de información
  7. Usos prohibidos
  8. Propiedad intelectual
  9. Disponibilidad del servicio
  10. Limitación de responsabilidad
  11. Notificaciones y comunicaciones
  12. Seguridad de la información
  13. Enlaces a terceros
  14. Modificaciones a los términos
  15. Cancelación de cuenta
  16. Legislación aplicable y jurisdicción
  17. Contacto
*/

INSERT INTO seguwallet_terms (title, version, content, is_active, published_at)
VALUES (
  'Términos y Condiciones de Uso de SEGUWALLET',
  '2.0',
  'TÉRMINOS Y CONDICIONES DE USO DE SEGUWALLET

Última actualización: 25 de mayo de 2026

Bienvenido a SEGUWALLET y SEGUWALLET App.

Los presentes Términos y Condiciones regulan el acceso y uso de la plataforma digital SEGUWALLET, propiedad de JIRO Y ASOCIADOS, por lo que cualquier persona que acceda, navegue, se registre o utilice la plataforma acepta expresamente los presentes términos.

─────────────────────────────────────────

1. IDENTIFICACIÓN DEL RESPONSABLE

SEGUWALLET es una plataforma tecnológica operada por:

JIRO Y ASOCIADOS Agente de Seguros y de Fianzas, S.A. de C.V.
Con domicilio en Marsella 14, Colonia Juárez, Ciudad de México, México.
Correo electrónico de contacto: contacto@jiro.mx
Sitio web: https://jiro.mx

En adelante denominado "SEGUWALLET".

─────────────────────────────────────────

2. OBJETO DE LA PLATAFORMA

SEGUWALLET es una plataforma digital diseñada para facilitar a los usuarios:

• Consulta y administración de pólizas de seguros.
• Resguardo digital de documentos.
• Consulta de información relacionada con seguros.
• Gestión de trámites y solicitudes.
• Acceso a herramientas tecnológicas relacionadas con seguros y servicios financieros.
• Comunicación con agentes, ejecutivos o representantes autorizados.
• Recepción de notificaciones, avisos y comunicaciones relacionadas con pólizas o servicios.

SEGUWALLET no garantiza la emisión automática de pólizas ni sustituye la validación, aceptación o procesos internos de las aseguradoras.

─────────────────────────────────────────

3. ACEPTACIÓN DE LOS TÉRMINOS

Al utilizar SEGUWALLET, el usuario declara:

• Ser mayor de edad y contar con capacidad legal para contratar.
• Haber leído y comprendido los presentes Términos y Condiciones.
• Aceptar plenamente todas las disposiciones aquí contenidas.
• Aceptar el Aviso de Privacidad disponible en: https://jiro.mx/aviso-privacidad

Si el usuario no está de acuerdo con cualquiera de las disposiciones, deberá abstenerse de utilizar la plataforma.

─────────────────────────────────────────

4. REGISTRO DE USUARIO

Para acceder a ciertas funcionalidades, el usuario deberá crear una cuenta proporcionando información verídica, actualizada y completa.

El usuario es responsable de:

• Mantener la confidencialidad de sus credenciales.
• Toda actividad realizada desde su cuenta.
• Notificar inmediatamente cualquier uso no autorizado.

SEGUWALLET podrá suspender o cancelar cuentas que contengan información falsa, fraudulenta o que incumplan estos términos.

─────────────────────────────────────────

5. DOCUMENTOS Y CONTENIDO CARGADO POR EL USUARIO

El usuario podrá cargar documentos, pólizas, identificaciones, comprobantes, imágenes y otros archivos relacionados con servicios de seguros.

Al cargar documentos en SEGUWALLET, el usuario:

• Declara tener derecho legítimo sobre los documentos proporcionados.
• Autoriza a SEGUWALLET a almacenar, procesar, analizar y utilizar dicha información para fines relacionados con:
  - Gestión de pólizas.
  - Cotizaciones.
  - Renovaciones.
  - Trámites.
  - Atención al cliente.
  - Servicios administrativos.
  - Servicios tecnológicos relacionados con seguros.
  - Generación de reportes y estadísticas internas.
  - Publicidad personalizada y campañas comerciales relacionadas con seguros y servicios financieros.

El usuario conserva la propiedad de sus documentos y datos.

─────────────────────────────────────────

6. AUTORIZACIÓN PARA CONSULTA Y GESTIÓN DE INFORMACIÓN

El usuario autoriza expresamente a SEGUWALLET y a JIRO Y ASOCIADOS a:

• Consultar información relacionada con pólizas y trámites.
• Gestionar procesos administrativos con aseguradoras.
• Utilizar la información proporcionada para prestar servicios solicitados por el usuario.
• Compartir información con aseguradoras, proveedores tecnológicos y terceros relacionados estrictamente con la prestación de servicios.

Lo anterior se realizará conforme al Aviso de Privacidad aplicable.

─────────────────────────────────────────

7. USOS PROHIBIDOS

Queda estrictamente prohibido:

• Utilizar SEGUWALLET para actividades ilícitas.
• Suplantar identidad.
• Compartir credenciales de acceso.
• Intentar vulnerar la seguridad de la plataforma.
• Cargar contenido falso, fraudulento, ofensivo o ilegal.
• Realizar ingeniería inversa o intentar copiar la plataforma.
• Introducir virus, malware o código malicioso.

SEGUWALLET podrá suspender o cancelar cuentas sin previo aviso en caso de detectar actividades indebidas.

─────────────────────────────────────────

8. PROPIEDAD INTELECTUAL

Todos los elementos de SEGUWALLET, incluyendo:

• Diseño.
• Software.
• Código.
• Interfaces.
• Logotipos.
• Marcas.
• Contenido gráfico.
• Textos.
• Funcionalidades.

son propiedad de JIRO Y ASOCIADOS o de sus respectivos titulares y se encuentran protegidos por las leyes aplicables de propiedad intelectual.

Queda prohibida su reproducción total o parcial sin autorización expresa por escrito.

─────────────────────────────────────────

9. DISPONIBILIDAD DEL SERVICIO

SEGUWALLET buscará mantener la plataforma disponible de forma continua; sin embargo, no garantiza que el servicio opere sin interrupciones o errores.

SEGUWALLET podrá:

• Modificar funcionalidades.
• Actualizar servicios.
• Suspender temporalmente la plataforma por mantenimiento.
• Limitar funcionalidades.
• Eliminar servicios.

sin necesidad de previo aviso.

─────────────────────────────────────────

10. LIMITACIÓN DE RESPONSABILIDAD

SEGUWALLET no será responsable por:

• Fallas de terceros.
• Interrupciones de internet.
• Errores atribuibles a aseguradoras.
• Pérdida indirecta de información.
• Daños derivados del uso indebido de la plataforma.
• Decisiones tomadas con base en información mostrada en la plataforma.

La información presentada puede depender de terceros, aseguradoras o integraciones externas.

─────────────────────────────────────────

11. NOTIFICACIONES Y COMUNICACIONES

El usuario acepta recibir comunicaciones por:

• Correo electrónico.
• WhatsApp.
• Notificaciones push.
• SMS.
• Medios electrónicos disponibles.

relacionadas con:

• Pólizas.
• Renovaciones.
• Cobranza.
• Trámites.
• Recordatorios.
• Actualizaciones.
• Publicidad y promociones relacionadas con seguros y servicios financieros.

El usuario podrá solicitar la limitación de ciertas comunicaciones promocionales.

─────────────────────────────────────────

12. SEGURIDAD DE LA INFORMACIÓN

SEGUWALLET implementa medidas razonables de seguridad tecnológica y administrativa para proteger la información de los usuarios.

No obstante, el usuario reconoce que ningún sistema es completamente invulnerable.

─────────────────────────────────────────

13. ENLACES A TERCEROS

La plataforma puede contener enlaces o integraciones con servicios de terceros.

SEGUWALLET no es responsable del contenido, políticas o funcionamiento de dichos terceros.

─────────────────────────────────────────

14. MODIFICACIONES A LOS TÉRMINOS

SEGUWALLET podrá modificar los presentes Términos y Condiciones en cualquier momento.

Las modificaciones entrarán en vigor una vez publicadas en la plataforma.

El uso continuo de la plataforma implicará la aceptación de las modificaciones.

─────────────────────────────────────────

15. CANCELACIÓN DE CUENTA

El usuario podrá solicitar la cancelación de su cuenta enviando un correo a:

contacto@jiro.mx

SEGUWALLET podrá conservar cierta información conforme a obligaciones legales, regulatorias o contractuales aplicables.

─────────────────────────────────────────

16. LEGISLACIÓN APLICABLE Y JURISDICCIÓN

Los presentes Términos y Condiciones se regirán por las leyes aplicables en los Estados Unidos Mexicanos.

Cualquier controversia será sometida a los tribunales competentes de la Ciudad de México, renunciando las partes a cualquier otro fuero que pudiera corresponderles.

─────────────────────────────────────────

17. CONTACTO

Para cualquier duda relacionada con SEGUWALLET o los presentes Términos y Condiciones, el usuario podrá contactar a:

Correo electrónico: contacto@jiro.mx

Sitios oficiales:
• https://seguwallet.mx
• https://app.seguwallet.mx
• https://jiro.mx',
  true,
  now()
);
