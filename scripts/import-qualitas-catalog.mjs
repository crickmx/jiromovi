import fs from 'node:fs';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';

const [filePath] = process.argv.slice(2);
const endpoint = process.env.QUALITAS_SYNC_ENDPOINT;
const anonKey = process.env.SUPABASE_ANON_KEY;
const importToken = process.env.QUALITAS_IMPORT_TOKEN;
if (!filePath || !endpoint || !anonKey || !importToken) throw new Error('Faltan argumentos de importación');

const fileName = filePath.split('/').pop();
const sourceFileDate = '2024-07-01';
const syncId = crypto.randomUUID();
const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
const sheets = ['AUTOS', 'PICKUPS-CARGA', 'PICKUPS-PART'];
const rows = sheets.flatMap((sheetName) =>
  XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
    .map((row) => ({ ...row, sheetName })),
);

async function call(body) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          'X-Catalog-Import-Token': importToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt === 6) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

await call({ action: 'start', syncId, fileName, sourceFileDate });
let accepted = 0;
for (let offset = 0; offset < rows.length; offset += 400) {
  const result = await call({
    action: 'import_rows',
    syncId,
    fileName,
    sourceFileDate,
    rows: rows.slice(offset, offset + 400),
  });
  accepted += result.accepted;
  if (offset % 4000 === 0) process.stdout.write(`Importados ${accepted}/${rows.length}\n`);
}
const final = await call({ action: 'finalize', syncId, fileName, sourceFileDate });
process.stdout.write(`${JSON.stringify(final)}\n`);
