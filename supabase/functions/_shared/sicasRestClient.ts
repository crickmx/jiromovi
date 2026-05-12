const SICAS_REST_BASE = "https://security-services.sicasonline.info/api";
const TOKEN_LIFETIME_MS = 3 * 60 * 1000; // 3 minutes

export interface SicasRestClientOptions {
  username: string;
  password: string;
  sCodeAuth?: string;
}

export interface ReadReportParams {
  keyCode: string;
  pageRequested?: number;
  itemsForPage?: number;
  sortFields?: string;
  formatResponse?: number;
  conditions?: string;
}

export interface SicasRestResponse {
  Sucess?: boolean;
  Error?: string;
  Response?: any[];
}

export class SicasRestClient {
  private username: string;
  private password: string;
  private sCodeAuth: string;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(options: SicasRestClientOptions) {
    this.username = options.username;
    this.password = options.password;
    this.sCodeAuth = options.sCodeAuth || "";
  }

  async getValidToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    const url = `${SICAS_REST_BASE}/Security/GetToken`;
    const body = {
      sUser: this.username,
      sPassword: this.password,
      sCodeAuth: this.sCodeAuth,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GetToken failed (HTTP ${response.status}): ${text.substring(0, 300)}`);
    }

    const data = await response.json();

    if (!data.Sucess && data.Error) {
      throw new Error(`GetToken error: ${data.Error}`);
    }

    // Token is in data.Response or data.Token or similar
    const token = data.Response || data.Token || data.token || "";
    if (!token) {
      throw new Error(`GetToken returned no token: ${JSON.stringify(data).substring(0, 300)}`);
    }

    this.token = token;
    this.tokenExpiresAt = Date.now() + TOKEN_LIFETIME_MS;
    return token;
  }

  async readReport(params: ReadReportParams): Promise<SicasRestResponse> {
    const token = await this.getValidToken();

    const url = `${SICAS_REST_BASE}/Report/ReadData`;
    const body: Record<string, any> = {
      PageRequested: params.pageRequested || 1,
      ItemsForPage: params.itemsForPage || 100,
      FormatResponse: params.formatResponse ?? 2,
    };

    if (params.sortFields) {
      body.SortFields = params.sortFields;
    }
    if (params.conditions) {
      body.Conditions = params.conditions;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "Prop_KeyCode": params.keyCode,
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      // Check for specific known error patterns
      if (text.includes("no encontrado") || text.includes("not found")) {
        throw new Error(`Codigo de reporte no encontrado: ${params.keyCode}`);
      }
      throw new Error(`ReadData HTTP ${response.status}: ${text.substring(0, 500)}`);
    }

    const data: SicasRestResponse = await response.json();

    // Check for application-level errors in response
    if (data.Sucess === false && data.Error) {
      if (/no encontrado|not found|no existe/i.test(data.Error)) {
        throw new Error(`Codigo de reporte no encontrado: ${params.keyCode}`);
      }
      throw new Error(data.Error);
    }

    return data;
  }
}

export async function createSicasRestClientWithDbAuth(
  options: SicasRestClientOptions
): Promise<SicasRestClient> {
  const client = new SicasRestClient(options);
  // Validate credentials by getting initial token
  await client.getValidToken();
  return client;
}
