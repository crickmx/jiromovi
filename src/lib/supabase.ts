import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qhwvuuyjhcennqccgvse.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ';

// Función para mostrar error amigable cuando faltan variables
function showConfigError() {
  if (typeof document !== 'undefined') {
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="background: white; border-radius: 20px; box-shadow: 0 25px 70px rgba(0,0,0,0.3); padding: 48px; max-width: 650px; text-align: center;">
            <div style="width: 90px; height: 90px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 10px 40px rgba(239, 68, 68, 0.4);">
              <svg style="width: 50px; height: 50px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h1 style="font-size: 32px; font-weight: 800; color: #1a202c; margin: 0 0 12px 0; letter-spacing: -0.5px;">
              Error de Conexión
            </h1>
            <p style="font-size: 18px; color: #dc2626; font-weight: 600; margin: 0 0 24px 0;">
              No se puede conectar con el servidor
            </p>
            <p style="font-size: 16px; color: #4a5568; line-height: 1.7; margin: 0 0 32px 0;">
              Las variables de entorno de Supabase no están configuradas en esta instalación. Para que la aplicación funcione correctamente, un administrador debe configurar las siguientes variables en la plataforma de hosting:
            </p>
            <div style="background: #fef2f2; border: 2px solid #fca5a5; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <svg style="width: 24px; height: 24px; color: #dc2626; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <p style="margin: 0; font-size: 15px; color: #991b1b; font-weight: 600; text-align: left;">
                  Variables Requeridas (Administradores)
                </p>
              </div>
              <code style="display: block; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px; color: #7f1d1d; line-height: 2; text-align: left; background: white; padding: 16px; border-radius: 8px;">
                <strong style="color: #dc2626;">VITE_SUPABASE_URL</strong><br/>
                <strong style="color: #dc2626;">VITE_SUPABASE_ANON_KEY</strong>
              </code>
            </div>
            <div style="background: #eff6ff; border-left: 5px solid #3b82f6; padding: 20px; border-radius: 10px; margin-bottom: 32px; text-align: left;">
              <p style="margin: 0 0 12px 0; font-size: 15px; color: #1e40af; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                <svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                </svg>
                Pasos para Administradores
              </p>
              <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #1e3a8a; line-height: 1.8;">
                <li>Accede al panel de tu plataforma de hosting (Netlify, Vercel, etc.)</li>
                <li>Ve a la sección "Environment Variables" o "Variables de Entorno"</li>
                <li>Agrega las dos variables listadas arriba</li>
                <li><strong>Importante:</strong> Realiza un nuevo deploy después de agregar las variables</li>
              </ol>
            </div>
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
              <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
                <strong style="color: #0f172a;">📖 Guía Completa:</strong> Lee el archivo
                <code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; color: #0f172a; font-weight: 600;">CONFIGURAR_VARIABLES_ENTORNO.md</code>
                en el repositorio para instrucciones detalladas paso a paso.
              </p>
            </div>
            <div style="border-top: 2px solid #e2e8f0; padding-top: 24px;">
              <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                ¿No eres administrador? Contacta al equipo de sistemas para resolver este problema.<br/>
                <strong style="color: #334155;">Dominio:</strong> <code style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; color: #0f172a;">app.movi.digital</code>
              </p>
            </div>
          </div>
        </div>
      `;
    }
  }
  console.error('❌ ERROR: Variables de entorno de Supabase no configuradas');
  console.error('📍 Dominio actual:', window.location.hostname);
  console.error('🔧 Configuración requerida:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - VITE_SUPABASE_ANON_KEY');
  console.info('📚 Consulta el archivo CONFIGURAR_VARIABLES_ENTORNO.md para instrucciones completas');
}

// Verificar que las variables existan y crear el cliente
let supabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  showConfigError();
  // Crear cliente dummy para evitar errores de importación
  supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key');
} else {
  console.log('[Supabase] Initializing with URL:', supabaseUrl);

  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'movi-auth',
    },
    global: {
      headers: {
        'X-Client-Info': 'movi-digital-intranet',
      },
    },
  });

  console.log('[Supabase] Client initialized successfully');
}

export const supabase = supabaseClient;
