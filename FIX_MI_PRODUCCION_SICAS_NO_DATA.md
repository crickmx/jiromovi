# Fix: Mi Producción SICAS - Sin Datos de Pólizas

## Problema Identificado

1. **La tabla `sicas_polizas_vigentes` estaba VACÍA** (0 registros)
2. **El reporte H03117 está fallando** en SICAS con error: "Variable de objeto o de bloque With no establecida"
3. Las credenciales estaban correctamente configuradas pero el reporte SOAP no funcionaba

## Solución Implementada

### 1. Nueva Función REST `sync-sicas-polizas-vigentes-rest`

Creada una nueva edge function que usa la **API REST de SICAS** en lugar del servicio SOAP.

**Características:**
- Usa API REST moderna de SICAS (más confiable)
- Intenta automáticamente con múltiples reportes: H05106, H05107, H05105, H03117
- Manejo automático de tokens y renovación
- Sincronización en lotes de 100 registros
- Logging detallado con reporte exitoso

### 2. Botón de Sincronización Manual

- Botón "Sincronizar desde SICAS" (solo visible para administradores)
- Llama a la nueva función REST
- Muestra qué reporte se usó exitosamente
- Recarga datos automáticamente después de sincronizar

## Cómo Usar

1. **Ir a:** "Mi Producción SICAS"
2. **Hacer clic en:** "Sincronizar desde SICAS"
3. **Esperar:** 30-60 segundos
4. **Verificar:** Las pólizas aparecerán automáticamente

## Políticas RLS

- Administradores: Ven TODAS las pólizas de todos los vendedores
- Gerentes: Ven pólizas de su oficina
- Agentes: Ven solo sus pólizas

## Status

Implementado y deployado. Listo para usar.
