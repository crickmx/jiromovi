import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useBugReportConfig() {
  const [botonActivo, setBotonActivo] = useState(false);

  useEffect(() => {
    let activo = true;
    supabase.from('bug_report_config').select('boton_activo').eq('id', 1).maybeSingle().then(({ data }) => {
      if (activo) setBotonActivo(data?.boton_activo ?? false);
    });
    return () => { activo = false; };
  }, []);

  return { botonActivo };
}
