'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Perfil, type Reunion } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

type ReunionForm = {
  titulo: string
  descripcion: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  lugar: string
  tipo: 'general' | 'sector' | 'templarios'
  sector_id: string
}

const FORM_VACIO: ReunionForm = {
  titulo: '', descripcion: '', fecha: '', hora_inicio: '', hora_fin: '',
  lugar: '', tipo: 'general', sector_id: ''
}

export default function CalendarioPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [sectores, setSectores] = useState<{ id: number; nombre: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<ReunionForm>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mesActual, setMesActual] = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)

  const puedeAgendar = perfil?.rol === 'admin' || perfil?.rol === 'encargado'

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) setPerfil(p)
      const { data: s } = await supabase.from('sectores').select('id, nombre').order('nombre')
      setSectores(s || [])
      await cargarReuniones()
    }
    init()
  }, [router])

  const cargarReuniones = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reuniones')
      .select('*, perfiles(nombre_completo, email), sectores(nombre)')
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
    setReuniones(data || [])
    setLoading(false)
  }

  // Calendario
  const year = mesActual.getFullYear()
  const mes = mesActual.getMonth()
  const primerDia = new Date(year, mes, 1).getDay()
  const diasEnMes = new Date(year, mes + 1, 0).getDate()

  const reunionesPorDia = (dia: number) => {
    const fecha = `${year}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    return reuniones.filter(r => r.fecha === fecha)
  }

  const reunionesDiaSeleccionado = diaSeleccionado
    ? reuniones.filter(r => r.fecha === diaSeleccionado)
    : []

  const proximasReuniones = reuniones.filter(r => {
    const hoy = new Date().toISOString().split('T')[0]
    return r.fecha >= hoy
  }).slice(0, 5)

  const guardarReunion = async () => {
    if (!form.titulo || !form.fecha || !form.hora_inicio) {
      setError('Título, fecha y hora de inicio son obligatorios.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const { error: e } = await supabase.from('reuniones').insert({
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        fecha: form.fecha,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin || null,
        lugar: form.lugar || null,
        tipo: form.tipo,
        sector_id: form.sector_id ? Number(form.sector_id) : null,
        creado_por: perfil!.id,
      })
      if (e) throw e
      setModal(false)
      setForm(FORM_VACIO)
      await cargarReuniones()
    } catch {
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const TIPO_COLOR: Record<string, { bg: string; color: string; label: string }> = {
    general:     { bg: '#e0f7fa', color: '#004466', label: 'General' },
    sector:      { bg: '#fef3c7', color: '#b45309', label: 'Sector' },
    templarios:  { bg: '#ede9fe', color: '#5b21b6', label: 'Templarios' },
  }

  const formatHora = (h: string) => h?.slice(0, 5) || ''
  const formatFecha = (f: string) => {
    const [y, m, d] = f.split('-')
    return `${d} de ${MESES[parseInt(m) - 1]} ${y}`
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol || ''} />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base" style={{ color: 'var(--texto-principal)' }}>Calendario</h2>
            <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>Reuniones programadas</p>
          </div>
          {puedeAgendar && (
            <button
              onClick={() => { setModal(true); setError('') }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#004466', color: 'white' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agendar
            </button>
          )}
        </div>

        {/* Calendario visual */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setMesActual(new Date(year, mes - 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>
              {MESES[mes]} {year}
            </p>
            <button onClick={() => setMesActual(new Date(year, mes + 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS.map(d => (
              <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'var(--texto-secundario)' }}>{d}</div>
            ))}
          </div>

          {/* Celdas del mes */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: primerDia }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: diasEnMes }).map((_, i) => {
              const dia = i + 1
              const fechaStr = `${year}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
              const reuDia = reunionesPorDia(dia)
              const hoy = new Date().toISOString().split('T')[0] === fechaStr
              const seleccionado = diaSeleccionado === fechaStr
              return (
                <button
                  key={dia}
                  onClick={() => setDiaSeleccionado(seleccionado ? null : fechaStr)}
                  className="relative flex flex-col items-center py-1.5 rounded-lg transition-all"
                  style={{
                    background: seleccionado ? '#004466' : hoy ? '#e0f7fa' : 'transparent',
                    color: seleccionado ? 'white' : hoy ? '#004466' : 'var(--texto-principal)',
                    minHeight: '40px'
                  }}>
                  <span className="text-xs font-medium">{dia}</span>
                  {reuDia.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {reuDia.slice(0, 3).map((r, idx) => (
                        <div key={idx} className="w-1.5 h-1.5 rounded-full" style={{ background: seleccionado ? 'white' : TIPO_COLOR[r.tipo]?.color || '#004466' }} />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="flex gap-3 mt-3 pt-3 border-t flex-wrap" style={{ borderColor: 'var(--color-borde)' }}>
            {Object.entries(TIPO_COLOR).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: v.color }} />
                <span className="text-xs" style={{ color: 'var(--texto-secundario)' }}>{v.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reuniones del día seleccionado */}
        {diaSeleccionado && (
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--texto-principal)' }}>
              {formatFecha(diaSeleccionado)}
            </p>
            {reunionesDiaSeleccionado.length === 0 ? (
              <div className="card text-center py-6">
                <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>Sin reuniones este día.</p>
                {puedeAgendar && (
                  <button
                    onClick={() => { setForm({ ...FORM_VACIO, fecha: diaSeleccionado }); setModal(true) }}
                    className="mt-3 text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: '#e0f7fa', color: '#004466' }}>
                    + Agendar reunión este día
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {reunionesDiaSeleccionado.map(r => (
                  <ReunionCard key={r.id} r={r} tipoColor={TIPO_COLOR} formatHora={formatHora} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Próximas reuniones */}
        <div>
          <p className="text-sm font-semibold mb-2" style={{ color: 'var(--texto-principal)' }}>Próximas reuniones</p>
          {loading ? (
            <div className="card text-center py-8">
              <svg className="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" style={{ color: '#004466' }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : proximasReuniones.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>No hay reuniones próximas agendadas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {proximasReuniones.map(r => (
                <ReunionCard key={r.id} r={r} tipoColor={TIPO_COLOR} formatHora={formatHora} showFecha formatFecha={formatFecha} />
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Modal agendar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-borde)' }}>
              <h3 className="font-semibold text-base" style={{ color: 'var(--texto-principal)' }}>Nueva reunión</h3>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Título *</label>
                <input className="input-field w-full" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Nombre de la reunión" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Descripción</label>
                <textarea className="input-field w-full" rows={2} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Agenda o notas..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Fecha *</label>
                  <input type="date" className="input-field w-full" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Tipo</label>
                  <select className="input-field w-full" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as any })}>
                    <option value="general">General</option>
                    <option value="sector">Sector</option>
                    <option value="templarios">Templarios</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Hora inicio *</label>
                  <input type="time" className="input-field w-full" value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Hora fin</label>
                  <input type="time" className="input-field w-full" value={form.hora_fin} onChange={e => setForm({ ...form, hora_fin: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Lugar</label>
                <input className="input-field w-full" value={form.lugar} onChange={e => setForm({ ...form, lugar: e.target.value })} placeholder="Dirección o nombre del lugar" />
              </div>
              {form.tipo === 'sector' && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Sector</label>
                  <select className="input-field w-full" value={form.sector_id} onChange={e => setForm({ ...form, sector_id: e.target.value })}>
                    <option value="">Selecciona un sector</option>
                    {sectores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              )}

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                  Cancelar
                </button>
                <button onClick={guardarReunion} disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: '#004466', color: 'white' }}>
                  {guardando ? 'Guardando...' : 'Guardar reunión'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReunionCard({ r, tipoColor, formatHora, showFecha, formatFecha }: {
  r: Reunion
  tipoColor: Record<string, { bg: string; color: string; label: string }>
  formatHora: (h: string) => string
  showFecha?: boolean
  formatFecha?: (f: string) => string
}) {
  const tc = tipoColor[r.tipo] || tipoColor.general
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: tc.bg, color: tc.color }}>{tc.label}</span>
            {showFecha && formatFecha && (
              <span className="text-xs" style={{ color: 'var(--texto-secundario)' }}>{formatFecha(r.fecha)}</span>
            )}
          </div>
          <p className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>{r.titulo}</p>
          {r.descripcion && <p className="text-xs mt-0.5" style={{ color: 'var(--texto-secundario)' }}>{r.descripcion}</p>}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs" style={{ color: 'var(--texto-secundario)' }}>
            <span>🕐 {formatHora(r.hora_inicio)}{r.hora_fin ? ` – ${formatHora(r.hora_fin)}` : ''}</span>
            {r.lugar && <span>📍 {r.lugar}</span>}
            {(r.sectores as any)?.nombre && <span>🏘 {(r.sectores as any).nombre}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
