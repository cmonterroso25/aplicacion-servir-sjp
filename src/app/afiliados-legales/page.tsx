'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Perfil, type AfiliadoLegalConRelacion, type Sector } from '@/lib/supabase'
import { TIPOS_UBICACION, OPCIONES_UBICACION, type TipoUbicacion } from '@/lib/ubicaciones'
import { exportToExcel } from '@/lib/exportXlsx'
import NavBar from '@/components/NavBar'

const ROLES_CON_ACCESO = ['admin', 'pentagono']
const PAGE_SIZE = 100

const ROLES = ['Simpatizante', 'Organizador', 'Guerrero', 'Líder', 'Templario']
const GENEROS = ['Masculino', 'Femenino']

type FiltroEstado = 'todos' | 'vinculados' | 'pendientes'

type MatchAfiliado = {
  id: number
  primer_apellido: string
  segundo_apellido: string | null
  primer_nombre: string
  segundo_nombre: string | null
  dpi: string | null
}

// Campos adicionales (los mismos que ya existen en "afiliados") que se
// pueden editar directamente sobre el registro de afiliados_legales, sin
// tocar los campos oficiales del TSE (dpi, boleta, cedula, nombre_completo,
// fecha_afiliacion_legal).
type DraftLegal = {
  telefono: string
  fecha_nacimiento: string
  genero: string
  edad: string
  rol_afiliado: string
  sector_id: string
  tipo_ubicacion: string
  nombre_ubicacion: string
  afiliado_por: string
  vota_en_pinula: boolean
  direccion: string
}

type FormCrear = {
  primer_apellido: string
  segundo_apellido: string
  primer_nombre: string
  segundo_nombre: string
} & DraftLegal

function generarPaginas(actual: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const paginas: (number | string)[] = [1]
  if (actual > 3) paginas.push('...')
  const inicio = Math.max(2, actual - 1)
  const fin = Math.min(total - 1, actual + 1)
  for (let i = inicio; i <= fin; i++) paginas.push(i)
  if (actual < total - 2) paginas.push('...')
  paginas.push(total)
  return paginas
}

// Separacion best-effort de "APELLIDOS NOMBRES" tal como viene del TSE.
// Es solo un punto de partida editable: no asumimos que sea correcto.
function separarNombreCompleto(nombreCompleto: string) {
  const partes = nombreCompleto.trim().split(/\s+/)
  if (partes.length <= 2) {
    return { primer_apellido: partes[0] || '', segundo_apellido: '', primer_nombre: partes[1] || '', segundo_nombre: '' }
  }
  if (partes.length === 3) {
    return { primer_apellido: partes[0], segundo_apellido: '', primer_nombre: partes[1], segundo_nombre: partes[2] }
  }
  return {
    primer_apellido: partes[0],
    segundo_apellido: partes[1],
    primer_nombre: partes.slice(2, 3).join(' '),
    segundo_nombre: partes.slice(3).join(' '),
  }
}

function draftDesdeRegistro(r: AfiliadoLegalConRelacion): DraftLegal {
  return {
    telefono: r.telefono || '',
    fecha_nacimiento: r.fecha_nacimiento || '',
    genero: r.genero || '',
    edad: r.edad || '',
    rol_afiliado: r.rol_afiliado || 'Simpatizante',
    sector_id: r.sector_id ? String(r.sector_id) : '',
    tipo_ubicacion: r.tipo_ubicacion || '',
    nombre_ubicacion: r.nombre_ubicacion || '',
    afiliado_por: r.afiliado_por || '',
    vota_en_pinula: r.vota_en_pinula ?? true,
    direccion: r.direccion || '',
  }
}

export default function AfiliadosLegalesPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [registros, setRegistros] = useState<AfiliadoLegalConRelacion[]>([])
  const [sectoresList, setSectoresList] = useState<Sector[]>([])
  const [afiliadoPorList, setAfiliadoPorList] = useState<{ id: number; nombre: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [totalVinculados, setTotalVinculados] = useState(0)
  const [page, setPage] = useState(1)

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [filtroSectorId, setFiltroSectorId] = useState('')
  const [filtroAfiliadoPor, setFiltroAfiliadoPor] = useState('')

  // Edicion de campos adicionales
  const [modoEdicion, setModoEdicion] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [draft, setDraft] = useState<DraftLegal | null>(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  // Vincular a afiliado existente
  const [vinculandoId, setVinculandoId] = useState<number | null>(null)
  const [buscarVinculo, setBuscarVinculo] = useState('')
  const [resultadosVinculo, setResultadosVinculo] = useState<MatchAfiliado[]>([])
  const [buscandoVinculo, setBuscandoVinculo] = useState(false)
  const [guardandoAccion, setGuardandoAccion] = useState<number | null>(null)
  const [errorAccion, setErrorAccion] = useState('')

  // Crear afiliado nuevo a partir del registro legal
  const [creandoId, setCreandoId] = useState<number | null>(null)
  const [formCrear, setFormCrear] = useState<FormCrear | null>(null)

  // Exportar a Excel
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase
        .from('perfiles').select('*').eq('id', session.user.id).single()
      if (!p || !ROLES_CON_ACCESO.includes(p.rol)) { router.replace('/afiliados'); return }
      setPerfil(p)

      const { data: sData } = await supabase.from('sectores').select('*').order('nombre')
      setSectoresList(sData || [])

      const { data: apData } = await supabase.from('afiliado_por').select('*').order('nombre')
      setAfiliadoPorList(apData || [])

      await cargar('', 'todos', 1, '', '')
      await cargarResumen()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const cargarResumen = useCallback(async () => {
    const { count } = await supabase
      .from('afiliados_legales')
      .select('*', { count: 'exact', head: true })
      .eq('vinculado', true)
    setTotalVinculados(count || 0)
  }, [])

  const cargar = useCallback(async (termino: string, estado: FiltroEstado, paginaActual: number, sector: string, afiliadoPor: string) => {
    setLoading(true)
    try {
      const desde = (paginaActual - 1) * PAGE_SIZE
      const hasta = desde + PAGE_SIZE - 1

      let q = supabase
        .from('afiliados_legales')
        .select('*, afiliados(id, primer_apellido, segundo_apellido, primer_nombre, segundo_nombre, dpi), sectores(nombre)', { count: 'exact' })
        .order('nombre_completo')

      if (termino.trim()) {
        const t = termino.trim()
        q = q.or(`nombre_completo.ilike.%${t}%,dpi.ilike.%${t}%,boleta.ilike.%${t}%`)
      }
      if (estado === 'vinculados') q = q.eq('vinculado', true)
      if (estado === 'pendientes') q = q.eq('vinculado', false)
      if (sector) q = q.eq('sector_id', parseInt(sector))
      if (afiliadoPor) q = q.eq('afiliado_por', afiliadoPor)

      q = q.range(desde, hasta)

      const { data, count, error } = await q
      if (error) console.error('Error cargando afiliados_legales:', error.message)
      setRegistros((data as any) || [])
      setTotal(count || 0)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleBuscar = () => {
    setPage(1)
    cargar(busqueda, filtroEstado, 1, filtroSectorId, filtroAfiliadoPor)
  }

  const cambiarFiltroEstado = (estado: FiltroEstado) => {
    setFiltroEstado(estado)
    setPage(1)
    cargar(busqueda, estado, 1, filtroSectorId, filtroAfiliadoPor)
  }

  const cambiarFiltroSector = (sector: string) => {
    setFiltroSectorId(sector)
    setPage(1)
    cargar(busqueda, filtroEstado, 1, sector, filtroAfiliadoPor)
  }

  const cambiarFiltroAfiliadoPor = (afiliadoPor: string) => {
    setFiltroAfiliadoPor(afiliadoPor)
    setPage(1)
    cargar(busqueda, filtroEstado, 1, filtroSectorId, afiliadoPor)
  }

  const irAPagina = (p: number) => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    if (p < 1 || p > totalPages || p === page) return
    setPage(p)
    cargar(busqueda, filtroEstado, p, filtroSectorId, filtroAfiliadoPor)
  }

  const formatFecha = (f?: string | null) => {
    if (!f) return ''
    try { return new Date(f).toLocaleDateString('es-GT') } catch { return f }
  }

  const formatNombreAfiliado = (a: MatchAfiliado) =>
    [a.primer_apellido, a.segundo_apellido, a.primer_nombre, a.segundo_nombre].filter(Boolean).join(' ')

  // --- Exportar a Excel ----------------------------------------------------

  const exportarDatos = async () => {
    setExportando(true)
    setErrorAccion('')
    try {
      let q = supabase
        .from('afiliados_legales')
        .select('*, afiliados(id, primer_apellido, segundo_apellido, primer_nombre, segundo_nombre, dpi), sectores(nombre)')
        .order('nombre_completo')

      if (busqueda.trim()) {
        const t = busqueda.trim()
        q = q.or(`nombre_completo.ilike.%${t}%,dpi.ilike.%${t}%,boleta.ilike.%${t}%`)
      }
      if (filtroEstado === 'vinculados') q = q.eq('vinculado', true)
      if (filtroEstado === 'pendientes') q = q.eq('vinculado', false)
      if (filtroSectorId) q = q.eq('sector_id', parseInt(filtroSectorId))
      if (filtroAfiliadoPor) q = q.eq('afiliado_por', filtroAfiliadoPor)

      const { data, error } = await q
      if (error || !data) {
        setErrorAccion('Error al exportar los datos.')
        return
      }

      const filas = (data as any[]).map((r) => {
        const nombreVinculado = r.afiliados
          ? [r.afiliados.primer_apellido, r.afiliados.segundo_apellido, r.afiliados.primer_nombre, r.afiliados.segundo_nombre].filter(Boolean).join(' ')
          : ''
        return {
          'Nombre (TSE)': r.nombre_completo || '',
          'DPI': r.dpi || '',
          'Boleta': r.boleta || '',
          'Cédula': r.cedula || '',
          'F. Afiliación legal': formatFecha(r.fecha_afiliacion_legal),
          'Teléfono': r.telefono || '',
          'F. Nacimiento': formatFecha(r.fecha_nacimiento),
          'Edad': r.edad || '',
          'Género': r.genero || '',
          'Rol': r.rol_afiliado || 'Simpatizante',
          'Sector': r.sectores?.nombre || '',
          'Ubicación': r.tipo_ubicacion && r.nombre_ubicacion ? r.nombre_ubicacion : '',
          'Afiliado por': r.afiliado_por || '',
          'Vota en Pinula': r.vota_en_pinula === null ? '' : (r.vota_en_pinula ? 'Sí' : 'No'),
          'Dirección': r.direccion || '',
          'Estado': r.vinculado ? 'Vinculado' : 'Pendiente',
          'Afiliado vinculado': nombreVinculado,
        }
      })

      exportToExcel(filas, 'afiliados_legales')
    } finally {
      setExportando(false)
    }
  }

  // --- Edicion de campos adicionales --------------------------------------

  const iniciarEdicion = (r: AfiliadoLegalConRelacion) => {
    setErrorAccion('')
    setVinculandoId(null)
    setCreandoId(null)
    setEditandoId(r.id)
    setDraft(draftDesdeRegistro(r))
  }

  const cancelarEdicion = () => {
    setEditandoId(null)
    setDraft(null)
  }

  const guardarEdicion = async (registroId: number) => {
    if (!draft) return
    setGuardandoEdicion(true)
    const { data: actualizado, error } = await supabase
      .from('afiliados_legales')
      .update({
        telefono: draft.telefono || null,
        fecha_nacimiento: draft.fecha_nacimiento || null,
        genero: draft.genero || null,
        edad: draft.edad || null,
        rol_afiliado: draft.rol_afiliado || null,
        sector_id: draft.sector_id ? parseInt(draft.sector_id) : null,
        tipo_ubicacion: draft.tipo_ubicacion || null,
        nombre_ubicacion: draft.nombre_ubicacion || null,
        afiliado_por: draft.afiliado_por || null,
        vota_en_pinula: draft.vota_en_pinula,
        direccion: draft.direccion || null,
      })
      .eq('id', registroId)
      .select('*, afiliados(id, primer_apellido, segundo_apellido, primer_nombre, segundo_nombre, dpi), sectores(nombre)')
      .single()

    if (!error && actualizado) {
      setRegistros((prev) => prev.map((r) => (r.id === registroId ? (actualizado as any) : r)))
    }
    setGuardandoEdicion(false)
    setEditandoId(null)
    setDraft(null)
  }

  // --- Vincular a afiliado existente -------------------------------------

  const abrirVincular = (id: number) => {
    setErrorAccion('')
    setCreandoId(null)
    setEditandoId(null)
    setVinculandoId(id)
    setBuscarVinculo('')
    setResultadosVinculo([])
  }

  const cerrarVincular = () => {
    setVinculandoId(null)
    setBuscarVinculo('')
    setResultadosVinculo([])
    setErrorAccion('')
  }

  const buscarVinculoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (vinculandoId === null) return
    if (buscarVinculoRef.current) clearTimeout(buscarVinculoRef.current)
    if (buscarVinculo.trim().length < 2) { setResultadosVinculo([]); return }
    buscarVinculoRef.current = setTimeout(async () => {
      setBuscandoVinculo(true)
      const t = buscarVinculo.trim()
      const { data } = await supabase
        .from('afiliados')
        .select('id, primer_apellido, segundo_apellido, primer_nombre, segundo_nombre, dpi')
        .or(`dpi.ilike.%${t}%,primer_apellido.ilike.%${t}%,segundo_apellido.ilike.%${t}%,primer_nombre.ilike.%${t}%`)
        .limit(8)
      setResultadosVinculo((data as any) || [])
      setBuscandoVinculo(false)
    }, 400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscarVinculo, vinculandoId])

  const confirmarVinculo = async (registroId: number, afiliadoId: number) => {
    setGuardandoAccion(registroId)
    setErrorAccion('')

    const { error: err1 } = await supabase
      .from('afiliados_legales')
      .update({ afiliado_id: afiliadoId, vinculado: true })
      .eq('id', registroId)

    if (err1) {
      setErrorAccion('Error al vincular. Intenta de nuevo.')
      setGuardandoAccion(null)
      return
    }

    const { error: err2 } = await supabase
      .from('afiliados')
      .update({ es_legal: true })
      .eq('id', afiliadoId)

    if (err2) {
      setErrorAccion('Se vinculó pero no se pudo marcar es_legal en afiliados.')
    }

    setGuardandoAccion(null)
    cerrarVincular()
    cargar(busqueda, filtroEstado, page, filtroSectorId, filtroAfiliadoPor)
    cargarResumen()
  }

  // --- Crear afiliado nuevo desde el registro legal -----------------------

  const abrirCrear = (registro: AfiliadoLegalConRelacion) => {
    setErrorAccion('')
    setVinculandoId(null)
    setEditandoId(null)
    setCreandoId(registro.id)
    setFormCrear({
      ...separarNombreCompleto(registro.nombre_completo),
      ...draftDesdeRegistro(registro),
    })
  }

  const cerrarCrear = () => {
    setCreandoId(null)
    setFormCrear(null)
    setErrorAccion('')
  }

  const confirmarCrear = async (registro: AfiliadoLegalConRelacion) => {
    if (!formCrear) return
    if (!formCrear.primer_apellido.trim() || !formCrear.primer_nombre.trim()) {
      setErrorAccion('Primer apellido y primer nombre son obligatorios.')
      return
    }
    setGuardandoAccion(registro.id)
    setErrorAccion('')

    const { data: existente } = await supabase
      .from('afiliados')
      .select('id')
      .eq('dpi', registro.dpi)
      .maybeSingle()
    if (existente) {
      setErrorAccion('Ya existe un afiliado con este DPI. Usa "Vincular" en su lugar.')
      setGuardandoAccion(null)
      return
    }

    const { data: nuevo, error: err1 } = await supabase
      .from('afiliados')
      .insert({
        primer_apellido: formCrear.primer_apellido.trim().toUpperCase(),
        segundo_apellido: formCrear.segundo_apellido.trim().toUpperCase() || null,
        primer_nombre: formCrear.primer_nombre.trim().toUpperCase(),
        segundo_nombre: formCrear.segundo_nombre.trim().toUpperCase() || null,
        dpi: registro.dpi,
        es_legal: true,
        telefono: formCrear.telefono || null,
        fecha_nacimiento: formCrear.fecha_nacimiento || null,
        genero: formCrear.genero || null,
        edad: formCrear.edad || null,
        rol_afiliado: formCrear.rol_afiliado || 'Simpatizante',
        sector_id: formCrear.sector_id ? parseInt(formCrear.sector_id) : null,
        tipo_ubicacion: formCrear.tipo_ubicacion || null,
        nombre_ubicacion: formCrear.nombre_ubicacion || null,
        afiliado_por: formCrear.afiliado_por || null,
        vota_en_pinula: formCrear.vota_en_pinula,
      })
      .select('id')
      .single()

    if (err1 || !nuevo) {
      setErrorAccion('Error al crear el afiliado. Verifica los datos.')
      setGuardandoAccion(null)
      return
    }

    const { error: err2 } = await supabase
      .from('afiliados_legales')
      .update({ afiliado_id: nuevo.id, vinculado: true })
      .eq('id', registro.id)

    if (err2) {
      setErrorAccion('Se creó el afiliado pero no se pudo vincular el registro legal.')
    }

    setGuardandoAccion(null)
    cerrarCrear()
    cargar(busqueda, filtroEstado, page, filtroSectorId, filtroAfiliadoPor)
    cargarResumen()
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const inputSm = "w-full text-xs border rounded px-1.5 py-1"
  const inputSmStyle = { borderColor: '#004466' }
  const opcionesUbicacionDraft = draft?.tipo_ubicacion
    ? (OPCIONES_UBICACION[draft.tipo_ubicacion as TipoUbicacion] || [])
    : []
  const opcionesUbicacionForm = formCrear?.tipo_ubicacion
    ? (OPCIONES_UBICACION[formCrear.tipo_ubicacion as TipoUbicacion] || [])
    : []

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol || ''} />
      <header className="bg-white border-b shadow-sm sticky top-0 z-10" style={{ borderColor: 'var(--color-borde)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#004466' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-sm" style={{ color: '#004466' }}>Afiliados legales</h1>
              <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>
                Registro oficial del TSE — {totalVinculados} de {total || '…'} vinculados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportarDatos}
              disabled={exportando}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white disabled:opacity-50"
              style={{ background: '#166534' }}>
              {exportando ? 'Descargando...' : 'Descargar Excel'}
            </button>
            <button
              onClick={() => { setModoEdicion((v) => !v); cancelarEdicion() }}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
              style={{ background: modoEdicion ? '#9b1c3a' : '#004466' }}>
              {modoEdicion ? 'Salir de edición' : 'Editar campos'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="card">
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              className="input-field flex-1 min-w-[220px]"
              placeholder="Buscar por nombre, DPI o boleta..."
            />
            <button onClick={handleBuscar} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#004466' }}>
              Buscar
            </button>
            <select
              value={filtroSectorId}
              onChange={(e) => cambiarFiltroSector(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border font-medium"
              style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
              <option value="">Todos los sectores</option>
              {sectoresList.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <select
              value={filtroAfiliadoPor}
              onChange={(e) => cambiarFiltroAfiliadoPor(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border font-medium"
              style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
              <option value="">Todos (afiliado por)</option>
              {afiliadoPorList.map((ap) => <option key={ap.id} value={ap.nombre}>{ap.nombre}</option>)}
            </select>
            <div className="flex gap-1">
              {(['todos', 'vinculados', 'pendientes'] as FiltroEstado[]).map((estado) => (
                <button
                  key={estado}
                  onClick={() => cambiarFiltroEstado(estado)}
                  className="text-xs px-3 py-2 rounded-lg border font-medium capitalize"
                  style={filtroEstado === estado
                    ? { background: '#004466', color: 'white', borderColor: '#004466' }
                    : { borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                  {estado}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-sm font-medium" style={{ color: 'var(--texto-secundario)' }}>
          {loading ? 'Cargando...' : `${registros.length} de ${total} registro${total !== 1 ? 's' : ''} · Página ${page} de ${totalPages}`}
        </p>

        {loading ? (
          <div className="card text-center py-10">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#004466' }}></div>
          </div>
        ) : total === 0 ? (
          <div className="card text-center py-10">
            <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>No se encontraron registros</p>
          </div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f0f6f9', borderBottom: '1px solid var(--color-borde)' }}>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Nombre (TSE)</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>DPI</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>F. Afiliación legal</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Teléfono</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>F. Nacimiento</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Edad</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Género</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Rol</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Sector</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Ubicación</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Afiliado por</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Vota en Pinula</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Estado</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Afiliado vinculado</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, idx) => {
                  const nombreVinculado = r.afiliados
                    ? [r.afiliados.primer_apellido, r.afiliados.segundo_apellido, r.afiliados.primer_nombre, r.afiliados.segundo_nombre].filter(Boolean).join(' ')
                    : null
                  const enEdicion = modoEdicion && editandoId === r.id && draft

                  return (
                    <React.Fragment key={r.id}>
                      {enEdicion ? (
                        <tr style={{ background: '#fff7ed' }}>
                          <td className="px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-principal)' }}>{r.nombre_completo}</td>
                          <td className="px-3 py-2.5 font-mono whitespace-nowrap">{r.dpi}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{formatFecha(r.fecha_afiliacion_legal) || '—'}</td>
                          <td className="px-3 py-2"><input className={inputSm} style={inputSmStyle} value={draft.telefono} onChange={(e) => setDraft({ ...draft, telefono: e.target.value })} /></td>
                          <td className="px-3 py-2"><input type="date" className={inputSm} style={inputSmStyle} value={draft.fecha_nacimiento} onChange={(e) => setDraft({ ...draft, fecha_nacimiento: e.target.value })} /></td>
                          <td className="px-3 py-2"><input className={inputSm} style={inputSmStyle} value={draft.edad} onChange={(e) => setDraft({ ...draft, edad: e.target.value })} /></td>
                          <td className="px-3 py-2">
                            <select className={inputSm} style={inputSmStyle} value={draft.genero} onChange={(e) => setDraft({ ...draft, genero: e.target.value })}>
                              <option value="">Selecciona...</option>
                              {GENEROS.map((g) => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select className={inputSm} style={inputSmStyle} value={draft.rol_afiliado} onChange={(e) => setDraft({ ...draft, rol_afiliado: e.target.value })}>
                              {ROLES.map((rr) => <option key={rr} value={rr}>{rr}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select className={inputSm} style={inputSmStyle} value={draft.sector_id} onChange={(e) => setDraft({ ...draft, sector_id: e.target.value })}>
                              <option value="">Sin sector</option>
                              {sectoresList.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              <select className={inputSm} style={inputSmStyle} value={draft.tipo_ubicacion} onChange={(e) => setDraft({ ...draft, tipo_ubicacion: e.target.value, nombre_ubicacion: '' })}>
                                <option value="">Tipo...</option>
                                {TIPOS_UBICACION.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                              {draft.tipo_ubicacion ? (
                                opcionesUbicacionDraft.length > 0 ? (
                                  <select className={inputSm} style={inputSmStyle} value={draft.nombre_ubicacion} onChange={(e) => setDraft({ ...draft, nombre_ubicacion: e.target.value })}>
                                    <option value="">Selecciona...</option>
                                    {opcionesUbicacionDraft.map((op) => <option key={op} value={op}>{op}</option>)}
                                  </select>
                                ) : (
                                  <input className={inputSm} style={inputSmStyle} value={draft.nombre_ubicacion} onChange={(e) => setDraft({ ...draft, nombre_ubicacion: e.target.value })} placeholder="Nombre..." />
                                )
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <select className={inputSm} style={inputSmStyle} value={draft.afiliado_por} onChange={(e) => setDraft({ ...draft, afiliado_por: e.target.value })}>
                              <option value="">Selecciona...</option>
                              {afiliadoPorList.map((ap) => <option key={ap.id} value={ap.nombre}>{ap.nombre}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select className={inputSm} style={inputSmStyle} value={draft.vota_en_pinula ? 'si' : 'no'} onChange={(e) => setDraft({ ...draft, vota_en_pinula: e.target.value === 'si' })}>
                              <option value="si">Sí</option>
                              <option value="no">No</option>
                            </select>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={r.vinculado ? { background: '#dcfce7', color: '#166534' } : { background: '#fef3c7', color: '#92400e' }}>
                              {r.vinculado ? 'Vinculado' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{nombreVinculado || '—'}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1.5">
                              <button onClick={() => guardarEdicion(r.id)} disabled={guardandoEdicion} className="text-xs px-2 py-1 rounded-lg font-semibold text-white disabled:opacity-50" style={{ background: '#166534' }}>
                                {guardandoEdicion ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button onClick={cancelarEdicion} className="text-xs px-2 py-1 rounded-lg border font-medium" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr
                          className="border-b hover:bg-gray-50 transition-colors"
                          style={{ borderColor: 'var(--color-borde)', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                          <td className="px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-principal)' }}>{r.nombre_completo}</td>
                          <td className="px-3 py-2.5 font-mono whitespace-nowrap">{r.dpi}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{formatFecha(r.fecha_afiliacion_legal) || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{r.telefono || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{formatFecha(r.fecha_nacimiento) || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{r.edad || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{r.genero || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{r.rol_afiliado || 'Simpatizante'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{(r as any).sectores?.nombre || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{r.tipo_ubicacion && r.nombre_ubicacion ? r.nombre_ubicacion : '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{r.afiliado_por || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {r.vota_en_pinula === null ? '—' : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={{ background: r.vota_en_pinula ? '#dcfce7' : '#fee2e2', color: r.vota_en_pinula ? '#166534' : '#991b1b' }}>
                                {r.vota_en_pinula ? 'Sí' : 'No'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={r.vinculado ? { background: '#dcfce7', color: '#166534' } : { background: '#fef3c7', color: '#92400e' }}>
                              {r.vinculado ? 'Vinculado' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{nombreVinculado || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <div className="flex gap-1.5">
                              {modoEdicion && (
                                <button onClick={() => iniciarEdicion(r)} className="text-xs px-2.5 py-1 rounded-lg font-semibold text-white" style={{ background: '#004466' }}>
                                  Editar
                                </button>
                              )}
                              {!r.vinculado && (
                                <>
                                  <button
                                    onClick={() => (vinculandoId === r.id ? cerrarVincular() : abrirVincular(r.id))}
                                    className="text-xs px-2.5 py-1 rounded-lg font-semibold text-white"
                                    style={{ background: '#004466' }}>
                                    Vincular
                                  </button>
                                  <button
                                    onClick={() => (creandoId === r.id ? cerrarCrear() : abrirCrear(r))}
                                    className="text-xs px-2.5 py-1 rounded-lg font-semibold text-white"
                                    style={{ background: '#166534' }}>
                                    Crear afiliado
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}

                      {vinculandoId === r.id && (
                        <tr style={{ background: '#f0f6f9' }}>
                          <td colSpan={15} className="px-4 py-3">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold" style={{ color: '#004466' }}>
                                Buscar afiliado existente para vincular a "{r.nombre_completo}"
                              </p>
                              <input
                                type="text"
                                autoFocus
                                value={buscarVinculo}
                                onChange={(e) => setBuscarVinculo(e.target.value)}
                                placeholder="Buscar por nombre o DPI..."
                                className="input-field w-full max-w-md text-sm"
                              />
                              {buscandoVinculo && <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>Buscando...</p>}
                              {resultadosVinculo.length > 0 && (
                                <div className="flex flex-col gap-1 max-w-md">
                                  {resultadosVinculo.map((m) => (
                                    <button
                                      key={m.id}
                                      onClick={() => confirmarVinculo(r.id, m.id)}
                                      disabled={guardandoAccion === r.id}
                                      className="text-left text-xs px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
                                      style={{ borderColor: 'var(--color-borde)' }}>
                                      <span className="font-semibold">{formatNombreAfiliado(m)}</span>
                                      {m.dpi && <span className="ml-2 font-mono" style={{ color: 'var(--texto-secundario)' }}>{m.dpi}</span>}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {errorAccion && <p className="text-xs text-red-600">{errorAccion}</p>}
                              <button onClick={cerrarVincular} className="text-xs px-3 py-1 rounded-lg border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {creandoId === r.id && formCrear && (
                        <tr style={{ background: '#f0fdf4' }}>
                          <td colSpan={15} className="px-4 py-3">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold" style={{ color: '#166534' }}>
                                Crear nuevo afiliado desde "{r.nombre_completo}" (DPI: {r.dpi}) — revisa la separación de nombres, es automática
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl">
                                <input className="input-field text-sm" placeholder="Primer apellido" value={formCrear.primer_apellido} onChange={(e) => setFormCrear({ ...formCrear, primer_apellido: e.target.value })} />
                                <input className="input-field text-sm" placeholder="Segundo apellido" value={formCrear.segundo_apellido} onChange={(e) => setFormCrear({ ...formCrear, segundo_apellido: e.target.value })} />
                                <input className="input-field text-sm" placeholder="Primer nombre" value={formCrear.primer_nombre} onChange={(e) => setFormCrear({ ...formCrear, primer_nombre: e.target.value })} />
                                <input className="input-field text-sm" placeholder="Segundo nombre" value={formCrear.segundo_nombre} onChange={(e) => setFormCrear({ ...formCrear, segundo_nombre: e.target.value })} />

                                <input className="input-field text-sm" placeholder="Teléfono" value={formCrear.telefono} onChange={(e) => setFormCrear({ ...formCrear, telefono: e.target.value })} />
                                <input type="date" className="input-field text-sm" value={formCrear.fecha_nacimiento} onChange={(e) => setFormCrear({ ...formCrear, fecha_nacimiento: e.target.value })} />
                                <input className="input-field text-sm" placeholder="Edad" value={formCrear.edad} onChange={(e) => setFormCrear({ ...formCrear, edad: e.target.value })} />
                                <select className="input-field text-sm" value={formCrear.genero} onChange={(e) => setFormCrear({ ...formCrear, genero: e.target.value })}>
                                  <option value="">Género...</option>
                                  {GENEROS.map((g) => <option key={g} value={g}>{g}</option>)}
                                </select>

                                <select className="input-field text-sm" value={formCrear.rol_afiliado} onChange={(e) => setFormCrear({ ...formCrear, rol_afiliado: e.target.value })}>
                                  {ROLES.map((rr) => <option key={rr} value={rr}>{rr}</option>)}
                                </select>
                                <select className="input-field text-sm" value={formCrear.sector_id} onChange={(e) => setFormCrear({ ...formCrear, sector_id: e.target.value })}>
                                  <option value="">Sin sector</option>
                                  {sectoresList.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                </select>
                                <select className="input-field text-sm" value={formCrear.tipo_ubicacion} onChange={(e) => setFormCrear({ ...formCrear, tipo_ubicacion: e.target.value, nombre_ubicacion: '' })}>
                                  <option value="">Tipo ubicación...</option>
                                  {TIPOS_UBICACION.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                {formCrear.tipo_ubicacion ? (
                                  opcionesUbicacionForm.length > 0 ? (
                                    <select className="input-field text-sm" value={formCrear.nombre_ubicacion} onChange={(e) => setFormCrear({ ...formCrear, nombre_ubicacion: e.target.value })}>
                                      <option value="">Ubicación...</option>
                                      {opcionesUbicacionForm.map((op) => <option key={op} value={op}>{op}</option>)}
                                    </select>
                                  ) : (
                                    <input className="input-field text-sm" placeholder="Nombre de ubicación" value={formCrear.nombre_ubicacion} onChange={(e) => setFormCrear({ ...formCrear, nombre_ubicacion: e.target.value })} />
                                  )
                                ) : <div />}

                                <select className="input-field text-sm" value={formCrear.afiliado_por} onChange={(e) => setFormCrear({ ...formCrear, afiliado_por: e.target.value })}>
                                  <option value="">Afiliado por...</option>
                                  {afiliadoPorList.map((ap) => <option key={ap.id} value={ap.nombre}>{ap.nombre}</option>)}
                                </select>
                                <select className="input-field text-sm" value={formCrear.vota_en_pinula ? 'si' : 'no'} onChange={(e) => setFormCrear({ ...formCrear, vota_en_pinula: e.target.value === 'si' })}>
                                  <option value="si">Vota en Pinula: Sí</option>
                                  <option value="no">Vota en Pinula: No</option>
                                </select>
                              </div>
                              {errorAccion && <p className="text-xs text-red-600">{errorAccion}</p>}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => confirmarCrear(r)}
                                  disabled={guardandoAccion === r.id}
                                  className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white disabled:opacity-50"
                                  style={{ background: '#166534' }}>
                                  {guardandoAccion === r.id ? 'Creando...' : 'Crear y vincular'}
                                </button>
                                <button onClick={cerrarCrear} className="text-xs px-3 py-1 rounded-lg border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 py-4 border-t flex-wrap" style={{ borderColor: 'var(--color-borde)' }}>
                <button onClick={() => irAPagina(page - 1)} disabled={page <= 1} className="px-2.5 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-40" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>←</button>
                {generarPaginas(page, totalPages).map((p, i) =>
                  p === '...' ? (
                    <span key={`dots-${i}`} className="px-2 text-sm" style={{ color: 'var(--texto-secundario)' }}>…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => irAPagina(p as number)}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                      style={p === page ? { background: '#004466', color: 'white' } : { border: '1px solid var(--color-borde)', color: 'var(--texto-secundario)' }}>
                      {p}
                    </button>
                  )
                )}
                <button onClick={() => irAPagina(page + 1)} disabled={page >= totalPages} className="px-2.5 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-40" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>→</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
