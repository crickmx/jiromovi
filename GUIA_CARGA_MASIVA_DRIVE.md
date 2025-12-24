# 📦 Guía de Carga Masiva desde Google Drive

Sistema completamente renovado que **NO requiere APIs ni Google Sheets**. Solo necesitas crear un archivo CSV simple.

---

## 🎯 ¿Cómo Funciona?

1. **Creas un CSV simple** con la lista de archivos de Google Drive
2. **Subes el CSV** al bucket de Supabase Storage
3. **Presionas el botón** y el sistema automáticamente descarga y procesa todo

---

## 📝 Paso a Paso

### 1️⃣ Haz tus archivos públicos en Google Drive

Para que el sistema pueda descargar los archivos, deben ser públicos:

1. Selecciona todos los archivos en tu carpeta de Google Drive
2. Clic derecho → **"Compartir"**
3. Cambia a **"Cualquier persona con el enlace"**
4. Selecciona **"Lector"**
5. Guarda los cambios

### 2️⃣ Obtén los IDs de tus archivos

Para cada archivo que quieras subir:

1. Clic derecho en el archivo → **"Obtener enlace"** o **"Compartir"**
2. Copia el enlace. Se verá así:
   ```
   https://drive.google.com/file/d/1ABC123XYZ456-abcdef/view
   ```
3. El **ID del archivo** es la parte entre `/d/` y `/view`:
   ```
   1ABC123XYZ456-abcdef
   ```

### 3️⃣ Crea tu archivo CSV

Abre el generador de CSV en tu navegador:
```
http://localhost:5173/generar-lista-drive.html
```

O créalo manualmente con este formato:
```csv
nombre_archivo.extensión,ID_de_Google_Drive
```

#### Ejemplo completo:

```csv
01-Introduccion-Seguros.mp4,1D064yj7jbC__ZWV5hb1xzvcpFB6mrLXV
01-Introduccion-Seguros.jpg,2E175kz8kcD__aXW6ic2yawdqGC7nsMAW
02-Tipos-De-Polizas.mp4,3F286la9ldE__bYX7jd3zbxerHD8otNBX
02-Tipos-De-Polizas.png,4G397mb0meF__cZY8ke4acyfsSE9puOCY
03-Cobertura-Vida.mp4,5H408nc1nfG__dAZ9lf5bdzhutF0qvPDZ
```

#### Reglas importantes:

✅ **Para emparejar video con miniatura:** Usa el mismo nombre base
```csv
video-clase.mp4,ID_VIDEO
video-clase.jpg,ID_IMAGEN    ← Se emparejará automáticamente
```

✅ **Puedes agregar comentarios:** Líneas que empiecen con `#`
```csv
# Videos del módulo 1
01-intro.mp4,ID_AQUI

# Videos del módulo 2
02-avanzado.mp4,ID_AQUI
```

✅ **Formatos soportados:**
- Videos: `.mp4`, `.mov`, `.avi`, `.webm`, `.mkv`
- Imágenes: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`

❌ **NO emparejarán automáticamente:**
```csv
video-01.mp4,ID_VIDEO
portada-01.jpg,ID_IMAGEN    ← Nombres diferentes
```

### 4️⃣ Guarda el archivo CSV

**Nombre exacto requerido:**
```
lista-archivos-drive.csv
```

### 5️⃣ Sube el CSV a Supabase Storage

1. Ve a tu proyecto de Supabase
2. Abre **Storage** en el menú lateral
3. Selecciona el bucket **`seguros-videos`**
4. Sube tu archivo `lista-archivos-drive.csv`
5. Confirma que se subió correctamente

### 6️⃣ Ejecuta la Carga Masiva

1. Ve a **Seguros Education** → **On Demand** en tu aplicación
2. Presiona el botón **"Carga Masiva Google Drive"**
3. El sistema verificará que exista el CSV
4. Confirma que quieres iniciar el proceso
5. El sistema procesará todo en segundo plano

---

## 🔍 ¿Qué Hace el Sistema?

Una vez que presionas el botón:

1. ✅ Lee el CSV desde Supabase Storage
2. ✅ Empareja videos con sus miniaturas (mismo nombre)
3. ✅ Descarga cada archivo desde Google Drive
4. ✅ Sube los archivos a Supabase Storage
5. ✅ Crea las lecciones en la base de datos
6. ✅ Te envía una notificación cuando termina

---

## 📊 Ejemplo Real

### Tu CSV:
```csv
Modulo-1-Introduccion.mp4,1ABC123
Modulo-1-Introduccion.jpg,2DEF456
Modulo-2-Seguros-Vida.mp4,3GHI789
Modulo-3-Seguros-Auto.mp4,4JKL012
Modulo-3-Seguros-Auto.png,5MNO345
```

### Resultado:
- ✅ **Lección 1:** Video + Miniatura (emparejados)
  - Video: `Modulo-1-Introduccion.mp4`
  - Miniatura: `Modulo-1-Introduccion.jpg`

- ✅ **Lección 2:** Solo Video (sin miniatura)
  - Video: `Modulo-2-Seguros-Vida.mp4`

- ✅ **Lección 3:** Video + Miniatura (emparejados)
  - Video: `Modulo-3-Seguros-Auto.mp4`
  - Miniatura: `Modulo-3-Seguros-Auto.png`

---

## ⚠️ Solución de Problemas

### Error: "No se encontró el archivo lista-archivos-drive.csv"

**Causa:** El archivo no está en Supabase Storage o tiene un nombre diferente

**Solución:**
1. Verifica que subiste el archivo al bucket `seguros-videos`
2. Confirma que el nombre es exactamente: `lista-archivos-drive.csv`
3. Verifica que está en la raíz del bucket (no en una carpeta)

### Error: "No se encontraron archivos válidos en el CSV"

**Causa:** El formato del CSV es incorrecto

**Solución:**
1. Cada línea debe tener: `nombre.ext,ID`
2. No olvides la extensión del archivo (`.mp4`, `.jpg`, etc.)
3. Verifica que no haya espacios extra
4. Usa el generador HTML para evitar errores de formato

### Error: "Error descargando archivo"

**Causa:** El archivo no es público en Google Drive

**Solución:**
1. Abre el archivo en Google Drive
2. Clic derecho → "Compartir"
3. Asegúrate que sea: "Cualquier persona con el enlace"
4. Nivel de acceso: "Lector"

### Los videos y miniaturas no se emparejan

**Causa:** Los nombres no coinciden

**Solución:**
```csv
# ❌ NO empareja (nombres diferentes)
video-01.mp4,ID1
imagen-01.jpg,ID2

# ✅ SÍ empareja (mismo nombre base)
leccion-01.mp4,ID1
leccion-01.jpg,ID2
```

---

## 💡 Consejos y Mejores Prácticas

### 1. Nomenclatura Consistente
```csv
# Buena práctica: numeración con formato
01-Introduccion.mp4,ID1
01-Introduccion.jpg,ID2
02-Desarrollo.mp4,ID3
02-Desarrollo.jpg,ID4

# Evitar: nombres inconsistentes
intro.mp4,ID1
thumbnail_clase_1.jpg,ID2
```

### 2. Organiza con Comentarios
```csv
# === MÓDULO 1: FUNDAMENTOS ===
01-Bienvenida.mp4,ID1
01-Bienvenida.jpg,ID2

# === MÓDULO 2: AVANZADO ===
02-Casos-Reales.mp4,ID3
02-Casos-Reales.jpg,ID4
```

### 3. Verifica antes de subir
- ✅ Todos los IDs son correctos
- ✅ Todos los archivos son públicos
- ✅ No hay líneas duplicadas
- ✅ Los nombres coinciden para emparejar

### 4. Procesa en lotes
Si tienes muchos archivos, divide en varios CSV:
- `lista-lote-1.csv`
- `lista-lote-2.csv`

Renombra a `lista-archivos-drive.csv` y procesa uno a la vez.

---

## 🚀 Ventajas de este Sistema

✅ **Sin APIs:** No necesitas configurar Google Cloud
✅ **Sin Sheets:** No necesitas crear hojas de cálculo
✅ **100% Portable:** Solo un CSV simple
✅ **Fácil de editar:** Puedes usar Excel, VSCode, o Notepad
✅ **Emparejar automático:** Videos y miniaturas se juntan solos
✅ **Proceso en segundo plano:** No tienes que esperar

---

## 📧 ¿Necesitas Ayuda?

Si tienes problemas:

1. Revisa los logs de Supabase Edge Functions
2. Verifica que todos los archivos sean públicos
3. Confirma que el CSV esté bien formado
4. Usa la herramienta `/generar-lista-drive.html` para evitar errores

---

## 🔄 Actualizaciones Futuras

Próximamente:
- [ ] Interfaz UI para subir el CSV desde la app
- [ ] Validación de IDs antes de iniciar
- [ ] Vista previa de archivos a procesar
- [ ] Opción de reanudar si falla a medio camino

---

¡Listo! Ahora tienes un sistema de carga masiva super simple y sin dependencias externas. 🎉
