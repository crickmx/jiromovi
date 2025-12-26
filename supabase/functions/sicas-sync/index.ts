import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ParsedCatalogItem {
  id_sicas: string;
  nombre: string;
  raw: any;
}

function parseSicasCatalogResponse(responseText: string, catalogType: 'despachos' | 'vendedores'): ParsedCatalogItem[] {
  const results: ParsedCatalogItem[] = [];

  try {
    const resultMatch = responseText.match(/<ReadInfoDataResult>(.*?)<\/ReadInfoDataResult>/s);
    if (!resultMatch) {
      console.error('No ReadInfoDataResult found');
      return results;
    }

    let dataContent = resultMatch[1];
    dataContent = dataContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

    let parsedData: any;

    if (dataContent.trim().startsWith('{') || dataContent.trim().startsWith('[')) {
      try {
        parsedData = JSON.parse(dataContent);
      } catch (e) {
        console.error('Failed to parse as JSON:', e);
        return results;
      }
    } else if (dataContent.trim().startsWith('<')) {
      const tableMatch = dataContent.match(/<Table>(.*?)<\/Table>/gs);
      if (!tableMatch) {
        console.error('No Table elements found in XML');
        return results;
      }

      parsedData = tableMatch.map(tableXml => {
        const obj: any = {};
        const fieldMatches = tableXml.matchAll(/<([^>]+)>([^<]*)<\/\1>/g);
        for (const match of fieldMatches) {
          const fieldName = match[1];
          const fieldValue = match[2];
          if (fieldName !== 'Table') {
            obj[fieldName] = fieldValue;
          }
        }
        return obj;
      });
    } else {
      console.error('Unknown data format');
      return results;
    }

    let dataArray: any[] = [];
    if (Array.isArray(parsedData)) {
      dataArray = parsedData;
    } else if (parsedData.NewDataSet && parsedData.NewDataSet.Table) {
      dataArray = Array.isArray(parsedData.NewDataSet.Table) ? parsedData.NewDataSet.Table : [parsedData.NewDataSet.Table];
    } else if (parsedData.Table) {
      dataArray = Array.isArray(parsedData.Table) ? parsedData.Table : [parsedData.Table];
    } else if (typeof parsedData === 'object') {
      const possibleArrayKeys = Object.keys(parsedData).filter(k => Array.isArray(parsedData[k]));
      if (possibleArrayKeys.length > 0) {
        dataArray = parsedData[possibleArrayKeys[0]];
      }
    }

    for (const row of dataArray) {
      if (!row || typeof row !== 'object') continue;

      const keys = Object.keys(row);

      let idKey = keys.find(k => {
        const kLower = k.toLowerCase();
        if (catalogType === 'despachos') {
          return kLower.includes('iddespacho') || kLower === 'id' || (kLower.includes('id') && kLower.includes('desp'));
        } else {
          return kLower.includes('idvend') || kLower.includes('idvendedor') || kLower === 'id' || (kLower.includes('id') && kLower.includes('vend'));
        }
      });

      if (!idKey) {
        idKey = keys.find(k => {
          const val = String(row[k]);
          return k.toLowerCase().includes('id') && val && !isNaN(Number(val));
        });
      }

      let nameKey = keys.find(k => {
        const kLower = k.toLowerCase();
        if (catalogType === 'despachos') {
          return kLower === 'despacho' || kLower === 'nombre' || kLower === 'descripcion';
        } else {
          return kLower === 'vendedor' || kLower === 'nombre' || kLower === 'descripcion';
        }
      });

      if (!nameKey) {
        nameKey = keys.find(k => {
          const val = String(row[k]);
          return val && val.length > 0 && isNaN(Number(val)) && !k.toLowerCase().includes('id');
        });
      }

      if (!idKey || !row[idKey]) continue;

      const id_sicas = String(row[idKey]).trim();
      const nombre = nameKey && row[nameKey] ? String(row[nameKey]).trim() : '(Sin nombre)';

      if (id_sicas) {
        results.push({
          id_sicas,
          nombre,
          raw: row,
        });
      }
    }
  } catch (error) {
    console.error('Error parsing catalog response:', error);
  }

  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { catalogType } = await req.json();

    if (!catalogType || !['despachos', 'vendedores'].includes(catalogType)) {
      throw new Error('Invalid catalogType. Must be "despachos" or "vendedores"');
    }

    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');
    const sicasEndpoint = Deno.env.get('SICAS_ENDPOINT') || 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

    if (!sicasUsername || !sicasPassword) {
      throw new Error('SICAS credentials not configured');
    }

    const propertyTypeReadData = catalogType === 'despachos' ? '11' : '32';

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>${propertyTypeReadData}</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>${sicasUsername}</UserName>
        <Password>${sicasPassword}</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch(sicasEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/ReadInfoData',
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();
    const parsedItems = parseSicasCatalogResponse(responseText, catalogType);

    if (parsedItems.length === 0) {
      throw new Error(`No items parsed from ${catalogType} response`);
    }

    const tableName = catalogType === 'despachos' ? 'sicas_despachos' : 'sicas_vendedores';

    for (const item of parsedItems) {
      await supabase
        .from(tableName)
        .upsert({
          id_sicas: item.id_sicas,
          nombre: item.nombre,
          raw: item.raw,
        }, {
          onConflict: 'id_sicas',
        });
    }

    const syncField = catalogType === 'despachos' ? 'last_sync_despachos_at' : 'last_sync_vendedores_at';
    await supabase
      .from('sicas_config')
      .update({ [syncField]: new Date().toISOString() })
      .eq('endpoint', sicasEndpoint);

    return new Response(
      JSON.stringify({
        success: true,
        catalogType,
        itemsProcessed: parsedItems.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error syncing SICAS catalog:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});