# 🎬 Paso a Paso: Migración de Videos a MOVI Digital

## ⚠️ IMPORTANTE: Antes de Empezar

Necesitas obtener tu **SUPABASE_SERVICE_ROLE_KEY** desde el dashboard de Supabase:

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **API**
4. Copia el **service_role key** (NO el anon key)
5. Agrégalo a tu archivo `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
   ```

## 📝 Opción Recomendada: Migración Completa Automática

He preparado todo lo necesario para migrar los 29 videos e imágenes:

### Paso 1: Preparar el Entorno

```bash
# 1. Verifica que Node.js esté instalado
node --version

# 2. Verifica que las variables estén en .env
cat .env | grep SUPABASE
```

Deberías ver:
```
VITE_SUPABASE_URL=https://qhwvuuyjhcennqccgvse.supabase.co
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...  ← NECESITAS AGREGAR ESTO
```

### Paso 2: Ejecutar la Migración

```bash
# Ejecuta el script de migración
node migrate-videos-script.mjs
```

### Paso 3: Monitorear el Progreso

El script mostrará:
- [X/29] Nombre del video
- → Descargando video...
- → Video descargado (XX MB)
- → Subiendo a MOVI...
- ✓ Video subido exitosamente
- ✓ Base de datos actualizada

### Paso 4: Verificar Resultados

Al finalizar verás:
```
✅ Migración completada
   Exitosos: 29
   Errores: 0
```

## 🔍 Verificación Manual

Después de la migración, verifica algunos videos:

1. **En Supabase Dashboard:**
   - Ve a Storage → `seguros-videos` → `academia-negocios-2025`
   - Deberías ver los 29 archivos .mp4
   - Ve a Storage → `seguros-thumbnails` → `academia-negocios-2025`
   - Deberías ver las imágenes .jpg

2. **En la Base de Datos:**
   ```sql
   SELECT
     titulo,
     video_url,
     miniatura_url
   FROM seguros_lessons
   WHERE categoria_id IN (
     SELECT id FROM seguros_categories
     WHERE nombre = 'Academia de Negocios 2025'
   )
   LIMIT 5;
   ```

3. **En la Aplicación:**
   - Ve a "Seguros Education" → "On Demand"
   - Selecciona "Academia de Negocios 2025"
   - Intenta reproducir algunos videos
   - Verifica que las miniaturas se muestren correctamente

## 🐛 Solución de Problemas

### Error: "Cannot read environment variable"

**Problema:** Falta el SUPABASE_SERVICE_ROLE_KEY

**Solución:**
1. Obtén el service_role key desde Supabase Dashboard
2. Agrégalo al archivo `.env`
3. Vuelve a ejecutar el script

### Error: "Failed to download from Google Drive"

**Problema:** Google Drive bloquea la descarga automática

**Solución A - Hacer los archivos públicos:**
1. Ve a Google Drive
2. Para cada archivo, haz clic derecho → "Share"
3. Cambia a "Anyone with the link can view"
4. Vuelve a ejecutar el script

**Solución B - Descarga manual:**
1. Descarga manualmente todos los archivos de Google Drive
2. Organízalos en carpetas:
   ```
   downloads/
     videos/
       archivo1.mp4
       archivo2.mp4
     images/
       imagen1.jpg
       imagen2.jpg
   ```
3. Usa el script alternativo de upload local (ver abajo)

### Error: "Upload failed: 403 Forbidden"

**Problema:** Permisos insuficientes en Supabase Storage

**Solución:**
1. Verifica que estás usando el `service_role` key (NO el anon key)
2. Verifica que los buckets existen:
   - `seguros-videos`
   - `seguros-thumbnails`
3. Verifica que los buckets son públicos

## 🎯 ¿Qué se va a migrar?

### Videos (29 total)
✅ Gestión de Siniestros: Protocolo de Respuesta Inmediata
✅ Secretos del Seguro de Auto MAPFRE
✅ Inversión en Salud: GMM para Jóvenes (AXA)
✅ Cobertura Esencial: Accidentes Personales Colectivos
✅ Libertad Financiera: Tu Plan de Retiro con GNP
✅ Blindaje Legal para Agentes de Seguros
✅ Domina Qualitas: Herramientas y Estrategias
✅ Control Total: Liderazgo Personal y Financiero
✅ JIRO 2025: Metas, Avances y Estrategias de Éxito
✅ Impulsa tu Éxito: Creación de Marca Personal
✅ Salud a la Carta: Protección Médica MAPFRE
✅ QCREA Qualitas: Protegiendo Autos Financiados
✅ UNIKUZ BX+: El GMM que Mereces
✅ El Arte de la Captación: Estrategias de Clientes
✅ Guía Legal Avanzada para Agentes
✅ Qualitas Salud: Maximiza tu Cobertura Médica
✅ Conversión Imparable: Funnel de Ventas Digital
✅ Vende Más: Las Bases de las Ventas Exitosas
✅ Prospección 2.0: Éxito en Redes Sociales
✅ VITALIA: Diseña tu Retiro de Lujo
✅ Lecciones Maestras: Sesión de Cierre con Diana
✅ Fundamentos y Estrategias Iniciales
✅ Dominando GNP Autos: Cierre de Estrategias
✅ Repensando tu Camino: Éxito en la Carrera de Seguros
✅ Supera tus Límites: Rompe el Techo de Cristal
✅ PERSONALIZA GNP: Adaptando tus Gastos Médicos
✅ Bienestar Digital: Manejo de Estrés con Tecnología
✅ CHUBB Auto: Coberturas Premium y Análisis de Tarifa
✅ ADN 2025: Evento Exclusivo de Lanzamiento

### Imágenes (16 disponibles, 13 sin imagen)
📸 16 videos tienen miniatura
❌ 13 videos no tienen miniatura (usarán placeholder)

## ⏱️ Tiempo Estimado

- Descarga de cada video: 30-60 segundos
- Upload a Supabase: 20-40 segundos
- Actualización BD: 1-2 segundos
- **Total estimado: 30-45 minutos**

## ✅ Checklist Final

Antes de considerar la migración completa:

- [ ] Todos los videos se descargaron correctamente
- [ ] Todos los videos se subieron a Supabase Storage
- [ ] Todas las imágenes disponibles se subieron
- [ ] La base de datos se actualizó con las nuevas URLs
- [ ] Los videos se reproducen correctamente en la app
- [ ] Las miniaturas se muestran correctamente
- [ ] NO hay referencias a Google Drive en la BD
- [ ] Los archivos originales están respaldados

## 🚀 ¿Listo para Empezar?

1. Agrega el `SUPABASE_SERVICE_ROLE_KEY` al archivo `.env`
2. Ejecuta: `node migrate-videos-script.mjs`
3. Espera a que termine (30-45 min)
4. Verifica que todo funcione
5. ¡Listo! Tus videos ahora están en MOVI Digital

## 💡 Beneficios de la Migración

- ✅ Control total sobre los archivos
- ✅ No dependes de Google Drive
- ✅ Mejor rendimiento y velocidad de carga
- ✅ URLs permanentes y predecibles
- ✅ Integración nativa con Supabase
- ✅ Sin límites de tráfico de Google Drive
- ✅ Mejor experiencia para los usuarios
