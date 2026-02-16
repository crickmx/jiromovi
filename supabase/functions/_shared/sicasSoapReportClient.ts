/**
 * SICAS SOAP Report Client - ProcesarWS
 *
 * Cliente para consumir reportes SICAS con filtros avanzados usando el método ProcesarWS.
 *
 * Diferencias con ReadInfoData:
 * - ReadInfoData: Catálogos simples sin filtros
 * - ProcesarWS: Reportes complejos con filtros, paginación y ordenamiento
 *
 * Basado en ejemplos oficiales de SICAS proporcionados en:
 * - WS__Consultar_todas_las_polizas_con_FILTROS_PRIV.pdf
 * - WS_Consulta_Cobranza_con_Filtro_Avanzado_PRIV.pdf
 * - WS_Consulta_de_Renovaciones_PRIV.pdf
 */

export interface FilterCondition {
  name: string;
  type: 0 | 1 | 2 | 3;
  subtype: number;
  values: string[];
  texts: string[];
  flag1: number;
  flag2?: number;
  fieldDb: string;
}

export interface SicasReportOptions {
  keyCode: string;
  page?: number;
  itemsPerPage?: number;
  sortField?: string;
  filters?: FilterCondition[];
  typeFormat?: 'XML' | 'JSON';
}

export interface SicasReportResponse {
  success: boolean;
  responseNbr: string;
  message: string;
  records: any[];
  totalRecords?: number;
  rawXml?: string;
}

export class SicasSoapReportClient {
  private endpoint: string;
  private username: string;
  private password: string;

  constructor(config: {
    endpoint: string;
    username: string;
    password: string;
  }) {
    this.endpoint = config.endpoint;
    this.username = config.username;
    this.password = config.password;
  }

  /**
   * Construye el string ConditionsAdd a partir de un array de filtros
   */
  private buildConditionsAdd(filters: FilterCondition[]): string {
    if (!filters || filters.length === 0) {
      return '';
    }

    return filters.map(f => {
      const valuesStr = f.values.join('|');
      const textsStr = f.texts.join('|');
      const flag2Str = f.flag2 !== undefined ? `;${f.flag2}` : '';

      return `${f.name};${f.type};${f.subtype};${valuesStr};${textsStr};${f.flag1}${flag2Str};${f.fieldDb}`;
    }).join('!');
  }

  /**
   * URL encode password (espacios como %20)
   */
  private encodePassword(password: string): string {
    return password.replace(/ /g, '%20');
  }

  /**
   * Construye el SOAP envelope para ProcesarWS
   */
  private buildSoapEnvelope(options: SicasReportOptions): string {
    const {
      keyCode,
      page = 1,
      itemsPerPage = -1,
      sortField = '',
      filters = [],
      typeFormat = 'XML'
    } = options;

    const conditionsAdd = this.buildConditionsAdd(filters);
    const encodedPassword = this.encodePassword(this.password);

    const sortFieldXml = sortField ? `<tem:InfoSort>${sortField}</tem:InfoSort>` : '';
    const conditionsXml = conditionsAdd ? `<tem:ConditionsAdd>${conditionsAdd}</tem:ConditionsAdd>` : '';

    return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:ProcesarWS>
      <tem:oDataWS>
        <tem:Credentials>
          <tem:UserName>${this.username}</tem:UserName>
          <tem:Password>${encodedPassword}</tem:Password>
        </tem:Credentials>
        <tem:TypeFormat>${typeFormat}</tem:TypeFormat>
        <tem:KeyProcess>REPORT</tem:KeyProcess>
        <tem:KeyCode>${keyCode}</tem:KeyCode>
        <tem:Page>${page}</tem:Page>
        <tem:ItemForPage>${itemsPerPage}</tem:ItemForPage>
        ${sortFieldXml}
        ${conditionsXml}
      </tem:oDataWS>
    </tem:ProcesarWS>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  /**
   * Ejecuta un reporte SICAS con filtros
   */
  async executeReport(options: SicasReportOptions): Promise<SicasReportResponse> {
    const soapEnvelope = this.buildSoapEnvelope(options);

    console.log('========================================');
    console.log('[SICAS SOAP] 🔵 INICIANDO REQUEST');
    console.log('========================================');
    console.log('[SICAS SOAP] KeyCode:', options.keyCode);
    console.log('[SICAS SOAP] Page:', options.page || 1);
    console.log('[SICAS SOAP] ItemsPerPage:', options.itemsPerPage || -1);
    console.log('[SICAS SOAP] SortField:', options.sortField || '(ninguno)');
    console.log('[SICAS SOAP] Filtros aplicados:', options.filters?.length || 0);

    if (options.filters && options.filters.length > 0) {
      console.log('[SICAS SOAP] 📋 DETALLE DE FILTROS:');
      options.filters.forEach((f, idx) => {
        console.log(`  Filtro ${idx + 1}: ${f.name}`);
        console.log(`    - Type: ${f.type}, Subtype: ${f.subtype}`);
        console.log(`    - Values: ${f.values.join(', ')}`);
        console.log(`    - Texts: ${f.texts.join(', ')}`);
        console.log(`    - FieldDb: ${f.fieldDb}`);
      });
    }

    // Log del request SOAP (sin password)
    const requestForLog = soapEnvelope.replace(/<tem:Password>.*?<\/tem:Password>/, '<tem:Password>***HIDDEN***</tem:Password>');
    console.log('[SICAS SOAP] 📤 REQUEST XML:');
    console.log(requestForLog);

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/ProcesarWS',
      },
      body: soapEnvelope,
    });

    console.log('[SICAS SOAP] 📥 HTTP Response Status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    console.log('[SICAS SOAP] 📥 Response Length:', responseText.length, 'bytes');
    console.log('[SICAS SOAP] 📥 Response Preview (primeros 1000 chars):');
    console.log(responseText.substring(0, 1000));

    // Parse SOAP response
    return this.parseSoapResponse(responseText);
  }

  /**
   * Parsea la respuesta SOAP de ProcesarWS
   */
  private parseSoapResponse(responseText: string): SicasReportResponse {
    // Decodificar XML escapado
    const decoded = responseText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    console.log('[SICAS SOAP] Respuesta decodificada (primeros 500 chars):', decoded.substring(0, 500));

    // Extraer ProcesarWSResult (estructura alternativa)
    const resultMatch = decoded.match(/<ProcesarWSResult>([\s\S]*?)<\/ProcesarWSResult>/i);
    if (resultMatch) {
      console.log('[SICAS SOAP] Encontrado ProcesarWSResult');
      const resultContent = resultMatch[1];

      // Intentar parsear como PROCESSDATA
      const processDataMatch = resultContent.match(/<PROCESSDATA>([\s\S]*?)<\/PROCESSDATA>/i);
      if (processDataMatch) {
        console.log('[SICAS SOAP] Encontrado PROCESSDATA dentro de ProcesarWSResult');
        return this.parseProcessData(processDataMatch[1]);
      }

      // Si no hay PROCESSDATA, intentar parsear directamente
      console.log('[SICAS SOAP] No se encontró PROCESSDATA, parseando ProcesarWSResult directamente');
      return this.parseProcessData(resultContent);
    }

    // Intentar buscar PROCESSDATA directamente
    const processDataMatch = decoded.match(/<PROCESSDATA>([\s\S]*?)<\/PROCESSDATA>/i);
    if (processDataMatch) {
      console.log('[SICAS SOAP] Encontrado PROCESSDATA directamente');
      return this.parseProcessData(processDataMatch[1]);
    }

    // Si llegamos aquí, la respuesta no tiene el formato esperado
    console.error('[SICAS SOAP] Formato de respuesta desconocido');
    console.error('[SICAS SOAP] Respuesta completa:', decoded.substring(0, 2000));
    throw new Error('No se encontró PROCESSDATA ni ProcesarWSResult en la respuesta');
  }

  /**
   * Parsea los datos de PROCESSDATA
   */
  private parseProcessData(processData: string): SicasReportResponse {
    console.log('========================================');
    console.log('[SICAS SOAP] 🔍 PARSEANDO PROCESSDATA');
    console.log('========================================');

    // Extraer campos básicos
    const responseTxt = this.extractXmlValue(processData, 'RESPONSETXT') || '';
    const responseNbr = this.extractXmlValue(processData, 'RESPONSENBR') || '0';
    const message = this.extractXmlValue(processData, 'MESSAGE') || '';

    console.log('[SICAS SOAP] ✅ RESPONSETXT:', responseTxt);
    console.log('[SICAS SOAP] 📊 RESPONSENBR:', responseNbr);
    console.log('[SICAS SOAP] 💬 MESSAGE:', message);

    // 🔥 CRÍTICO: Detectar errores en MESSAGE
    if (message && (
      message.toLowerCase().includes('error') ||
      message.toLowerCase().includes('denied') ||
      message.toLowerCase().includes('denegad') ||
      message.toLowerCase().includes('variable de objeto') ||
      message.toLowerCase().includes('no se puede') ||
      message.toLowerCase().includes('failed')
    )) {
      console.error('[SICAS SOAP] ❌ ERROR DETECTADO EN MESSAGE:', message);
      throw new Error(`Error en SICAS: ${message}`);
    }

    // Verificar si hay error por RESPONSETXT
    if (responseTxt.toUpperCase() !== 'SUCESS' || responseNbr === '0') {
      console.log('[SICAS SOAP] ⚠️ RESPONSETXT no es SUCCESS o RESPONSENBR es 0');
      console.log('[SICAS SOAP] Interpretando como: sin datos disponibles');

      return {
        success: true,
        responseNbr,
        message: message || 'Reporte sin datos',
        records: [],
        totalRecords: 0,
      };
    }

    // Extraer registros
    console.log('[SICAS SOAP] 🔎 Buscando registros en PROCESSDATA...');
    const records = this.parseRecords(processData);
    console.log('[SICAS SOAP] ✅ Registros parseados:', records.length);

    if (records.length > 0) {
      console.log('[SICAS SOAP] 📋 Campos del primer registro:');
      console.log(JSON.stringify(Object.keys(records[0]), null, 2));
      console.log('[SICAS SOAP] 📄 Primer registro completo:');
      console.log(JSON.stringify(records[0], null, 2));
    }

    return {
      success: true,
      responseNbr,
      message,
      records,
      totalRecords: records.length,
      rawXml: processData,
    };
  }

  /**
   * Extrae el valor de un tag XML
   */
  private extractXmlValue(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Parsea los registros del XML
   */
  private parseRecords(xml: string): any[] {
    const records: any[] = [];

    console.log('[SICAS SOAP] 🔍 Buscando tag DATAINFO...');

    // Buscar DATAINFO
    const dataInfoMatch = xml.match(/<DATAINFO>([\s\S]*?)<\/DATAINFO>/i);
    if (!dataInfoMatch) {
      console.log('[SICAS SOAP] ⚠️ No se encontró tag DATAINFO');
      console.log('[SICAS SOAP] 📄 XML completo (primeros 2000 chars):');
      console.log(xml.substring(0, 2000));

      // Intentar buscar otras estructuras comunes
      console.log('[SICAS SOAP] 🔍 Buscando estructuras alternativas...');

      // Buscar NewDataSet (estructura alternativa)
      const newDataSetMatch = xml.match(/<NewDataSet>([\s\S]*?)<\/NewDataSet>/i);
      if (newDataSetMatch) {
        console.log('[SICAS SOAP] ✅ Encontrado NewDataSet!');
        return this.parseNewDataSet(newDataSetMatch[1]);
      }

      // Buscar tablas directamente (Table, DatDocumentos, etc)
      const tableMatch = xml.match(/<(Table|DatDocumentos|Documentos)[^>]*>([\s\S]*?)<\/\1>/i);
      if (tableMatch) {
        console.log('[SICAS SOAP] ✅ Encontrada tabla:', tableMatch[1]);
        return this.parseTableRows(xml, tableMatch[1]);
      }

      console.log('[SICAS SOAP] ❌ No se encontró ninguna estructura conocida');
      return records;
    }

    console.log('[SICAS SOAP] ✅ Tag DATAINFO encontrado');
    const dataInfo = dataInfoMatch[1];

    // Extraer todos los registros
    const recordMatches = dataInfo.matchAll(/<RECORD>([\s\S]*?)<\/RECORD>/gi);
    let recordCount = 0;

    for (const recordMatch of recordMatches) {
      recordCount++;
      const recordXml = recordMatch[1];
      const record: any = {};

      // Extraer todos los campos del registro
      const fieldMatches = recordXml.matchAll(/<([^>]+)>([^<]*)<\/\1>/g);

      for (const fieldMatch of fieldMatches) {
        const fieldName = fieldMatch[1];
        const fieldValue = fieldMatch[2].trim();

        // Convertir valores numéricos
        if (fieldValue && !isNaN(Number(fieldValue)) && fieldValue !== '') {
          record[fieldName] = Number(fieldValue);
        } else {
          record[fieldName] = fieldValue;
        }
      }

      if (Object.keys(record).length > 0) {
        records.push(record);
      }
    }

    console.log('[SICAS SOAP] ✅ Encontrados', recordCount, 'tags RECORD');
    console.log('[SICAS SOAP] ✅ Parseados', records.length, 'registros válidos');

    return records;
  }

  /**
   * Parsea NewDataSet (estructura alternativa de SICAS)
   */
  private parseNewDataSet(xml: string): any[] {
    const records: any[] = [];

    // Buscar todas las tablas dentro de NewDataSet
    const tableMatches = xml.matchAll(/<(Table|DatDocumentos|Documentos)[^>]*>([\s\S]*?)<\/\1>/gi);

    for (const tableMatch of tableMatches) {
      const tableName = tableMatch[1];
      const tableContent = tableMatch[2];

      console.log('[SICAS SOAP] 📊 Parseando tabla:', tableName);

      const record: any = {};
      const fieldMatches = tableContent.matchAll(/<([^>]+)>([^<]*)<\/\1>/g);

      for (const fieldMatch of fieldMatches) {
        const fieldName = fieldMatch[1];
        const fieldValue = fieldMatch[2].trim();

        if (fieldValue && !isNaN(Number(fieldValue)) && fieldValue !== '') {
          record[fieldName] = Number(fieldValue);
        } else {
          record[fieldName] = fieldValue;
        }
      }

      if (Object.keys(record).length > 0) {
        records.push(record);
      }
    }

    console.log('[SICAS SOAP] ✅ Parseados', records.length, 'registros de NewDataSet');
    return records;
  }

  /**
   * Parsea filas de una tabla específica
   */
  private parseTableRows(xml: string, tableName: string): any[] {
    const records: any[] = [];
    const regex = new RegExp(`<${tableName}[^>]*>([\\s\\S]*?)<\/${tableName}>`, 'gi');
    const matches = xml.matchAll(regex);

    for (const match of matches) {
      const rowContent = match[1];
      const record: any = {};

      const fieldMatches = rowContent.matchAll(/<([^>]+)>([^<]*)<\/\1>/g);

      for (const fieldMatch of fieldMatches) {
        const fieldName = fieldMatch[1];
        const fieldValue = fieldMatch[2].trim();

        if (fieldValue && !isNaN(Number(fieldValue)) && fieldValue !== '') {
          record[fieldName] = Number(fieldValue);
        } else {
          record[fieldName] = fieldValue;
        }
      }

      if (Object.keys(record).length > 0) {
        records.push(record);
      }
    }

    return records;
  }

  /**
   * Helper: Crear filtro de fecha por CAPTURA (recomendado según ejemplo oficial)
   * Formato: DD/MM/YYYY HH:mm o DD/MM/YYYY HH:mm:ss
   */
  static createDateRangeFilterByCaptura(
    dateFrom: string,
    dateTo: string,
    dateFromText: string,
    dateToText: string
  ): FilterCondition {
    return {
      name: 'Desde|Hasta|Captura',
      type: 3,
      subtype: 1,
      values: [dateFrom, dateTo],
      texts: [dateFromText, dateToText],
      flag1: 0,
      flag2: -1, // Flags invertidos como en el ejemplo oficial
      fieldDb: 'DatDocumentos.FCaptura',
    };
  }

  /**
   * Helper: Crear filtro de fecha por VIGENCIA (FDesde)
   * Formato: DD/MM/YYYY HH:mm o DD/MM/YYYY HH:mm:ss
   */
  static createDateRangeFilterByVigencia(
    dateFrom: string,
    dateTo: string,
    dateFromText: string,
    dateToText: string
  ): FilterCondition {
    return {
      name: 'Desde|Hasta|Desde',
      type: 3,
      subtype: 1,
      values: [dateFrom, dateTo],
      texts: [dateFromText, dateToText],
      flag1: 0,
      flag2: -1, // Flags invertidos como en el ejemplo oficial
      fieldDb: 'DatDocumentos.FDesde',
    };
  }

  /**
   * Helper genérico: Crear filtro de fecha (rango)
   * @deprecated Use createDateRangeFilterByCaptura o createDateRangeFilterByVigencia
   */
  static createDateRangeFilter(
    dateFrom: string,
    dateTo: string,
    dateFromText: string,
    dateToText: string,
    fieldDb: string
  ): FilterCondition {
    return {
      name: 'Desde|Hasta|Desde',
      type: 3,
      subtype: 1,
      values: [dateFrom, dateTo],
      texts: [dateFromText, dateToText],
      flag1: 0,
      flag2: -1, // Actualizado para coincidir con ejemplo oficial
      fieldDb,
    };
  }

  /**
   * Helper: Crear filtro de estatus vigente
   */
  static createStatusVicenteFilter(): FilterCondition {
    return {
      name: 'Estatus',
      type: 0,
      subtype: 0,
      values: ['0'],
      texts: ['Vigentes'],
      flag1: -1,
      flag2: 0,
      fieldDb: 'DatDocumentos.Status',
    };
  }

  /**
   * Helper: Crear filtro de vendedores
   */
  static createVendorFilter(vendorIds: string[], vendorNames: string[]): FilterCondition {
    return {
      name: 'Vendedor',
      type: 2,
      subtype: 0,
      values: vendorIds,
      texts: vendorNames,
      flag1: 1,
      flag2: 0,
      fieldDb: 'CatVendedores.IDVend',
    };
  }

  /**
   * Helper: Crear filtro de tipo de documento (solo pólizas)
   */
  static createDocumentTypeFilter(): FilterCondition {
    return {
      name: 'Documentos',
      type: 2,
      subtype: 0,
      values: ['1'],
      texts: ['Polizas'],
      flag1: -1,
      flag2: 0,
      fieldDb: 'DatDocumentos.TipoDocto',
    };
  }

  /**
   * Helper: Crear filtro de cobranza (pagado/liquidado)
   */
  static createCobranzaFilter(): FilterCondition {
    return {
      name: 'Cobranza',
      type: 2,
      subtype: 0,
      values: ['3', '4'],
      texts: ['Pagado', 'Liquidado'],
      flag1: -1,
      flag2: 0,
      fieldDb: 'VDatRecibos.Status',
    };
  }

  /**
   * Helper: Crear filtro de compañía (like)
   */
  static createCompanyFilter(companyName: string): FilterCondition {
    return {
      name: 'Compañía',
      type: 0,
      subtype: 1,
      values: [`*${companyName}*`],
      texts: [`*${companyName}*`],
      flag1: 1,
      fieldDb: 'VCatCias.CiaNombre',
    };
  }

  /**
   * Helper: Crear filtro de documento específico
   */
  static createDocumentIdFilter(documentId: string): FilterCondition {
    return {
      name: 'ID_Documento',
      type: 0,
      subtype: 1,
      values: [documentId],
      texts: [documentId],
      flag1: 0,
      flag2: -1,
      fieldDb: 'VDatDocumentos.IDDocto',
    };
  }

  /**
   * Helper: Crear filtro de número de documento
   */
  static createDocumentNumberFilter(documentNumber: string): FilterCondition {
    return {
      name: 'Documento',
      type: 0,
      subtype: 1,
      values: [documentNumber],
      texts: [documentNumber],
      flag1: 0,
      flag2: -1,
      fieldDb: 'VDatDocumentos.Documento',
    };
  }
}

/**
 * KeyCodes conocidos de reportes SICAS
 */
export const SICAS_REPORT_KEYCODES = {
  // Pólizas y Documentos
  POLIZAS_VIGENTES: 'H03400',
  DOCUMENTOS_POR_ID: 'H03410',
  RENOVACIONES: 'H02761',

  // Cobranza
  COBRANZA_FILTROS: 'H03430_001',

  // Comisiones (por determinar los correctos)
  COMISIONES_PAGADAS: 'H03420',
  COMISIONES_PENDIENTES: 'H03421',
} as const;

/**
 * Ejemplo de uso:
 *
 * const client = new SicasSoapReportClient({
 *   endpoint: 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx',
 *   username: 'W4sP3r',
 *   password: 'wA5P3R 2020',
 * });
 *
 * const filters = [
 *   SicasSoapReportClient.createStatusVicenteFilter(),
 *   SicasSoapReportClient.createDateRangeFilter(
 *     '01/01/2025', '31/12/2025',
 *     '01/Ene/2025', '31/Dic/2025',
 *     'DatDocumentos.FDesde'
 *   ),
 *   SicasSoapReportClient.createVendorFilter(['69', '53'], ['VENDEDOR 1', 'VENDEDOR 2']),
 * ];
 *
 * const result = await client.executeReport({
 *   keyCode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
 *   page: 1,
 *   itemsPerPage: 100,
 *   sortField: 'DatDocumentos.FDesde',
 *   filters,
 * });
 *
 * console.log(`Encontrados ${result.records.length} registros`);
 */
