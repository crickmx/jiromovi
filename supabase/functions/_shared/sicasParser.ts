/**
 * Parser universal para respuestas SOAP de SICAS
 * Maneja múltiples formatos: JSON array, JSON object, XML, CSV-like text
 */

interface ParsedRecord {
  id_sicas: string;
  nombre: string;
  raw: any;
  metadata?: any;
}

type ParseResult =
  | {
      kind: 'success';
      success: boolean;
      records: ParsedRecord[];
      stats: {
        totalRows: number;
        successfullyParsed: number;
        failed: number;
      };
      errors: string[];
      warning?: string;
    }
  | {
      kind: 'not_available';
      success: false;
      message: string;
      responseTxt: string;
      responseNbr: string;
      status: 'not_available';
    };

/**
 * Detecta si viene PROCESSDATA indicando catálogo no disponible
 */
function isNotAvailableProcessData(data: any): boolean {
  const processData = data?.NewDataSet?.PROCESSDATA || data?.PROCESSDATA;
  if (!processData) return false;

  const responseTxt = String(processData?.RESPONSETXT ?? '').toUpperCase();
  const responseNbr = String(processData?.RESPONSENBR ?? '').trim();
  const message = String(processData?.MESSAGE ?? '');

  const hasInternalError = /Error en Ejecución|Proceso Interno|SICASOnline/i.test(message);

  return responseTxt === 'SUCESS' && responseNbr === '0' && hasInternalError;
}

/**
 * Parser universal que intenta múltiples estrategias
 */
export function parseSicasResponse(data: any, catalogName: string): ParseResult {
  try {
    // Verificar si viene PROCESSDATA (mensaje de proceso, no catálogo)
    if (isNotAvailableProcessData(data)) {
      const processData = data?.NewDataSet?.PROCESSDATA || data?.PROCESSDATA;
      return {
        kind: 'not_available',
        success: false,
        message: String(processData.MESSAGE ?? 'Catálogo no disponible'),
        responseTxt: String(processData.RESPONSETXT ?? ''),
        responseNbr: String(processData.RESPONSENBR ?? '0'),
        status: 'not_available',
      };
    }

    // Verificar si es un catálogo vacío (formato legacy)
    if (typeof data === 'object' && data !== null && '__empty_catalog' in data) {
      return {
        kind: 'not_available',
        success: false,
        message: data.message || 'Catálogo no disponible en SICAS',
        responseTxt: data.responseTxt || 'SUCESS',
        responseNbr: data.responseNbr || '0',
        status: 'not_available',
      };
    }

    // Estrategia 1: Es un array JSON
    if (Array.isArray(data)) {
      return parseJsonArray(data, catalogName);
    }

    // Estrategia 2: Es un objeto JSON con una propiedad que contiene el array
    if (typeof data === 'object' && data !== null) {
      // Buscar la primera key que sea un array
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
          return parseJsonArray(data[key], catalogName);
        }
      }

      // Si no hay arrays, intentar parsear el objeto como un solo registro
      return parseSingleObject(data, catalogName);
    }

    // Estrategia 3: Es un string XML
    if (typeof data === 'string' && data.trim().startsWith('<')) {
      return parseXmlString(data, catalogName);
    }

    // Estrategia 4: Es un string tipo CSV o texto delimitado
    if (typeof data === 'string') {
      return parseTextLines(data, catalogName);
    }

    throw new Error(`Formato de datos no soportado: ${typeof data}`);
  } catch (error) {
    console.error('[SICAS Parser] Error:', error.message);
    return {
      kind: 'success',
      success: false,
      records: [],
      stats: { totalRows: 0, successfullyParsed: 0, failed: 0 },
      errors: [`Error general de parseo: ${error.message}`],
    };
  }
}

/**
 * Parse array JSON
 */
function parseJsonArray(arr: any[], catalogName: string): ParseResult {
  const result = {
    kind: 'success' as const,
    success: true,
    records: [] as ParsedRecord[],
    stats: { totalRows: arr.length, successfullyParsed: 0, failed: 0 },
    errors: [] as string[],
  };

  for (let i = 0; i < arr.length; i++) {
    try {
      const item = arr[i];
      const id = item.ID || item.Id || item.id || item.CVECAMPO || item.CVE || item.CLAVE || `${i + 1}`;
      const nombre =
        item.NOMBRE ||
        item.Nombre ||
        item.nombre ||
        item.DESCRIPCION ||
        item.Descripcion ||
        item.descripcion ||
        item.DESCAMPO ||
        item.TEXTO ||
        JSON.stringify(item);

      result.records.push({
        id_sicas: String(id),
        nombre: String(nombre),
        raw: item,
        metadata: {
          source: 'json_array',
          originalIndex: i,
        },
      });

      result.stats.successfullyParsed++;
    } catch (error) {
      result.errors.push(`Registro ${i}: ${error.message}`);
      result.stats.failed++;
    }
  }

  return result;
}

/**
 * Parse objeto JSON único
 */
function parseSingleObject(obj: any, catalogName: string): ParseResult {
  const result = {
    kind: 'success' as const,
    success: true,
    records: [] as ParsedRecord[],
    stats: { totalRows: 1, successfullyParsed: 0, failed: 0 },
    errors: [] as string[],
  };

  try {
    const id = obj.ID || obj.Id || obj.id || obj.CVECAMPO || obj.CVE || '1';
    const nombre =
      obj.NOMBRE || obj.Nombre || obj.nombre || obj.DESCRIPCION || obj.Descripcion || JSON.stringify(obj);

    result.records.push({
      id_sicas: String(id),
      nombre: String(nombre),
      raw: obj,
      metadata: {
        source: 'json_object',
      },
    });

    result.stats.successfullyParsed++;
  } catch (error) {
    result.errors.push(`Error parseando objeto: ${error.message}`);
    result.stats.failed++;
  }

  return result;
}

/**
 * Parse XML string
 */
function parseXmlString(xml: string, catalogName: string): ParseResult {
  const result = {
    kind: 'success' as const,
    success: true,
    records: [] as ParsedRecord[],
    stats: { totalRows: 0, successfullyParsed: 0, failed: 0 },
    errors: [] as string[],
  };

  try {
    const tagMatch = xml.match(/<([A-Z_]+)>/i);
    if (!tagMatch) {
      throw new Error('No se encontraron tags XML en el string');
    }

    const recordTag = tagMatch[1];
    const recordRegex = new RegExp(`<${recordTag}>(.*?)</${recordTag}>`, 'gis');
    const matches = Array.from(xml.matchAll(recordRegex));

    result.stats.totalRows = matches.length;

    for (let i = 0; i < matches.length; i++) {
      try {
        const recordXml = matches[i][1];
        const fields: any = {};
        const fieldRegex = /<([A-Z_]+)>(.*?)<\/([A-Z_]+)>/gi;
        let fieldMatch;

        while ((fieldMatch = fieldRegex.exec(recordXml)) !== null) {
          const fieldName = fieldMatch[1];
          const fieldValue = fieldMatch[2];
          fields[fieldName] = fieldValue;
        }

        const id = fields.ID || fields.CVECAMPO || fields.CVE || `${i + 1}`;
        const nombre = fields.NOMBRE || fields.DESCRIPCION || fields.DESCAMPO || JSON.stringify(fields);

        result.records.push({
          id_sicas: String(id),
          nombre: String(nombre),
          raw: fields,
          metadata: {
            source: 'xml',
            recordTag,
          },
        });

        result.stats.successfullyParsed++;
      } catch (error) {
        result.errors.push(`Registro XML ${i}: ${error.message}`);
        result.stats.failed++;
      }
    }
  } catch (error) {
    result.errors.push(`Error parseando XML: ${error.message}`);
  }

  return result;
}

/**
 * Parse texto línea por línea
 */
function parseTextLines(text: string, catalogName: string): ParseResult {
  const result = {
    kind: 'success' as const,
    success: true,
    records: [] as ParsedRecord[],
    stats: { totalRows: 0, successfullyParsed: 0, failed: 0 },
    errors: [] as string[],
  };

  try {
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    result.stats.totalRows = lines.length;

    for (let i = 0; i < lines.length; i++) {
      try {
        const line = lines[i].trim();
        const parts = line.includes('|') ? line.split('|') : line.split(';');
        const id = parts[0]?.trim() || `${i + 1}`;
        const nombre = parts[1]?.trim() || line;

        result.records.push({
          id_sicas: id,
          nombre: nombre,
          raw: { line, parts },
          metadata: {
            source: 'text_line',
            lineNumber: i + 1,
          },
        });

        result.stats.successfullyParsed++;
      } catch (error) {
        result.errors.push(`Línea ${i + 1}: ${error.message}`);
        result.stats.failed++;
      }
    }
  } catch (error) {
    result.errors.push(`Error general de parseo: ${error.message}`);
  }

  return result;
}

/**
 * Helper para detectar si SICAS indica catálogo no disponible
 */
function isSicasNotAvailable(processData: any): boolean {
  const txt = String(processData?.RESPONSETXT ?? '').toUpperCase().trim();
  const nbr = String(processData?.RESPONSENBR ?? '').trim();
  const msg = String(processData?.MESSAGE ?? '').trim();

  const hasErrorEjecucion = /Error en Ejecuci[oó]n/i.test(msg);
  const hasProcesoInterno = /Proceso Interno/i.test(msg);
  const hasSicasOnline = /SICASOnline/i.test(msg);
  const hasWS = /\bWS\b/i.test(msg);

  // LOG COMPLETO cuando detectamos este patrón
  if (txt === 'SUCESS' && nbr === '0' && (hasErrorEjecucion || hasProcesoInterno || hasSicasOnline)) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('[SICAS Parser] CATÁLOGO NO DISPONIBLE DETECTADO');
    console.log('═══════════════════════════════════════════════════════');
    console.log('RESPONSETXT:', txt);
    console.log('RESPONSENBR:', nbr);
    console.log('MESSAGE (COMPLETO):', msg);
    console.log('MESSAGE Length:', msg.length, 'chars');
    console.log('Patrones detectados:', {
      hasErrorEjecucion,
      hasProcesoInterno,
      hasSicasOnline,
      hasWS
    });
    console.log('═══════════════════════════════════════════════════════');
    return true;
  }

  // Caso clásico: mensaje de error con palabras clave
  return hasErrorEjecucion && (hasProcesoInterno || hasSicasOnline || hasWS);
}

/**
 * Parsea respuesta SOAP de SICAS
 * Extrae ReadInfoDataResult y lo decodifica
 */
export function parseSoapResponse(soapXml: string): any {
  try {
    const resultMatch = soapXml.match(/<ReadInfoDataResult[^>]*>(.*?)<\/ReadInfoDataResult>/is);

    if (!resultMatch) {
      const decodedSoapXml = soapXml
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');

      const responseTxtMatch = decodedSoapXml.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/is);
      if (responseTxtMatch) {
        const responseTxt = responseTxtMatch[1].trim();
        const messageMatch = decodedSoapXml.match(/<MESSAGE>(.*?)<\/MESSAGE>/is);
        const responseNbrMatch = decodedSoapXml.match(/<RESPONSENBR>(.*?)<\/RESPONSENBR>/is);

        const message = messageMatch ? messageMatch[1].trim() : '';
        const responseNbr = responseNbrMatch ? responseNbrMatch[1].trim() : '';

        const processData = { MESSAGE: message, RESPONSETXT: responseTxt, RESPONSENBR: responseNbr };

        if (responseTxt.toUpperCase() === 'DENIED') {
          throw new Error(`SICAS DENIED: ${message || 'Acceso denegado'}`);
        }

        if (isSicasNotAvailable(processData)) {
          console.log('[SICAS Parser] Catálogo no disponible');
          return {
            __empty_catalog: true,
            message: message || 'Catálogo no disponible',
            responseTxt,
            responseNbr,
            status: 'not_available',
          };
        }
      }

      const errorMatch = soapXml.match(/<ERROR>(.*?)<\/ERROR>/is);
      if (errorMatch) {
        throw new Error(`SICAS Error: ${errorMatch[1]}`);
      }

      const faultMatch = soapXml.match(/<faultstring>(.*?)<\/faultstring>/is);
      if (faultMatch) {
        throw new Error(`SOAP Fault: ${faultMatch[1]}`);
      }

      throw new Error('No se encontró ReadInfoDataResult en la respuesta SOAP');
    }

    let dataResult = resultMatch[1];

    // Decode HTML entities
    dataResult = dataResult
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');

    const decodedMessageMatch = dataResult.match(/<MESSAGE>(.*?)<\/MESSAGE>/is);
    const decodedResponseTxtMatch = dataResult.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/is);
    const decodedResponseNbrMatch = dataResult.match(/<RESPONSENBR>(.*?)<\/RESPONSENBR>/is);

    if (decodedMessageMatch || decodedResponseTxtMatch) {
      const message = decodedMessageMatch ? decodedMessageMatch[1].trim() : '';
      const responseTxt = decodedResponseTxtMatch ? decodedResponseTxtMatch[1].trim() : '';
      const responseNbr = decodedResponseNbrMatch ? decodedResponseNbrMatch[1].trim() : '';

      const processData = {
        MESSAGE: message,
        RESPONSETXT: responseTxt,
        RESPONSENBR: responseNbr,
      };

      if (responseTxt.toUpperCase() === 'DENIED') {
        throw new Error(`SICAS DENIED: ${message || 'Acceso denegado'}`);
      }

      if (isSicasNotAvailable(processData)) {
        console.log('[SICAS Parser] Catálogo no disponible');
        return {
          __empty_catalog: true,
          message: message || 'Catálogo no disponible',
          responseTxt,
          responseNbr,
          status: 'not_available',
        };
      }

      if (message) {
        console.warn('[SICAS Parser] PROCESSDATA MESSAGE:', message);
      }
    }

    try {
      return JSON.parse(dataResult);
    } catch (jsonError) {
      return dataResult;
    }
  } catch (error) {
    console.error('[SICAS Parser] Error:', error.message);
    throw new Error(`Error parseando respuesta SOAP: ${error.message}`);
  }
}

/**
 * Valida si la respuesta SOAP contiene un error
 */
export function checkSoapError(soapXml: string): { hasError: boolean; errorMessage?: string } {
  const faultMatch = soapXml.match(/<faultstring>(.*?)<\/faultstring>/i);
  if (faultMatch) {
    return {
      hasError: true,
      errorMessage: `SOAP Fault: ${faultMatch[1]}`,
    };
  }

  const responseTxtMatch = soapXml.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i);
  if (responseTxtMatch && responseTxtMatch[1].toUpperCase() === 'DENIED') {
    return {
      hasError: true,
      errorMessage: 'Autenticación denegada por SICAS',
    };
  }

  return { hasError: false };
}
