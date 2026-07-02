'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Perfil } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

type Estado = 'Por hacer' | 'En Proceso' | 'En espera' | 'Hecho'

interface Encargado {
  id: number
  nombre: string
}

interface Seguimiento {
  id: string
  codigo: string | null
  titulo: string
  descripcion: string | null
  estado: Estado
  encargado_id: number | null
  encargado_nombre: string | null
  creado_por: string | null
  creado_por_nombre: string | null
  created_at: string
  updated_at: string
}

interface SeguimientoNota {
  id: string
  seguimiento_id: string
  nota: string
  creado_por: string | null
  creado_por_nombre: string | null
  created_at: string
}

const ESTADOS: Estado[] = ['Por hacer', 'En Proceso', 'En espera', 'Hecho']
const ROLES_PERMITIDOS = ['admin', 'encargado', 'pentagono']

const colorEstado: Record<Estado, { bg: string; color: string; accent: string }> = {
  'Por hacer':  { bg: '#f1f5f9', color: '#334155', accent: '#64748b' },
  'En Proceso': { bg: '#fff7ed', color: '#b45309', accent: '#f59e0b' },
  'En espera':  { bg: '#f5f3ff', color: '#6d28d9', accent: '#8b5cf6' },
  'Hecho':      { bg: '#f0fdf4', color: '#166534', accent: '#22c55e' },
}

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function SeguimientosPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([])
  const [notasPorTarea, setNotasPorTarea] = useState<Record<string, SeguimientoNota[]>>({})
  const [encargados, setEncargados] = useState<Encargado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [notaTexto, setNotaTexto] = useState<Record<string, string>>({})
  const [guardandoNota, setGuardandoNota] = useState<string | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [confirmarEliminarId, setConfirmarEliminarId] = useState<string | null>(null)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevaDescripcion, setNuevaDescripcion] = useState('')
  const [nuevoEncargadoId, setNuevoEncargadoId] = useState('')
  const [guardandoTarea, setGuardandoTarea] = useState(false)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const { data: tareas, error: errTareas } = await supabase
        .from('seguimientos')
        .select('*')
        .order('created_at', { ascending: true })
      if (errTareas) throw errTareas
      setSeguimientos(tareas || [])

      const { data: notas, error: errNotas } = await supabase
        .from('seguimiento_notas')
        .select('*')
        .order('created_at', { ascending: false })
      if (errNotas) throw errNotas

      const agrupadas: Record<string, SeguimientoNota[]> = {}
      for (const n of notas || []) {
        if (!agrupadas[n.seguimiento_id]) agrupadas[n.seguimiento_id] = []
        agrupadas[n.seguimiento_id].push(n)
      }
      setNotasPorTarea(agrupadas)

      const { data: encData, error: errEnc } = await supabase
        .from('encargado_seguimiento')
        .select('*')
        .order('nombre')
      if (errEnc) throw errEnc
      setEncargados(encData || [])
    } catch (e: any) {
      const detalle = e?.message || e?.error_description || JSON.stringify(e)
      setError(`No se pudo cargar el tablero: ${detalle}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase
        .from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) setPerfil(p)

      const permitido = ROLES_PERMITIDOS.includes(p?.rol || '')
      setAutorizado(permitido)
      if (permitido) await cargarDatos()
    }
    init()
  }, [router, cargarDatos])

  const crearTarea = async () => {
    if (!nuevoTitulo.trim() || !perfil) return
    setGuardandoTarea(true)
    try {
      const encargadoSeleccionado = encargados.find((e) => String(e.id) === nuevoEncargadoId)
      const { data, error: err } = await supabase
        .from('seguimientos')
        .insert({
          titulo: nuevoTitulo.trim(),
          descripcion: nuevaDescripcion.trim() || null,
          estado: 'Por hacer',
          encargado_id: encargadoSeleccionado ? encargadoSeleccionado.id : null,
          encargado_nombre: encargadoSeleccionado ? encargadoSeleccionado.nombre : null,
          creado_por: perfil.id,
          creado_por_nombre: perfil.nombre_completo || perfil.email,
        })
        .select()
        .single()
      if (err) throw err
      if (data) setSeguimientos((prev) => [...prev, data as Seguimiento])
      setNuevoTitulo('')
      setNuevaDescripcion('')
      setNuevoEncargadoId('')
      setMostrarForm(false)
    } catch (e: any) {
      const detalle = e?.message || e?.error_description || JSON.stringify(e)
      setError(`No se pudo crear la actividad: ${detalle}`)
    } finally {
      setGuardandoTarea(false)
    }
  }

  const cambiarEstado = async (id: string, nuevoEstado: Estado) => {
    setSeguimientos((prev) => prev.map((s) => (s.id === id ? { ...s, estado: nuevoEstado } : s)))
    const { error: err } = await supabase
      .from('seguimientos')
      .update({ estado: nuevoEstado })
      .eq('id', id)
    if (err) {
      setError(`No se pudo actualizar el estado: ${err.message}`)
      cargarDatos()
    }
  }

  const cambiarEncargado = async (id: string, encargadoIdStr: string) => {
    const encargado = encargados.find((e) => String(e.id) === encargadoIdStr) || null
    setSeguimientos((prev) => prev.map((s) =>
      s.id === id ? { ...s, encargado_id: encargado?.id ?? null, encargado_nombre: encargado?.nombre ?? null } : s
    ))
    const { error: err } = await supabase
      .from('seguimientos')
      .update({ encargado_id: encargado?.id ?? null, encargado_nombre: encargado?.nombre ?? null })
      .eq('id', id)
    if (err) {
      setError(`No se pudo actualizar el encargado: ${err.message}`)
      cargarDatos()
    }
  }

  const agregarNota = async (seguimientoId: string) => {
    const texto = (notaTexto[seguimientoId] || '').trim()
    if (!texto || !perfil) return
    setGuardandoNota(seguimientoId)
    try {
      const { data, error: err } = await supabase
        .from('seguimiento_notas')
        .insert({
          seguimiento_id: seguimientoId,
          nota: texto,
          creado_por: perfil.id,
          creado_por_nombre: perfil.nombre_completo || perfil.email,
        })
        .select()
        .single()
      if (err) throw err
      if (data) {
        setNotasPorTarea((prev) => ({
          ...prev,
          [seguimientoId]: [data as SeguimientoNota, ...(prev[seguimientoId] || [])],
        }))
      }
      setNotaTexto((prev) => ({ ...prev, [seguimientoId]: '' }))
    } catch (e: any) {
      const detalle = e?.message || e?.error_description || JSON.stringify(e)
      setError(`No se pudo agregar el seguimiento: ${detalle}`)
    } finally {
      setGuardandoNota(null)
    }
  }

  const eliminarTarea = async (id: string) => {
    setEliminandoId(id)
    try {
      const { error: err } = await supabase
        .from('seguimientos')
        .delete()
        .eq('id', id)
      if (err) throw err
      setSeguimientos((prev) => prev.filter((s) => s.id !== id))
      setNotasPorTarea((prev) => {
        const copia = { ...prev }
        delete copia[id]
        return copia
      })
      setExpandidoId(null)
    } catch (e: any) {
      const detalle = e?.message || e?.error_description || JSON.stringify(e)
      setError(`No se pudo eliminar la actividad: ${detalle}`)
    } finally {
      setEliminandoId(null)
      setConfirmarEliminarId(null)
    }
  }

  if (autorizado === false) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
        <NavBar rol={perfil?.rol || ''} />
        <main className="max-w-2xl mx-auto px-4 py-10">
          <div className="card text-center py-10">
            <p className="font-semibold text-lg" style={{ color: '#991b1b' }}>Acceso restringido</p>
            <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>
              No tienes permiso para ver esta seccion.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol || ''} />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-bold text-lg" style={{ color: '#004466' }}>Seguimientos</h1>
            <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>Tablero de actividades del equipo</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 whitespace-pre-wrap break-words">{error}</div>
        )}

        {loading || autorizado === null ? (
          <div className="card text-center py-10">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#004466' }}></div>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {ESTADOS.map((estado) => {
              const estilo = colorEstado[estado]
              const tareas = seguimientos.filter((s) => s.estado === estado)
              return (
                <div key={estado} className="flex-shrink-0 w-[280px] sm:w-[300px]">
                  <div
                    className="rounded-t-xl px-3 py-2 flex items-center justify-between border-b-2"
                    style={{ background: estilo.bg, borderColor: estilo.accent }}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: estilo.color }}>{estado}</span>
                      <span
                        className="text-xs font-bold px-1.5 rounded-full"
                        style={{ background: 'white', color: estilo.color }}>
                        {tareas.length}
                      </span>
                    </div>
                    {estado === 'Por hacer' && (
                      <button
                        onClick={() => setMostrarForm((v) => !v)}
                        className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: '#004466', color: 'white' }}
                        title="Nueva actividad">
                        +
                      </button>
                    )}
                  </div>

                  <div
                    className="rounded-b-xl p-2 space-y-2 min-h-[200px]"
                    style={{ background: '#fafafa', border: '1px solid var(--color-borde)', borderTop: 'none' }}>

                    {estado === 'Por hacer' && mostrarForm && (
                      <div className="card space-y-2 p-3">
                        <input
                          type="text"
                          value={nuevoTitulo}
                          onChange={(e) => setNuevoTitulo(e.target.value)}
                          placeholder="Titulo de la actividad"
                          className="input-field text-sm"
                          autoFocus
                        />
                        <textarea
                          value={nuevaDescripcion}
                          onChange={(e) => setNuevaDescripcion(e.target.value)}
                          placeholder="Descripcion (opcional)"
                          className="input-field text-sm"
                          rows={2}
                        />
                        <select
                          value={nuevoEncargadoId}
                          onChange={(e) => setNuevoEncargadoId(e.target.value)}
                          className="input-field text-sm">
                          <option value="">Sin encargado asignado</option>
                          {encargados.map((enc) => (
                            <option key={enc.id} value={enc.id}>{enc.nombre}</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={crearTarea}
                            disabled={guardandoTarea || !nuevoTitulo.trim()}
                            className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white disabled:opacity-50"
                            style={{ background: '#004466' }}>
                            {guardandoTarea ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            onClick={() => { setMostrarForm(false); setNuevoTitulo(''); setNuevaDescripcion(''); setNuevoEncargadoId('') }}
                            className="text-xs font-semibold py-1.5 px-3 rounded-lg border"
                            style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {tareas.length === 0 && !(estado === 'Por hacer' && mostrarForm) && (
                      <p className="text-xs text-center py-6" style={{ color: 'var(--texto-secundario)' }}>
                        Sin actividades
                      </p>
                    )}

                    {tareas.map((tarea) => {
                      const expandido = expandidoId === tarea.id
                      const notas = notasPorTarea[tarea.id] || []
                      const confirmando = confirmarEliminarId === tarea.id
                      return (
                        <div
                          key={tarea.id}
                          className="card p-3 space-y-2"
                          style={{ borderLeft: `3px solid ${estilo.accent}` }}>
                          {tarea.codigo && (
                            <span
                              className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: '#004466', color: 'white' }}>
                              {tarea.codigo}
                            </span>
                          )}
                          <button
                            onClick={() => setExpandidoId(expandido ? null : tarea.id)}
                            className="text-left w-full font-semibold text-sm"
                            style={{ color: 'var(--texto-principal)' }}>
                            {tarea.titulo}
                          </button>
                          {tarea.encargado_nombre && (
                            <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--texto-secundario)' }}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {tarea.encargado_nombre}
                            </p>
                          )}

                          {expandido && (
                            <div className="space-y-3 pt-1">
                              {tarea.descripcion && (
                                <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>
                                  {tarea.descripcion}
                                </p>
                              )}

                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium w-16 flex-shrink-0" style={{ color: 'var(--texto-secundario)' }}>Estado:</span>
                                <select
                                  value={tarea.estado}
                                  onChange={(e) => cambiarEstado(tarea.id, e.target.value as Estado)}
                                  className="text-xs border rounded-lg px-2 py-1 flex-1"
                                  style={{ borderColor: 'var(--color-borde)' }}>
                                  {ESTADOS.map((op) => (
                                    <option key={op} value={op}>{op}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium w-16 flex-shrink-0" style={{ color: 'var(--texto-secundario)' }}>Encargado:</span>
                                <select
                                  value={tarea.encargado_id ? String(tarea.encargado_id) : ''}
                                  onChange={(e) => cambiarEncargado(tarea.id, e.target.value)}
                                  className="text-xs border rounded-lg px-2 py-1 flex-1"
                                  style={{ borderColor: 'var(--color-borde)' }}>
                                  <option value="">Sin asignar</option>
                                  {encargados.map((enc) => (
                                    <option key={enc.id} value={enc.id}>{enc.nombre}</option>
                                  ))}
                                </select>
                              </div>

                              {tarea.creado_por_nombre && (
                                <p className="text-[11px]" style={{ color: 'var(--texto-secundario)' }}>
                                  Creado por {tarea.creado_por_nombre} · {formatFecha(tarea.created_at)}
                                </p>
                              )}

                              <div className="space-y-2 border-t pt-2" style={{ borderColor: 'var(--color-borde)' }}>
                                <p className="text-xs font-semibold" style={{ color: 'var(--texto-principal)' }}>
                                  Seguimiento / detalles
                                </p>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={notaTexto[tarea.id] || ''}
                                    onChange={(e) => setNotaTexto((prev) => ({ ...prev, [tarea.id]: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && agregarNota(tarea.id)}
                                    placeholder="Agregar nota o avance..."
                                    className="input-field text-xs flex-1"
                                  />
                                  <button
                                    onClick={() => agregarNota(tarea.id)}
                                    disabled={guardandoNota === tarea.id || !(notaTexto[tarea.id] || '').trim()}
                                    className="text-xs font-semibold px-3 rounded-lg text-white disabled:opacity-50"
                                    style={{ background: '#004466' }}>
                                    Agregar
                                  </button>
                                </div>

                                {notas.length > 0 && (
                                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {notas.map((n) => (
                                      <div key={n.id} className="text-xs rounded-lg px-2 py-1.5" style={{ background: '#f1f5f9' }}>
                                        <p style={{ color: 'var(--texto-principal)' }}>{n.nota}</p>
                                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--texto-secundario)' }}>
                                          {n.creado_por_nombre || 'Usuario'} · {formatFecha(n.created_at)}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="border-t pt-2" style={{ borderColor: 'var(--color-borde)' }}>
                                {confirmando ? (
                                  <div className="rounded-lg px-2 py-2 space-y-1.5" style={{ background: '#fee2e2' }}>
                                    <p className="text-xs font-medium" style={{ color: '#991b1b' }}>
                                      ¿Eliminar esta actividad? No se puede deshacer.
                                    </p>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => eliminarTarea(tarea.id)}
                                        disabled={eliminandoId === tarea.id}
                                        className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white disabled:opacity-50"
                                        style={{ background: '#dc2626' }}>
                                        {eliminandoId === tarea.id ? 'Eliminando...' : 'Si, eliminar'}
                                      </button>
                                      <button
                                        onClick={() => setConfirmarEliminarId(null)}
                                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
                                        style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)', background: 'white' }}>
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmarEliminarId(tarea.id)}
                                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                                    style={{ color: '#dc2626' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Eliminar actividad
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
