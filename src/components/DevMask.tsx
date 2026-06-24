import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth, type Usuario } from '../contexts/AuthContext';

interface MoviUserRow {
  id: string;
  nombre: string | null;
  apellidos: string | null;
  email_laboral: string | null;
  rol: string | null;
}

export function DevMask() {
  if (!import.meta.env.DEV) return null;
  return <DevMaskPanel />;
}

function DevMaskPanel() {
  const { maskAs, unmask, isMasked, usuario } = useAuth();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<MoviUserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    if (!open || users.length > 0) return;
    setLoadingUsers(true);
    supabase
      .from('usuarios')
      .select('id, nombre, apellidos, email_laboral, rol')
      .eq('activo', true)
      .order('apellidos')
      .then(({ data }) => {
        setUsers((data as MoviUserRow[]) || []);
        setLoadingUsers(false);
      });
  }, [open]);

  async function handleApply() {
    if (!selected) return;
    setLoadingApply(true);
    const { data, error } = await supabase
      .from('usuarios')
      .select('*, oficina:oficinas(id, nombre, accent_color)')
      .eq('id', selected)
      .maybeSingle();
    setLoadingApply(false);
    if (error || !data) {
      alert('No se pudo cargar el perfil del usuario seleccionado.');
      return;
    }
    maskAs(data as unknown as Usuario);
    setSelected('');
    setOpen(false);
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
      background: '#0f172a',
      border: '1px solid #1e3a5f',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      minWidth: open ? '290px' : 'auto',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '12px',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: open ? '9px 14px 8px' : '8px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: open ? '1px solid #1e293b' : 'none',
        }}
      >
        <span style={{
          background: '#f59e0b', color: '#1c1917', fontSize: '10px',
          fontWeight: 800, padding: '1px 6px', borderRadius: '4px', letterSpacing: '.05em',
        }}>DEV</span>
        <span style={{ color: '#94a3b8', fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isMasked
            ? <><span style={{ color: '#4ade80' }}>✦</span> {usuario?.nombre} {usuario?.apellidos}</>
            : 'Máscara de usuario'}
        </span>
        <span style={{ color: '#334155', fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '12px 14px' }}>
          {isMasked ? (
            <>
              <div style={{ background: '#052e16', border: '1px solid #166534', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>
                <p style={{ color: '#4ade80', margin: 0, fontSize: '11px', fontWeight: 700 }}>
                  ✦ Vista activa como:
                </p>
                <p style={{ color: '#86efac', margin: '2px 0 0', fontSize: '12px' }}>
                  {usuario?.nombre} {usuario?.apellidos}
                </p>
                <p style={{ color: '#4ade80', margin: '1px 0 0', fontSize: '10px', opacity: 0.7 }}>
                  {usuario?.rol} · {usuario?.email_laboral}
                </p>
              </div>
              <button
                onClick={unmask}
                style={{
                  width: '100%', background: '#1e293b', color: '#f87171',
                  border: '1px solid #7f1d1d', borderRadius: '7px',
                  padding: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                }}
              >
                Volver a mi sesión real
              </button>
              <div style={{ borderTop: '1px solid #1e293b', margin: '12px 0 10px' }} />
              <p style={{ color: '#475569', margin: '0 0 8px', fontSize: '11px' }}>Cambiar máscara:</p>
            </>
          ) : (
            <p style={{ color: '#64748b', margin: '0 0 8px', fontSize: '11px', lineHeight: 1.5 }}>
              Simula MOVI y Bonos como otro usuario:
            </p>
          )}

          {loadingUsers ? (
            <p style={{ color: '#334155', fontSize: '11px', margin: '0 0 8px' }}>Cargando usuarios…</p>
          ) : (
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              style={{
                width: '100%', background: '#1e293b', color: '#f1f5f9',
                border: '1px solid #334155', borderRadius: '7px',
                padding: '6px 8px', fontSize: '12px', marginBottom: '10px', outline: 'none',
              }}
            >
              <option value="">— Seleccionar usuario —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellidos} · {u.rol}
                </option>
              ))}
            </select>
          )}

          <button
            disabled={!selected || loadingApply}
            onClick={handleApply}
            style={{
              width: '100%',
              background: selected ? '#164281' : '#1e293b',
              color: selected ? '#fff' : '#334155',
              border: '1px solid ' + (selected ? '#1e40af' : '#334155'),
              borderRadius: '7px', padding: '7px', fontSize: '12px', fontWeight: 700,
              cursor: selected ? 'pointer' : 'not-allowed', transition: 'all .15s',
            }}
          >
            {loadingApply ? 'Cargando…' : 'Activar máscara'}
          </button>
        </div>
      )}
    </div>
  );
}
