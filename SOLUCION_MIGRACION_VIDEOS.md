# ✅ Solución: Migración Manual de Videos

## Problema Encontrado

Google Drive bloquea las descargas automáticas por scripts, lo que causa que:
- Los archivos se descarguen con 0 bytes
- Las APIs de Google Drive requieren autenticación OAuth
- Es necesario un proceso manual

## ✅ Solución Implementada

He creado una herramienta web interactiva que te permite subir los archivos manualmente:

### 📍 Ubicación

Abre este archivo en tu navegador:
```
public/migrate-videos-manual.html
```

O accede desde tu servidor de desarrollo:
```
http://localhost:5173/migrate-videos-manual.html
```

## 🎯 Proceso de Migración (Paso a Paso)

### Paso 1: Descargar Archivos de Google Drive

1. Ve a Google Drive y abre cada carpeta de videos
2. Descarga los 29 videos manualmente a tu computadora
3. Descarga las 16 imágenes disponibles
4. Organízalos en una carpeta fácil de encontrar

**Lista de archivos a descargar:**

**Videos (29):**
1. Gestión de Siniestros: Protocolo de Respuesta Inmediata
2. Secretos del Seguro de Auto MAPFRE
3. Inversión en Salud: GMM para Jóvenes (AXA)
4. Cobertura Esencial: Accidentes Personales Colectivos
5. Libertad Financiera: Tu Plan de Retiro con GNP
6. Blindaje Legal para Agentes de Seguros
7. Domina Qualitas: Herramientas y Estrategias
8. Control Total: Liderazgo Personal y Financiero
9. JIRO 2025: Metas, Avances y Estrategias de Éxito
10. Impulsa tu Éxito: Creación de Marca Personal
11. Salud a la Carta: Protección Médica MAPFRE
12. QCREA Qualitas: Protegiendo Autos Financiados
13. UNIKUZ BX+: El GMM que Mereces
14. El Arte de la Captación: Estrategias de Clientes
15. Guía Legal Avanzada para Agentes
16. Qualitas Salud: Maximiza tu Cobertura Médica
17. Conversión Imparable: Funnel de Ventas Digital
18. Vende Más: Las Bases de las Ventas Exitosas
19. Prospección 2.0: Éxito en Redes Sociales
20. VITALIA: Diseña tu Retiro de Lujo
21. Lecciones Maestras: Sesión de Cierre con Diana
22. Fundamentos y Estrategias Iniciales
23. Dominando GNP Autos: Cierre de Estrategias
24. Repensando tu Camino: Éxito en la Carrera de Seguros
25. Supera tus Límites: Rompe el Techo de Cristal
26. PERSONALIZA GNP: Adaptando tus Gastos Médicos
27. Bienestar Digital: Manejo de Estrés con Tecnología
28. CHUBB Auto: Coberturas Premium y Análisis de Tarifa
29. ADN 2025: Evento Exclusivo de Lanzamiento

**Imágenes disponibles (16):**
- Gestión de Siniestros
- Inversión en Salud (AXA)
- Cobertura Esencial
- Libertad Financiera (GNP)
- Blindaje Legal
- Domina Qualitas
- Impulsa tu Éxito
- Salud a la Carta (MAPFRE)
- QCREA Qualitas
- UNIKUZ BX+
- El Arte de la Captación
- Guía Legal Avanzada
- Qualitas Salud
- Conversión Imparable
- Vende Más
- Repensando tu Camino

### Paso 2: Usar la Herramienta de Upload

1. **Abre la herramienta:** `public/migrate-videos-manual.html`

2. **Para cada archivo:**
   - Copia el título EXACTO de la lección (desde la lista en la herramienta)
   - Selecciona el tipo de archivo (Video o Imagen)
   - Haz clic en "Seleccionar Archivo"
   - Elige el archivo desde tu computadora
   - Haz clic en "Subir Archivo a MOVI"

3. **La herramienta automáticamente:**
   - Sube el archivo a Supabase Storage
   - Actualiza la base de datos con la nueva URL
   - Marca el video como "Subido" en la lista

4. **Repite para cada video e imagen**

### Paso 3: Verificar

Después de subir todos los archivos:

1. **Verifica en Supabase Dashboard:**
   - Storage → seguros-videos → academia-negocios-2025
   - Storage → seguros-thumbnails → academia-negocios-2025

2. **Verifica en la aplicación:**
   - Ve a "Seguros Education" → "On Demand"
   - Selecciona "Academia de Negocios 2025"
   - Reproduce algunos videos

## 📊 Progreso de Migración

Usa la herramienta para trackear tu progreso:
- La lista muestra los 29 videos
- Los videos subidos se marcan en verde
- Puedes ver cuántos te faltan

## ⏱️ Tiempo Estimado

- Descargar archivos de Google Drive: 1-2 horas
- Subir cada archivo: 1-3 minutos
- **Total estimado: 2-3 horas**

## 💡 Ventajas de Esta Solución

✅ No depende de APIs de Google Drive
✅ No requiere autenticación OAuth
✅ Control total del proceso
✅ Puedes pausar y continuar cuando quieras
✅ Verificación inmediata de cada upload
✅ Interfaz visual clara del progreso
✅ Actualización automática de la base de datos

## 🔧 Características de la Herramienta

1. **Interfaz Intuitiva:**
   - Diseño moderno y fácil de usar
   - Instrucciones claras en cada paso
   - Progress tracking visual

2. **Validación:**
   - Verifica que el título sea correcto
   - Muestra el tamaño del archivo
   - Confirma cada upload exitoso

3. **Log en Tiempo Real:**
   - Muestra cada paso del proceso
   - Indica errores si ocurren
   - Confirma actualización de BD

4. **Lista de Tracking:**
   - 29 videos listados
   - Marca automáticamente los subidos
   - Fácil identificar lo que falta

## 🎉 Resultado Final

Al terminar tendrás:
- ✅ 29 videos en Supabase Storage
- ✅ 16 imágenes en Supabase Storage
- ✅ Base de datos actualizada con URLs de MOVI
- ✅ Videos reproducibles en la aplicación
- ✅ Control total sobre tus archivos

## 📝 Notas Importantes

1. **Títulos Exactos:** El título debe coincidir EXACTAMENTE con la base de datos
2. **Conexión Estable:** Asegúrate de tener buena conexión a internet
3. **No Cierres la Ventana:** Mientras se sube un archivo
4. **Backup:** Guarda los archivos originales como respaldo

## 🆘 Soporte

Si encuentras problemas:
1. Verifica que el título sea exacto
2. Verifica que el archivo sea .mp4 (video) o .jpg/.png (imagen)
3. Revisa la consola del navegador para más detalles
4. Intenta de nuevo - la herramienta usa `upsert: true`

## ✅ Listo para Empezar

1. Descarga los archivos de Google Drive
2. Abre `public/migrate-videos-manual.html`
3. ¡Empieza a subir!
