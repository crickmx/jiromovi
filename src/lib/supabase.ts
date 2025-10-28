import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Función para mostrar error amigable cuando faltan variables
function showConfigError() {
  if (typeof document !== 'undefined') {
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); padding: 48px; max-width: 600px; text-align: center;">
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);">
              <svg style="width: 40px; height: 40px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h1 style="font-size: 28px; font-weight: 700; color: #1a202c; margin: 0 0 16px 0;">
              Configuración Requerida
            </h1>
            <p style="font-size: 16px; color: #4a5568; line-height: 1.6; margin: 0 0 32px 0;">
              Esta aplicación requiere variables de entorno para funcionar. Por favor, configura las siguientes variables en tu plataforma de hosting:
            </p>
            <div style="background: #f7fafc; border: 2px dashed #cbd5e0; border-radius: 12px; padding: 24px; text-align: left; margin-bottom: 32px;">
              <code style="display: block; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px; color: #2d3748; line-height: 1.8; word-break: break-all;">
                <strong style="color: #667eea;">VITE_SUPABASE_URL</strong><br/>
                <strong style="color: #667eea;">VITE_SUPABASE_ANON_KEY</strong>
              </code>
            </div>
            <div style="background: #edf2f7; border-left: 4px solid #667eea; padding: 16px; border-radius: 8px; margin-bottom: 32px; text-align: left;">
              <p style="margin: 0; font-size: 14px; color: #2d3748; line-height: 1.6;">
                <strong style="color: #667eea;">💡 Importante:</strong> Las variables deben configurarse en tu plataforma de hosting (Netlify, Vercel, etc.) y después debes hacer un nuevo deploy.
              </p>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <a href="/README_IMPORTANTE.md" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
                <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Guía de Configuración
              </a>
              <a href="https://github.com/yourusername/yourrepo" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; background: white; color: #667eea; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; border: 2px solid #667eea; transition: all 0.2s;">
                <svg style="width: 18px; height: 18px;" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Documentación
              </a>
            </div>
            <p style="margin-top: 32px; font-size: 13px; color: #718096; line-height: 1.6;">
              Si ya configuraste las variables y sigues viendo este mensaje, verifica que hayas redeployed la aplicación después de agregar las variables.
            </p>
          </div>
        </div>
      `;
    }
  }
  console.error('❌ ERROR: Variables de entorno de Supabase no configuradas');
  console.info('📚 Lee el archivo README_IMPORTANTE.md para instrucciones');
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
