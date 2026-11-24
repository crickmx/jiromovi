// Banco de pruebas visual del correo y WhatsApp, con datos simulados.
// Ver qa/ui-correo/README.md. No toca Supabase ni el servidor de correo reales.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
const root = path.resolve(__dirname, '../..');
const MOCKS: Record<string, string> = {
  [path.join(root, 'src/contexts/AuthContext.tsx')]: path.join(root, 'qa/ui-correo/mockAuth.tsx'),
  [path.join(root, 'src/lib/supabase.ts')]: path.join(root, 'qa/ui-correo/mockSupabase.ts'),
};
export default defineConfig({
  root,
  plugins: [react(), {
    name: 'mocks', enforce: 'pre',
    async resolveId(source, importer, opts) {
      if (!importer || importer.includes('ui-correo/mock')) return null;
      const r = await this.resolve(source, importer, { ...opts, skipSelf: true });
      if (r && MOCKS[r.id]) return MOCKS[r.id];
      return null;
    },
  }],
  resolve: { alias: { '@': path.join(root, 'src') } },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://simulado.invalid') },
  server: { port: 5199, strictPort: true },
});
