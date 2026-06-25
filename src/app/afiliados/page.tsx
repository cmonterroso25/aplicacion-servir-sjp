'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Afiliado, type Perfil, type Sector } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

const colorRol: Record<string, { bg: string; color: string }> = {
  Simpatizante: { bg: '#e0f7fa', color: '#004466' },
  Organizador:  { bg: '#fff3e0', color: '#b45309' },
  Guerrero:     { bg: '#fce4ec', color: '#9b1c3a' },
  Lider:        { bg: '#e8f5e9', color: '#166534' },
  Templario:    { bg: '#ede7f6', color: '#4527a0' },
}

const ROLES = ['Simpatizante', 'Organizador', 'Guerrero', 'Lider', 'Templario']

type SortField = 'nombre' | 'dpi' | 'telefono' | 'fecha_nacimiento' | 'genero' | 'rol' | 'sector' | 'ubicacion' | 'encargado' | 'afiliado_por' | 'vota' | 'fecha_registro'
type SortDir = 'asc' | 'desc'

type Draft = {
  primer_apellido: string
  segundo_apellido: string
  primer_nombre: string
  segundo_nombre: string
  dpi: string
  telefono: string
  fecha_nacimiento: string
  genero: string
  rol_afiliado: string
  sector_id: string
  nombre_ubicacion: string
  afiliado_por: string
  vota_en_pinula: boolean
}

export default function AfiliadosPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [afiliados, setAfiliados] = useState<Afiliado[]>([])
  const [sectoresList, setSectoresList] = useState<Sector[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [total, setTotal] = useState(0)

  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [filtros, setFiltros] = useState({
    nombre: '', dpi: '', telefono: '', fecha_nacimiento: '',
    genero: '', rol: '', sector: '', ubicacion: '',
    encargado: '', afiliado_por: '', vota: '', fecha_registro: '',
  })

  const [modoEdicion, setModoEdicion] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [errorEdicion, setErrorEdicion] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase
        .from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) setPerfil(p)

      const { data: sData } = await supabase.from('sectores').select('*').order('nombre')
      setSectoresList(sData || [])

      await cargarAfiliados(p?.rol || 'encargado', session.user.id, '')
    }
    init()
  }, [router])

  const cargarAfiliados = useCallback(async (rol: string, userId: string, termino: string) => {
    setLoading(true)
    try {
      let q = supabase
        .from('afiliados')
        .select('*, sectores(nombre, encargado_nombre), perfiles(nombre_completo, email)', { count: 'exact' })
        .order('primer_apellido')
        .limit(100)
      if (rol === 'encargado') q = q.eq('encargado_id', userId)
      if (termino.length >= 2) {
        q = q.or(`primer_apellido.ilike.%${termino}%,primer_nombre.ilike.%${termino}%,dpi.eq.${termino}`)
      }
      const { data, count } = await q
      setAfiliados(data || [])
      setTotal(count || 0)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleBuscar = () => {
    if (perfil) cargarAfiliados(perfil.rol, perfil.id, busqueda)
  }

  const formatNombre = (a: Afiliado) =>
    [a.primer_apellido, a.segundo_apellido, a.primer_nombre, a.segundo_nombre]
      .filter(Boolean).join(' ')

  const formatFecha = (f?: string | null) => {
    if (!f) return ''
    try {
      return new Date(f).toLocaleDateString('es-GT')
    } catch {
      return f
    }
  }

  const handleFiltroChange = (campo: keyof typeof filtros, valor: string) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }))
  }

  const limpiarFiltros = () => {
    setFiltros({
      nombre: '', dpi: '', telefono: '', fecha_nacimiento: '',
      genero: '', rol: '', sector: '', ubicacion: '',
      encargado: '', afiliado_por: '', vota: '', fecha_registro: '',
    })
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sectoresUnicos = useMemo(() => {
    const set = new Set<string>()
    afiliados.forEach((a) => { if ((a as any).sectores?.nombre) set.add((a as any).sectores.nombre) })
    return Array.from(set).sort()
  }, [afiliados])

  const generosUnicos = useMemo(() => {
    const set = new Set<string>()
    afiliados.forEach((a) => { if (a.genero) set.add(a.genero) })
    return Array.from(set).sort()
  }, [afiliados])

  const getValor = (a: Afiliado, field: SortField): string => {
    switch (field) {
      case 'nombre': return formatNombre(a).toLowerCase()
      case 'dpi': return (a.dpi || '').toLowerCase()
      case 'telefono': return (a.telefono || '').toLowerCase()
      case 'fecha_nacimiento': return a.fecha_nacimiento || ''
      case 'genero': return (a.genero || '').toLowerCase()
      case 'rol': return ((a as any).rol_afiliado || 'Simpatizante').toLowerCase()
      case 'sector': return ((a as any).sectores?.nombre || '').toLowerCase()
      case 'ubicacion': return (a.nombre_ubicacion || '').toLowerCase()
      case 'encargado': return (((a as any).sectores)?.encargado_nombre || '').toLowerCase()
      case 'afiliado_por': return ((a as any).afiliado_por || '').toLowerCase()
      case 'vota': return a.vota_en_pinula ? '1' : '0'
      case 'fecha_registro': return (a.created_at as any) || ''
      default: return ''
    }
  }

  const afiliadosFiltrados = useMemo(() => {
    let lista = afiliados.filter((a) => {
      const rol = (a as any).rol_afiliado || 'Simpatizante'
      const encargadoSector = ((a as any).sectores)?.encargado_nombre || ''
      const ubicacion = a.nombre_ubicacion || ''
      const afiliadoPor = (a as any).afiliado_por || ''
      const fechaNac = formatFecha(a.fecha_nacimiento)
      const fechaReg = formatFecha(a.created_at as any)

      if (filtros.nombre && !formatNombre(a).toLowerCase().includes(filtros.nombre.toLowerCase())) return false
      if (filtros.dpi && !(a.dpi || '').toLowerCase().includes(filtros.dpi.toLowerCase())) return false
      if (filtros.telefono && !(a.telefono || '').toLowerCase().includes(filtros.telefono.toLowerCase())) return false
      if (filtros.fecha_nacimiento && !fechaNac.includes(filtros.fecha_nacimiento)) return false
      if (filtros.genero && a.genero !== filtros.genero) return false
      if (filtros.rol && rol !== filtros.rol) return false
      if (filtros.sector && (a as any).sectores?.nombre !== filtros.sector) return false
      if (filtros.ubicacion && !ubicacion.toLowerCase().includes(filtros.ubicacion.toLowerCase())) return false
      if (filtros.encargado && !encargadoSector.toLowerCase().includes(filtros.encargado.toLowerCase())) return false
      if (filtros.afiliado_por && !afiliadoPor.toLowerCase().includes(filtros.afiliado_por.toLowerCase())) return false
      if (filtros.vota && (filtros.vota === 'si' ? !a.vota_en_pinula : a.vota_en_pinula)) return false
      if (filtros.fecha_registro && !fechaReg.includes(filtros.fecha_registro)) return false
      return true
    })

    if (sortField) {
      lista = [...lista].sort((a, b) => {
        const va = getValor(a, sortField)
        const vb = getValor(b, sortField)
        if (va < vb) return sortDir === 'asc' ? -1 : 1
        if (va > vb) return sortDir === 'asc' ? 1 : -1
        return 0
      })
    }

    return lista
  }, [afiliados, filtros, sortField, sortDir])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">⇅</span>
    }
    return <span className="ml-1" style={{ color: '#004466' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const iniciarEdicion = (a: Afiliado) => {
    setErrorEdicion('')
    setEditandoId(a.id)
    setDraft({
      primer_apellido: a.primer_apellido || '',
      segundo_apellido: a.segundo_apellido || '',
      primer_nombre: a.primer_nombre || '',
      segundo_nombre: a.segundo_nombre || '',
      dpi: a.dpi || '',
      telefono: a.telefono || '',
      fecha_nacimiento: a.fecha_nacimiento || '',
      genero: a.genero || '',
      rol_afiliado: (a as any).rol_afiliado || 'Simpatizante',
      sector_id: a.sector_id ? String(a.sector_id) : '',
      nombre_ubicacion: a.nombre_ubicacion || '',
      afiliado_por: (a as any).afiliado_por || '',
      vota_en_pinula: a.vota_en_pinula ?? true,
    })
  }

  const cancelarEdicion = () => {
    setEditandoId(null)
    setDraft(null)
    setErrorEdicion('')
  }

  const guardarEdicion = async () => {
    if (!draft || editandoId === null) return
    if (!draft.primer_apellido.trim() || !draft.primer_nombre.trim()) {
      setErrorEdicion('Nombre y apellido son obligatorios.')
      return
    }
    setGuardandoEdicion(true)
    setErrorEdicion('')

    if (draft.dpi.trim()) {
      const { data: existente } = await supabase
        .from('afiliados')
        .select('id')
        .eq('dpi', draft.dpi.trim())
        .neq('id', editandoId)
        .maybeSingle()
      if (existente) {
        setErrorEdicion('Esta persona ya se encuentra afiliada')
        setGuardandoEdicion(false)
        return
      }
    }

    const { data: actualizado, error: err } = await supabase
      .from('afiliados')
      .update({
        primer_apellido: draft.primer_apellido.toUpperCase(),
        segundo_apellido: draft.segundo_apellido.toUpperCase() || null,
        primer_nombre: draft.primer_nombre.toUpperCase(),
        segundo_nombre: draft.segundo_nombre.toUpperCase() || null,
        dpi: draft.dpi || null,
        telefono: draft.telefono || null,
        fecha_nacimiento: draft.fecha_nacimiento || null,
        genero: draft.genero || null,
        rol_afiliado: draft.rol_afiliado,
        sector_id: draft.sector_id ? parseInt(draft.sector_id) : null,
        nombre_ubicacion: draft.nombre_ubicacion || null,
        afiliado_por: draft.afiliado_por || null,
        vota_en_pinula: draft.vota_en_pinula,
      })
      .eq('id', editandoId)
      .select('*, sectores(nombre, encargado_nombre), perfiles(nombre_completo, email)')
      .single()

    if (err) {
      if ((err as any).code === '23505') {
        setErrorEdicion('Esta persona ya se encuentra afiliada')
      } else {
        setErrorEdicion('Error al guardar los cambios. Intenta de nuevo.')
      }
      setGuardandoEdicion(false)
      return
    }

    setAfiliados((prev) => prev.map((a) => (a.id === editandoId ? (actualizado as any) : a)))
    setGuardandoEdicion(false)
    setEditandoId(null)
    setDraft(null)
  }

  const thBase = "text-left px-3 py-2 font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-gray-100"
  const inputFiltro = "w-full text-xs border rounded px-2 py-1"
  const inputFiltroStyle = { borderColor: 'var(--color-borde)' }
  const inputEdicion = "w-full text-xs border rounded px-1.5 py-1"
  const inputEdicionStyle = { borderColor: '#004466' }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol || ''} />
      <header className="bg-white border-b shadow-sm sticky top-0 z-10" style={{ borderColor: 'var(--color-borde)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#004466' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-sm" style={{ color: '#004466' }}>Afiliados</h1>
              <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>
                {perfil?.rol === 'encargado' ? 'Mis afiliados' : 'Todos los afiliados'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/afiliados/nuevo')} className="text-sm px-4 py-1.5 rounded-lg font-semibold text-white" style={{ background: '#004466' }}>
              + Nuevo
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="card">
          <div className="flex gap-2">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              className="input-field flex-1"
              placeholder="Buscar por nombre, apellido o DPI (servidor)..."
            />
            {busqueda && (
              <button onClick={() => { setBusqueda(''); if (perfil) cargarAfiliados(perfil.rol, perfil.id, '') }} className="px-3 rounded-lg border text-sm" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                X
              </button>
            )}
            <button onClick={handleBuscar} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#004466' }}>
              Buscar
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm font-medium" style={{ color: 'var(--texto-secundario)' }}>
            {loading ? 'Cargando...' : `${afiliadosFiltrados.length} de ${total} afiliado${total !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={limpiarFiltros} className="text-xs px-3 py-1.5 rounded-lg border font-medium" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
              Limpiar filtros
            </button>
            {perfil?.rol !== 'encargado' && perfil?.rol !== 'lider' && (
              <button
                onClick={() => { setModoEdicion((v) => !v); cancelarEdicion() }}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                style={{ background: modoEdicion ? '#9b1c3a' : '#004466' }}>
                {modoEdicion ? 'Salir de edición' : 'Editar afiliados'}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="card text-center py-10">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#004466' }}></div>
          </div>
        ) : afiliados.length === 0 ? (
          <div className="card text-center py-10">
            <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>No hay afiliados registrados</p>
            <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>Haz clic en "+ Nuevo" para agregar el primero.</p>
          </div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f0f6f9', borderBottom: '1px solid var(--color-borde)' }}>
                  <th className={thBase} style={{ color: 'var(--texto-secundario)' }} onClick={() => handleSort('nombre')}>Nombre completo<SortIcon field="nombre" /></th>
                  <th className={thBase} style={{ color: 'var(--texto-secundario)' }} onClick={() => handleSort('dpi')}>DPI<SortIcon field="dpi" /></th>
                  <th className={thBase} style={{ color: 'var(--texto-secundario)' }} onClick={() => handleSort('telefono')}>Teléfono<SortIcon field="telefono" /></th>
                  <th className={thBase} style={{ color: 'var(--texto-secundario)' }} onClick={() => handleSort('fecha_nacimiento')}>F. Nacimiento<SortIcon field="fecha_nacimiento" /></th>
                  <th className={thBase} style={{ color: 'var(--texto-secundario)' }} onClick={() => handleSort('genero')}>Género<SortIcon field="genero" /></th>
                  <th className={thBase} style={{ color: 'var(--texto-secundario)' }} onClick={() => handleSort('rol')}>Rol<SortIcon field="rol" /></th>
                  <th className={thBase} style={{ color: 'var(--texto-secundario)' }} onClick={() => handleSort('sector')}>Sector<SortIcon field="sector" /></th>
                  <th className={thBase} style={{ color: 'var(--texto-secundario)' }} onClick={() => handleSort('ubicacion')}>Ubicación<SortIcon field="ubicacion" /></th>
                  {perfil?.rol !== 'encargado' && perfil?.rol !== 'lider' && (
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }} onClick={() => handleSort('encargado')}>Encargado del sector<SortIcon field="encargado" /></th>
                  )}
                  <th className={thBase} style={{ color: 'var(--texto-secundario)' }} onClick={() => handleSort('afiliado_por')}>Afiliado por<SortIcon field="afiliado_por" /></th>
                  <th className={thBase} style={{ color: 'var(--texto-secundario)' }} onClick={() => handleSort('vota')}>Vota en Pinula<SortIcon field="vota" /></th>
                  <th className={thBase} style={{ color: 'var(--texto-secundario)' }} onClick={() => handleSort('fecha_registro')}>F. Registro<SortIcon field="fecha_registro" /></th>
                  {modoEdicion && (
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-secundario)' }}>Acciones</th>
                  )}
                </tr>
                <tr style={{ background: 'white', borderBottom: '2px solid var(--color-borde)' }}>
                  <th className="px-3 py-1.5">
                    <input type="text" value={filtros.nombre} onChange={(e) => handleFiltroChange('nombre', e.target.value)} placeholder="Filtrar..." className={inputFiltro} style={inputFiltroStyle} />
                  </th>
                  <th className="px-3 py-1.5">
                    <input type="text" value={filtros.dpi} onChange={(e) => handleFiltroChange('dpi', e.target.value)} placeholder="Filtrar..." className={inputFiltro} style={inputFiltroStyle} />
                  </th>
                  <th className="px-3 py-1.5">
                    <input type="text" value={filtros.telefono} onChange={(e) => handleFiltroChange('telefono', e.target.value)} placeholder="Filtrar..." className={inputFiltro} style={inputFiltroStyle} />
                  </th>
                  <th className="px-3 py-1.5">
                    <input type="text" value={filtros.fecha_nacimiento} onChange={(e) => handleFiltroChange('fecha_nacimiento', e.target.value)} placeholder="dd/mm/aaaa" className={inputFiltro} style={inputFiltroStyle} />
                  </th>
                  <th className="px-3 py-1.5">
                    <select value={filtros.genero} onChange={(e) => handleFiltroChange('genero', e.target.value)} className={inputFiltro} style={inputFiltroStyle}>
                      <option value="">Todos</option>
                      {generosUnicos.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </th>
                  <th className="px-3 py-1.5">
                    <select value={filtros.rol} onChange={(e) => handleFiltroChange('rol', e.target.value)} className={inputFiltro} style={inputFiltroStyle}>
                      <option value="">Todos</option>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </th>
                  <th className="px-3 py-1.5">
                    <select value={filtros.sector} onChange={(e) => handleFiltroChange('sector', e.target.value)} className={inputFiltro} style={inputFiltroStyle}>
                      <option value="">Todos</option>
                      {sectoresUnicos.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </th>
                  <th className="px-3 py-1.5">
                    <input type="text" value={filtros.ubicacion} onChange={(e) => handleFiltroChange('ubicacion', e.target.value)} placeholder="Filtrar..." className={inputFiltro} style={inputFiltroStyle} />
                  </th>
                  {perfil?.rol !== 'encargado' && perfil?.rol !== 'lider' && (
                    <th className="px-3 py-1.5">
                      <input type="text" value={filtros.encargado} onChange={(e) => handleFiltroChange('encargado', e.target.value)} placeholder="Filtrar..." className={inputFiltro} style={inputFiltroStyle} />
                    </th>
                  )}
                  <th className="px-3 py-1.5">
                    <input type="text" value={filtros.afiliado_por} onChange={(e) => handleFiltroChange('afiliado_por', e.target.value)} placeholder="Filtrar..." className={inputFiltro} style={inputFiltroStyle} />
                  </th>
                  <th className="px-3 py-1.5">
                    <select value={filtros.vota} onChange={(e) => handleFiltroChange('vota', e.target.value)} className={inputFiltro} style={inputFiltroStyle}>
                      <option value="">Todos</option>
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </select>
                  </th>
                  <th className="px-3 py-1.5">
                    <input type="text" value={filtros.fecha_registro} onChange={(e) => handleFiltroChange('fecha_registro', e.target.value)} placeholder="dd/mm/aaaa" className={inputFiltro} style={inputFiltroStyle} />
                  </th>
                  {modoEdicion && <th className="px-3 py-1.5"></th>}
                </tr>
              </thead>
              <tbody>
                {afiliadosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-8 text-sm" style={{ color: 'var(--texto-secundario)' }}>
                      Ningun afiliado coincide con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  afiliadosFiltrados.map((a, idx) => {
                    const rol = (a as any).rol_afiliado || 'Simpatizante'
                    const estiloRol = colorRol[rol] || colorRol['Simpatizante']
                    const encargadoSector = ((a as any).sectores)?.encargado_nombre
                    const enEdicion = modoEdicion && editandoId === a.id && draft

                    if (enEdicion) {
                      return (
                        <tr key={a.id} style={{ background: '#fff7ed' }}>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              <input className={inputEdicion} style={inputEdicionStyle} value={draft.primer_apellido} onChange={(e) => setDraft({ ...draft, primer_apellido: e.target.value })} placeholder="Primer apellido" />
                              <input className={inputEdicion} style={inputEdicionStyle} value={draft.segundo_apellido} onChange={(e) => setDraft({ ...draft, segundo_apellido: e.target.value })} placeholder="Segundo apellido" />
                              <input className={inputEdicion} style={inputEdicionStyle} value={draft.primer_nombre} onChange={(e) => setDraft({ ...draft, primer_nombre: e.target.value })} placeholder="Primer nombre" />
                              <input className={inputEdicion} style={inputEdicionStyle} value={draft.segundo_nombre} onChange={(e) => setDraft({ ...draft, segundo_nombre: e.target.value })} placeholder="Segundo nombre" />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input className={inputEdicion} style={inputEdicionStyle} value={draft.dpi} onChange={(e) => setDraft({ ...draft, dpi: e.target.value })} />
                          </td>
                          <td className="px-3 py-2">
                            <input className={inputEdicion} style={inputEdicionStyle} value={draft.telefono} onChange={(e) => setDraft({ ...draft, telefono: e.target.value })} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="date" className={inputEdicion} style={inputEdicionStyle} value={draft.fecha_nacimiento} onChange={(e) => setDraft({ ...draft, fecha_nacimiento: e.target.value })} />
                          </td>
                          <td className="px-3 py-2">
                            <input className={inputEdicion} style={inputEdicionStyle} value={draft.genero} onChange={(e) => setDraft({ ...draft, genero: e.target.value })} />
                          </td>
                          <td className="px-3 py-2">
                            <select className={inputEdicion} style={inputEdicionStyle} value={draft.rol_afiliado} onChange={(e) => setDraft({ ...draft, rol_afiliado: e.target.value })}>
                              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select className={inputEdicion} style={inputEdicionStyle} value={draft.sector_id} onChange={(e) => setDraft({ ...draft, sector_id: e.target.value })}>
                              <option value="">Sin sector</option>
                              {sectoresList.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input className={inputEdicion} style={inputEdicionStyle} value={draft.nombre_ubicacion} onChange={(e) => setDraft({ ...draft, nombre_ubicacion: e.target.value })} />
                          </td>
                          {perfil?.rol !== 'encargado' && perfil?.rol !== 'lider' && (
                            <td className="px-3 py-2 text-xs" style={{ color: 'var(--texto-secundario)' }}>{encargadoSector || '—'}</td>
                          )}
                          <td className="px-3 py-2">
                            <input className={inputEdicion} style={inputEdicionStyle} value={draft.afiliado_por} onChange={(e) => setDraft({ ...draft, afiliado_por: e.target.value })} />
                          </td>
                          <td className="px-3 py-2">
                            <select className={inputEdicion} style={inputEdicionStyle} value={draft.vota_en_pinula ? 'si' : 'no'} onChange={(e) => setDraft({ ...draft, vota_en_pinula: e.target.value === 'si' })}>
                              <option value="si">Sí</option>
                              <option value="no">No</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ color: 'var(--texto-secundario)' }}>{formatFecha(a.created_at as any) || '—'}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1.5">
                              <button onClick={guardarEdicion} disabled={guardandoEdicion} className="text-xs px-2 py-1 rounded-lg font-semibold text-white disabled:opacity-50" style={{ background: '#166534' }}>
                                {guardandoEdicion ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button onClick={cancelarEdicion} className="text-xs px-2 py-1 rounded-lg border font-medium" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                                Cancelar
                              </button>
                              {errorEdicion && (
                                <p className="text-xs text-red-600 mt-1">{errorEdicion}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr
                        key={a.id}
                        className="border-b hover:bg-gray-50 transition-colors"
                        style={{ borderColor: 'var(--color-borde)', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#004466' }}>
                              {a.primer_apellido.charAt(0)}
                            </div>
                            <span className="font-semibold" style={{ color: 'var(--texto-principal)' }}>{formatNombre(a)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono whitespace-nowrap">{a.dpi || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{a.telefono || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatFecha(a.fecha_nacimiento) || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{a.genero || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: estiloRol.bg, color: estiloRol.color }}>
                            {rol}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{(a as any).sectores?.nombre || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {a.tipo_ubicacion && a.nombre_ubicacion ? `${a.nombre_ubicacion}` : '—'}
                        </td>
                        {perfil?.rol !== 'encargado' && perfil?.rol !== 'lider' && (
                          <td className="px-3 py-2.5 whitespace-nowrap">{encargadoSector || '—'}</td>
                        )}
                        <td className="px-3 py-2.5 whitespace-nowrap">{(a as any).afiliado_por || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
                            style={{ background: a.vota_en_pinula ? '#dcfce7' : '#fee2e2', color: a.vota_en_pinula ? '#166534' : '#991b1b' }}>
                            {a.vota_en_pinula ? 'Sí' : 'No'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatFecha(a.created_at as any) || '—'}</td>
                        {modoEdicion && (
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button onClick={() => iniciarEdicion(a)} className="text-xs px-2.5 py-1 rounded-lg font-semibold text-white" style={{ background: '#004466' }}>
                              Editar
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
