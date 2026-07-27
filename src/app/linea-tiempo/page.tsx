'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Perfil, type LineaTiempoEvento } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const LIMITE_FECHA = '2027-07-31'

type EventoForm = {
  titulo: string
  descripcion: string
  lugar: string
  encargado_nombre: string
  fecha: string
  hora_inicio: string
  hora_fin: string
}

const FORM_VACIO: EventoForm = {
  titulo: '', descripcion: '', lugar: '', encargado_nombre: '',
  fecha: '', hora_inicio: '', hora_fin: ''
}

const hoyStr = () => new Date().toISOString().split('T')[0]

function sumarDias(fechaBase: string, n: number) {
  const [y, m, d] = fechaBase.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function diffDias(desde: string, hasta: string) {
  const [y1, m1, d1] = desde.split('-').map(Number)
  const [y2, m2, d2] = hasta.split('-').map(Number)
  const dt1 = new Date(y1, m1 - 1, d1)
  const dt2 = new Date(y2, m2 - 1, d2)
  return Math.round((dt2.getTime() - dt1.getTime()) / (1000 * 60 * 60 * 24))
}

function diaSemanaDe(fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export default function LineaTiempoPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [eventos, setEventos] = useState<LineaTiempoEvento[]>([])
  const [loading, setLoading] = useState(true)

  // Meses colapsados/expandidos. Solo el mes actual arranca abierto.
  const [mesesAbiertos, setMesesAbiertos] = useState<Set<string>>(new Set([hoyStr().slice(0, 7)]))

  // Modal agregar/editar
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<EventoForm>(FORM_VACIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Modal detalle (solo lectura)
  const [detalle, setDetalle] = useState<LineaTiempoEvento | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) {
        // Admin y pentagono acceden a esta pestaña
        if (p.rol !== 'admin' && p.rol !== 'pentagono') { router.replace('/afiliados'); return }
        setPerfil(p)
      }
      await cargarEventos()
    }
    init()
  }, [router])

  const cargarEventos = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('linea_tiempo_eventos')
      .select('*')
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
    setEventos(data || [])
    setLoading(false)
  }

  // Agrupa eventos por fecha para lookup O(1) al renderizar cada día
  const eventosPorFecha = useMemo(() => {
    const mapa: Record<string, LineaTiempoEvento[]> = {}
    for (const ev of eventos) {
      if (!mapa[ev.fecha]) mapa[ev.fecha] = []
      mapa[ev.fecha].push(ev)
    }
    return mapa
  }, [eventos])

  // Genera TODOS los días desde hoy hasta julio 2027, agrupados por mes (YYYY-MM)
  const mesesConDias = useMemo(() => {
    const base = hoyStr()
    const totalDias = diffDias(base, LIMITE_FECHA) + 1
    const grupos: { key: string; label: string; dias: string[] }[] = []
    let grupoActual: { key: string; label: string; dias: string[] } | null = null

    for (let i = 0; i < totalDias; i++) {
      const f = sumarDias(base, i)
      const key = f.slice(0, 7) // YYYY-MM
      if (!grupoActual || grupoActual.key !== key) {
        const partes: string[] = key.split('-')
        const y: string = partes[0]
        const m: string = partes[1]
        const nuevoGrupo: { key: string; label: string; dias: string[] } = {
          key,
          label: `${MESES[parseInt(m) - 1]} ${y}`,
          dias: []
        }
        grupoActual = nuevoGrupo
        grupos.push(nuevoGrupo)
      }
      grupoActual.dias.push(f)
    }
    return grupos
  }, [])

  // Conteo de actividades por mes, para mostrar junto al header
  const conteoEventosPorMes = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const ev of eventos) {
      const key = ev.fecha.slice(0, 7)
      mapa[key] = (mapa[key] || 0) + 1
    }
    return mapa
  }, [eventos])

  const toggleMes = (key: string) => {
    setMesesAbiertos(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(key)) nuevo.delete(key)
      else nuevo.add(key)
      return nuevo
    })
  }

  const abrirModalNuevo = (fechaInicial: string) => {
    setForm({ ...FORM_VACIO, fecha: fechaInicial })
    setEditandoId(null)
    setError('')
    setModal(true)
  }

  const abrirModalEditar = (ev: LineaTiempoEvento) => {
    setForm({
      titulo: ev.titulo || '',
      descripcion: ev.descripcion || '',
      lugar: ev.lugar || '',
      encargado_nombre: ev.encargado_nombre || '',
      fecha: ev.fecha || '',
      hora_inicio: ev.hora_inicio || '',
      hora_fin: ev.hora_fin || '',
    })
    setEditandoId(ev.id)
    setError('')
    setDetalle(null)
    setModal(true)
  }

  const guardarEvento = async () => {
    if (!form.titulo || !form.fecha || !form.hora_inicio) {
      setError('Título, fecha y hora de inicio son obligatorios.')
      return
    }
    if (form.fecha > LIMITE_FECHA) {
      setError('La fecha no puede ser posterior a julio 2027.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const payload = {
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        lugar: form.lugar || null,
        encargado_nombre: form.encargado_nombre || null,
        fecha: form.fecha,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin || null,
      }

      if (editandoId) {
        const { error: e1 } = await supabase
          .from('linea_tiempo_eventos')
          .update(payload)
          .eq('id', editandoId)
        if (e1) throw e1

        const { error: e2 } = await supabase
          .from('reuniones')
          .update({
            titulo: payload.titulo,
            descripcion: payload.descripcion,
            lugar: payload.lugar,
            encargado_nombre: payload.encargado_nombre,
            fecha: payload.fecha,
            hora_inicio: payload.hora_inicio,
            hora_fin: payload.hora_fin,
          })
          .eq('linea_tiempo_id', editandoId)
        if (e2) throw e2
      } else {
        const { data: nuevo, error: e1 } = await supabase
          .from('linea_tiempo_eventos')
          .insert({ ...payload, creado_por: perfil!.id })
          .select()
          .single()
        if (e1) throw e1

        const { error: e2 } = await supabase.from('reuniones').insert({
          titulo: payload.titulo,
          descripcion: payload.descripcion,
          lugar: payload.lugar,
          encargado_nombre: payload.encargado_nombre,
          fecha: payload.fecha,
          hora_inicio: payload.hora_inicio,
          hora_fin: payload.hora_fin,
          tipo: 'general',
          creado_por: perfil!.id,
          origen: 'linea_tiempo',
          linea_tiempo_id: nuevo.id,
        })
        if (e2) throw e2
      }

      setModal(false)
      setForm(FORM_VACIO)
      setEditandoId(null)
      await cargarEventos()
    } catch {
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminarEvento = async (id: string) => {
    if (!confirm('¿Eliminar este evento de la línea de tiempo? También se eliminará del calendario. Esta acción no se puede deshacer.')) return
    setEliminando(id)
    try {
      const { error: e } = await supabase
        .from('linea_tiempo_eventos')
        .delete()
        .eq('id', id)
      if (e) throw e
      setDetalle(null)
      await cargarEventos()
    } catch {
      alert('Error al eliminar. Intenta de nuevo.')
    } finally {
      setEliminando(null)
    }
  }

  const formatHora = (h: string) => h?.slice(0, 5) || ''

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol || ''} />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        <div>
          <h2 className="font-semibold text-base" style={{ color: 'var(--texto-principal)' }}>Línea de tiempo</h2>
          <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>Toca un día para agregar una actividad, o toca una actividad para ver sus detalles</p>
        </div>

        {loading ? (
          <div className="card text-center py-8">
            <svg className="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" style={{ color: '#004466' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <div className="space-y-2">
            {mesesConDias.map(grupo => {
              const abierto = mesesAbiertos.has(grupo.key)
              const cantidadEventos = conteoEventosPorMes[grupo.key] || 0

              return (
                <div key={grupo.key} className="card !p-0 overflow-hidden">
                  {/* Header del mes — clic para colapsar/expandir */}
                  <button
                    onClick={() => toggleMes(grupo.key)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform"
                        style={{ color: '#004466', transform: abierto ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>{grupo.label}</span>
                    </div>
                    {cantidadEventos > 0 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#e0f7fa', color: '#004466' }}>
                        {cantidadEventos} {cantidadEventos === 1 ? 'actividad' : 'actividades'}
                      </span>
                    )}
                  </button>

                  {/* Días del mes — solo se montan si está abierto */}
                  {abierto && (
                    <div className="relative pl-6 pr-3 pb-3">
                      <div className="absolute left-[21px] top-0 bottom-3 w-0.5" style={{ background: 'var(--color-borde)' }} />

                      <div className="space-y-1">
                        {grupo.dias.map(fecha => {
                          const [, , d] = fecha.split('-')
                          const esHoy = fecha === hoyStr()
                          const diaSemana = diaSemanaDe(fecha)
                          const esFinDeSemana = diaSemana === 0 || diaSemana === 6
                          const eventosDia = eventosPorFecha[fecha] || []
                          const tieneEventos = eventosDia.length > 0

                          const fondoFila = esFinDeSemana ? '#eaf4fc' : 'transparent'
                          const colorAcento = esFinDeSemana ? '#0369a1' : 'var(--texto-secundario)'

                          return (
                            <div key={fecha} className="relative">
                              <div
                                className="absolute -left-6 top-3 w-4 h-4 rounded-full border-2"
                                style={{
                                  background: esHoy ? '#004466' : tieneEventos ? '#e0f7fa' : 'white',
                                  borderColor: esFinDeSemana && !esHoy ? '#0369a1' : '#004466'
                                }}
                              />
                              <div
                                className="relative rounded-xl px-3 py-2.5 mb-1 cursor-pointer transition-colors hover:bg-gray-50"
                                style={{
                                  background: fondoFila,
                                  border: esHoy ? '2px solid #004466' : '2px solid transparent'
                                }}
                                onClick={() => abrirModalNuevo(fecha)}>

                                {/* Insignia "Hoy" en la esquina superior derecha del recuadro */}
                                {esHoy && (
                                  <span
                                    className="absolute top-0 right-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-bl-lg rounded-tr-[10px]"
                                    style={{ background: '#004466', color: 'white' }}>
                                    Hoy
                                  </span>
                                )}

                                <div className="flex items-start gap-3">
                                  <div className="shrink-0 w-10 text-center">
                                    <p className="text-lg font-bold leading-none" style={{ color: esHoy ? '#004466' : esFinDeSemana ? '#0369a1' : 'var(--texto-principal)' }}>{d}</p>
                                  </div>

                                  <div className="flex-1 min-w-0 pt-0.5">
                                    <p className="text-xs font-medium" style={{ color: colorAcento }}>
                                      {DIAS_SEMANA[diaSemana]}
                                    </p>

                                    {tieneEventos ? (
                                      <div className="mt-1 space-y-1">
                                        {eventosDia.map(ev => (
                                          <button
                                            key={ev.id}
                                            onClick={(e) => { e.stopPropagation(); setDetalle(ev) }}
                                            className="block w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold truncate"
                                            style={{ background: '#004466', color: 'white' }}>
                                            {formatHora(ev.hora_inicio)} · {ev.titulo}
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs mt-1" style={{ color: 'var(--texto-secundario)', opacity: 0.6 }}>
                                        + Agregar actividad
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Modal detalle (solo lectura) */}
      {detalle && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setDetalle(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-borde)' }}>
              <h3 className="font-semibold text-base" style={{ color: 'var(--texto-principal)' }}>Detalle de actividad</h3>
              <button onClick={() => setDetalle(null)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="font-semibold text-lg" style={{ color: 'var(--texto-principal)' }}>{detalle.titulo}</p>

              <div className="flex flex-col gap-1.5 text-sm" style={{ color: 'var(--texto-secundario)' }}>
                <span>📅 {detalle.fecha}</span>
                <span>🕐 {formatHora(detalle.hora_inicio)}{detalle.hora_fin ? ` – ${formatHora(detalle.hora_fin)}` : ''}</span>
                {detalle.lugar && <span>📍 {detalle.lugar}</span>}
                {detalle.encargado_nombre && <span>👤 {detalle.encargado_nombre}</span>}
              </div>

              {detalle.descripcion && (
                <p className="text-sm pt-1 border-t" style={{ color: 'var(--texto-principal)', borderColor: 'var(--color-borde)' }}>
                  {detalle.descripcion}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => eliminarEvento(detalle.id)}
                  disabled={eliminando === detalle.id}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border disabled:opacity-50"
                  style={{ borderColor: '#dc2626', color: '#dc2626' }}>
                  {eliminando === detalle.id ? 'Eliminando...' : 'Eliminar'}
                </button>
                <button
                  onClick={() => abrirModalEditar(detalle)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                  style={{ background: '#004466', color: 'white' }}>
                  Editar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar / editar */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-borde)' }}>
              <h3 className="font-semibold text-base" style={{ color: 'var(--texto-principal)' }}>
                {editandoId ? 'Editar actividad' : 'Nueva actividad'}
              </h3>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Título *</label>
                <input className="input-field w-full" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Nombre de la actividad" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Lugar</label>
                <input className="input-field w-full" value={form.lugar} onChange={e => setForm({ ...form, lugar: e.target.value })} placeholder="Dirección o nombre del lugar" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Encargado</label>
                <input className="input-field w-full" value={form.encargado_nombre} onChange={e => setForm({ ...form, encargado_nombre: e.target.value })} placeholder="Nombre del encargado" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Fecha *</label>
                <input type="date" max={LIMITE_FECHA} className="input-field w-full" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
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
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Descripción</label>
                <textarea className="input-field w-full" rows={3} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Notas..." />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                  Cancelar
                </button>
                <button onClick={guardarEvento} disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: '#004466', color: 'white' }}>
                  {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Guardar actividad'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
