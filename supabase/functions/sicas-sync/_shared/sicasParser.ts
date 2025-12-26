interface ParsedRecord {
  id_sicas: string;
  nombre: string;
  raw: any;
  metadata?: any;
}

interface ParseResult {
  success: boolean;
  records: ParsedRecord[];
  stats: {
    totalRows: number;
    successfullyParsed: number;
    failed: number;
  };
  errors: string[];
}

export function parseSicasResponse(data: any, catalogName: string): ParseResult {
  const result: ParseResult = {
    success: false,
    records: [],
    stats: { totalRows: 0, successfullyParsed: 0, failed: 0 },
    errors: [],
  };

  try {
    console.log('[SICAS Parser] Tipo de data recibida:', typeof data);
    console.log('[SICAS Parser] Es array:', Array.isArray(data));

    if (typeof data === 'string') {
      console.log('[SICAS Parser] Preview del string (primeros 500 chars):', data.substring(0, 500));
    }

    if (Array.isArray(data)) {
      console.log('[SICAS Parser] ✅ Detectado: Array JSON');
      return parseJsonArray(data, catalogName);
    }

    if (typeof data === 'object' && data !== null) {
      console.log('[SICAS Parser] ✅ Detectado: Objeto JSON');
      console.log('[SICAS Parser] Keys del objeto:', Object.keys(data));

      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
          console.log(`[SICAS Parser] Encontrado array en key: ${key}`);
          return parseJsonArray(data[key], catalogName);
        }
      }

      console.log('[SICAS Parser] Objeto no contiene arrays, parseando como registro único');
      return parseSingleObject(data, catalogName);
    }

    if (typeof data === 'string' && data.trim().startsWith('<')) {
      console.log('[SICAS Parser] ✅ Detectado: XML string');
      return parseXmlString(data, catalogName);
    }

    if (typeof data === 'string') {
      console.log('[SICAS Parser] ✅ Detectado: String de texto');
      return parseTextLines(data, catalogName);
    }

    throw new Error(`Formato de datos no soportado: ${typeof data}`);
  } catch (error) {
    console.error('[SICAS Parser] ❌ Error general:', error.message);
    result.errors.push(`Error general de parseo: ${error.message}`);
  }

  return result;
}

function parseJsonArray(arr: any[], catalogName: string): ParseResult {
  const result: ParseResult = {
    success: true,
    records: [],
    stats: { totalRows: arr.length, successfullyParsed: 0, failed: 0 },
    errors: [],
  };

  console.log(`[SICAS Parser] Parseando ${arr.length} registros de array JSON...`);

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
      console.error(`[SICAS Parser] Error parseando registro ${i}:`, error.message);
      result.errors.push(`Registro ${i}: ${error.message}`);
      result.stats.failed++;
    }
  }

  console.log(`[SICAS Parser] ✅ Array JSON parseado: ${result.stats.successfullyParsed}/${result.stats.totalRows}`);
  return result;
}

function parseSingleObject(obj: any, catalogName: string): ParseResult {
  const result: ParseResult = {
    success: true,
    records: [],
    stats: { totalRows: 1, successfullyParsed: 0, failed: 0 },
    errors: [],
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

function parseXmlString(xml: string, catalogName: string): ParseResult {
  const result: ParseResult = {
    success: true,
    records: [],
    stats: { totalRows: 0, successfullyParsed: 0, failed: 0 },
    errors: [],
  };

  try {
    console.log('[SICAS Parser] Parseando XML...');

    const tagMatch = xml.match(/<([A-Z_]+)>/i);
    if (!tagMatch) {
      throw new Error('No se encontraron tags XML en el string');
    }

    const recordTag = tagMatch[1];
    console.log(`[SICAS Parser] Tag detectado para registros: ${recordTag}`);

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

    console.log(`[SICAS Parser] ✅ XML parseado: ${result.stats.successfullyParsed}/${result.stats.totalRows}`);
  } catch (error) {
    result.errors.push(`Error parseando XML: ${error.message}`);
  }

  return result;
}

function parseTextLines(text: string, catalogName: string): ParseResult {
  const result: ParseResult = {
    success: true,
    records: [],
    stats: { totalRows: 0, successfullyParsed: 0, failed: 0 },
    errors: [],
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

    console.log(`[SICAS Parser] ✅ Texto parseado: ${result.stats.successfullyParsed}/${result.stats.totalRows} líneas`);
  } catch (error) {
    result.errors.push(`Error general de parseo: ${error.message}`);
  }

  return result;
}

export function parseSoapResponse(soapXml: string): any {
  try {
    const resultMatch = soapXml.match(/<ReadInfoDataResult[^>]*>(.*?)<\/ReadInfoDataResult>/is);

    if (!resultMatch) {
      const responseTxtMatch = soapXml.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/is);
      if (responseTxtMatch) {
        const responseTxt = responseTxtMatch[1].trim();
        const messageMatch = soapXml.match(/<MESSAGE>(.*?)<\/MESSAGE>/is);
        const responseNbrMatch = soapXml.match(/<RESPONSENBR>(.*?)<\/RESPONSENBR>/is);

        const message = messageMatch ? messageMatch[1].trim() : '';
        const responseNbr = responseNbrMatch ? responseNbrMatch[1].trim() : '';

        console.log('[SICAS Parser] MESSAGE encontrado:', message);
        console.log('[SICAS Parser] RESPONSETXT:', responseTxt);
        console.log('[SICAS Parser] RESPONSENBR:', responseNbr);

        // Verificar si es caso de catálogo no disponible
        const processData = { MESSAGE: message, RESPONSETXT: responseTxt, RESPONSENBR: responseNbr };

        // ❌ CASO FATAL: DENIED (autenticación denegada)
        if (responseTxt.toUpperCase() === 'DENIED') {
          console.error('[SICAS Parser] ❌ Autenticación denegada');
          throw new Error(`SICAS DENIED: ${message || 'Acceso denegado'}`);
        }

        // ✅ CASO ESPECIAL: SUCESS + RESPONSENBR=0 + mensaje de error interno
        // Este es el caso de "catálogo no disponible" y NO debe lanzar error
        console.log('[SICAS Parser] 🔍 Verificando isSicasNotAvailable con:', { message, responseTxt, responseNbr });
        console.log('[SICAS Parser] 🔍 Datos completos del processData:', JSON.stringify(processData, null, 2));
        const isNotAvailable = isSicasNotAvailable(processData);
        console.log('[SICAS Parser] 🔍 isSicasNotAvailable retornó:', isNotAvailable);
        console.log('[SICAS Parser] 🔍 Tipo de isNotAvailable:', typeof isNotAvailable);

        if (isNotAvailable) {
          console.warn('[SICAS Parser] ⚠️ Catálogo no disponible (capturado desde SOAP sin ReadInfoDataResult)');
          return {
            __empty_catalog: true,
            message: message || 'Catálogo no disponible',
            responseTxt,
            responseNbr,
            status: 'not_available',
          };
        }

        // Si hay un error real que no es not_available, lanzar
        console.error('[SICAS Parser] ❌ Error SOAP real (isSicasNotAvailable retornó false)');
        console.error('[SICAS Parser] ❌ Error detectado en MESSAGE:', message);
        throw new Error(`SICAS: ${message || responseTxt}`);
      }

      const errorMatch = soapXml.match(/<ERROR>(.*?)<\/ERROR>/is);
      if (errorMatch) {
        console.error('[SICAS Parser] ERROR tag encontrado:', errorMatch[1]);
        throw new Error(`SICAS Error: ${errorMatch[1]}`);
      }

      const faultMatch = soapXml.match(/<faultstring>(.*?)<\/faultstring>/is);
      if (faultMatch) {
        console.error('[SICAS Parser] SOAP Fault:', faultMatch[1]);
        throw new Error(`SOAP Fault: ${faultMatch[1]}`);
      }

      console.error('[SICAS Parser] XML recibido (primeros 1000 chars):', soapXml.substring(0, 1000));
      throw new Error('No se encontró ReadInfoDataResult en la respuesta SOAP. Verificar credenciales y permisos en SICAS.');
    }

    let dataResult = resultMatch[1];
    console.log('[SICAS Parser] ReadInfoDataResult extraído (primeros 500 chars):', dataResult.substring(0, 500));

    dataResult = dataResult
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');

    console.log('[SICAS Parser] Después de decode - contenido completo:', dataResult);

    // Buscar PROCESSDATA dentro del ReadInfoDataResult decodificado
    const decodedMessageMatch = dataResult.match(/<MESSAGE>(.*?)<\/MESSAGE>/is);
    const decodedResponseTxtMatch = dataResult.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/is);
    const decodedResponseNbrMatch = dataResult.match(/<RESPONSENBR>(.*?)<\/RESPONSENBR>/is);

    console.log('[SICAS Parser] 🔍 Regex results:', {
      hasMessage: !!decodedMessageMatch,
      hasResponseTxt: !!decodedResponseTxtMatch,
      hasResponseNbr: !!decodedResponseNbrMatch,
      messageValue: decodedMessageMatch ? decodedMessageMatch[1] : null,
      responseTxtValue: decodedResponseTxtMatch ? decodedResponseTxtMatch[1] : null,
      responseNbrValue: decodedResponseNbrMatch ? decodedResponseNbrMatch[1] : null,
    });

    if (decodedMessageMatch || decodedResponseTxtMatch) {
      const message = decodedMessageMatch ? decodedMessageMatch[1].trim() : '';
      const responseTxt = decodedResponseTxtMatch ? decodedResponseTxtMatch[1].trim() : '';
      const responseNbr = decodedResponseNbrMatch ? decodedResponseNbrMatch[1].trim() : '';

      console.log('[SICAS Parser] PROCESSDATA detectado:');
      console.log('  - MESSAGE:', message);
      console.log('  - RESPONSETXT:', responseTxt);
      console.log('  - RESPONSENBR:', responseNbr);

      // Simular objeto PROCESSDATA para el helper
      const processData = {
        MESSAGE: message,
        RESPONSETXT: responseTxt,
        RESPONSENBR: responseNbr,
      };

      // ❌ CASO FATAL: DENIED (autenticación denegada)
      if (responseTxt.toUpperCase() === 'DENIED') {
        console.error('[SICAS Parser] ❌ Autenticación denegada');
        throw new Error(`SICAS DENIED: ${message || 'Acceso denegado'}`);
      }

      // ✅ CASO ESPECIAL: SUCESS + RESPONSENBR=0 + mensaje de error interno
      // Este es el caso de "catálogo no disponible" y NO debe lanzar error
      console.log('[SICAS Parser] 🔍 Verificando isSicasNotAvailable (PROCESSDATA) con:', { message, responseTxt, responseNbr });
      console.log('[SICAS Parser] 🔍 Datos completos del processData (PROCESSDATA):', JSON.stringify(processData, null, 2));
      const isNotAvailable = isSicasNotAvailable(processData);
      console.log('[SICAS Parser] 🔍 isSicasNotAvailable retornó:', isNotAvailable);
      console.log('[SICAS Parser] 🔍 Tipo de isNotAvailable:', typeof isNotAvailable);

      if (isNotAvailable) {
        console.warn('[SICAS Parser] ⚠️ Catálogo no disponible (capturado desde PROCESSDATA)');
        console.warn('[SICAS Parser] MESSAGE:', message);
        console.warn('[SICAS Parser] RESPONSENBR:', responseNbr);
        return {
          __empty_catalog: true,
          message: message || 'Catálogo no disponible',
          responseTxt,
          responseNbr,
          status: 'not_available',
        };
      }

      // ⚠️ Si llegamos aquí y hay un MESSAGE con "error", solo loguear como advertencia
      // NO lanzar error porque podría ser solo información del proceso
      if (message) {
        console.warn('[SICAS Parser] ⚠️ MESSAGE presente pero no es catálogo no disponible:', message);
        console.warn('[SICAS Parser] ⚠️ Continuando con el parseo del catálogo...');
      }
    }

    try {
      const parsed = JSON.parse(dataResult);
      console.log('[SICAS Parser] ✅ JSON parseado exitosamente');
      return parsed;
    } catch (jsonError) {
      console.warn('[SICAS Parser] ⚠️ No es JSON válido, parseando como XML');
      console.warn('[SICAS Parser] Error JSON:', jsonError.message);
      return dataResult;
    }
  } catch (error) {
    console.error('[SICAS Parser] ❌ Error fatal:', error.message);
    throw new Error(`Error parseando respuesta SOAP: ${error.message}`);
  }
}

/**
 * Helper para detectar si SICAS indica catálogo no disponible
 */
function isSicasNotAvailable(processData: any): boolean {
  console.log('[isSicasNotAvailable] 🎯 INICIO - Función llamada con:', processData);

  const txt = String(processData?.RESPONSETXT ?? '').toUpperCase().trim();
  const nbr = String(processData?.RESPONSENBR ?? '').trim();
  const msg = String(processData?.MESSAGE ?? '').trim();

  console.log('[isSicasNotAvailable] 🎯 Valores extraídos:', { txt, nbr, msgLength: msg.length });

  // Detectar mensaje de error interno de SICAS
  // Estos mensajes indican que el servicio no está disponible temporalmente
  const hasErrorEjecucion = /Error en Ejecuci[oó]n/i.test(msg);
  const hasProcesoInterno = /Proceso Interno/i.test(msg);
  const hasSicasOnline = /SICASOnline/i.test(msg);
  const hasWS = /\bWS\b/i.test(msg);

  const internalError = hasErrorEjecucion && (hasProcesoInterno || hasSicasOnline || hasWS);

  console.log('[isSicasNotAvailable] 🎯 Tests de regex:', {
    txt,
    nbr,
    msgPreview: msg.substring(0, 100),
    hasErrorEjecucion,
    hasProcesoInterno,
    hasSicasOnline,
    hasWS,
    internalError,
  });

  console.log('[isSicasNotAvailable] 🎯 RESULTADO FINAL:', internalError);

  return internalError;
}

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