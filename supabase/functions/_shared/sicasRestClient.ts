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
  private tokenCache: SicasTokenCache | null = null;

  private readonly TOKEN_LIFETIME_MS = 3 * 60 * 1000;
  private readonly TOKEN_REFRESH_BUFFER_MS = 30 * 1000;

  constructor() {
    this.baseUrl = Deno.env.get('SICAS_REST_API_URL') || 'https://security-services.sicasonline.info/api';
    this.username = Deno.env.get('SICAS_USERNAME') || '';
    this.password = Deno.env.get('SICAS_PASSWORD') || '';

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

    const params = new URLSearchParams({
      sUserName: this.username,
      sPassword: this.password,
    });

    const response = await fetch(`${this.baseUrl}/Security/GetToken?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get token: ${response.status} ${response.statusText}`);
    }

    const data: SicasAuthResponse = await response.json();

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
          if (typeof body === 'string') {
            requestOptions.body = body;
          } else {
            const formData = new URLSearchParams();
            Object.entries(body).forEach(([key, value]) => {
              formData.append(key, String(value));
            });
            requestOptions.body = formData.toString();
            requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
          }
        }

        console.log(`[SICAS REST] ${method} ${endpoint} (Intento ${attempt + 1}/${maxRetries + 1})`);

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

  public async readReport(options: {
    keyCode: string;
    pageRequested?: number;
    itemsForPage?: number;
    sortFields?: string;
    fieldsRequested?: string;
    formatResponse?: 0 | 2;
    conditions?: string;
    conditionsDirect?: string;
  }): Promise<SicasReportResponse> {
    const {
      keyCode,
      pageRequested = 1,
      itemsForPage = 100,
      sortFields,
      fieldsRequested,
      formatResponse = 2,
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

    try {
      const response = await this.request<SicasReportResponse>(
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

      return response;
    } catch (error: any) {
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
