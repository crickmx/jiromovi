# Guía de Uso Rápida - Módulo GMM BX+

## Flujo Completo de Uso

### 1. Cargar Tarifas (Solo una vez / cuando cambien)

📍 **GMM / Tarifas Admin**

1. Subir archivo Excel de tarifas
2. Esperar confirmación "Tarifas cargadas exitosamente"
3. Verificar que el paquete aparece como "Activo"

---

### 2. Crear Cotización

📍 **GMM / Cotizador**

#### A. Parámetros del Plan
- Estado
- Nivel Hospitalario
- Tabulador
- Suma Asegurada
- Deducible
- Coaseguro
- Tope de Coaseguro (se autocompleta según % coaseguro)
- Forma de Pago

#### B. Asegurados
- Agregar mínimo 1, máximo 8 asegurados
- Para cada uno: Nombre, Edad, Sexo

#### C. Coberturas Opcionales
**Preseleccionadas por default:**
- ✅ Medicamentos Fuera del Hospital
- ✅ Eliminación de Deducible por Accidente
- ✅ Multiregión
- ✅ Beneficio Hospitalario VIP
- ✅ Emergencia Médica en el Extranjero

**Otras disponibles:**
- Reconocimiento de Antigüedad
- Complicaciones No Amparadas
- Padecimientos Preexistentes
- Enfermedades Graves en el Extranjero
- Cobertura Internacional
- Ampliación de Servicios
- Ayuda Diaria
- Indemnización por Enfermedades Graves

#### D. Calcular
1. Clic en **"Calcular"**
2. Revisar resultados:
   - Primas individuales por asegurado
   - Prima neta total
   - Planes de pago disponibles
   - Totales con IVA

#### E. Guardar
1. Clic en **"Guardar Cotización"**
2. La cotización se guarda con folio único
3. Redirección automática a "Mis Cotizaciones"

---

### 3. Gestionar Cotizaciones

📍 **GMM / Mis Cotizaciones**

#### Filtros Disponibles
- 🔍 Búsqueda por folio, cliente o asegurado
- 📅 Forma de pago (Anual, Semestral, Trimestral, Mensual)
- 📊 Estado (Activa, Borrador, Archivada)

#### Acciones por Cotización

**⬇️ Descargar PDF**
- Genera PDF profesional
- Incluye:
  - Datos del plan
  - Asegurados con primas individuales
  - **Coberturas Básicas Incluidas** (hospitalización, honorarios médicos, etc.)
  - **Coberturas Opcionales Contratadas** (con descripciones)
  - **Servicios de Asistencia Incluidos** (orientación telefónica, segunda opinión, etc.)
  - Totales desglosados

**✏️ Editar**
- Abre el cotizador con todos los datos precargados
- Permite modificar cualquier parámetro
- Al guardar: crea NUEVA cotización (no sobrescribe)
- Mantiene referencia visual "Editada desde cotización X"

**🗑️ Eliminar**
- Requiere confirmación
- Soft delete (no destruye datos)
- Solo el creador puede eliminar
- Útil para limpiar cotizaciones de prueba

---

## Casos de Uso Comunes

### Cotización Rápida para Cliente
1. Ir a Cotizador
2. Llenar datos básicos (estado, nivel, etc.)
3. Agregar asegurados (nombre, edad, sexo)
4. Las coberturas recomendadas ya están activas
5. Calcular
6. Guardar
7. Descargar PDF desde "Mis Cotizaciones"
8. Enviar PDF al cliente

### Comparar Diferentes Escenarios
1. Crear cotización base
2. Guardar
3. Ir a "Mis Cotizaciones"
4. Clic en "Editar" sobre la cotización
5. Modificar parámetros (ej: cambiar deducible o coberturas)
6. Calcular
7. Guardar (se crea nueva cotización)
8. Comparar ambas cotizaciones en el listado

### Revisar Cotizaciones Anteriores
1. Ir a "Mis Cotizaciones"
2. Usar filtros o búsqueda
3. Ver detalles en el listado
4. Descargar PDF para reenviar o revisar

---

## Coberturas: ¿Qué Viene Incluido vs Opcional?

### 📋 Coberturas Básicas (SIEMPRE incluidas)
Estas vienen por default en GMM BX+ y NO se pueden desactivar:
- Hospitalización por enfermedad o accidente
- Honorarios médicos
- Medicamentos durante hospitalización
- Estudios de laboratorio y gabinete
- Cirugías y procedimientos quirúrgicos
- Honorarios de anestesiólogo
- Terapias físicas durante hospitalización
- Ambulancia terrestre
- Sala de urgencias

### ➕ Coberturas Opcionales (Seleccionables)
El usuario puede agregar o quitar:
- Medicamentos fuera del hospital ⭐
- Eliminación de deducible por accidente ⭐
- Multiregión ⭐
- Beneficio Hospitalario VIP ⭐
- Emergencia médica en el extranjero ⭐
- Reconocimiento de antigüedad
- Complicaciones no amparadas
- Padecimientos preexistentes
- Enfermedades graves en el extranjero
- Cobertura internacional
- Ampliación de servicios
- Ayuda diaria
- Indemnización por enfermedades graves

⭐ = Preseleccionadas por default (configuración recomendada)

### 🤝 Servicios de Asistencia (SIEMPRE incluidos)
Estos servicios vienen automáticamente:
- Orientación médica telefónica 24/7
- Segunda opinión médica
- Asistencia en traslados médicos
- Coordinación de citas médicas
- Envío de medicamentos a domicilio
- Asistencia en trámites administrativos
- Red de médicos y hospitales preferentes

---

## Solución de Problemas

### Las primas aparecen en $0.00
1. Verifica que hay tarifas activas en "GMM / Tarifas Admin"
2. Abre `/diagnostico-gmm-calculo.html` en tu navegador
3. Ejecuta el diagnóstico
4. Verifica que todos los factores se leen correctamente

### No puedo guardar la cotización
1. Verifica que todos los asegurados tengan nombre y edad
2. Verifica que todos los parámetros del plan estén seleccionados
3. Verifica que hayas calculado la cotización primero

### El PDF no se descarga
1. Verifica que la cotización esté guardada
2. Revisa la consola del navegador (F12) por errores
3. Intenta descargar desde "Mis Cotizaciones"

### No encuentro una cotización
1. Verifica los filtros activos
2. Usa la búsqueda por folio o nombre
3. Verifica que no esté eliminada (soft delete)

---

## Mejores Prácticas

✅ **SÍ:**
- Guardar cotizaciones importantes
- Usar nombres descriptivos para asegurados
- Descargar PDFs antes de enviar al cliente
- Usar "Editar" para crear variaciones de una cotización
- Eliminar cotizaciones de prueba

❌ **NO:**
- Editar y sobrescribir cotizaciones importantes (se crea nueva automáticamente)
- Eliminar cotizaciones que ya enviaste al cliente
- Olvidar calcular antes de guardar

---

**¿Preguntas o problemas?**
Consulta `GMM_MIS_COTIZACIONES_IMPLEMENTADO.md` para documentación técnica completa.
