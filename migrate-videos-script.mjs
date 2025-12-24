import fs from 'fs';
import https from 'https';
import http from 'http';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const csvData = `Titulo,URL del Video,URL de la Imagen
Gestión de Siniestros: Protocolo de Respuesta Inmediata,https://drive.google.com/file/d/1zuVK0nUcn5yVymf85jpyECnIa6jmdII4/view?usp=drivesdk,https://drive.google.com/file/d/1l3UVM1-7A_uB__8t7Et08s_TcEQSfLYv/view?usp=drivesdk
Secretos del Seguro de Auto MAPFRE,https://drive.google.com/file/d/1J_6F4ulWz_v5PqouhFziJwacZWpLuK3m/view?usp=drivesdk,No se encontró imagen
Inversión en Salud: GMM para Jóvenes (AXA),https://drive.google.com/file/d/14pzImzjryVEtLKeM03RkZoJ-pH9DiEqM/view?usp=drivesdk,https://drive.google.com/file/d/1NI_tB0KB0LyRShlSJaEfzC3rrtIuy9Oh/view?usp=drivesdk
Cobertura Esencial: Accidentes Personales Colectivos,https://drive.google.com/file/d/1VidpEBXrSS3YHDmF92BO_zfBhAumzCTp/view?usp=drivesdk,https://drive.google.com/file/d/11Nrp7Wc1vdMO3-XYSAfXRQ-FYdoTVGYW/view?usp=drivesdk
Libertad Financiera: Tu Plan de Retiro con GNP,https://drive.google.com/file/d/1IwIpL__yaO8DRzC0wJLwiXhqUvMXj9zg/view?usp=drivesdk,https://drive.google.com/file/d/1b8JA_IQ4Qx3ElXBk2LZJgEcCFRCfqMcT/view?usp=drivesdk
Blindaje Legal para Agentes de Seguros,https://drive.google.com/file/d/1z-9Ay9IFA1WxB4dA39EJ35esaSuMZBkF/view?usp=drivesdk,https://drive.google.com/file/d/1Yz2NpuvWS6MA_krW_uTFIUV4U3WQ0y7K/view?usp=drivesdk
Domina Qualitas: Herramientas y Estrategias,https://drive.google.com/file/d/15hX22yK2EDSr2R2ijeW5UP1g_SAolC7m/view?usp=drivesdk,https://drive.google.com/file/d/1AoA_PUTpA98T8XsS6vJpIzztwDTpI343/view?usp=drivesdk
Control Total: Liderazgo Personal y Financiero,https://drive.google.com/file/d/1c1P--ypanEhlHlKCj-mymY4hCCDKqKwW/view?usp=drivesdk,No se encontró imagen
"JIRO 2025: Metas, Avances y Estrategias de Éxito",https://drive.google.com/file/d/1tG_qnOuzvI7z5u6uGv3VKKL03z3WlHwy/view?usp=drivesdk,No se encontró imagen
Impulsa tu Éxito: Creación de Marca Personal,https://drive.google.com/file/d/1w2PQVUvBQWzr1v-gUPgOtjdDQFDRdfQk/view?usp=drivesdk,https://drive.google.com/file/d/1ZlidOiSY7kJspUeYCLHyF-qgSGqonoUE/view?usp=drivesdk
Salud a la Carta: Protección Médica MAPFRE,https://drive.google.com/file/d/1O4iEO9IB-9knlCV2iPgy8I3YMrFAtVDN/view?usp=drivesdk,https://drive.google.com/file/d/1KAXO0ZoBqG8PxsTwttZp2MwWeUuILc1E/view?usp=drivesdk
QCREA Qualitas: Protegiendo Autos Financiados,https://drive.google.com/file/d/1ag50gNcQtP6g1ygAREVCOPEN_nO6uQBk/view?usp=drivesdk,https://drive.google.com/file/d/1EQb9bAEEby5SLon0y9voGWCs-oe3dxvz/view?usp=drivesdk
UNIKUZ BX+: El GMM que Mereces,https://drive.google.com/file/d/1LpxweFlwTBZZqH9JNCySPfxrdzw0I_Jb/view?usp=drivesdk,https://drive.google.com/file/d/1hVCMJXE0gqVxgzpdUw1ZcnQTypSaabMs/view?usp=drivesdk
El Arte de la Captación: Estrategias de Clientes,https://drive.google.com/file/d/1Y90mK21BiFq--siRRvvD2jdDfaMFyGjz/view?usp=drivesdk,https://drive.google.com/file/d/1L-OPI352py5Mg-MngPWOCqAQo5ugV3it/view?usp=drivesdk
Guía Legal Avanzada para Agentes,https://drive.google.com/file/d/1oPoe8TgIv5NwOvtUG7yh7LNAQwECOkRg/view?usp=drivesdk,https://drive.google.com/file/d/1YNlesqvR66iKH_CrbVk4Y3DWO75e0XZH/view?usp=drivesdk
Qualitas Salud: Maximiza tu Cobertura Médica,https://drive.google.com/file/d/1xTDNLbfoKh15L7uWCOUGd1yFWlnldfMB/view?usp=drivesdk,https://drive.google.com/file/d/1yQGBB6z0vMaQMtwAV66_QLv_c0pVZxqj/view?usp=drivesdk
Conversión Imparable: Funnel de Ventas Digital,https://drive.google.com/file/d/1VY-0V6DlBxNZHxuYlQZQ7TdKaKkm2tPZ/view?usp=drivesdk,https://drive.google.com/file/d/1MMU9vaye_kTKqxqaSvRnOpVSd5AwbG-q/view?usp=drivesdk
Vende Más: Las Bases de las Ventas Exitosas,https://drive.google.com/file/d/195RA5lOGsZLYB2vJ8gz7gKE0PG4YXmPI/view?usp=drivesdk,https://drive.google.com/file/d/1hLWBPa3tONlDzzQjjJogny4xcrFFe_6G/view?usp=drivesdk
Prospección 2.0: Éxito en Redes Sociales,https://drive.google.com/file/d/1SXCeA8ggqx3OgBZskbQ6zWjJp4BwrziM/view?usp=drivesdk,No se encontró imagen
VITALIA: Diseña tu Retiro de Lujo,https://drive.google.com/file/d/10XLrSMLNBRfY63ON73hMOPp4qSYvNqKF/view?usp=drivesdk,No se encontró imagen
Lecciones Maestras: Sesión de Cierre con Diana,https://drive.google.com/file/d/1ztWJYOTZK0clLJ_gCZFDk6bkkA5DEg_P/view?usp=drivesdk,No se encontró imagen
Fundamentos y Estrategias Iniciales,https://drive.google.com/file/d/1AOgTG4Wp9v8gaEiROot2Ezu52fNjXlLI/view?usp=drivesdk,No se encontró imagen
Dominando GNP Autos: Cierre de Estrategias,https://drive.google.com/file/d/1vzptkOu3VGPX4AVrkZy1WldbnGasa5ml/view?usp=drivesdk,No se encontró imagen
Repensando tu Camino: Éxito en la Carrera de Seguros,https://drive.google.com/file/d/1eyKpXqAJ8EEPXW6KJ91cl89O2BDxKtns/view?usp=drivesdk,https://drive.google.com/file/d/1gXrTMatgLtmQO5gpmXeLLFve3pUF8vGl/view?usp=drivesdk
Supera tus Límites: Rompe el Techo de Cristal,https://drive.google.com/file/d/1k6yanPwVWy4lFQ0a-EyJ0A1yqnNduO50/view?usp=drivesdk,No se encontró imagen
PERSONALIZA GNP: Adaptando tus Gastos Médicos,https://drive.google.com/file/d/1DOJL_WJBmnA2ZsmOlwF5ZTX85zxUhvzm/view?usp=drivesdk,No se encontró imagen
Bienestar Digital: Manejo de Estrés con Tecnología,https://drive.google.com/file/d/1Wo37ov99gTTv_dEPuknbRl99wMUtPsGO/view?usp=drivesdk,No se encontró imagen
CHUBB Auto: Coberturas Premium y Análisis de Tarifa,https://drive.google.com/file/d/1jQb4HYE6gzZU8d13VQ-japM9V5H4Udax/view?usp=drivesdk,No se encontró imagen
ADN 2025: Evento Exclusivo de Lanzamiento,https://drive.google.com/file/d/1q2IaZYq2Nft21E3RDwfk-LQ4RsIRkBeI/view?usp=drivesdk,No se encontró imagen`;

function extractGoogleDriveId(url) {
  if (!url || url === 'No se encontró imagen') return null;
  const match = url.match(/\/d\/([^\/]+)\//);
  return match ? match[1] : null;
}

function getDirectDownloadUrl(driveUrl) {
  const fileId = extractGoogleDriveId(driveUrl);
  if (!fileId) return null;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function sanitizeFilename(titulo) {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const downloadUrl = getDirectDownloadUrl(url);
    if (!downloadUrl) {
      reject(new Error('Invalid URL'));
      return;
    }

    https.get(downloadUrl, { followRedirect: true }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        });
      } else {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }
    }).on('error', reject);
  });
}

async function uploadToSupabase(bucket, path, fileBuffer) {
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(`${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`);
        } else {
          reject(new Error(`Upload failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

async function updateDatabase(titulo, videoUrl, imageUrl) {
  const url = `${SUPABASE_URL}/rest/v1/seguros_lessons`;

  const updateData = {};
  if (videoUrl) updateData.video_url = videoUrl;
  if (imageUrl) updateData.miniatura_url = imageUrl;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(`${url}?titulo=eq.${encodeURIComponent(titulo)}`);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Prefer': 'return=minimal',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`DB update failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(updateData));
    req.end();
  });
}

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = [];
    let current = '';
    let inQuotes = false;

    for (let char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim());

    if (parts.length >= 2) {
      items.push({
        titulo: parts[0],
        videoUrl: parts[1] || '',
        imageUrl: parts[2] || ''
      });
    }
  }

  return items;
}

async function main() {
  console.log('🚀 Iniciando migración de videos a MOVI Digital\n');

  const items = parseCSV(csvData);
  console.log(`📊 Total de items a migrar: ${items.length}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const filename = sanitizeFilename(item.titulo);

    console.log(`\n[${i + 1}/${items.length}] ${item.titulo}`);

    let videoUrl = null;
    let imageUrl = null;

    if (item.videoUrl && item.videoUrl !== 'No se encontró imagen') {
      try {
        console.log('  → Descargando video...');
        const videoBuffer = await downloadFile(item.videoUrl);
        console.log(`  → Video descargado (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

        console.log('  → Subiendo a MOVI...');
        const videoPath = `academia-negocios-2025/${filename}.mp4`;
        videoUrl = await uploadToSupabase('seguros-videos', videoPath, videoBuffer);
        console.log('  ✓ Video subido exitosamente');
      } catch (error) {
        console.error(`  ✗ Error con video: ${error.message}`);
        errorCount++;
      }
    }

    if (item.imageUrl && item.imageUrl !== 'No se encontró imagen') {
      try {
        console.log('  → Descargando imagen...');
        const imageBuffer = await downloadFile(item.imageUrl);
        console.log('  → Imagen descargada');

        console.log('  → Subiendo a MOVI...');
        const imagePath = `academia-negocios-2025/${filename}.jpg`;
        imageUrl = await uploadToSupabase('seguros-thumbnails', imagePath, imageBuffer);
        console.log('  ✓ Imagen subida exitosamente');
      } catch (error) {
        console.error(`  ✗ Error con imagen: ${error.message}`);
      }
    }

    if (videoUrl || imageUrl) {
      try {
        console.log('  → Actualizando base de datos...');
        await updateDatabase(item.titulo, videoUrl, imageUrl);
        console.log('  ✓ Base de datos actualizada');
        successCount++;
      } catch (error) {
        console.error(`  ✗ Error actualizando BD: ${error.message}`);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n\n✅ Migración completada`);
  console.log(`   Exitosos: ${successCount}`);
  console.log(`   Errores: ${errorCount}`);
}

main().catch(console.error);
