import type { ReactNode } from 'react';
import { ArrowLeft, Download, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { type Asegurado, type ResultadoCotizacion } from '../../lib/aunaOncoCotizador';
import {
  PARENTESCOS,
  afirmativas,
  type Solicitud,
  type Contratante,
  type Domicilio,
  type DatosAseguradoSolicitud,
  type DetalleAfirmativo,
} from '../../lib/aunaOncoSolicitud';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const inputCls = 'w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent';
const labelCls = 'block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1';

const ENTIDADES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México',
  'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán',
  'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas', 'Nacido en el extranjero',
];

function Tarjeta({ titulo, children, nota }: { titulo: string; children: ReactNode; nota?: string }) {
  return (
    <section className="rounded-2xl bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/[0.06] p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{titulo}</h3>
        {nota && <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">{nota}</p>}
      </div>
      {children}
    </section>
  );
}

function Campo({ label, value, onChange, type = 'text', placeholder, className = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}</label>
      <input type={type} className={inputCls} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function SiNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-200 dark:border-white/10 overflow-hidden">
      {[true, false].map(v => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
          className={`px-3 py-1.5 text-xs font-semibold ${value === v ? 'bg-accent text-accent-foreground' : 'bg-white dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}>
          {v ? 'Sí' : 'No'}
        </button>
      ))}
    </div>
  );
}

interface Props {
  solicitud: Solicitud;
  setSolicitud: (fn: (s: Solicitud) => Solicitud) => void;
  asegurados: Asegurado[];
  resultado: ResultadoCotizacion;
  faltan: string[];
  generando: boolean;
  error: string | null;
  onVolver: () => void;
  onGenerar: () => void;
}

export default function SolicitudEmisionAuna({ solicitud: s, setSolicitud, asegurados, resultado, faltan, generando, error, onVolver, onGenerar }: Props) {
  const c = s.contratante;
  const fisica = c.tipoPersona === 'fisica';
  const setC = (cambios: Partial<Contratante>) => setSolicitud(x => ({ ...x, contratante: { ...x.contratante, ...cambios } }));
  const setDom = (cambios: Partial<Domicilio>) => setSolicitud(x => ({ ...x, contratante: { ...x.contratante, domicilio: { ...x.contratante.domicilio, ...cambios } } }));
  const setAseg = (id: string, cambios: Partial<DatosAseguradoSolicitud>) =>
    setSolicitud(x => ({ ...x, asegurados: { ...x.asegurados, [id]: { ...x.asegurados[id], ...cambios } } }));

  const detalleDe = (aseguradoId: string, pregunta: number): DetalleAfirmativo => {
    const existente = s.detalles.find(d => d.aseguradoId === aseguradoId && d.pregunta === pregunta);
    return existente ?? { id: `${aseguradoId}-${pregunta}`, aseguradoId, pregunta, diagnostico: '', fecha: '', medicamento: '', cirugia: '', clinica: '' };
  };
  const setDetalle = (aseguradoId: string, pregunta: number, cambios: Partial<DetalleAfirmativo>) =>
    setSolicitud(x => {
      const actual = detalleDe(aseguradoId, pregunta);
      const otros = x.detalles.filter(d => !(d.aseguradoId === aseguradoId && d.pregunta === pregunta));
      return { ...x, detalles: [...otros, { ...actual, ...cambios }] };
    });

  const hayAfirmativas = asegurados.some(a => afirmativas(a).length > 0 || a.respuestas.p4);

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-5">
        <button type="button" onClick={onVolver} className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-accent">
          <ArrowLeft className="w-4 h-4" /> Volver a la cotización
        </button>

        <Tarjeta titulo="Contratante" nota="Quien paga la póliza. Debe ser mayor de edad.">
          <div className="flex rounded-lg border border-neutral-200 dark:border-white/10 overflow-hidden w-fit">
            {(['fisica', 'moral'] as const).map(t => (
              <button key={t} type="button" onClick={() => setC({ tipoPersona: t })}
                className={`px-4 py-1.5 text-xs font-semibold ${c.tipoPersona === t ? 'bg-accent text-accent-foreground' : 'bg-white dark:bg-neutral-800 text-neutral-500'}`}>
                Persona {t === 'fisica' ? 'física' : 'moral'}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Campo label={fisica ? 'Nombre(s)' : 'Razón social'} value={c.nombres} onChange={v => setC({ nombres: v })} className={fisica ? '' : 'sm:col-span-3'} />
            {fisica && <Campo label="Apellido paterno" value={c.apellidoPaterno} onChange={v => setC({ apellidoPaterno: v })} />}
            {fisica && <Campo label="Apellido materno" value={c.apellidoMaterno} onChange={v => setC({ apellidoMaterno: v })} />}
            <Campo label="RFC" value={c.rfc} onChange={v => setC({ rfc: v.toUpperCase() })} />
            {fisica && <Campo label="CURP (si cuenta con ella)" value={c.curp} onChange={v => setC({ curp: v.toUpperCase() })} />}
            <Campo label={fisica ? 'Fecha de nacimiento' : 'Fecha de constitución'} type="date" value={c.fechaNacimiento} onChange={v => setC({ fechaNacimiento: v })} />
            {fisica && (
              <div>
                <label className={labelCls}>Sexo</label>
                <select className={inputCls} value={c.sexo} onChange={e => setC({ sexo: e.target.value as Contratante['sexo'] })}>
                  <option value="">Selecciona…</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
            )}
            {fisica && (
              <div>
                <label className={labelCls}>Entidad de nacimiento</label>
                <select className={inputCls} value={c.entidadNacimiento} onChange={e => setC({ entidadNacimiento: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {ENTIDADES.map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
            )}
            <Campo label="País de nacimiento" value={c.paisNacimiento} onChange={v => setC({ paisNacimiento: v })} />
            <Campo label="Nacionalidad" value={c.nacionalidad} onChange={v => setC({ nacionalidad: v })} />
            <Campo label="Teléfono" type="tel" value={c.telefono} onChange={v => setC({ telefono: v })} />
            <Campo label="Correo electrónico" type="email" value={c.email} onChange={v => setC({ email: v })} />
            <Campo label="Ocupación, profesión o giro" value={c.ocupacion} onChange={v => setC({ ocupacion: v })} />
            <Campo label="No. de serie FIEL (opcional)" value={c.serieFiel} onChange={v => setC({ serieFiel: v })} />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Domicilio particular del contratante">
          <div className="grid sm:grid-cols-6 gap-3">
            <Campo label="Calle" value={c.domicilio.calle} onChange={v => setDom({ calle: v })} className="sm:col-span-3" />
            <Campo label="No. exterior" value={c.domicilio.numExt} onChange={v => setDom({ numExt: v })} />
            <Campo label="No. interior" value={c.domicilio.numInt} onChange={v => setDom({ numInt: v })} />
            <Campo label="C.P." value={c.domicilio.cp} onChange={v => setDom({ cp: v.replace(/\D/g, '').slice(0, 5) })} />
            <Campo label="Colonia" value={c.domicilio.colonia} onChange={v => setDom({ colonia: v })} className="sm:col-span-3" />
            <Campo label="Municipio o alcaldía" value={c.domicilio.municipio} onChange={v => setDom({ municipio: v })} className="sm:col-span-3" />
            <Campo label="Ciudad o población" value={c.domicilio.ciudad} onChange={v => setDom({ ciudad: v })} className="sm:col-span-2" />
            <div className="sm:col-span-2">
              <label className={labelCls}>Entidad federativa</label>
              <select className={inputCls} value={c.domicilio.entidad} onChange={e => setDom({ entidad: e.target.value })}>
                <option value="">Selecciona…</option>
                {ENTIDADES.filter(e => e !== 'Nacido en el extranjero').map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <Campo label="País" value={c.domicilio.pais} onChange={v => setDom({ pais: v })} className="sm:col-span-2" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className={labelCls}>Origen de los recursos</label>
              <select className={inputCls} value={c.origenRecursos} onChange={e => setC({ origenRecursos: e.target.value as Contratante['origenRecursos'] })}>
                <option value="actividad">Producto de su ocupación, actividad o giro</option>
                <option value="otro">Otro</option>
              </select>
              {c.origenRecursos === 'otro' && <input className={`${inputCls} mt-2`} placeholder="Especifica" value={c.origenOtro} onChange={e => setC({ origenOtro: e.target.value })} />}
            </div>
            <div>
              <label className={labelCls}>Destino de los recursos</label>
              <select className={inputCls} value={c.destinoRecursos} onChange={e => setC({ destinoRecursos: e.target.value as Contratante['destinoRecursos'] })}>
                <option value="seguro">Contratar un seguro con Dentegra</option>
                <option value="otro">Otro</option>
              </select>
              {c.destinoRecursos === 'otro' && <input className={`${inputCls} mt-2`} placeholder="Especifica" value={c.destinoOtro} onChange={e => setC({ destinoOtro: e.target.value })} />}
            </div>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Reconocimiento del contratante y PEP">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-700 dark:text-neutral-300">¿Actúa a nombre de un tercero?</p>
            <SiNo value={s.tercero.actua} onChange={v => setSolicitud(x => ({ ...x, tercero: { ...x.tercero, actua: v } }))} />
          </div>
          {s.tercero.actua && (
            <div className="grid sm:grid-cols-3 gap-3">
              <Campo label="Nombre del tercero" value={s.tercero.nombre} onChange={v => setSolicitud(x => ({ ...x, tercero: { ...x.tercero, nombre: v } }))} />
              <Campo label="Parentesco o vínculo" value={s.tercero.parentesco} onChange={v => setSolicitud(x => ({ ...x, tercero: { ...x.tercero, parentesco: v } }))} />
              <Campo label="Acto jurídico del mandato" value={s.tercero.actoJuridico} onChange={v => setSolicitud(x => ({ ...x, tercero: { ...x.tercero, actoJuridico: v } }))} />
            </div>
          )}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-neutral-100 dark:border-white/5">
            <p className="text-xs text-neutral-700 dark:text-neutral-300">¿Usted, su cónyuge o un pariente hasta segundo grado es Persona Políticamente Expuesta?</p>
            <SiNo value={s.pep.es} onChange={v => setSolicitud(x => ({ ...x, pep: { ...x.pep, es: v } }))} />
          </div>
          {s.pep.es && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Campo label="Puesto, fecha y parentesco" value={s.pep.detalle} onChange={v => setSolicitud(x => ({ ...x, pep: { ...x.pep, detalle: v } }))} />
              <div>
                <label className={labelCls}>¿Tiene vínculos patrimoniales con una sociedad?</label>
                <div className="flex gap-2 items-center">
                  <SiNo value={s.pep.vinculos} onChange={v => setSolicitud(x => ({ ...x, pep: { ...x.pep, vinculos: v } }))} />
                  {s.pep.vinculos && <input className={inputCls} placeholder="Nombre de la sociedad" value={s.pep.sociedad} onChange={e => setSolicitud(x => ({ ...x, pep: { ...x.pep, sociedad: e.target.value } }))} />}
                </div>
              </div>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Asegurados" nota="Fecha de nacimiento, sexo, estatura, peso y cuestionario vienen de la cotización.">
          {asegurados.map((a, i) => {
            const da = s.asegurados[a.id];
            if (!da) return null;
            return (
              <div key={a.id} className="space-y-3 pb-4 border-b border-neutral-100 dark:border-white/5 last:border-0 last:pb-0">
                <p className="text-xs font-bold text-neutral-500">{i === 0 ? 'Titular' : `Dependiente A${i}`} · {a.sexo === 'F' ? 'Mujer' : 'Hombre'} · {a.fechaNacimiento || 'sin fecha'}{a.estatura && a.peso ? ` · ${a.estatura} m, ${a.peso} kg` : ''}</p>
                <div className="grid sm:grid-cols-4 gap-3">
                  <Campo label="Nombre(s)" value={da.nombres} onChange={v => setAseg(a.id, { nombres: v })} />
                  <Campo label="Apellido paterno" value={da.apellidoPaterno} onChange={v => setAseg(a.id, { apellidoPaterno: v })} />
                  <Campo label="Apellido materno" value={da.apellidoMaterno} onChange={v => setAseg(a.id, { apellidoMaterno: v })} />
                  <div>
                    <label className={labelCls}>Parentesco</label>
                    <select className={inputCls} value={da.parentesco} onChange={e => setAseg(a.id, { parentesco: e.target.value })}>
                      <option value="">Selecciona…</option>
                      {PARENTESCOS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <Campo label="Actividad profesional" value={da.actividad} onChange={v => setAseg(a.id, { actividad: v })} className="sm:col-span-2" />
                  {a.respuestas.p4 && <Campo label="Medicamento que toma (P4)" value={da.medicamentos} onChange={v => setAseg(a.id, { medicamentos: v })} className="sm:col-span-2" />}
                </div>
                <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                  <input type="checkbox" checked={da.mismoDomicilio} onChange={e => setAseg(a.id, { mismoDomicilio: e.target.checked })} />
                  Mismo domicilio que el contratante
                </label>
                {!da.mismoDomicilio && <Campo label="Domicilio" value={da.domicilio} onChange={v => setAseg(a.id, { domicilio: v })} />}

                {afirmativas(a).map(p => {
                  const det = detalleDe(a.id, p.num);
                  return (
                    <div key={p.id} className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-900/10 p-3 space-y-2">
                      <p className="text-xs text-amber-800 dark:text-amber-300"><b>P{p.num} · Sí.</b> {p.texto}</p>
                      <div className="grid sm:grid-cols-5 gap-2">
                        <Campo label="Diagnóstico o dolencia" value={det.diagnostico} onChange={v => setDetalle(a.id, p.num, { diagnostico: v })} className="sm:col-span-2" />
                        <Campo label="Fecha" value={det.fecha} onChange={v => setDetalle(a.id, p.num, { fecha: v })} placeholder="mm/aaaa" />
                        <Campo label="Medicamento" value={det.medicamento} onChange={v => setDetalle(a.id, p.num, { medicamento: v })} className="sm:col-span-2" />
                        <Campo label="Cirugía o procedimiento" value={det.cirugia} onChange={v => setDetalle(a.id, p.num, { cirugia: v })} className="sm:col-span-2" />
                        <Campo label="Clínica u hospital" value={det.clinica} onChange={v => setDetalle(a.id, p.num, { clinica: v })} className="sm:col-span-3" />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Tarjeta>

        <Tarjeta titulo="Médico de cabecera o tratante" nota={hayAfirmativas ? 'Obligatorio: hay respuestas afirmativas en el cuestionario.' : 'Opcional.'}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo label="Nombre" value={s.medico.nombre} onChange={v => setSolicitud(x => ({ ...x, medico: { ...x.medico, nombre: v } }))} />
            <Campo label="Especialidad" value={s.medico.especialidad} onChange={v => setSolicitud(x => ({ ...x, medico: { ...x.medico, especialidad: v } }))} />
            <Campo label="Teléfono" value={s.medico.telefono} onChange={v => setSolicitud(x => ({ ...x, medico: { ...x.medico, telefono: v } }))} />
            <Campo label="Correo" value={s.medico.email} onChange={v => setSolicitud(x => ({ ...x, medico: { ...x.medico, email: v } }))} />
            <Campo label="Dirección del consultorio" value={s.medico.direccion} onChange={v => setSolicitud(x => ({ ...x, medico: { ...x.medico, direccion: v } }))} className="sm:col-span-2" />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Póliza, agente y consentimiento">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Envío de documentos</label>
              <select className={inputCls} value={s.envio} onChange={e => setSolicitud(x => ({ ...x, envio: e.target.value as Solicitud['envio'] }))}>
                <option value="digital">Digital (correo)</option>
                <option value="impresa">Impresa</option>
              </select>
            </div>
            <Campo label="Clave de agente" value={s.agente.clave} onChange={v => setSolicitud(x => ({ ...x, agente: { ...x.agente, clave: v } }))} />
            <Campo label="Participación (%)" value={s.agente.participacion} onChange={v => setSolicitud(x => ({ ...x, agente: { ...x.agente, participacion: v.replace(/[^\d.]/g, '') } }))} />
            <Campo label="Lugar de firma" value={s.lugar} onChange={v => setSolicitud(x => ({ ...x, lugar: v }))} placeholder="Ciudad, estado" className="sm:col-span-3" />
          </div>
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-neutral-100 dark:border-white/5">
            <p className="text-xs text-neutral-700 dark:text-neutral-300">¿Acepta que Dentegra use sus datos no sensibles para promoción de productos y encuestas de satisfacción? <span className="text-neutral-400">(no condiciona la contratación)</span></p>
            <SiNo value={s.aceptaMercadotecnia} onChange={v => setSolicitud(x => ({ ...x, aceptaMercadotecnia: v }))} />
          </div>
        </Tarjeta>
      </div>

      <aside className="lg:sticky lg:top-4 space-y-4">
        <section className="rounded-2xl bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/[0.06] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Solicitud de emisión</h3>
            <img src="/logo-auna.png" alt="Auna" className="h-5 w-auto" />
          </div>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-neutral-500">Asegurados</dt><dd className="font-medium">{asegurados.length}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-500">Forma de pago</dt><dd className="font-medium">{resultado.formaPago === 'anual' ? 'Anual' : 'Mensual'}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-500">Prima total</dt><dd className="font-bold tabular-nums">{fmt(resultado.primaTotal)}</dd></div>
          </dl>
        </section>

        {faltan.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 mb-2"><AlertTriangle className="w-3.5 h-3.5" /> Falta para generarla ({faltan.length})</p>
            <ul className="text-[11px] text-amber-800/90 dark:text-amber-200/80 space-y-0.5 max-h-72 overflow-y-auto list-disc pl-4">
              {faltan.map(f => <li key={f}>{f}</li>)}
            </ul>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-4 h-4" /> Solicitud completa</p>
        )}

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <button type="button" onClick={onGenerar} disabled={generando || faltan.length > 0}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Generar solicitud PDF
        </button>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">El PDF lleva espacio para la firma autógrafa del contratante y del agente.</p>
      </aside>
    </div>
  );
}
