'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Perfil, type Secretaria, type SecretariaIndicador } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

type GrupoKey = 'sectorial' | 'territorial' | 'transversal' | 'estrategica' | 'administrativa'

const GRUPOS: { key: GrupoKey; label: string }[] = [
  { key: 'sectorial', label: 'Secretarías Sectoriales' },
  { key: 'transversal', label: 'Secretarías Transversales' },
  { key: 'estrategica', label: 'Secretarías Estratégicas' },
]

const FUNCIONES_TABS = [
  { key: 'funciones_permanentes' as const, label: 'Permanentes' },
  { key: 'funciones_proselitismo' as const, label: 'Proselitismo' },
  { key: 'funciones_campana' as const, label: 'Campaña' },
]

const METAS_TABS = [
  { key: 'metas_corto' as const, label: 'Corto plazo' },
  { key: 'metas_mediano' as const, label: 'Mediano plazo' },
  { key: 'metas_largo' as const, label: 'Largo plazo' },
]

type FuncionesKey = typeof FUNCIONES_TABS[number]['key']
type MetasKey = typeof METAS_TABS[number]['key']

type IndicadorForm = {
  id: string
  esNuevo: boolean
  indicador: string
  meta: string
  periodo: string
  orden: number
}

function renderLista(texto: string | null) {
  if (!texto) return <p className="text-sm italic" style={{ color: 'var(--texto-secundario)' }}>Sin información registrada.</p>
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  return (
    <ul className="space-y-1.5">
      {lineas.map((linea, i) => (
        <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--texto-principal)' }}>
          <span style={{ color: '#004466' }}>•</span>
          <span>{linea.replace(/^-\s*/, '')}</span>
        </li>
      ))}
    </ul>
  )
}

export default function SecretariasPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [secretarias, setSecretarias] = useState<Secretaria[]>([])
  const [indicadores, setIndicadores] = useState<Record<string, SecretariaIndicador[]>>({})
  const [coordinador, setCoordinador] = useState('')
  const [loading, setLoading] = useState(true)

  const esAdmin = perfil?.rol === 'admin'

  const [encargadoEditId, setEncargadoEditId] = useState<string | null>(null)
  const [encargadoValor, setEncargadoValor] = useState('')
  const [guardandoEncargado, setGuardandoEncargado] = useState(false)

  const [detalle, setDetalle] = useState<Secretaria | null>(null)

  const [editandoMisionVision, setEditandoMisionVision] = useState(false)
  const [misionInput, setMisionInput] = useState('')
  const [visionInput, setVisionInput] = useState('')
  const [guardandoMisionVision, setGuardandoMisionVision] = useState(false)

  const [funcionesTab, setFuncionesTab] = useState<FuncionesKey>('funciones_permanentes')
  const [editandoFunciones, setEditandoFunciones] = useState(false)
  const [funcionesInput, setFuncionesInput] = useState('')
  const [guardandoFunciones, setGuardandoFunciones] = useState(false)

  const [metasTab, setMetasTab] = useState<MetasKey>('metas_corto')
  const [editandoMetas, setEditandoMetas] = useState(false)
  const [metasInput, setMetasInput] = useState('')
  const [guardandoMetas, setGuardandoMetas] = useState(false)

  const [editandoCoordinacion, setEditandoCoordinacion] = useState(false)
  const [coordinacionInput, setCoordinacionInput] = useState('')
  const [guardandoCoordinacion, setGuardandoCoordinacion] = useState(false)

  const [editandoIndicadores, setEditandoIndicadores] = useState(false)
  const [indicadoresForm, setIndicadoresForm] = useState<IndicadorForm[]>([])
  const [indicadoresEliminados, setIndicadoresEliminados] = useState<string[]>([])
  const [guardandoIndicadores, setGuardandoIndicadores] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) {
        if (p.rol !== 'admin' && p.rol !== 'pentagono') { router.replace('/afiliados'); return }
        setPerfil(p)
      }
      await cargarDatos()
    }
    init()
  }, [router])

  const cargarDatos = async () => {
    setLoading(true)
    const [{ data: secs }, { data: inds }, { data: cfg }] = await Promise.all([
      supabase.from('secretarias').select('*').order('orden', { ascending: true }),
      supabase.from('secretaria_indicadores').select('*').order('orden', { ascending: true }),
      supabase.from('configuracion').select('*').eq('clave', 'coordinador_municipal').single(),
    ])
    setSecretarias(secs || [])
    const mapa: Record<string, SecretariaIndicador[]> = {}
    for (const ind of inds || []) {
      if (!mapa[ind.secretaria_id]) mapa[ind.secretaria_id] = []
      mapa[ind.secretaria_id].push(ind)
    }
    setIndicadores(mapa)
    setCoordinador(cfg?.valor || 'Santiago Cobos')
    setLoading(false)
  }

  const secretariasPorGrupo = useMemo(() => {
    const mapa: Record<GrupoKey, Secretaria[]> = {
      sectorial: [], territorial: [], transversal: [], estrategica: [], administrativa: [],
    }
    for (const s of secretarias) {
      const g = s.grupo as GrupoKey
      if (mapa[g]) mapa[g].push(s)
    }
    return mapa
  }, [secretarias])

  const reportanDirecto = useMemo(() => secretarias.filter(s => s.reporta_directo), [secretarias])

  const abrirEdicionEncargado = (sec: Secretaria) => {
    setEncargadoEditId(sec.id)
    setEncargadoValor(sec.encargado_nombre || '')
  }

  const guardarEncargado = async (id: string) => {
    setGuardandoEncargado(true)
    try {
      const { error } = await supabase
        .from('secretarias')
        .update({ encargado_nombre: encargadoValor || null })
        .eq('id', id)
      if (error) throw error
      setSecretarias(prev => prev.map(s => s.id === id ? { ...s, encargado_nombre: encargadoValor || null } : s))
      setDetalle(prev => prev && prev.id === id ? { ...prev, encargado_nombre: encargadoValor || null } : prev)
      setEncargadoEditId(null)
    } catch {
      alert('Error al guardar el encargado.')
    } finally {
      setGuardandoEncargado(false)
    }
  }

  const abrirDetalle = (sec: Secretaria) => {
    setDetalle(sec)
    setEditandoMisionVision(false)
    setEditandoFunciones(false)
    setEditandoMetas(false)
    setEditandoCoordinacion(false)
    setEditandoIndicadores(false)
    setFuncionesTab('funciones_permanentes')
    setMetasTab('metas_corto')
  }

  const cerrarDetalle = () => setDetalle(null)

  const actualizarSecretariaLocal = (id: string, patch: Partial<Secretaria>) => {
    setSecretarias(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
    setDetalle(prev => prev && prev.id === id ? { ...prev, ...patch } : prev)
  }

  const abrirEdicionMisionVision = () => {
    if (!detalle) return
    setMisionInput(detalle.mision || '')
    setVisionInput(detalle.vision || '')
    setEditandoMisionVision(true)
  }

  const guardarMisionVision = async () => {
    if (!detalle) return
    setGuardandoMisionVision(true)
    try {
      const { error } = await supabase
        .from('secretarias')
        .update({ mision: misionInput || null, vision: visionInput || null })
        .eq('id', detalle.id)
      if (error) throw error
      actualizarSecretariaLocal(detalle.id, { mision: misionInput || null, vision: visionInput || null })
      setEditandoMisionVision(false)
    } catch {
      alert('Error al guardar.')
    } finally {
      setGuardandoMisionVision(false)
    }
  }

  const abrirEdicionFunciones = () => {
    if (!detalle) return
    setFuncionesInput((detalle[funcionesTab] as string) || '')
    setEditandoFunciones(true)
  }

  const cambiarFuncionesTab = (tab: FuncionesKey) => {
    setFuncionesTab(tab)
    setEditandoFunciones(false)
  }

  const guardarFunciones = async () => {
    if (!detalle) return
    setGuardandoFunciones(true)
    try {
      const { error } = await supabase
        .from('secretarias')
        .update({ [funcionesTab]: funcionesInput || null })
        .eq('id', detalle.id)
      if (error) throw error
      actualizarSecretariaLocal(detalle.id, { [funcionesTab]: funcionesInput || null } as Partial<Secretaria>)
      setEditandoFunciones(false)
    } catch {
      alert('Error al guardar.')
    } finally {
      setGuardandoFunciones(false)
    }
  }

  const abrirEdicionMetas = () => {
    if (!detalle) return
    setMetasInput((detalle[metasTab] as string) || '')
    setEditandoMetas(true)
  }

  const cambiarMetasTab = (tab: MetasKey) => {
    setMetasTab(tab)
    setEditandoMetas(false)
  }

  const guardarMetas = async () => {
    if (!detalle) return
    setGuardandoMetas(true)
    try {
      const { error } = await supabase
        .from('secretarias')
        .update({ [metasTab]: metasInput || null })
        .eq('id', detalle.id)
      if (error) throw error
      actualizarSecretariaLocal(detalle.id, { [metasTab]: metasInput || null } as Partial<Secretaria>)
      setEditandoMetas(false)
    } catch {
      alert('Error al guardar.')
    } finally {
      setGuardandoMetas(false)
    }
  }

  const abrirEdicionCoordinacion = () => {
    if (!detalle) return
    setCoordinacionInput(detalle.coordinacion || '')
    setEditandoCoordinacion(true)
  }

  const guardarCoordinacion = async () => {
    if (!detalle) return
    setGuardandoCoordinacion(true)
    try {
      const { error } = await supabase
        .from('secretarias')
        .update({ coordinacion: coordinacionInput || null })
        .eq('id', detalle.id)
      if (error) throw error
      actualizarSecretariaLocal(detalle.id, { coordinacion: coordinacionInput || null })
      setEditandoCoordinacion(false)
    } catch {
      alert('Error al guardar.')
    } finally {
      setGuardandoCoordinacion(false)
    }
  }

  const abrirEdicionIndicadores = () => {
    if (!detalle) return
    const actuales = indicadores[detalle.id] || []
    setIndicadoresForm(actuales.map(i => ({
      id: i.id, esNuevo: false, indicador: i.indicador, meta: i.meta || '', periodo: i.periodo || '', orden: i.orden,
    })))
    setIndicadoresEliminados([])
    setEditandoIndicadores(true)
  }

  const actualizarFilaIndicador = (idx: number, campo: 'indicador' | 'meta' | 'periodo', valor: string) => {
    setIndicadoresForm(prev => prev.map((row, i) => i === idx ? { ...row, [campo]: valor } : row))
  }

  const agregarFilaIndicador = () => {
    setIndicadoresForm(prev => [...prev, {
      id: `nuevo-${Date.now()}`, esNuevo: true, indicador: '', meta: '', periodo: '', orden: prev.length,
    }])
  }

  const eliminarFilaIndicador = (idx: number) => {
    const fila = indicadoresForm[idx]
    if (fila && !fila.esNuevo) setIndicadoresEliminados(prev => [...prev, fila.id])
    setIndicadoresForm(prev => prev.filter((_, i) => i !== idx))
  }

  const guardarIndicadores = async () => {
    if (!detalle) return
    setGuardandoIndicadores(true)
    try {
      if (indicadoresEliminados.length) {
        const { error: eDel } = await supabase.from('secretaria_indicadores').delete().in('id', indicadoresEliminados)
        if (eDel) throw eDel
      }
      for (let i = 0; i < indicadoresForm.length; i++) {
        const fila = indicadoresForm[i]
        if (!fila.indicador.trim()) continue
        if (fila.esNuevo) {
          const { error: eIns } = await supabase.from('secretaria_indicadores').insert({
            secretaria_id: detalle.id, indicador: fila.indicador, meta: fila.meta || null, periodo: fila.periodo || null, orden: i,
          })
          if (eIns) throw eIns
        } else {
          const { error: eUpd } = await supabase.from('secretaria_indicadores')
            .update({ indicador: fila.indicador, meta: fila.meta || null, periodo: fila.periodo || null, orden: i })
            .eq('id', fila.id)
          if (eUpd) throw eUpd
        }
      }
      const { data: recargados } = await supabase
        .from('secretaria_indicadores')
        .select('*')
        .eq('secretaria_id', detalle.id)
        .order('orden', { ascending: true })
      setIndicadores(prev => ({ ...prev, [detalle.id]: recargados || [] }))
      setEditandoIndicadores(false)
      setIndicadoresEliminados([])
    } catch {
      alert('Error al guardar los indicadores.')
    } finally {
      setGuardandoIndicadores(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol || ''} />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h2 className="font-semibold text-base" style={{ color: 'var(--texto-principal)' }}>Secretarías</h2>
          <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
            Estructura organizativa del partido. Toca una secretaría para ver su misión, funciones, metas e indicadores.
          </p>
        </div>

        {loading ? (
          <div className="card text-center py-8">
            <svg className="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" style={{ color: '#004466' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <div className="space-y-5">

            <div className="card text-center !py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--texto-secundario)' }}>Coordinador Municipal</p>
              <p className="font-semibold text-base" style={{ color: '#004466' }}>{coordinador}</p>
            </div>

            {/* Organigrama */}
            <div className="flex flex-col items-center">

              {/* Nodo Pentágono */}
              <div className="rounded-2xl px-7 py-3 text-center shadow-sm shrink-0" style={{ background: '#004466' }}>
                <p className="text-white font-bold text-sm tracking-wide">PENTÁGONO</p>
                <p className="text-white/70 text-[10px] mt-0.5">Órgano de dirección</p>
              </div>

              {/* Tronco principal */}
              <div className="w-0.5 h-6" style={{ background: 'var(--color-borde)' }} />

              {/* Secretarías con línea indirecta (reportan directo) */}
              {reportanDirecto.length > 0 && (
                <div className="flex flex-col items-center mb-1">
                  <p className="text-[10px] italic mb-1" style={{ color: 'var(--texto-secundario)' }}>
                    línea de reporte indirecta
                  </p>
                  <div
                    className="inline-flex"
                    style={reportanDirecto.length > 1 ? { borderTop: '2px dashed rgba(0,68,102,0.45)' } : undefined}
                  >
                    {reportanDirecto.map(sec => (
                      <div key={sec.id} className="flex flex-col items-center px-3 pt-4 relative">
                        <div
                          className="absolute top-0 left-1/2 w-0 h-4 -translate-x-1/2"
                          style={{ borderLeft: '2px dashed rgba(0,68,102,0.45)' }}
                        />
                        <TarjetaSecretaria
                          sec={sec}
                          onAbrirDetalle={abrirDetalle}
                          indirecta
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grupos de secretarías, encadenados con líneas sólidas */}
              <div className="w-full max-w-xl">
                {GRUPOS.map(grupo => {
                  const secs = secretariasPorGrupo[grupo.key].filter(s => !s.reporta_directo)
                  if (secs.length === 0) return null
                  return (
                    <div key={grupo.key} className="flex flex-col items-center">
                      <div className="w-0.5 h-5" style={{ background: 'var(--color-borde)' }} />
                      <span
                        className="text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full mb-2"
                        style={{ background: 'white', border: '1.5px solid var(--color-borde)', color: 'var(--texto-secundario)' }}>
                        {grupo.label}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pb-1">
                        {secs.map(sec => (
                          <TarjetaSecretaria
                            key={sec.id}
                            sec={sec}
                            onAbrirDetalle={abrirDetalle}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {detalle && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) cerrarDetalle() }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10" style={{ borderColor: 'var(--color-borde)' }}>
              <div>
                <h3 className="font-semibold text-base" style={{ color: 'var(--texto-principal)' }}>{detalle.nombre}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {encargadoEditId === detalle.id ? (
                    <>
                      <input
                        className="input-field !py-1 !px-2 text-xs w-40"
                        value={encargadoValor}
                        onChange={e => setEncargadoValor(e.target.value)}
                        placeholder="Nombre del encargado"
                        autoFocus
                      />
                      <button onClick={() => guardarEncargado(detalle.id)} disabled={guardandoEncargado} className="text-xs font-semibold" style={{ color: '#004466' }}>Guardar</button>
                      <button onClick={() => setEncargadoEditId(null)} className="text-xs" style={{ color: 'var(--texto-secundario)' }}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>
                        {detalle.encargado_nombre || 'Sin encargado asignado'}
                      </p>
                      {esAdmin && (
                        <button onClick={() => abrirEdicionEncargado(detalle)} className="text-gray-400 hover:text-gray-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <button onClick={cerrarDetalle} className="text-gray-400 hover:text-gray-600 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-5">

              <section>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: '#004466' }}>Misión y Visión</h4>
                  {esAdmin && !editandoMisionVision && (
                    <button onClick={abrirEdicionMisionVision} className="text-xs font-medium" style={{ color: '#004466' }}>Editar</button>
                  )}
                </div>
                {editandoMisionVision ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Misión</label>
                      <textarea className="input-field w-full" rows={3} value={misionInput} onChange={e => setMisionInput(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: 'var(--texto-secundario)' }}>Visión 2027</label>
                      <textarea className="input-field w-full" rows={3} value={visionInput} onChange={e => setVisionInput(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditandoMisionVision(false)} className="flex-1 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>Cancelar</button>
                      <button onClick={guardarMisionVision} disabled={guardandoMisionVision} className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-60" style={{ background: '#004466', color: 'white' }}>
                        {guardandoMisionVision ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <p className="text-[11px] font-semibold" style={{ color: 'var(--texto-secundario)' }}>Misión</p>
                      <p className="text-sm" style={{ color: 'var(--texto-principal)' }}>{detalle.mision || 'Sin información registrada.'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold" style={{ color: 'var(--texto-secundario)' }}>Visión 2027</p>
                      <p className="text-sm" style={{ color: 'var(--texto-principal)' }}>{detalle.vision || 'Sin información registrada.'}</p>
                    </div>
                  </div>
                )}
              </section>

              <section>
                <h4 className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: '#004466' }}>Funciones</h4>
                <div className="flex gap-1 mb-2">
                  {FUNCIONES_TABS.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => cambiarFuncionesTab(tab.key)}
                      className="text-xs font-medium px-2.5 py-1 rounded-full border"
                      style={funcionesTab === tab.key
                        ? { background: '#004466', color: 'white', borderColor: '#004466' }
                        : { background: 'white', color: 'var(--texto-secundario)', borderColor: 'var(--color-borde)' }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-end mb-1">
                  {esAdmin && !editandoFunciones && (
                    <button onClick={abrirEdicionFunciones} className="text-xs font-medium" style={{ color: '#004466' }}>Editar</button>
                  )}
                </div>
                {editandoFunciones ? (
                  <div className="space-y-2">
                    <textarea className="input-field w-full" rows={6} value={funcionesInput} onChange={e => setFuncionesInput(e.target.value)} placeholder="Una función por línea, iniciando con '- '" />
                    <div className="flex gap-2">
                      <button onClick={() => setEditandoFunciones(false)} className="flex-1 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>Cancelar</button>
                      <button onClick={guardarFunciones} disabled={guardandoFunciones} className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-60" style={{ background: '#004466', color: 'white' }}>
                        {guardandoFunciones ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                ) : (
                  renderLista(detalle[funcionesTab] as string | null)
                )}
              </section>

              <section>
                <h4 className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: '#004466' }}>Metas</h4>
                <div className="flex gap-1 mb-2">
                  {METAS_TABS.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => cambiarMetasTab(tab.key)}
                      className="text-xs font-medium px-2.5 py-1 rounded-full border"
                      style={metasTab === tab.key
                        ? { background: '#004466', color: 'white', borderColor: '#004466' }
                        : { background: 'white', color: 'var(--texto-secundario)', borderColor: 'var(--color-borde)' }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-end mb-1">
                  {esAdmin && !editandoMetas && (
                    <button onClick={abrirEdicionMetas} className="text-xs font-medium" style={{ color: '#004466' }}>Editar</button>
                  )}
                </div>
                {editandoMetas ? (
                  <div className="space-y-2">
                    <textarea className="input-field w-full" rows={5} value={metasInput} onChange={e => setMetasInput(e.target.value)} placeholder="Una meta por línea, iniciando con '- '" />
                    <div className="flex gap-2">
                      <button onClick={() => setEditandoMetas(false)} className="flex-1 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>Cancelar</button>
                      <button onClick={guardarMetas} disabled={guardandoMetas} className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-60" style={{ background: '#004466', color: 'white' }}>
                        {guardandoMetas ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                ) : (
                  renderLista(detalle[metasTab] as string | null)
                )}
              </section>

              <section>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: '#004466' }}>Indicadores de Desempeño</h4>
                  {esAdmin && !editandoIndicadores && (
                    <button onClick={abrirEdicionIndicadores} className="text-xs font-medium" style={{ color: '#004466' }}>Editar</button>
                  )}
                </div>

                {editandoIndicadores ? (
                  <div className="space-y-2">
                    {indicadoresForm.map((fila, idx) => (
                      <div key={fila.id} className="border rounded-lg p-2 space-y-1.5" style={{ borderColor: 'var(--color-borde)' }}>
                        <input
                          className="input-field w-full !py-1.5 text-sm"
                          placeholder="Indicador"
                          value={fila.indicador}
                          onChange={e => actualizarFilaIndicador(idx, 'indicador', e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            className="input-field !py-1.5 text-sm"
                            placeholder="Meta"
                            value={fila.meta}
                            onChange={e => actualizarFilaIndicador(idx, 'meta', e.target.value)}
                          />
                          <input
                            className="input-field !py-1.5 text-sm"
                            placeholder="Período"
                            value={fila.periodo}
                            onChange={e => actualizarFilaIndicador(idx, 'periodo', e.target.value)}
                          />
                        </div>
                        <button onClick={() => eliminarFilaIndicador(idx)} className="text-xs font-medium" style={{ color: '#dc2626' }}>
                          Eliminar fila
                        </button>
                      </div>
                    ))}
                    <button onClick={agregarFilaIndicador} className="text-xs font-medium" style={{ color: '#004466' }}>
                      + Agregar indicador
                    </button>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setEditandoIndicadores(false)} className="flex-1 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>Cancelar</button>
                      <button onClick={guardarIndicadores} disabled={guardandoIndicadores} className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-60" style={{ background: '#004466', color: 'white' }}>
                        {guardandoIndicadores ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                ) : (
                  (indicadores[detalle.id] || []).length > 0 ? (
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left" style={{ color: 'var(--texto-secundario)' }}>
                            <th className="font-medium text-xs pb-1 px-1">Indicador</th>
                            <th className="font-medium text-xs pb-1 px-1">Meta</th>
                            <th className="font-medium text-xs pb-1 px-1">Período</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(indicadores[detalle.id] || []).map(ind => (
                            <tr key={ind.id} className="border-t" style={{ borderColor: 'var(--color-borde)' }}>
                              <td className="py-1.5 px-1" style={{ color: 'var(--texto-principal)' }}>{ind.indicador}</td>
                              <td className="py-1.5 px-1" style={{ color: 'var(--texto-principal)' }}>{ind.meta || '—'}</td>
                              <td className="py-1.5 px-1" style={{ color: 'var(--texto-principal)' }}>{ind.periodo || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm italic" style={{ color: 'var(--texto-secundario)' }}>Sin indicadores registrados.</p>
                  )
                )}
              </section>

              <section>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: '#004466' }}>Coordinación Intersecretarial</h4>
                  {esAdmin && !editandoCoordinacion && (
                    <button onClick={abrirEdicionCoordinacion} className="text-xs font-medium" style={{ color: '#004466' }}>Editar</button>
                  )}
                </div>
                {editandoCoordinacion ? (
                  <div className="space-y-2">
                    <textarea className="input-field w-full" rows={4} value={coordinacionInput} onChange={e => setCoordinacionInput(e.target.value)} placeholder="Una línea por secretaría relacionada, iniciando con '- '" />
                    <div className="flex gap-2">
                      <button onClick={() => setEditandoCoordinacion(false)} className="flex-1 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>Cancelar</button>
                      <button onClick={guardarCoordinacion} disabled={guardandoCoordinacion} className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-60" style={{ background: '#004466', color: 'white' }}>
                        {guardandoCoordinacion ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                ) : (
                  renderLista(detalle.coordinacion)
                )}
              </section>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TarjetaSecretaria({
  sec, onAbrirDetalle, destacada, indirecta,
}: {
  sec: Secretaria
  onAbrirDetalle: (sec: Secretaria) => void
  destacada?: boolean
  indirecta?: boolean
}) {
  const estiloBorde = indirecta
    ? { borderColor: 'rgba(0,68,102,0.5)', borderWidth: 1.5, borderStyle: 'dashed' as const }
    : destacada
      ? { borderColor: '#004466', borderWidth: 1.5 }
      : undefined

  return (
    <div
      className="card !p-3 cursor-pointer hover:shadow-md transition-shadow"
      style={estiloBorde}
      onClick={() => onAbrirDetalle(sec)}>
      <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--texto-principal)' }}>{sec.nombre}</p>
      <p className="text-xs mt-1 truncate" style={{ color: 'var(--texto-secundario)' }}>
        {sec.encargado_nombre || 'Sin encargado'}
      </p>
    </div>
  )
}