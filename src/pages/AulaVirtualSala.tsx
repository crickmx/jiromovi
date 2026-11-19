import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { aulaDaily, type EntradaAula } from '../lib/aulaDaily';
import { SalaAula } from '../components/aula/SalaAula';

/**
 * Sala del Aula Virtual (usuarios MOVI).
 * La edge function resuelve el rol en el servidor y devuelve el meeting token:
 * aquí nunca se decide quién puede moderar.
 */
export function AulaVirtualSala() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario, loading: cargandoSesion } = useAuth();

  const [entrada, setEntrada] = useState<EntradaAula | null>(null);
  const [titulo, setTitulo] = useState('Aula Virtual');
  const [error, setError] = useState<string | null>(null);

  const salir = useCallback(() => navigate('/seguros-education/aula-virtual'), [navigate]);

  useEffect(() => {
    if (cargandoSesion) return;
    if (!id || !usuario) return;

    let vivo = true;
    aulaDaily
      .entrar(id)
      .then((r) => {
        if (vivo) setEntrada(r);
      })
      .catch((e: Error) => {
        if (vivo) setError(e.message || 'No fue posible entrar a la clase');
      });

    return () => {
      vivo = false;
    };
  }, [id, usuario, cargandoSesion]);

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    supabase
      .from('aula_eventos')
      .select('titulo')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (vivo && data?.titulo) setTitulo(data.titulo);
      });
    return () => {
      vivo = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-title-sm font-bold text-neutral-900 dark:text-white">No se pudo entrar</p>
        <p className="max-w-md text-body-sm text-neutral-500 dark:text-white/60">{error}</p>
        <button
          onClick={salir}
          className="rounded-xl bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent-hover"
        >
          Volver al Aula Virtual
        </button>
      </div>
    );
  }

  if (!entrada) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-accent/20 border-t-accent" />
        <p className="text-body-sm text-neutral-500 dark:text-white/60">Preparando la sala…</p>
      </div>
    );
  }

  return (
    <SalaAula
      eventoId={id!}
      entrada={entrada}
      anfitrion={entrada.rol === 'host'}
      titulo={titulo}
      onSalir={salir}
    />
  );
}

export default AulaVirtualSala;