'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Perfil, type Reunion } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

type ReunionForm = {
  titulo: string
  encargado_nombre: string
  lugar: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  descripcion: string
}

const FORM_VACIO: ReunionForm = {
  titulo: '', encargado_nombre: '', lugar: '',
  fecha: '', hora_inicio: '', hora_fin: '', descripcion: ''
}

export default function CalendarioPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<ReunionForm>(FORM_VACIO)
  const [editandoId, setEditandoId] = useState<number | null>(null)  // ← NUEVO
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState<number | null>(null)  // ← NUEVO
  const [error, setError] = useState('')
  const [mesActual, setMesActual] = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)

  // ✅ CORREGIDO: colaborador en lugar de encargado
  const puedeAgendar = perfil?.rol === 'admin' || perfil?.rol === 'colaborador'

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) {
        if (p.rol === 'lider') { router.replace('/afiliados'); return }
        setPerfil(p)
      }
      await cargarReuniones()
    }
    init()
  }, [router])

  const cargarReuniones = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reuniones')
      .select('*')
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
    setReuniones(data || [])
    setLoading(false)
  }

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

  const abrirModal = (fechaInicial = '') => {
    setForm({ ...FORM_VACIO, fecha: fechaInicial })
    setEditandoId(null)  // ← NUEVO
    setError('')
    setModal(true)
  }

  // ← NUEVA FUNCIÓN
  const abrirModalEditar = (r: Reunion) => {
    setForm({
      titulo: r.titulo || '',
      encargado_nombre: (r as any).encargado_nombre || '',
      lugar: r.lugar || '',
      fecha: r.fecha || '',
      hora_inicio: r.hora_inicio || '',
      hora_fin: r.hora_fin || '',
      descripcion: r.descripcion || '',
    })
    setEditandoId(r.id)
    setError('')
    setModal(true)
  }

  const guardarReunion = async () => {
    if (!form.titulo || !form.fecha || !form.hora_inicio) {
      setError('Título, fecha y hora de inicio son obligatorios.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      if (editandoId) {
        // ← EDITAR
        const { error: e } = await supabase
          .from('reuniones')
          .update({
            titulo: form.titulo,
            encargado_nombre: form.encargado_nombre || null,
            lugar: form.lugar || null,
            fecha: form.fecha,
            hora_inicio: form.hora_inicio,
            hora_fin: form.hora_fin || null,
            descripcion: form.descripcion || null,
          })
          .eq('id', editandoId)
        if (e) throw e
      } else {
        // INSERTAR
        const { error: e } = await supabase.from('reuniones').insert({
          titulo: form.titulo,
          encargado_nombre: form.encargado_nombre || null,
          lugar: form.lugar || null,
          fecha: form.fecha,
          hora_inicio: form.hora_inicio,
          hora_fin: form.hora_fin || null,
          descripcion: form.descripcion || null,
          tipo: 'general',
          creado_por: perfil!.id,
        })
        if (e) throw e
      }
      setModal(false)
      setForm(FORM_VACIO)
      setEditandoId(null)
      await cargarReuniones()
    } catch {
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  // ← NUEVA FUNCIÓN
  const eliminarReunion = async (id: number) => {
    if (!confirm('¿Eliminar esta reunión? Esta acción no se puede deshacer.')) return
    setEliminando(id)
    try {
      const { error: e } = await supabase
        .from('reuniones')
        .delete()
        .eq('id', id)
      if (e) throw e
      await cargarReuniones()
      // Si se elimina la última reunión del día seleccionado, limpiar selección
      const quedanReuniones = reuniones.filter(r => r.id !== id && r.fecha === diaSeleccionado)
      if (quedanReuniones.length === 0) setDiaSeleccionado(null)
    } catch {
      alert('Error al eliminar. Intenta de nuevo.')
    } finally {
      setEliminando(null)
    }
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
              onClick={() => abrirModal()}
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

          <div className="grid grid-cols-7 mb-1">
            {DIAS.map(d => (
              <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'var(--texto-secundario)' }}>{d}</div>
            ))}
          </div>

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
                      {reuDia.slice(0, 3).map((_, idx) => (
                        <div key={idx} className="w-1.5 h-1.5 rounded-full" style={{ background: seleccionado ? 'white' : '#004466' }} />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
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
                    onClick={() => abrirModal(diaSeleccionado)}
                    className="mt-3 text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: '#e0f7fa', color: '#004466' }}>
                    + Agendar reunión este día
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {reunionesDiaSeleccionado.map(r => (
                  <ReunionCard
                    key={r.id}
                    r={r}
                    formatHora={formatHora}
                    puedeEditar={puedeAgendar}
                    onEditar={() => abrirModalEditar(r)}
                    onEliminar={() => eliminarReunion(r.id)}
                    eliminando={eliminando === r.id}
                  />
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
                <ReunionCard
                  key={r.id}
                  r={r}
                  formatHora={formatHora}
                  showFecha
                  formatFecha={formatFecha}
                  puedeEditar={puedeAgendar}
                  onEditar={() => abrirModalEditar(r)}
                  onEliminar={() => eliminarReunion(r.id)}
                  eliminando={eliminando === r.id}
                />
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Modal agendar / editar */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-borde)' }}>
              {/* ← Título dinámico según si edita o crea */}
              <h3 className="font-semibold text-base" style={{ color: 'var(--texto-principal)' }}>
                {editandoId ? 'Editar reunión' : 'Nueva reunión'}
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
                <input className="input-field w-full" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Nombre de la reunión" />
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
                <input type="date" className="input-field w-full" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
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
                <textarea className="input-field w-full" rows={3} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Agenda o notas..." />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                  Cancelar
                </button>
                <button onClick={guardarReunion} disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: '#004466', color: 'white' }}>
                  {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Guardar reunión'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ← COMPONENTE ACTUALIZADO CON BOTONES
function ReunionCard({
  r,
  formatHora,
  showFecha,
  formatFecha,
  puedeEditar,
  onEditar,
  onEliminar,
  eliminando
}: {
  r: Reunion
  formatHora: (h: string) => string
  showFecha?: boolean
  formatFecha?: (f: string) => string
  puedeEditar?: boolean
  onEditar?: () => void
  onEliminar?: () => void
  eliminando?: boolean
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {showFecha && formatFecha && (
            <p className="text-xs mb-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>{formatFecha(r.fecha)}</p>
          )}
          <p className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>{r.titulo}</p>
          {r.descripcion && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--texto-secundario)' }}>{r.descripcion}</p>
          )}
          <div className="flex flex-col gap-1 mt-2 text-xs" style={{ color: 'var(--texto-secundario)' }}>
            <span>🕐 {formatHora(r.hora_inicio)}{r.hora_fin ? ` – ${formatHora(r.hora_fin)}` : ''}</span>
            {r.lugar && <span>📍 {r.lugar}</span>}
            {(r as any).encargado_nombre && <span>👤 {(r as any).encargado_nombre}</span>}
          </div>
        </div>

        {/* ← BOTONES EDITAR / ELIMINAR */}
        {puedeEditar && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={onEditar}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Editar reunión">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#004466' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={onEliminar}
              disabled={eliminando}
              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Eliminar reunión">
              {eliminando ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" style={{ color: '#dc2626' }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#dc2626' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
