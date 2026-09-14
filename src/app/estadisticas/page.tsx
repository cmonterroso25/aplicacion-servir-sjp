'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Perfil } from '@/lib/supabase'
import { exportToExcel } from '@/lib/exportXlsx'
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
  coordinador: number
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
  coordinador: number
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

// ── Estructura (Templario → Coordinador → Afiliados) ──────────
type TemplarioOption = {
  id: number
  nombre: string
}

type RawAfiliadoEstructura = {
  id: number
  primer_nombre: string | null
  segundo_nombre: string | null
  primer_apellido: string | null
  segundo_apellido: string | null
  rol_afiliado: string | null
  afiliado_por: string | null
  coordinador_id: number | null
  telefono: string | null
  nombre_ubicacion: string | null
  vota_en_pinula: boolean | null
  es_fiscal: boolean | null
  sectores: { nombre: string } | null
}

type EstructuraAfiliado = {
  id: number
  nombre: string
  telefono: string | null
  sector: string
  rol: string
  ubicacion: string
  vota_en_pinula: boolean | null
  es_fiscal: boolean | null
}

type EstructuraCoordinador = {
  id: number
  nombre: string
  afiliados: EstructuraAfiliado[]
}

type ResumenTemplario = {
  nombre: string
  coordinadores: number
  afiliados: number
}

// ── Fiscales (Templario → afiliados con es_fiscal = true) ─────
type FiscalAfiliado = {
  id: number
  nombre: string
  telefono: string | null
  sector: string
  rol: string
  ubicacion: string
  vota_en_pinula: boolean | null
}

type EstadisticaFiscalTemplario = {
  afiliado_por: string
  total: number
  afiliados: FiscalAfiliado[]
}

const META_COORDINADORES_POR_TEMPLARIO = 20
const META_AFILIADOS_POR_COORDINADOR = 35
const META_AFILIADOS_TOTAL_TEMPLARIO = META_COORDINADORES_POR_TEMPLARIO * META_AFILIADOS_POR_COORDINADOR

const ROLES_SIN_ACCESO = ['lider', 'colaborador', 'templario']
const ROLES_LEGALES = ['admin', 'pentagono']

// ──────────────────────────────────────────────────────────────
// Normalización de nombres (compartida entre Por sector, Por templario, Estructura y Fiscales)
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

function nombreCompletoAfiliado(a: RawAfiliadoEstructura): string {
  return [a.primer_nombre, a.segundo_nombre, a.primer_apellido, a.segundo_apellido]
    .filter(Boolean)
    .join(' ')
}

// ──────────────────────────────────────────────────────────────
// Anillo de progreso (SVG) — usado en el resumen visual de Estructura
// ──────────────────────────────────────────────────────────────
function AnilloProgreso({
  valor,
  meta,
  color,
  bgColor,
  label,
  tamano = 120,
}: {
  valor: number
  meta: number
  color: string
  bgColor: string
  label: string
  tamano?: number
}) {
  const radio = tamano / 2 - 10
  const circunferencia = 2 * Math.PI * radio
  const pct = meta > 0 ? Math.min(valor / meta, 1) : 0
  const offset = circunferencia * (1 - pct)
  const centro = tamano / 2

  return (
    <div className="flex flex-col items-center">
      <svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`}>
        <circle cx={centro} cy={centro} r={radio} fill="none" stroke={bgColor} strokeWidth="10" />
        <circle
          cx={centro}
          cy={centro}
          r={radio}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${centro} ${centro})`}
        />
        <text x={centro} y={centro - 3} textAnchor="middle" fontSize="20" fontWeight="bold" fill={color}>
          {valor}
        </text>
        <text x={centro} y={centro + 15} textAnchor="middle" fontSize="10" fill="#9ca3af">
          / {meta}
        </text>
      </svg>
      <p className="text-xs font-medium mt-2 text-center" style={{ color: 'var(--texto-secundario)' }}>{label}</p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Tarjeta de detalle de un afiliado (reutilizada en Estructura y Fiscales)
// ──────────────────────────────────────────────────────────────
function AfiliadoDetalleCard({
  nombre,
  telefono,
  sector,
  vota_en_pinula,
  es_fiscal,
  rol,
  ubicacion,
}: {
  nombre: string
  telefono: string | null
  sector: string
  vota_en_pinula: boolean | null
  es_fiscal?: boolean | null
  rol?: string
  ubicacion?: string
}) {
  return (
    <div className="px-3 py-2 rounded-lg space-y-1" style={{ background: '#f8fafc' }}>
      <span className="text-xs font-semibold block" style={{ color: 'var(--texto-principal)' }}>{nombre}</span>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]" style={{ color: 'var(--texto-secundario)' }}>
        <span>{telefono || 'Sin telefono'}</span>
        <span>{sector}</span>
        {ubicacion && <span>{ubicacion}</span>}
        {rol && <span>{rol}</span>}
        {typeof es_fiscal === 'boolean' && <span>{es_fiscal ? 'Fiscal: Sí' : 'Fiscal: No'}</span>}
        <span style={{ color: vota_en_pinula ? '#166534' : '#9b1c3a', fontWeight: 500 }}>
          {vota_en_pinula ? 'Vota en Pinula' : 'No vota en Pinula'}
        </span>
      </div>
    </div>
  )
}

export default function EstadisticasPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [vista, setVista] = useState<'sector' | 'templario' | 'estructura' | 'fiscales'>('sector')

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

  // ── Estructura (piramide) ───────────────────────────────────
  const [estructuraDataCargada, setEstructuraDataCargada] = useState(false)
  const [loadingEstructura, setLoadingEstructura] = useState(false)
  const [templarios, setTemplarios] = useState<TemplarioOption[]>([])
  const [templarioSeleccionado, setTemplarioSeleccionado] = useState<string>('')
  const [afiliadosEstructura, setAfiliadosEstructura] = useState<RawAfiliadoEstructura[]>([])
  const [expandidoCoordinador, setExpandidoCoordinador] = useState<number | null>(null)

  // ── Fiscales ────────────────────────────────────────────────
  const [statsFiscales, setStatsFiscales] = useState<EstadisticaFiscalTemplario[]>([])
  const [loadingFiscales, setLoadingFiscales] = useState(false)
  const [expandidoFiscal, setExpandidoFiscal] = useState<string | null>(null)
  const [fiscalesDataCargada, setFiscalesDataCargada] = useState(false)

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

  const seleccionarVistaEstructura = () => {
    setVista('estructura')
    if (!estructuraDataCargada) {
      setEstructuraDataCargada(true)
      setLoadingEstructura(true)
      cargarEstructura()
    }
  }

  const seleccionarVistaFiscales = () => {
    setVista('fiscales')
    if (!fiscalesDataCargada) {
      setFiscalesDataCargada(true)
      setLoadingFiscales(true)
      cargarStatsFiscales()
    }
  }

  const cargarEstructura = async () => {
    try {
      const { data: templariosData, error: templariosError } = await supabase
        .from('afiliado_por')
        .select('id, nombre')
        .order('nombre')

      if (templariosError) throw templariosError
      setTemplarios(templariosData || [])

      let allRows: RawAfiliadoEstructura[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: page, error } = await supabase
          .from('afiliados')
          .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, rol_afiliado, afiliado_por, coordinador_id, telefono, nombre_ubicacion, vota_en_pinula, es_fiscal, sectores(nombre)')
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!page || page.length === 0) { hasMore = false; break }

        allRows = allRows.concat(page as unknown as RawAfiliadoEstructura[])
        if (page.length < pageSize) hasMore = false
        from += pageSize
      }

      setAfiliadosEstructura(allRows)
    } catch (e) {
      console.error('Error cargando estructura:', e)
    } finally {
      setLoadingEstructura(false)
    }
  }

  const cargarStatsFiscales = async () => {
    try {
      const { data: templariosData, error: templariosError } = await supabase
        .from('afiliado_por')
        .select('id, nombre')
        .order('nombre')

      if (templariosError) throw templariosError

      let allRows: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: page, error } = await supabase
          .from('afiliados')
          .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, afiliado_por, telefono, rol_afiliado, nombre_ubicacion, vota_en_pinula, sectores(nombre)')
          .eq('es_fiscal', true)
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!page || page.length === 0) { hasMore = false; break }

        allRows = allRows.concat(page)
        if (page.length < pageSize) hasMore = false
        from += pageSize
      }

      // Arrancamos con TODOS los templarios del catalogo (aunque tengan 0
      // fiscales), igual que en el resumen de Estructura.
      const porTemplario: Record<string, { nombre: string; afiliados: FiscalAfiliado[] }> = {}
      ;(templariosData || []).forEach((t: any) => {
        porTemplario[claveFinal(t.nombre)] = { nombre: t.nombre, afiliados: [] }
      })

      const variantesPorClave: Record<string, Record<string, number>> = {}

      allRows.forEach((a: any) => {
        const nombreOriginal = a.afiliado_por || 'Sin registrar'
        const key = claveFinal(nombreOriginal)
        if (!porTemplario[key]) {
          porTemplario[key] = { nombre: nombreOriginal, afiliados: [] }
        }
        if (!variantesPorClave[key]) variantesPorClave[key] = {}
        variantesPorClave[key][nombreOriginal] = (variantesPorClave[key][nombreOriginal] || 0) + 1

        const nombreAfiliado = [a.primer_nombre, a.segundo_nombre, a.primer_apellido, a.segundo_apellido]
          .filter(Boolean)
          .join(' ')
        porTemplario[key].afiliados.push({
          id: a.id,
          nombre: nombreAfiliado,
          telefono: a.telefono ?? null,
          sector: a.sectores?.nombre || 'Sin sector',
          rol: a.rol_afiliado || 'Simpatizante',
          ubicacion: a.nombre_ubicacion || 'Sin ubicación',
          vota_en_pinula: a.vota_en_pinula ?? null,
        })
      })

      for (const key of Object.keys(variantesPorClave)) {
        const variantes = variantesPorClave[key]
        const nombreMasFrecuente = Object.entries(variantes).sort((a, b) => b[1] - a[1])[0][0]
        porTemplario[key].nombre = nombreMasFrecuente
      }

      const resultado = Object.values(porTemplario)
        .map((t) => ({
          afiliado_por: t.nombre,
          total: t.afiliados.length,
          afiliados: t.afiliados.sort((a, b) => a.nombre.localeCompare(b.nombre)),
        }))
        .sort((a, b) => b.total - a.total)

      setStatsFiscales(resultado)
    } catch (e) {
      console.error('Error cargando fiscales:', e)
    } finally {
      setLoadingFiscales(false)
    }
  }

  const coordinadoresDelTemplario = useMemo<EstructuraCoordinador[]>(() => {
    if (!templarioSeleccionado) return []
    const key = claveFinal(templarioSeleccionado)

    const mapa: Record<number, EstructuraCoordinador> = {}
    afiliadosEstructura.forEach((a) => {
      const rolNorm = normalizarClave(a.rol_afiliado || '')
      const apNorm = claveFinal(a.afiliado_por || '')
      if (rolNorm === 'coordinador' && apNorm === key) {
        mapa[a.id] = { id: a.id, nombre: nombreCompletoAfiliado(a), afiliados: [] }
      }
    })

    afiliadosEstructura.forEach((a) => {
      if (a.coordinador_id != null && mapa[a.coordinador_id]) {
        mapa[a.coordinador_id].afiliados.push({
          id: a.id,
          nombre: nombreCompletoAfiliado(a),
          telefono: a.telefono,
          sector: a.sectores?.nombre || 'Sin sector',
          rol: a.rol_afiliado || 'Simpatizante',
          ubicacion: a.nombre_ubicacion || 'Sin ubicación',
          vota_en_pinula: a.vota_en_pinula,
          es_fiscal: a.es_fiscal,
        })
      }
    })

    return Object.values(mapa).sort((a, b) => b.afiliados.length - a.afiliados.length)
  }, [templarioSeleccionado, afiliadosEstructura])

  const totalAfiliadosEstructura = coordinadoresDelTemplario.reduce((s, c) => s + c.afiliados.length, 0)

  // ── Resumen comparativo de TODOS los templarios ────────────
  const resumenTemplarios = useMemo<ResumenTemplario[]>(() => {
    if (templarios.length === 0) return []

    const porTemplario: Record<string, { nombre: string; coordinadorIds: number[] }> = {}
    templarios.forEach((t) => {
      porTemplario[claveFinal(t.nombre)] = { nombre: t.nombre, coordinadorIds: [] }
    })

    afiliadosEstructura.forEach((a) => {
      const rolNorm = normalizarClave(a.rol_afiliado || '')
      const apKey = claveFinal(a.afiliado_por || '')
      if (rolNorm === 'coordinador' && porTemplario[apKey]) {
        porTemplario[apKey].coordinadorIds.push(a.id)
      }
    })

    const coordinadorATemplario: Record<number, string> = {}
    Object.entries(porTemplario).forEach(([key, t]) => {
      t.coordinadorIds.forEach((id) => { coordinadorATemplario[id] = key })
    })

    const afiliadosPorTemplario: Record<string, number> = {}
    afiliadosEstructura.forEach((a) => {
      if (a.coordinador_id != null) {
        const key = coordinadorATemplario[a.coordinador_id]
        if (key) afiliadosPorTemplario[key] = (afiliadosPorTemplario[key] || 0) + 1
      }
    })

    return Object.entries(porTemplario)
      .map(([key, t]) => ({
        nombre: t.nombre,
        coordinadores: t.coordinadorIds.length,
        afiliados: afiliadosPorTemplario[key] || 0,
      }))
      .sort((a, b) => b.afiliados - a.afiliados)
  }, [templarios, afiliadosEstructura])

  // ── Export Excel: TODOS los coordinadores (de todos los templarios) con
  // sus afiliados asignados. No se limita al templario seleccionado en el
  // filtro de la pantalla.
  const handleExportEstructura = () => {
    const mapaCoordinadores: Record<number, { nombre: string; templario: string; afiliados: RawAfiliadoEstructura[] }> = {}

    afiliadosEstructura.forEach((a) => {
      if (normalizarClave(a.rol_afiliado || '') === 'coordinador') {
        mapaCoordinadores[a.id] = {
          nombre: nombreCompletoAfiliado(a),
          templario: a.afiliado_por || 'Sin registrar',
          afiliados: [],
        }
      }
    })

    afiliadosEstructura.forEach((a) => {
      if (a.coordinador_id != null && mapaCoordinadores[a.coordinador_id]) {
        mapaCoordinadores[a.coordinador_id].afiliados.push(a)
      }
    })

    const filas: Record<string, any>[] = []
    Object.values(mapaCoordinadores)
      .sort((a, b) => a.templario.localeCompare(b.templario) || a.nombre.localeCompare(b.nombre))
      .forEach((c) => {
        if (c.afiliados.length === 0) {
          filas.push({
            Templario: c.templario,
            Coordinador: c.nombre,
            Afiliado: '—',
            'Teléfono': '—',
            Sector: '—',
            Rol: '—',
            'Ubicación': '—',
            'Vota en Pinula': '—',
            Fiscal: '—',
          })
        } else {
          c.afiliados
            .slice()
            .sort((a, b) => nombreCompletoAfiliado(a).localeCompare(nombreCompletoAfiliado(b)))
            .forEach((a) => {
              filas.push({
                Templario: c.templario,
                Coordinador: c.nombre,
                Afiliado: nombreCompletoAfiliado(a),
                'Teléfono': a.telefono || 'Sin registrar',
                Sector: a.sectores?.nombre || 'Sin sector',
                Rol: a.rol_afiliado || 'Simpatizante',
                'Ubicación': a.nombre_ubicacion || 'Sin ubicación',
                'Vota en Pinula': a.vota_en_pinula ? 'Sí' : 'No',
                Fiscal: a.es_fiscal ? 'Sí' : 'No',
              })
            })
        }
      })

    if (filas.length === 0) {
      window.alert('No hay datos de estructura para exportar.')
      return
    }

    exportToExcel(filas, 'estructura_coordinadores', 'Coordinadores y Afiliados')
  }

  // ── Export Excel: TODOS los templarios con sus afiliados marcados como
  // Fiscal = Sí. Usa el mismo agrupador (statsFiscales) que ya alimenta las
  // tarjetas de la pantalla de Fiscales.
  const handleExportFiscales = () => {
    const filas: Record<string, any>[] = []
    statsFiscales
      .slice()
      .sort((a, b) => a.afiliado_por.localeCompare(b.afiliado_por))
      .forEach((t) => {
        if (t.afiliados.length === 0) {
          filas.push({
            Templario: t.afiliado_por,
            Afiliado: '—',
            'Teléfono': '—',
            Sector: '—',
            Rol: '—',
            'Ubicación': '—',
            'Vota en Pinula': '—',
          })
        } else {
          t.afiliados.forEach((a) => {
            filas.push({
              Templario: t.afiliado_por,
              Afiliado: a.nombre,
              'Teléfono': a.telefono || 'Sin registrar',
              Sector: a.sector,
              Rol: a.rol,
              'Ubicación': a.ubicacion,
              'Vota en Pinula': a.vota_en_pinula ? 'Sí' : 'No',
            })
          })
        }
      })

    if (filas.length === 0) {
      window.alert('No hay datos de fiscales para exportar.')
      return
    }

    exportToExcel(filas, 'fiscales_templarios', 'Fiscales por Templario')
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
            coordinador: 0,
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
        else if (rol_a === 'coordinador') mapa[key].coordinador++
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
            roles: { coordinador: 0, guerrero: 0, organizador: 0, simpatizante: 0, otro: 0 }
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

        if (rol.includes('coordinador')) mapa[key].roles.coordinador++
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
    coordinador: '#166534',
    templario: '#4527a0',
  }

  const totalGeneralTemplario = statsTemplarios.reduce((s, e) => s + e.total, 0)
  const totalFiscales = statsFiscales.reduce((s, e) => s + e.total, 0)
  const templariosConFiscales = statsFiscales.filter((e) => e.total > 0).length

  const ROLES_TEMPLARIO = [
    { key: 'coordinador',  label: 'Coordinadores',  color: '#004466', bg: '#e0f7fa' },
    { key: 'guerrero',     label: 'Guerreros',       color: '#b45309', bg: '#fef3c7' },
    { key: 'organizador',  label: 'Organizadores',   color: '#065f46', bg: '#d1fae5' },
    { key: 'simpatizante', label: 'Simpatizantes',   color: '#6b7280', bg: '#f3f4f6' },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol} />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {mostrarTemplarioTab && (
          <div className="flex gap-2 flex-wrap">
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
            <button
              onClick={seleccionarVistaEstructura}
              className="text-sm px-4 py-2 rounded-lg border font-medium transition-all"
              style={vista === 'estructura'
                ? { background: '#004466', color: 'white', borderColor: '#004466' }
                : { background: 'white', color: 'var(--texto-secundario)', borderColor: 'var(--color-borde)' }}>
              Estructura
            </button>
            <button
              onClick={seleccionarVistaFiscales}
              className="text-sm px-4 py-2 rounded-lg border font-medium transition-all"
              style={vista === 'fiscales'
                ? { background: '#004466', color: 'white', borderColor: '#004466' }
                : { background: 'white', color: 'var(--texto-secundario)', borderColor: 'var(--color-borde)' }}>
              Fiscales
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
                            { key: 'coordinador', label: 'Coordinador', val: e.coordinador },
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

        {vista === 'estructura' && mostrarTemplarioTab && (
          <>
            <div className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-base mb-1" style={{ color: 'var(--texto-principal)' }}>Estructura</h2>
                  <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
                    Meta: {META_COORDINADORES_POR_TEMPLARIO} coordinadores por templario, {META_AFILIADOS_POR_COORDINADOR} afiliados por coordinador
                  </p>
                </div>
                <button
                  onClick={handleExportEstructura}
                  disabled={loadingEstructura || afiliadosEstructura.length === 0}
                  className="text-xs px-3 py-2 rounded-lg font-semibold text-white disabled:opacity-50 flex-shrink-0"
                  style={{ background: '#166534' }}>
                  Exportar Excel
                </button>
              </div>

              <select
                value={templarioSeleccionado}
                onChange={(e) => { setTemplarioSeleccionado(e.target.value); setExpandidoCoordinador(null) }}
                className="w-full text-sm px-3 py-2 rounded-lg border"
                style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-principal)' }}
                disabled={loadingEstructura}
              >
                <option value="">
                  {loadingEstructura ? 'Cargando templarios...' : 'Selecciona un templario'}
                </option>
                {templarios.map((t) => (
                  <option key={t.id} value={t.nombre}>{t.nombre}</option>
                ))}
              </select>
            </div>

            {loadingEstructura ? (
              <div className="card text-center py-10">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#004466' }}></div>
              </div>
            ) : !templarioSeleccionado ? (
              <div className="card text-center py-10">
                <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>Selecciona un templario</p>
                <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>Para ver su estructura de coordinadores y afiliados.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="card text-center">
                    <p className="text-3xl font-bold" style={{ color: coordinadoresDelTemplario.length >= META_COORDINADORES_POR_TEMPLARIO ? '#166534' : '#004466' }}>
                      {coordinadoresDelTemplario.length}
                      <span className="text-base font-medium" style={{ color: 'var(--texto-secundario)' }}> / {META_COORDINADORES_POR_TEMPLARIO}</span>
                    </p>
                    <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Coordinadores</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-3xl font-bold" style={{ color: '#004466' }}>{totalAfiliadosEstructura}</p>
                    <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Afiliados asignados a coordinador</p>
                  </div>
                </div>

                {coordinadoresDelTemplario.length === 0 ? (
                  <div className="card text-center py-10">
                    <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>Sin coordinadores</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>
                      Este templario todavia no tiene afiliados con rol Coordinador.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {coordinadoresDelTemplario.map((c) => {
                      const abierto = expandidoCoordinador === c.id
                      const cumpleMeta = c.afiliados.length >= META_AFILIADOS_POR_COORDINADOR
                      return (
                        <div key={c.id} className="card hover:shadow-md transition-shadow">
                          <button className="w-full text-left" onClick={() => setExpandidoCoordinador(abierto ? null : c.id)}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm" style={{ background: '#166534' }}>
                                  {c.nombre.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--texto-principal)' }}>{c.nombre}</p>
                                  <p className="text-xs mt-0.5" style={{ color: cumpleMeta ? '#166534' : '#b45309' }}>
                                    {cumpleMeta ? 'Cumple la meta' : `Faltan ${META_AFILIADOS_POR_COORDINADOR - c.afiliados.length} para la meta`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="text-right">
                                  <p className="font-bold text-lg leading-none" style={{ color: '#166534' }}>{c.afiliados.length}</p>
                                  <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>/ {META_AFILIADOS_POR_COORDINADOR}</p>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--texto-secundario)' }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>

                            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: '#dcfce7' }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.min((c.afiliados.length / META_AFILIADOS_POR_COORDINADOR) * 100, 100)}%`, background: '#166534' }}
                              />
                            </div>
                          </button>

                          {abierto && (
                            <div className="mt-4 pt-4 border-t space-y-1.5" style={{ borderColor: 'var(--color-borde)' }}>
                              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--texto-secundario)' }}>
                                Afiliados asignados
                              </p>
                              {c.afiliados.length === 0 ? (
                                <p className="text-sm italic" style={{ color: 'var(--texto-secundario)' }}>Sin afiliados asignados todavia.</p>
                              ) : (
                                c.afiliados.map((a) => (
                                  <AfiliadoDetalleCard
                                    key={a.id}
                                    nombre={a.nombre}
                                    telefono={a.telefono}
                                    sector={a.sector}
                                    vota_en_pinula={a.vota_en_pinula}
                                    es_fiscal={a.es_fiscal}
                                    rol={a.rol}
                                    ubicacion={a.ubicacion}
                                  />
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* Tablero resumen: comparativo de TODOS los templarios */}
            {/* ────────────────────────────────────────────────────────── */}
            {!loadingEstructura && (
              <div className="space-y-3 pt-2">
                <h2 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>
                  Resumen general por templario
                </h2>

                {resumenTemplarios.length === 0 ? (
                  <div className="card text-center py-10">
                    <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>No hay templarios registrados</p>
                  </div>
                ) : (
                  <div className="card overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'var(--color-borde)' }}>
                          <th className="text-left py-2 pr-3 font-semibold" style={{ color: 'var(--texto-secundario)' }}>Templario</th>
                          <th className="text-right py-2 px-3 font-semibold" style={{ color: 'var(--texto-secundario)' }}>Coordinadores</th>
                          <th className="text-right py-2 px-3 font-semibold" style={{ color: 'var(--texto-secundario)' }}>Afiliados</th>
                          <th className="text-right py-2 pl-3 font-semibold" style={{ color: 'var(--texto-secundario)' }}>Prom. / coordinador</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumenTemplarios.map((t) => {
                          const promedio = t.coordinadores > 0 ? Math.round((t.afiliados / t.coordinadores) * 10) / 10 : 0
                          const cumpleCoordinadores = t.coordinadores >= META_COORDINADORES_POR_TEMPLARIO
                          return (
                            <tr
                              key={t.nombre}
                              className="border-b last:border-0 cursor-pointer hover:bg-gray-50"
                              style={{ borderColor: 'var(--color-borde)' }}
                              onClick={() => { setTemplarioSeleccionado(t.nombre); setExpandidoCoordinador(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                            >
                              <td className="py-2.5 pr-3 font-medium" style={{ color: 'var(--texto-principal)' }}>{t.nombre}</td>
                              <td className="py-2.5 px-3 text-right font-semibold" style={{ color: cumpleCoordinadores ? '#166534' : '#b45309' }}>
                                {t.coordinadores} / {META_COORDINADORES_POR_TEMPLARIO}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold" style={{ color: '#004466' }}>{t.afiliados}</td>
                              <td className="py-2.5 pl-3 text-right" style={{ color: promedio >= META_AFILIADOS_POR_COORDINADOR ? '#166534' : 'var(--texto-secundario)' }}>
                                {promedio}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* Anillo doble: avance del templario seleccionado */}
            {/* ────────────────────────────────────────────────────────── */}
            {templarioSeleccionado && !loadingEstructura && (
              <div className="space-y-3 pt-2">
                <h2 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>
                  Avance visual — {templarioSeleccionado}
                </h2>
                <div className="card flex flex-wrap items-center justify-around gap-6 py-6">
                  <AnilloProgreso
                    valor={coordinadoresDelTemplario.length}
                    meta={META_COORDINADORES_POR_TEMPLARIO}
                    color="#004466"
                    bgColor="#e0f7fa"
                    label="Coordinadores"
                  />
                  <AnilloProgreso
                    valor={totalAfiliadosEstructura}
                    meta={META_AFILIADOS_TOTAL_TEMPLARIO}
                    color="#166534"
                    bgColor="#dcfce7"
                    label="Afiliados asignados (meta ideal)"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {vista === 'fiscales' && mostrarTemplarioTab && (
          <>
            <div className="card">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-semibold text-base mb-1" style={{ color: 'var(--texto-principal)' }}>Fiscales</h2>
                  <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
                    Afiliados marcados como Fiscal (Sí), agrupados por Templario
                  </p>
                </div>
                <button
                  onClick={handleExportFiscales}
                  disabled={loadingFiscales || statsFiscales.length === 0}
                  className="text-xs px-3 py-2 rounded-lg font-semibold text-white disabled:opacity-50 flex-shrink-0"
                  style={{ background: '#166534' }}>
                  Exportar Excel
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 text-center" style={{ background: '#e0f7fa' }}>
                  <p className="text-2xl font-bold" style={{ color: '#004466' }}>{totalFiscales}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#004466' }}>Total fiscales</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: '#fef3c7' }}>
                  <p className="text-2xl font-bold" style={{ color: '#b45309' }}>{templariosConFiscales}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>Templarios con fiscales</p>
                </div>
              </div>
            </div>

            {loadingFiscales ? (
              <div className="card text-center py-10">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#004466' }}></div>
              </div>
            ) : statsFiscales.length === 0 ? (
              <div className="card text-center py-10">
                <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>No hay templarios registrados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {statsFiscales.map((t) => {
                  const abierto = expandidoFiscal === t.afiliado_por
                  return (
                    <div key={t.afiliado_por} className="card hover:shadow-md transition-shadow">
                      <button className="w-full text-left" onClick={() => setExpandidoFiscal(abierto ? null : t.afiliado_por)}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm" style={{ background: '#004466' }}>
                              {t.afiliado_por.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--texto-principal)' }}>{t.afiliado_por}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className="font-bold text-lg leading-none" style={{ color: '#004466' }}>{t.total}</p>
                              <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>fiscal{t.total !== 1 ? 'es' : ''}</p>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--texto-secundario)' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </button>

                      {abierto && (
                        <div className="mt-4 pt-4 border-t space-y-1.5" style={{ borderColor: 'var(--color-borde)' }}>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--texto-secundario)' }}>
                            Afiliados fiscales
                          </p>
                          {t.afiliados.length === 0 ? (
                            <p className="text-sm italic" style={{ color: 'var(--texto-secundario)' }}>Sin fiscales registrados todavia.</p>
                          ) : (
                            t.afiliados.map((a) => (
                              <AfiliadoDetalleCard
                                key={a.id}
                                nombre={a.nombre}
                                telefono={a.telefono}
                                sector={a.sector}
                                vota_en_pinula={a.vota_en_pinula}
                                rol={a.rol}
                                ubicacion={a.ubicacion}
                              />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
