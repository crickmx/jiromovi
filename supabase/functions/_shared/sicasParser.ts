/**
 * SICAS Universal Parser
 *
 * Parser 100% dinámico para cualquier catálogo SICAS
 * NUNCA asume estructuras fijas
 */

export interface ParsedSicasRecord {
  id_sicas: string;
  nombre: string;
  raw: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SicasParseResult {
  success: boolean;
  records: ParsedSicasRecord[];
  errors: string[];
  stats: {
    totalRows: number;
    successfullyParsed: number;
    failed: number;
  };
}

/**
 * Detecta automáticamente el campo ID en un registro
 *
 * Prioridad:
 * 1. ID<Entidad> (ej: IDDespacho, IDVendedor)
 * 2. Id<Entidad> (ej: IdDespacho, IdVendedor)
 * 3. Cualquier campo que contenga 'id' o 'ID'
 * 4. Primer campo numérico o string numérico
 */
function detectIdField(record: Record<string, any>): string | null {
  const keys = Object.keys(record);

  // Paso 1: Buscar ID<Entidad> o Id<Entidad>
  for (const key of keys) {
    if (key.match(/^ID[A-Z]/)) {
      return String(record[key]);
    }
  }

  for (const key of keys) {
    if (key.match(/^Id[A-Z]/)) {
      return String(record[key]);
    }
  }

  // Paso 2: Buscar cualquier campo con 'id' (case insensitive)
  for (const key of keys) {
    if (key.toLowerCase().includes('id')) {
      return String(record[key]);
    }
  }

  // Paso 3: Buscar primer campo numérico
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '')) {
      return String(value);
    }
  }

  // Paso 4: Usar primer campo como fallback
  if (keys.length > 0) {
    return String(record[keys[0]]);
  }

  return null;
}

/**
 * Detecta automáticamente el campo Nombre en un registro
 *
 * Prioridad:
 * 1. Campo 'Nombre' exacto
 * 2. Campo que contenga 'Nombre'
 * 3. Campo 'Descripcion' o que contenga 'Desc'
 * 4. Campo que contenga el nombre de la entidad (Despacho, Vendedor, etc)
 * 5. Primer campo string no vacío que no sea ID
 */
function detectNameField(record: Record<string, any>, entityHint?: string): string | null {
  const keys = Object.keys(record);

  // Paso 1: Buscar 'Nombre' exacto
  for (const key of keys) {
    if (key === 'Nombre' || key === 'nombre' || key === 'NOMBRE') {
      return String(record[key]);
    }
  }

  // Paso 2: Buscar campo que contenga 'Nombre'
  for (const key of keys) {
    if (key.toLowerCase().includes('nombre')) {
      return String(record[key]);
    }
  }

  // Paso 3: Buscar 'Descripcion'
  for (const key of keys) {
    if (key.toLowerCase().includes('descrip')) {
      return String(record[key]);
    }
  }

  // Paso 4: Buscar campo que contenga el nombre de la entidad
  if (entityHint) {
    for (const key of keys) {
      if (key.toLowerCase().includes(entityHint.toLowerCase())) {
        return String(record[key]);
      }
    }
  }

  // Paso 5: Buscar primer string no vacío que no sea ID
  for (const key of keys) {
    if (!key.toLowerCase().includes('id')) {
      const value = record[key];
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }
  }

  // Fallback: usar segundo campo si existe
  if (keys.length > 1) {
    return String(record[keys[1]]);
  }

  return 'Sin nombre';
}

/**
 * Extrae metadata adicional del registro (excluyendo id y nombre)
 */
function extractMetadata(record: Record<string, any>, idKey: string, nameKey: string): Record<string, any> {
  const metadata: Record<string, any> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key !== idKey && key !== nameKey) {
      metadata[key] = value;
    }
  }

  return metadata;
}

/**
 * Detecta el formato de respuesta y extrae el array de datos
 * Soporta:
 * - JSON directo: [...]
 * - JSON wrapped: { data: [...], items: [...], etc }
 * - XML en string (lo convierte a JSON si es posible)
 */
function extractDataArray(responseData: any): any[] | null {
  // Si ya es un array, retornarlo
  if (Array.isArray(responseData)) {
    return responseData;
  }

  // Si es objeto, buscar el array dentro
  if (typeof responseData === 'object' && responseData !== null) {
    // Intentar claves comunes
    const commonKeys = ['data', 'items', 'records', 'rows', 'results', 'content', 'values'];
    for (const key of commonKeys) {
      if (Array.isArray(responseData[key])) {
        return responseData[key];
      }
    }

    // Buscar el primer array encontrado
    for (const value of Object.values(responseData)) {
      if (Array.isArray(value) && value.length > 0) {
        return value;
      }
    }
  }

  // Si es string, intentar parsear como JSON
  if (typeof responseData === 'string') {
    try {
      const parsed = JSON.parse(responseData);
      return extractDataArray(parsed);
    } catch {
      // No es JSON válido, retornar null
      return null;
    }
  }

  return null;
}

/**
 * Parser universal para cualquier respuesta de SICAS
 *
 * @param rawResponse - Respuesta cruda de SICAS (puede ser JSON, XML en string, etc)
 * @param catalogName - Nombre del catálogo (opcional, ayuda a detectar el campo nombre)
 * @returns Resultado del parseo con registros normalizados
 */
export function parseSicasResponse(
  rawResponse: any,
  catalogName?: string
): SicasParseResult {
  const result: SicasParseResult = {
    success: false,
    records: [],
    errors: [],
    stats: {
      totalRows: 0,
      successfullyParsed: 0,
      failed: 0,
    },
  };

  try {
    // Extraer el array de datos
    const dataArray = extractDataArray(rawResponse);

    if (!dataArray || dataArray.length === 0) {
      result.errors.push('No se encontró un array de datos en la respuesta');
      return result;
    }

    result.stats.totalRows = dataArray.length;

    // Procesar cada registro
    for (let i = 0; i < dataArray.length; i++) {
      const record = dataArray[i];

      try {
        // Detectar ID
        const idSicas = detectIdField(record);
        if (!idSicas) {
          result.errors.push(`Fila ${i + 1}: No se pudo detectar el campo ID`);
          result.stats.failed++;
          continue;
        }

        // Detectar Nombre
        const nombre = detectNameField(record, catalogName);
        if (!nombre) {
          result.errors.push(`Fila ${i + 1}: No se pudo detectar el campo Nombre`);
          result.stats.failed++;
          continue;
        }

        // Extraer metadata
        const metadata = extractMetadata(record, idSicas, nombre);

        // Crear registro parseado
        result.records.push({
          id_sicas: idSicas,
          nombre: nombre,
          raw: record,
          metadata,
        });

        result.stats.successfullyParsed++;
      } catch (error) {
        result.errors.push(`Fila ${i + 1}: ${error.message}`);
        result.stats.failed++;
      }
    }

    result.success = result.stats.successfullyParsed > 0;

  } catch (error) {
    result.errors.push(`Error general de parseo: ${error.message}`);
  }

  return result;
}

/**
 * Parsea respuesta SOAP de SICAS
 * Extrae ReadInfoDataResult y lo decodifica
 */
export function parseSoapResponse(soapXml: string): any {
  try {
    // Intentar extraer ReadInfoDataResult (con o sin atributos)
    const resultMatch = soapXml.match(/<ReadInfoDataResult[^>]*>(.*?)<\/ReadInfoDataResult>/is);

    if (!resultMatch) {
      // Si no encontramos ReadInfoDataResult, buscar si hay un error en RESPONSETXT
      const responseTxtMatch = soapXml.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/is);
      if (responseTxtMatch) {
        const responseTxt = responseTxtMatch[1];
        console.error('[SICAS Parser] RESPONSETXT encontrado:', responseTxt);

        // Buscar el mensaje completo
        const messageMatch = soapXml.match(/<MESSAGE>(.*?)<\/MESSAGE>/is);
        const errorMessage = messageMatch ? messageMatch[1] : responseTxt;

        // Log de más contexto
        console.error('[SICAS Parser] XML completo:', soapXml);

        throw new Error(`SICAS Error: ${errorMessage}`);
      }

      // Buscar si hay un mensaje de error en la respuesta
      const errorMatch = soapXml.match(/<ERROR>(.*?)<\/ERROR>/is);
      if (errorMatch) {
        console.error('[SICAS Parser] ERROR tag encontrado:', errorMatch[1]);
        throw new Error(`SICAS Error: ${errorMatch[1]}`);
      }

      // Buscar faultstring
      const faultMatch = soapXml.match(/<faultstring>(.*?)<\/faultstring>/is);
      if (faultMatch) {
        console.error('[SICAS Parser] SOAP Fault:', faultMatch[1]);
        throw new Error(`SOAP Fault: ${faultMatch[1]}`);
      }

      // Log del XML recibido para debug
      console.error('[SICAS Parser] XML recibido (primeros 1000 chars):', soapXml.substring(0, 1000));
      throw new Error('No se encontró ReadInfoDataResult en la respuesta SOAP. Verificar credenciales y permisos en SICAS.');
    }

    let dataResult = resultMatch[1];
    console.log('[SICAS Parser] ReadInfoDataResult extraído (primeros 500 chars):', dataResult.substring(0, 500));

    // Decode HTML entities
    dataResult = dataResult
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');

    console.log('[SICAS Parser] Después de decode - contenido completo:', dataResult);

    // Verificar si el contenido decodificado tiene un mensaje de error
    const decodedMessageMatch = dataResult.match(/<MESSAGE>(.*?)<\/MESSAGE>/is);
    const decodedResponseTxtMatch = dataResult.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/is);

    if (decodedMessageMatch) {
      const message = decodedMessageMatch[1].trim();
      console.log('[SICAS Parser] MESSAGE encontrado:', message);

      // Si el mensaje contiene "Error" y RESPONSETXT no es SUCCESS (SICAS escribe "SUCESS" a veces)
      if (message.toLowerCase().includes('error')) {
        console.error('[SICAS Parser] ❌ Error detectado en MESSAGE:', message);
        throw new Error(`SICAS: ${message}`);
      }
    }

    // Intentar parsear como JSON
    try {
      const parsed = JSON.parse(dataResult);
      console.log('[SICAS Parser] ✅ JSON parseado exitosamente');
      return parsed;
    } catch (jsonError) {
      console.warn('[SICAS Parser] ⚠️ No es JSON válido, parseando como XML');
      console.warn('[SICAS Parser] Error JSON:', jsonError.message);

      // Si no es JSON, es XML - retornar el string decodificado para que el caller lo procese
      return dataResult;
    }
  } catch (error) {
    console.error('[SICAS Parser] ❌ Error fatal:', error.message);
    throw new Error(`Error parseando respuesta SOAP: ${error.message}`);
  }
}

/**
 * Valida si la respuesta SOAP contiene un error
 */
export function checkSoapError(soapXml: string): { hasError: boolean; errorMessage?: string } {
  // Buscar SOAP Fault
  const faultMatch = soapXml.match(/<faultstring>(.*?)<\/faultstring>/i);
  if (faultMatch) {
    return {
      hasError: true,
      errorMessage: `SOAP Fault: ${faultMatch[1]}`,
    };
  }

  // Buscar RESPONSETXT = DENIED
  const responseTxtMatch = soapXml.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i);
  if (responseTxtMatch && responseTxtMatch[1].toUpperCase() === 'DENIED') {
    return {
      hasError: true,
      errorMessage: 'Autenticación denegada por SICAS',
    };
  }

  // Buscar mensajes de error
  if (soapXml.toLowerCase().includes('error') ||
      soapXml.toLowerCase().includes('invalid')) {
    const errorMatch = soapXml.match(/<MESSAGE>(.*?)<\/MESSAGE>/i);
    if (errorMatch) {
      return {
        hasError: true,
        errorMessage: errorMatch[1],
      };
    }
  }

  return { hasError: false };
}
