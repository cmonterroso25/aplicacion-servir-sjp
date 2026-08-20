'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Perfil } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

type AfiliadoPorCount = {
  nombre: string
  total: number
}

type EstadisticaSector = {
  sector: string
  encargado: string
  total: number
  vota_pinula: number
  no_vota: number
  simpatizante: number
  organizador: number
  guerrero: number
  lider: number
  templario: number
  afiliado_por: AfiliadoPorCount[]
}

type EstadisticaLegalSector = {
  sector: string
  total: number
  vinculados: number
  pendientes: number
}

type RolCount = {
  lider: number
  guerrero: number
  organizador: number
  simpatizante: number
  otro: number
}

type SectorCount = {
  nombre: string
  total: number
}

type AfiliadoPorStats = {
  afiliado_por: string
  total: number
  vota_pinula: number
  no_vota: number
  sectores: SectorCount[]
  roles: RolCount
}

type EstadisticaLegalTemplario = {
  afiliado_por: string
  total: number
  vinculados: number
  pendientes: number
}

const ROLES_SIN_ACCESO = ['lider', 'colaborador', 'templario']
const ROLES_LEGALES = ['admin', 'pentagono']

// ──────────────────────────────────────────────────────────────
// Normalización de nombres (compartida entre Por sector y Por templario)
// ──────────────────────────────────────────────────────────────
// Resuelve variantes por tildes, mayúsculas o espacios extra
// (ej. "René Galicia" vs "Rene Galicia", "Sebastián España" vs
// "Sebastian Espana"). NO fusiona nombres realmente distintos.
function normalizarClave(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes/diacríticos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // colapsa espacios múltiples/invisibles
}

// Alias manuales confirmados: casos donde la normalización por
// tildes no alcanza (ej. nombre incompleto) pero SÍ es la misma
// persona. Confirmado con el usuario antes de agregar cada entrada.
// La clave y el valor deben ser resultado de normalizarClave().
const ALIAS_TEMPLARIOS: Record<string, string> = {
  'alejandro': 'alejandro rustrian',
}

function claveFinal(nombreOriginal: string): string {
  const base = normalizarClave(nombreOriginal)
  return ALIAS_TEMPLARIOS[base] || base
}

export default function EstadisticasPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [vista, setVista] = useState<'sector' | 'templario'>('sector')

  // ── Por sector ──────────────────────────────────────────────
  const [estadisticas, setEstadisticas] = useState<EstadisticaSector[]>([])
  const [totales, setTotales] = useState({ total: 0, vota: 0, no_vota: 0 })
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)

  // Afiliados legales (TSE) por sector
  const [legalesTotales, setLegalesTotales] = useState({ total: 0, vinculados: 0, pendientes: 0 })
  const [legalesPorSector, setLegalesPorSector] = useState<EstadisticaLegalSector[]>([])
  const [loadingLegales, setLoadingLegales] = useState(true)
  const [mostrarLegales, setMostrarLegales] = useState(false)

  // ── Por templario ───────────────────────────────────────────
  const [statsTemplarios, setStatsTemplarios] = useState<AfiliadoPorStats[]>([])
  const [loadingTemplarios, setLoadingTemplarios] = useState(false)
  const [expandidoTemplario, setExpandidoTemplario] = useState<string | null>(null)
  const [templarioDataCargada, setTemplarioDataCargada] = useState(false)

  const [statsLegalesTemplario, setStatsLegalesTemplario] = useState<EstadisticaLegalTemplario[]>([])
  const [totalesLegalesTemplario, setTotalesLegalesTemplario] = useState({ total: 0, vinculados: 0, pendientes: 0 })
  const [loadingLegalesTemplario, setLoadingLegalesTemplario] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase
        .from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) {
        if (ROLES_SIN_ACCESO.includes(p.rol)) { router.replace('/afiliados'); return }
        setPerfil(p)
        await cargarEstadisticas(p.rol, session.user.id)

        if (ROLES_LEGALES.includes(p.rol)) {
          setMostrarLegales(true)
          await cargarEstadisticasLegales()
        } else {
          setLoadingLegales(false)
        }
      }
    }
    init()
  }, [router])

  const mostrarTemplarioTab = !!perfil && ROLES_LEGALES.includes(perfil.rol)

  const seleccionarVistaTemplario = () => {
    setVista('templario')
    if (!templarioDataCargada) {
      setTemplarioDataCargada(true)
      setLoadingTemplarios(true)
      setLoadingLegalesTemplario(true)
      cargarStatsTemplario()
      cargarStatsLegalesTemplario()
    }
  }

  const cargarEstadisticas = async (rol: string, userId: string) => {
    setLoading(true)
    setErrorCarga('')
    try {
      const encargadosPorSector: Record<number, string[]> = {}
      try {
        const { data: encargadosData, error: encargadosError } = await supabase
          .from('sectores_encargados')
          .select('sector_id, encargado_nombre')

        if (encargadosError) {
          console.error('Error cargando sectores_encargados. message:', encargadosError.message)
          console.error('Error cargando sectores_encargados. details:', encargadosError.details)
          console.error('Error cargando sectores_encargados. hint:', encargadosError.hint)
          console.error('Error cargando sectores_encargados. code:', encargadosError.code)
        } else {
          console.log('sectores_encargados OK, filas:', encargadosData?.length)
          ;(encargadosData || []).forEach((row: any) => {
            if (row.sector_id == null) return
            if (!encargadosPorSector[row.sector_id]) encargadosPorSector[row.sector_id] = []
            if (row.encargado_nombre) encargadosPorSector[row.sector_id].push(row.encargado_nombre)
          })
        }
      } catch (e) {
        console.error('Excepcion cargando sectores_encargados:', e)
      }

      let allData: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        let q = supabase
          .from('afiliados')
          .select('sector_id, vota_en_pinula, rol_afiliado, afiliado_por, sectores(nombre), encargado_id')
          .range(from, from + pageSize - 1)

        if (rol === 'encargado') {
          q = q.eq('encargado_id', userId)
        }

        const { data: pageData, error } = await q
        if (error) {
          console.error('Error cargando afiliados:', error.message)
          throw new Error(error.message || 'Error al cargar afiliados')
        }
        if (!pageData || pageData.length === 0) { hasMore = false; break }

        allData = allData.concat(pageData)
        if (pageData.length < pageSize) hasMore = false
        from += pageSize
      }

      const data = allData

      if (!data) return

      const mapa: Record<string, EstadisticaSector> = {}
      const afiliadoPorVariantes: Record<string, Record<string, Record<string, number>>> = {}
      const afiliadoPorTotales: Record<string, Record<string, number>> = {}

      data.forEach((a: any) => {
        const sectorNombre = a.sectores?.nombre || 'Sin sector'
        const nombresEncargados = a.sector_id != null ? (encargadosPorSector[a.sector_id] || []) : []
        const encargado = nombresEncargados.length > 0 ? nombresEncargados.join(', ') : 'Sin encargado'
        const key = sectorNombre

        if (!mapa[key]) {
          mapa[key] = {
            sector: sectorNombre,
            encargado,
            total: 0,
            vota_pinula: 0,
            no_vota: 0,
            simpatizante: 0,
            organizador: 0,
            guerrero: 0,
            lider: 0,
            templario: 0,
            afiliado_por: [],
          }
          afiliadoPorVariantes[key] = {}
          afiliadoPorTotales[key] = {}
        }

        mapa[key].total++
        if (a.vota_en_pinula) mapa[key].vota_pinula++
        else mapa[key].no_vota++

        const rol_a = normalizarClave(a.rol_afiliado || 'Simpatizante')
        if (rol_a === 'simpatizante') mapa[key].simpatizante++
        else if (rol_a === 'organizador') mapa[key].organizador++
        else if (rol_a === 'guerrero') mapa[key].guerrero++
        else if (rol_a === 'lider') mapa[key].lider++
        else if (rol_a === 'templario') mapa[key].templario++

        const afiliadoPorOriginal = a.afiliado_por || 'Sin registrar'
        const afiliadoPorKey = normalizarClave(afiliadoPorOriginal)

        afiliadoPorTotales[key][afiliadoPorKey] = (afiliadoPorTotales[key][afiliadoPorKey] || 0) + 1
        if (!afiliadoPorVariantes[key][afiliadoPorKey]) afiliadoPorVariantes[key][afiliadoPorKey] = {}
        afiliadoPorVariantes[key][afiliadoPorKey][afiliadoPorOriginal] =
          (afiliadoPorVariantes[key][afiliadoPorKey][afiliadoPorOriginal] || 0) + 1
      })

      for (const sectorKey of Object.keys(mapa)) {
        const totalesSector = afiliadoPorTotales[sectorKey]
        const variantesSector = afiliadoPorVariantes[sectorKey]
        mapa[sectorKey].afiliado_por = Object.keys(totalesSector).map((apKey) => {
          const variantes = variantesSector[apKey]
          const nombreMasFrecuente = Object.entries(variantes).sort((a, b) => b[1] - a[1])[0][0]
          return { nombre: nombreMasFrecuente, total: totalesSector[apKey] }
        }).sort((a, b) => b.total - a.total)
      }

      const lista = Object.values(mapa).sort((a, b) => b.total - a.total)
      setEstadisticas(lista)

      const total = data.length
      const vota = data.filter((a: any) => a.vota_en_pinula).length
      setTotales({ total, vota, no_vota: total - vota })

    } catch (e: any) {
      console.error('Error cargando estadisticas:', e)
      setErrorCarga(e?.message || 'Ocurrio un error al cargar las estadisticas')
    } finally {
      setLoading(false)
    }
  }

  const cargarEstadisticasLegales = async () => {
    setLoadingLegales(true)
    try {
      let allData: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: pageData, error } = await supabase
          .from('afiliados_legales')
          .select('sector_id, vinculado, sectores(nombre)')
          .range(from, from + pageSize - 1)

        if (error) {
          console.error('Error cargando afiliados_legales:', error.message)
          hasMore = false
          break
        }
        if (!pageData || pageData.length === 0) { hasMore = false; break }

        allData = allData.concat(pageData)
        if (pageData.length < pageSize) hasMore = false
        from += pageSize
      }

      const mapa: Record<string, EstadisticaLegalSector> = {}
      allData.forEach((a: any) => {
        const sectorNombre = a.sectores?.nombre || 'Sin sector'
        if (!mapa[sectorNombre]) {
          mapa[sectorNombre] = { sector: sectorNombre, total: 0, vinculados: 0, pendientes: 0 }
        }
        mapa[sectorNombre].total++
        if (a.vinculado) mapa[sectorNombre].vinculados++
        else mapa[sectorNombre].pendientes++
      })

      const lista = Object.values(mapa).sort((a, b) => b.total - a.total)
      setLegalesPorSector(lista)

      const total = allData.length
      const vinculados = allData.filter((a: any) => a.vinculado).length
      setLegalesTotales({ total, vinculados, pendientes: total - vinculados })
    } catch (e) {
      console.error('Excepcion cargando estadisticas legales:', e)
    } finally {
      setLoadingLegales(false)
    }
  }

  const cargarStatsTemplario = async () => {
    try {
      let allRows: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: page, error } = await supabase
          .rpc('obtener_stats_templarios')
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!page || page.length === 0) { hasMore = false; break }

        allRows = allRows.concat(page)
        if (page.length < pageSize) hasMore = false
        from += pageSize
      }

      const data = allRows

      const mapa: Record<string, AfiliadoPorStats> = {}
      const variantesPorClave: Record<string, Record<string, number>> = {}

      for (const row of data || []) {
        const nombreOriginal = (row.afiliado_por as string) || 'Sin registrar'
        const key = claveFinal(nombreOriginal)
        const sectorNombre = row.sector_nombre || 'Sin sector'
        const rol = (row.rol_afiliado || '').toLowerCase()

        if (!mapa[key]) {
          mapa[key] = {
            afiliado_por: nombreOriginal,
            total: 0,
            vota_pinula: 0,
            no_vota: 0,
            sectores: [],
            roles: { lider: 0, guerrero: 0, organizador: 0, simpatizante: 0, otro: 0 }
          }
          variantesPorClave[key] = {}
        }

        variantesPorClave[key][nombreOriginal] = (variantesPorClave[key][nombreOriginal] || 0) + 1

        mapa[key].total++
        if (row.vota_en_pinula) mapa[key].vota_pinula++
        else mapa[key].no_vota++

        const sectorExistente = mapa[key].sectores.find(s => s.nombre === sectorNombre)
        if (sectorExistente) {
          sectorExistente.total++
        } else {
          mapa[key].sectores.push({ nombre: sectorNombre, total: 1 })
        }

        if (rol.includes('líder') || rol.includes('lider')) mapa[key].roles.lider++
        else if (rol.includes('guerrero')) mapa[key].roles.guerrero++
        else if (rol.includes('organizador')) mapa[key].roles.organizador++
        else if (rol.includes('simpatizante')) mapa[key].roles.simpatizante++
        else mapa[key].roles.otro++
      }

      for (const key of Object.keys(mapa)) {
        const variantes = variantesPorClave[key]
        const nombreMasFrecuente = Object.entries(variantes).sort((a, b) => b[1] - a[1])[0][0]
        mapa[key].afiliado_por = nombreMasFrecuente
      }

      const resultado = Object.values(mapa).sort((a, b) => b.total - a.total)
      setStatsTemplarios(resultado)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingTemplarios(false)
    }
  }

  const cargarStatsLegalesTemplario = async () => {
    try {
      let allRows: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: page, error } = await supabase
          .from('afiliados_legales')
          .select('afiliado_por, vinculado')
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!page || page.length === 0) { hasMore = false; break }

        allRows = allRows.concat(page)
        if (page.length < pageSize) hasMore = false
        from += pageSize
      }

      const mapa: Record<string, EstadisticaLegalTemplario> = {}
      const variantesPorClave: Record<string, Record<string, number>> = {}

      for (const row of allRows) {
        const nombreOriginal = (row.afiliado_por as string) || 'Sin registrar'
        const key = claveFinal(nombreOriginal)

        if (!mapa[key]) {
          mapa[key] = { afiliado_por: nombreOriginal, total: 0, vinculados: 0, pendientes: 0 }
          variantesPorClave[key] = {}
        }

        variantesPorClave[key][nombreOriginal] = (variantesPorClave[key][nombreOriginal] || 0) + 1

        mapa[key].total++
        if (row.vinculado) mapa[key].vinculados++
        else mapa[key].pendientes++
      }

      for (const key of Object.keys(mapa)) {
        const variantes = variantesPorClave[key]
        const nombreMasFrecuente = Object.entries(variantes).sort((a, b) => b[1] - a[1])[0][0]
        mapa[key].afiliado_por = nombreMasFrecuente
      }

      const resultado = Object.values(mapa).sort((a, b) => b.total - a.total)
      setStatsLegalesTemplario(resultado)

      const total = allRows.length
      const vinculados = allRows.filter((r) => r.vinculado).length
      setTotalesLegalesTemplario({ total, vinculados, pendientes: total - vinculados })
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingLegalesTemplario(false)
    }
  }

  const porcentaje = (parte: number, total: number) =>
    total === 0 ? 0 : Math.round((parte / total) * 100)

  const colorRol: Record<string, string> = {
    simpatizante: '#004466',
    organizador: '#b45309',
    guerrero: '#9b1c3a',
    lider: '#166534',
    templario: '#4527a0',
  }

  const totalGeneralTemplario = statsTemplarios.reduce((s, e) => s + e.total, 0)

  const ROLES_TEMPLARIO = [
    { key: 'lider',        label: 'Líderes',        color: '#004466', bg: '#e0f7fa' },
    { key: 'guerrero',     label: 'Guerreros',       color: '#b45309', bg: '#fef3c7' },
    { key: 'organizador',  label: 'Organizadores',   color: '#065f46', bg: '#d1fae5' },
    { key: 'simpatizante', label: 'Simpatizantes',   color: '#6b7280', bg: '#f3f4f6' },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol} />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {mostrarTemplarioTab && (
          <div className="flex gap-2">
            <button
              onClick={() => setVista('sector')}
              className="text-sm px-4 py-2 rounded-lg border font-medium transition-all"
              style={vista === 'sector'
                ? { background: '#004466', color: 'white', borderColor: '#004466' }
                : { background: 'white', color: 'var(--texto-secundario)', borderColor: 'var(--color-borde)' }}>
              Por sector
            </button>
            <button
              onClick={seleccionarVistaTemplario}
              className="text-sm px-4 py-2 rounded-lg border font-medium transition-all"
              style={vista === 'templario'
                ? { background: '#004466', color: 'white', borderColor: '#004466' }
                : { background: 'white', color: 'var(--texto-secundario)', borderColor: 'var(--color-borde)' }}>
              Por templario
            </button>
          </div>
        )}

        {vista === 'sector' && (
          <>
            {/* Tarjetas resumen */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card text-center">
                <p className="text-3xl font-bold" style={{ color: '#004466' }}>{totales.total}</p>
                <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Total afiliados</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-green-600">{totales.vota}</p>
                <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Votan en Pinula</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-red-500">{totales.no_vota}</p>
                <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>No votan aqui</p>
              </div>
            </div>

            {errorCarga && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {errorCarga}
              </div>
            )}

            {loading ? (
              <div className="card text-center py-10">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#004466' }}></div>
              </div>
            ) : estadisticas.length === 0 ? (
              <div className="card text-center py-10">
                <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>No hay datos todavia</p>
              </div>
            ) : (
              <>
              {/* Grafica resumen: afiliados por sector */}
              <div className="card space-y-4">
                <h2 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>
                  Afiliados por sector
                </h2>
                <div className="space-y-2.5">
                  {estadisticas.map((e) => {
                    const max = estadisticas[0].total || 1
                    const ancho = Math.max((e.total / max) * 100, 6)
                    return (
                      <div key={e.sector} className="flex items-center gap-3">
                        <p
                          className="text-xs font-medium w-28 sm:w-40 flex-shrink-0 text-right leading-tight"
                          style={{ color: 'var(--texto-secundario)' }}
                          title={e.sector}
                        >
                          {e.sector}
                        </p>
                        <div className="flex-1 h-5 rounded-md overflow-hidden">
                          <div
                            className="h-full rounded-md flex items-center justify-end px-2 transition-all"
                            style={{ width: `${ancho}%`, background: '#004466', minWidth: '1.75rem' }}
                          >
                            <span className="text-xs font-semibold text-white">{e.total}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>
                  Por sector
                </h2>
                {estadisticas.map((e) => {
                  const abierto = expandido === e.sector
                  return (
                    <div key={e.sector} className="card hover:shadow-md transition-shadow">
                      <button className="w-full text-left" onClick={() => setExpandido(abierto ? null : e.sector)}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold" style={{ color: 'var(--texto-principal)' }}>{e.sector}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--texto-secundario)' }}>
                              Encargado: {e.encargado}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-2xl font-bold leading-none" style={{ color: '#004466' }}>{e.total}</p>
                              <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>afiliados</p>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--texto-secundario)' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Barra de progreso votan vs no votan */}
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--texto-secundario)' }}>
                            <span>Votan en Pinula: {e.vota_pinula} ({porcentaje(e.vota_pinula, e.total)}%)</span>
                            <span>No votan: {e.no_vota}</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: '#fee2e2' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${porcentaje(e.vota_pinula, e.total)}%`, background: '#166534' }}
                            />
                          </div>
                        </div>

                        {/* Roles */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {[
                            { key: 'simpatizante', label: 'Simpatizante', val: e.simpatizante },
                            { key: 'organizador', label: 'Organizador', val: e.organizador },
                            { key: 'guerrero', label: 'Guerrero', val: e.guerrero },
                            { key: 'lider', label: 'Lider', val: e.lider },
                            { key: 'templario', label: 'Templario', val: e.templario },
                          ].filter(r => r.val > 0).map((r) => (
                            <span key={r.key} className="text-xs font-medium px-2 py-1 rounded-full"
                              style={{ background: `${colorRol[r.key]}15`, color: colorRol[r.key] }}>
                              {r.label}: {r.val}
                            </span>
                          ))}
                        </div>
                      </button>

                      {abierto && (
                        <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: 'var(--color-borde)' }}>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--texto-secundario)' }}>
                            Afiliado por
                          </p>
                          {e.afiliado_por.length === 0 ? (
                            <p className="text-sm italic" style={{ color: 'var(--texto-secundario)' }}>Sin registros.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {e.afiliado_por.map((ap) => (
                                <div key={ap.nombre} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#f8fafc' }}>
                                  <span className="text-xs font-medium" style={{ color: 'var(--texto-principal)' }}>{ap.nombre}</span>
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#e0f7fa', color: '#004466' }}>
                                    {ap.total} afiliado{ap.total !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              </>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* Afiliados legales (TSE) — solo visible para admin/pentagono */}
            {/* ────────────────────────────────────────────────────────── */}
            {mostrarLegales && (
              <div className="space-y-5 pt-2">
                <h2 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>
                  Afiliados legales (TSE)
                </h2>

                <div className="grid grid-cols-3 gap-3">
                  <div className="card text-center">
                    <p className="text-3xl font-bold" style={{ color: '#004466' }}>{legalesTotales.total}</p>
                    <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Total afiliados legales</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-3xl font-bold text-green-600">{legalesTotales.vinculados}</p>
                    <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Vinculados</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-3xl font-bold" style={{ color: '#92400e' }}>{legalesTotales.pendientes}</p>
                    <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Pendientes de vincular</p>
                  </div>
                </div>

                {loadingLegales ? (
                  <div className="card text-center py-10">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#004466' }}></div>
                  </div>
                ) : legalesPorSector.length === 0 ? (
                  <div className="card text-center py-10">
                    <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>No hay datos todavia</p>
                  </div>
                ) : (
                  <div className="card space-y-4">
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>
                      Vinculados por sector
                    </h3>
                    <div className="space-y-2.5">
                      {legalesPorSector.filter((e) => e.sector !== 'Sin sector').map((e) => {
                        const max = Math.max(...legalesPorSector.filter((s) => s.sector !== 'Sin sector').map((s) => s.vinculados), 1)
                        const ancho = Math.max((e.vinculados / max) * 100, 6)
                        return (
                          <div key={e.sector} className="flex items-center gap-3">
                            <p
                              className="text-xs font-medium w-28 sm:w-40 flex-shrink-0 text-right leading-tight"
                              style={{ color: 'var(--texto-secundario)' }}
                              title={e.sector}
                            >
                              {e.sector}
                            </p>
                            <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: '#f0f6f9' }}>
                              <div
                                className="h-full rounded-md flex items-center justify-end px-2 transition-all"
                                style={{ width: `${ancho}%`, background: '#166534', minWidth: '1.75rem' }}
                              >
                                <span className="text-xs font-semibold text-white">{e.vinculados}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {vista === 'templario' && mostrarTemplarioTab && (
          <>
            <div className="card">
              <h2 className="font-semibold text-base mb-1" style={{ color: 'var(--texto-principal)' }}>Templarios</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--texto-secundario)' }}>Estadísticas por quien afilió</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 text-center" style={{ background: '#e0f7fa' }}>
                  <p className="text-2xl font-bold" style={{ color: '#004466' }}>{totalGeneralTemplario}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#004466' }}>Total afiliados</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: '#fef3c7' }}>
                  <p className="text-2xl font-bold" style={{ color: '#b45309' }}>{statsTemplarios.length}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>Templarios activos</p>
                </div>
              </div>
            </div>

            {loadingTemplarios ? (
              <div className="card text-center py-10">
                <svg className="animate-spin h-6 w-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24" style={{ color: '#004466' }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>Cargando estadísticas...</p>
              </div>
            ) : statsTemplarios.length === 0 ? (
              <div className="card text-center py-10">
                <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>Sin datos</p>
                <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>No hay afiliados registrados.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {statsTemplarios.map((enc) => {
                  const abierto = expandidoTemplario === enc.afiliado_por
                  const pct = totalGeneralTemplario > 0 ? Math.round((enc.total / totalGeneralTemplario) * 100) : 0
                  return (
                    <div key={enc.afiliado_por} className="card hover:shadow-md transition-shadow">
                      <button className="w-full text-left" onClick={() => setExpandidoTemplario(abierto ? null : enc.afiliado_por)}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm" style={{ background: '#004466' }}>
                              {enc.afiliado_por.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--texto-principal)' }}>{enc.afiliado_por}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className="font-bold text-lg leading-none" style={{ color: '#004466' }}>{enc.total}</p>
                              <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>{pct}%</p>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--texto-secundario)' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: '#e0f7fa' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#004466' }} />
                        </div>

                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--texto-secundario)' }}>
                            <span>Votan en Pinula: {enc.vota_pinula} ({porcentaje(enc.vota_pinula, enc.total)}%)</span>
                            <span>No votan: {enc.no_vota}</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: '#fee2e2' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${porcentaje(enc.vota_pinula, enc.total)}%`, background: '#166534' }}
                            />
                          </div>
                        </div>
                      </button>

                      {abierto && (
                        <div className="mt-4 pt-4 border-t space-y-4" style={{ borderColor: 'var(--color-borde)' }}>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--texto-secundario)' }}>Desglose por rol</p>
                            <div className="grid grid-cols-2 gap-2">
                              {ROLES_TEMPLARIO.map(({ key, label, color, bg }) => (
                                <div key={key} className="rounded-lg px-3 py-2 flex items-center justify-between" style={{ background: bg }}>
                                  <span className="text-xs font-medium" style={{ color }}>{label}</span>
                                  <span className="text-sm font-bold" style={{ color }}>{enc.roles[key as keyof RolCount]}</span>
                                </div>
                              ))}
                              {enc.roles.otro > 0 && (
                                <div className="rounded-lg px-3 py-2 flex items-center justify-between col-span-2" style={{ background: '#f3f4f6' }}>
                                  <span className="text-xs font-medium" style={{ color: '#6b7280' }}>Otros roles</span>
                                  <span className="text-sm font-bold" style={{ color: '#6b7280' }}>{enc.roles.otro}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--texto-secundario)' }}>Afiliados por sector</p>
                            <div className="space-y-1.5">
                              {enc.sectores.sort((a, b) => b.total - a.total).map((s) => (
                                <div key={s.nombre} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#f8fafc' }}>
                                  <span className="text-xs font-medium" style={{ color: 'var(--texto-principal)' }}>{s.nombre}</span>
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#e0f7fa', color: '#004466' }}>
                                    {s.total} afiliado{s.total !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* Afiliados legales (TSE) por templario */}
            {/* ────────────────────────────────────────────────────────── */}
            <div className="space-y-5 pt-2">
              <h2 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>
                Afiliados legales (TSE) por templario
              </h2>

              <div className="grid grid-cols-3 gap-3">
                <div className="card text-center">
                  <p className="text-3xl font-bold" style={{ color: '#004466' }}>{totalesLegalesTemplario.total}</p>
                  <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Total afiliados legales</p>
                </div>
                <div className="card text-center">
                  <p className="text-3xl font-bold text-green-600">{totalesLegalesTemplario.vinculados}</p>
                  <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Vinculados</p>
                </div>
                <div className="card text-center">
                  <p className="text-3xl font-bold" style={{ color: '#92400e' }}>{totalesLegalesTemplario.pendientes}</p>
                  <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Pendientes de vincular</p>
                </div>
              </div>

              {loadingLegalesTemplario ? (
                <div className="card text-center py-10">
                  <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#004466' }}></div>
                </div>
              ) : statsLegalesTemplario.length === 0 ? (
                <div className="card text-center py-10">
                  <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>No hay datos todavia</p>
                </div>
              ) : (
                <div className="card space-y-4">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>
                    Vinculados por templario
                  </h3>
                  <div className="space-y-2.5">
                    {statsLegalesTemplario.filter((e) => e.afiliado_por !== 'Sin registrar').map((e) => {
                      const max = Math.max(...statsLegalesTemplario.filter((s) => s.afiliado_por !== 'Sin registrar').map((s) => s.vinculados), 1)
                      const ancho = Math.max((e.vinculados / max) * 100, 6)
                      return (
                        <div key={e.afiliado_por} className="flex items-center gap-3">
                          <p
                            className="text-xs font-medium w-28 sm:w-40 flex-shrink-0 text-right leading-tight"
                            style={{ color: 'var(--texto-secundario)' }}
                            title={e.afiliado_por}
                          >
                            {e.afiliado_por}
                          </p>
                          <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: '#f0f6f9' }}>
                            <div
                              className="h-full rounded-md flex items-center justify-end px-2 transition-all"
                              style={{ width: `${ancho}%`, background: '#166534', minWidth: '1.75rem' }}
                            >
                              <span className="text-xs font-semibold text-white">{e.vinculados}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
