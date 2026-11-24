#!/usr/bin/env node
/**
 * Script de prueba para verificar la sincronización de pólizas SICAS
 *
 * Uso: node test-sicas-polizas.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Leer variables del archivo .env
const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSyncPolizas() {
  console.log('🔄 Probando sincronización de pólizas SICAS...\n');

  try {
    // 1. Verificar configuración
    console.log('1️⃣ Verificando configuración SICAS...');
    const { data: config, error: configError } = await supabase
      .from('sicas_config')
      .select('*')
      .single();

    if (configError) {
      console.error('❌ Error al obtener configuración:', configError.message);
      return;
    }

    console.log(`✅ Configuración encontrada:`);
    console.log(`   Endpoint: ${config.endpoint}`);
    console.log(`   Usuario: ${config.sicas_usuario}`);
    console.log(`   Password: ${config.sicas_password ? '[CONFIGURADO]' : '[NO CONFIGURADO]'}\n`);

    // 2. Invocar edge function
    console.log('2️⃣ Invocando edge function de sincronización...');
    const response = await fetch(
      `${supabaseUrl}/functions/v1/sync-sicas-polizas-vigentes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Error en sincronización:', result);
      return;
    }

    console.log('✅ Respuesta de sincronización:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    // 3. Verificar datos guardados
    console.log('3️⃣ Verificando datos guardados en BD...');
    const { data: polizas, error: polizasError, count } = await supabase
      .from('sicas_polizas_vigentes')
      .select('*', { count: 'exact' });

    if (polizasError) {
      console.error('❌ Error al consultar pólizas:', polizasError.message);
      return;
    }

    console.log(`✅ Total de pólizas en BD: ${count || 0}`);

    if (polizas && polizas.length > 0) {
      console.log('\n📋 Primeras 3 pólizas:');
      polizas.slice(0, 3).forEach((p, i) => {
        console.log(`\n   Póliza ${i + 1}:`);
        console.log(`   - No. Póliza: ${p.no_poliza}`);
        console.log(`   - Asegurado: ${p.asegurado}`);
        console.log(`   - Vendedor ID: ${p.vend_id}`);
        console.log(`   - Vendedor: ${p.vend_nombre}`);
        console.log(`   - Prima: $${p.prima_neta || 0}`);
        console.log(`   - Vigencia hasta: ${p.vigencia_hasta}`);
      });
    }

    // 4. Verificar vendedores únicos
    console.log('\n4️⃣ Verificando vendedores en las pólizas...');
    const vendedoresUnicos = [...new Set(polizas?.map(p => p.vend_id) || [])];
    console.log(`✅ Vendedores únicos: ${vendedoresUnicos.length}`);
    if (vendedoresUnicos.length > 0 && vendedoresUnicos.length <= 10) {
      console.log('   IDs:', vendedoresUnicos.join(', '));
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.error(error.stack);
  }
}

testSyncPolizas();
