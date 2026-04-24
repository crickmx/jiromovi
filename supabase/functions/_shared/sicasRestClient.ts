/**
 * SICAS REST API Client
 *
 * Cliente oficial para consumir la API REST de SICAS.
 * Basado en la documentación oficial: API-Servicios_REST.pdf (páginas 27-31)
 *
 * ENDPOINTS:
 * - QUA: https://www.sicasonline.net/security-services/api
 * - PROD: https://security-services.sicasonline.info/api
 *
 * FLUJO DE AUTENTICACIÓN:
 * 1. POST /Security/GetToken → Obtener token inicial (params: sUserName, sPassword, sCodeAuth)
 * 2. GET /Security/ValidateToken?ReactiveIf=true → Validar y renovar token
 * 3. Token válido por 3 minutos, renovable hasta 10 minutos
 *
 * CONSUMO DE REPORTES/CATÁLOGOS:
 * - POST /Report/ReadData
 * - Headers: Authorization (token), Prop_KeyCode (código de reporte)
 * - Body: PageRequested, ItemsForPage, SortFields, FieldsRequested, FormatResponse, Conditions, ConditionsDirect
 * - Response: JSON con TableInfo (datos) y TableControl (paginación)
 */

interface SicasTokenCache {
  token: string;
  expiresAt: number;
}

interface SicasAuthResponse {
  Token: string;
  Sucess: boolean;
  Message?: string;
}

interface SicasValidateTokenResponse {
  Token?: string;
  Status: 'OK' | 'RENEW' | 'ERR';
  Message?: string;
  Sucess: boolean;
}

interface SicasReportResponse {
  Response: Array<{
    TableInfo?: any[];
    TableControl?: Array<{
      MaxRecords: number;
      Pages: number;
      Page: number;
      ItemForPage: number;
    }>;
  }>;
  Sucess: boolean;
  Error?: string;
}

function parseXmlToTableInfo(xmlString: string): {
  tableInfo: Record<string, string>[];
  tableControl: { MaxRecords: number; Pages: number; Page: number; ItemForPage: number } | null;
} {
  const records: Record<string, string>[] = [];
  // Match any row element: Table_WS_Documentos, Table_WS_xxx, etc.
  const rowRegex = /<(Table_WS_\w+)>([\s\S]*?)<\/\1>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(xmlString)) !== null) {
    const rowXml = rowMatch[2];
    const record: Record<string, string> = {};
    const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(rowXml)) !== null) {
      record[fieldMatch[1]] = fieldMatch[2].trim();
    }
    records.push(record);
  }

  // Parse pagination control
  let tableControl = null;
  const controlMatch = xmlString.match(/<Table_Paginacion>([\s\S]*?)<\/Table_Paginacion>/);
  if (controlMatch) {
    const xml = controlMatch[1];
    const getVal = (tag: string): number => {
      const m = xml.match(new RegExp(`<${tag}>(\\d+)</${tag}>`));
      return m ? parseInt(m[1], 10) : 0;
    };
    tableControl = {
      MaxRecords: getVal("MaxRecords") || getVal("TotalRegistros"),
      Pages: getVal("Pages") || getVal("TotalPaginas"),
      Page: getVal("Page") || getVal("PaginaActual"),
      ItemForPage: getVal("ItemForPage") || getVal("ItemsPorPagina"),
    };
  }

  return { tableInfo: records, tableControl };
}

interface SicasDigitalFile {
  FileName: string;
  FileExtension: string;
  FileSize?: number;
  FileData?: string;
  DocumentDate?: string;
  UploadDate?: string;
  Description?: string;
}

interface SicasDigitalFilesResponse {
  Files: SicasDigitalFile[];
  Sucess: boolean;
  Message?: string;
  Error?: string;
}

export class SicasRestClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private sCodeAuth?: string;
  private tokenCache: SicasTokenCache | null = null;

  private readonly TOKEN_LIFETIME_MS = 3 * 60 * 1000;
  private readonly TOKEN_REFRESH_BUFFER_MS = 30 * 1000;

  constructor(config?: { baseUrl?: string; username?: string; password?: string; sCodeAuth?: string }) {
    this.baseUrl = config?.baseUrl || Deno.env.get('SICAS_REST_API_URL') || 'https://security-services.sicasonline.info/api';
    this.username = config?.username || Deno.env.get('SICAS_USERNAME') || '';
    this.password = config?.password || Deno.env.get('SICAS_PASSWORD') || '';
    this.sCodeAuth = config?.sCodeAuth || Deno.env.get('SICAS_CODE_AUTH') || undefined;

    if (!this.username || !this.password) {
      throw new Error('SICAS credentials not configured');
    }
  }

  private isTokenValid(): boolean {
    if (!this.tokenCache) return false;
    const now = Date.now();
    return now < this.tokenCache.expiresAt - this.TOKEN_REFRESH_BUFFER_MS;
  }

  private async getToken(): Promise<string> {
    console.log('[SICAS REST] Obteniendo nuevo token...');
    console.log('[SICAS REST] URL:', `${this.baseUrl}/Security/GetToken`);
    console.log('[SICAS REST] Username:', this.username);

    // Según manual oficial (página 5-6): parámetros sUserName, sPassword, sCodeAuth (opcional)
    const params = new URLSearchParams({
      sUserName: this.username,
      sPassword: this.password,
    });

    // Agregar sCodeAuth solo si está configurado
    if (this.sCodeAuth) {
      params.append('sCodeAuth', this.sCodeAuth);
    }

    const url = `${this.baseUrl}/Security/GetToken?${params.toString()}`;
    console.log('[SICAS REST] Request URL completa:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('[SICAS REST] Response status:', response.status, response.statusText);

    const responseText = await response.text();
    console.log('[SICAS REST] Response body:', responseText);

    if (!response.ok) {
      throw new Error(`Failed to get token: ${response.status} ${response.statusText} - Body: ${responseText}`);
    }

    const data: SicasAuthResponse = JSON.parse(responseText);

    if (!data.Sucess || !data.Token) {
      throw new Error(`Authentication failed: ${data.Message || 'Unknown error'}`);
    }

    this.tokenCache = {
      token: data.Token,
      expiresAt: Date.now() + this.TOKEN_LIFETIME_MS,
    };

    console.log('[SICAS REST] ✅ Token obtenido exitosamente');
    return data.Token;
  }

  private async validateAndRenewToken(token: string): Promise<string> {
    console.log('[SICAS REST] Validando y renovando token...');

    const response = await fetch(`${this.baseUrl}/Security/ValidateToken?ReactiveIf=true`, {
      method: 'GET',
      headers: {
        'Authorization': token,
      },
    });

    if (!response.ok) {
      console.log('[SICAS REST] ⚠️ ValidateToken falló, obteniendo nuevo token');
      return await this.getToken();
    }

    const data: SicasValidateTokenResponse = await response.json();

    if (!data.Sucess) {
      console.log('[SICAS REST] ⚠️ Token inválido, obteniendo nuevo token');
      return await this.getToken();
    }

    if (data.Status === 'RENEW' && data.Token) {
      console.log('[SICAS REST] ✅ Token renovado');
      this.tokenCache = {
        token: data.Token,
        expiresAt: Date.now() + this.TOKEN_LIFETIME_MS,
      };
      return data.Token;
    }

    if (data.Status === 'OK') {
      console.log('[SICAS REST] ✅ Token aún válido');
      this.tokenCache = {
        token: token,
        expiresAt: Date.now() + this.TOKEN_LIFETIME_MS,
      };
      return token;
    }

    console.log('[SICAS REST] ⚠️ Status desconocido, obteniendo nuevo token');
    return await this.getToken();
  }

  public async getValidToken(): Promise<string> {
    if (this.isTokenValid() && this.tokenCache) {
      return this.tokenCache.token;
    }

    if (this.tokenCache?.token) {
      try {
        return await this.validateAndRenewToken(this.tokenCache.token);
      } catch (error) {
        console.log('[SICAS REST] Error renovando token, obteniendo nuevo:', error);
      }
    }

    return await this.getToken();
  }

  public async request<T = any>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST';
      headers?: Record<string, string>;
      body?: any;
      queryParams?: Record<string, string | number | boolean>;
      maxRetries?: number;
    } = {}
  ): Promise<T> {
    const {
      method = 'POST',
      headers = {},
      body,
      queryParams,
      maxRetries = 1,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const token = await this.getValidToken();

        let url = `${this.baseUrl}${endpoint}`;
        if (queryParams) {
          const params = new URLSearchParams();
          Object.entries(queryParams).forEach(([key, value]) => {
            params.append(key, String(value));
          });
          url += `?${params.toString()}`;
        }

        const requestHeaders: Record<string, string> = {
          'Authorization': token,
          'Content-Type': 'application/json',
          ...headers,
        };

        const requestOptions: RequestInit = {
          method,
          headers: requestHeaders,
        };

        if (body && method === 'POST') {
          const serialized = typeof body === 'string' ? body : JSON.stringify(body);
          requestOptions.body = serialized;
          requestHeaders['Content-Type'] = 'application/json';
        }

        console.log(`[SICAS REST] ${method} ${endpoint} (Intento ${attempt + 1}/${maxRetries + 1})`);
        console.log(`[SICAS REST] Headers: ${JSON.stringify(Object.fromEntries(Object.entries(requestHeaders).filter(([k]) => k !== 'Authorization')))}`);
        if (requestOptions.body) console.log(`[SICAS REST] Body: ${String(requestOptions.body).substring(0, 500)}`);

        const response = await fetch(url, requestOptions);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.Message?.includes('Token Inactivo') && attempt < maxRetries) {
          console.log('[SICAS REST] Token expirado, reintentando...');
          this.tokenCache = null;
          continue;
        }

        return data as T;
      } catch (error) {
        lastError = error as Error;
        console.error(`[SICAS REST] Error en intento ${attempt + 1}:`, error);

        if (attempt < maxRetries) {
          this.tokenCache = null;
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Método para leer reportes según manual oficial (páginas 27-31)
   * Endpoint: POST /Report/ReadData
   * Headers: Authorization (token), Prop_KeyCode (código de reporte)
   * Body: PageRequested, ItemsForPage, SortFields, FieldsRequested, FormatResponse, Conditions, ConditionsDirect
   *
   * KeyCodes importantes:
   * - HWS_DOCTOS: Documentos (pólizas, órdenes, fianzas)
   * - HWSDOC: Solo pólizas (sin órdenes ni fianzas)
   */
  public async readReport(options: {
    keyCode: string;
    pageRequested?: number;
    itemsForPage?: number;
    sortFields?: string;
    fieldsRequested?: string;
    formatResponse?: 0 | 2; // 0 = XML, 2 = JSON
    conditions?: string;
    conditionsDirect?: string;
  }): Promise<SicasReportResponse> {
    const {
      keyCode,
      pageRequested = 1,
      itemsForPage = 100,
      sortFields,
      fieldsRequested,
      formatResponse = 2, // JSON por defecto
      conditions,
      conditionsDirect,
    } = options;

    const body: Record<string, any> = {
      PageRequested: pageRequested,
      ItemsForPage: itemsForPage,
      FormatResponse: formatResponse,
    };

    if (sortFields) body.SortFields = sortFields;
    if (fieldsRequested) body.FieldsRequested = fieldsRequested;
    if (conditions) body.Conditions = conditions;
    if (conditionsDirect) body.ConditionsDirect = conditionsDirect;

    console.log('[SICAS REST] readReport - KeyCode:', keyCode);
    console.log('[SICAS REST] readReport - Body:', JSON.stringify(body, null, 2));

    try {
      const response = await this.request<any>(
        '/Report/ReadData',
        {
          method: 'POST',
          headers: {
            'Prop_KeyCode': keyCode,
          },
          body,
          maxRetries: 2,
        }
      );

      // Verificar si el error indica código de reporte inválido
      if (response.Error) {
        if (response.Error.includes('Codigo de reporte') ||
            response.Error.includes('No se encontro') ||
            response.Error.includes('not found')) {
          throw new Error(`Codigo de reporte no encontrado: ${keyCode}`);
        }
        throw new Error(response.Error);
      }

      // Handle XML string response format: { Response: "<DATAINFO>...</DATAINFO>", Sucess: true }
      if (typeof response.Response === 'string' && response.Response.includes('<')) {
        console.log('[SICAS REST] readReport - Response is XML string, parsing...');
        const { tableInfo, tableControl } = parseXmlToTableInfo(response.Response);
        const normalized: SicasReportResponse = {
          Response: [{
            TableInfo: tableInfo,
            TableControl: tableControl ? [tableControl] : undefined,
          }],
          Sucess: response.Sucess,
          Error: response.Error,
        };
        console.log('[SICAS REST] readReport - Parsed XML. Records:', tableInfo.length, 'Control:', tableControl);
        return normalized;
      }

      // Handle already-structured JSON array response
      const reportResponse = response as SicasReportResponse;

      const rawTableInfo = reportResponse.Response?.[0]?.TableInfo ?? [];

      // OPCIÓN B (robusta): cualquier registro sin IDDocto ni Documento
      // es el registro de paginación — independiente del idioma de campos
      const paginationRecord = rawTableInfo.find(
        (r: any) => r.IDDocto === undefined && r.Documento === undefined
      );

      const cleanTableInfo = rawTableInfo.filter(
        (r: any) => r.IDDocto !== undefined || r.Documento !== undefined
      );

      // Extraer con todos los posibles nombres (inglés y español)
      const tableControl = paginationRecord ? [{
        MaxRecords: Number(
          paginationRecord.MaxRecords   ??
          paginationRecord.TotalRegistros ??
          paginationRecord.TotalRecords   ?? 0
        ),
        Pages: Number(
          paginationRecord.Pages        ??
          paginationRecord.TotalPaginas ?? 1
        ),
        Page: Number(
          paginationRecord.Page         ??
          paginationRecord.PaginaActual ?? 1
        ),
        ItemForPage: Number(
          paginationRecord.ItemForPage    ??
          paginationRecord.ItemsPorPagina ?? 100
        )
      }] : (reportResponse.Response?.[1]?.TableControl ?? []);

      // Log para confirmar que la paginación fue detectada
      if (paginationRecord) {
        console.log('[SICAS] Paginación detectada:', JSON.stringify(tableControl[0]));
        console.log('[SICAS] Documentos reales en este batch:', cleanTableInfo.length);
      } else {
        console.warn('[SICAS] ADVERTENCIA: No se encontró registro de paginación.');
        console.warn('[SICAS] Campos del último registro:',
          JSON.stringify(Object.keys(rawTableInfo[rawTableInfo.length - 1] ?? {})));
      }

      // Retornar estructura normalizada
      return {
        Response: [
          { TableInfo:    cleanTableInfo },
          { TableControl: tableControl  }
        ],
        Sucess: reportResponse.Sucess
      };
    } catch (error: any) {
      console.error('[SICAS REST] readReport - Error:', error.message);
      // Mejorar el mensaje de error para códigos de reporte
      if (error.message?.includes('Codigo de reporte') ||
          error.message?.includes('not found')) {
        throw new Error(`Codigo de reporte no encontrado: ${keyCode}`);
      }
      throw error;
    }
  }

  public async getDigitalFiles(options: {
    identity: string;
    valuePK: string;
  }): Promise<SicasDigitalFilesResponse> {
    const { identity, valuePK } = options;

    return await this.request<SicasDigitalFilesResponse>(
      '/DigitalCenter/GetFiles',
      {
        method: 'POST',
        body: {
          Identity: identity,
          ValuePK: valuePK,
        },
        maxRetries: 2,
      }
    );
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const token = await this.getToken();
      return {
        success: true,
        message: `Conexión REST exitosa. Token obtenido: ${token.substring(0, 50)}...`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${(error as Error).message}`,
      };
    }
  }
}

export function createSicasRestClient(): SicasRestClient {
  return new SicasRestClient();
}
