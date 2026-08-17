'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Perfil } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

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

// ──────────────────────────────────────────────────────────────
// Normalización de nombres de templarios
// ──────────────────────────────────────────────────────────────
// Resuelve automáticamente variantes por tildes, mayúsculas o
// espacios extra (ej. "Daniel Gonzalez" vs "Daniel González").
// NO fusiona nombres realmente distintos (ej. "Carlos Monterroso"
// vs "Carlos Morente" se mantienen separados).
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

export default function TemplariosPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [stats, setStats] = useState<AfiliadoPorStats[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)

  // Afiliados legales (TSE) por templario
  const [statsLegales, setStatsLegales] = useState<EstadisticaLegalTemplario[]>([])
  const [totalesLegales, setTotalesLegales] = useState({ total: 0, vinculados: 0, pendientes: 0 })
  const [loadingLegales, setLoadingLegales] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) {
        if (p.rol !== 'admin' && p.rol !== 'pentagono') { router.replace('/afiliados'); return }
        setPerfil(p)
        await cargarStats()
        await cargarStatsLegales()
      }
    }
    init()
  }, [router])

  const cargarStats = async () => {
    setLoading(true)
    try {
      // Traer TODAS las filas paginando de 1000 en 1000
      // (Supabase/PostgREST limita cada respuesta a 1000 filas por defecto,
      // incluso cuando se usa una funcion RPC que devuelve muchas filas)
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

      // mapa por CLAVE NORMALIZADA -> stats
      const mapa: Record<string, AfiliadoPorStats> = {}
      // conteo de variantes originales por clave, para elegir cuál mostrar
      const variantesPorClave: Record<string, Record<string, number>> = {}

      for (const row of data || []) {
        const nombreOriginal = (row.afiliado_por as string) || 'Sin registrar'
        const key = claveFinal(nombreOriginal)
        const sectorNombre = row.sector_nombre || 'Sin sector'
        const rol = (row.rol_afiliado || '').toLowerCase()

        if (!mapa[key]) {
          mapa[key] = {
            afiliado_por: nombreOriginal, // se ajusta al final con la variante más frecuente
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

      // Para cada grupo, usar como nombre visible la variante con más ocurrencias
      for (const key of Object.keys(mapa)) {
        const variantes = variantesPorClave[key]
        const nombreMasFrecuente = Object.entries(variantes).sort((a, b) => b[1] - a[1])[0][0]
        mapa[key].afiliado_por = nombreMasFrecuente
      }

      const resultado = Object.values(mapa).sort((a, b) => b.total - a.total)
      setStats(resultado)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const cargarStatsLegales = async () => {
    setLoadingLegales(true)
    try {
      // Traer TODAS las filas de afiliados_legales paginando de 1000 en 1000
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

      // mismo criterio de normalización/alias que usamos arriba para afiliados
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
      setStatsLegales(resultado)

      const total = allRows.length
      const vinculados = allRows.filter((r) => r.vinculado).length
      setTotalesLegales({ total, vinculados, pendientes: total - vinculados })
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingLegales(false)
    }
  }

  const totalGeneral = stats.reduce((s, e) => s + e.total, 0)

  const porcentaje = (parte: number, total: number) =>
    total === 0 ? 0 : Math.round((parte / total) * 100)

  const ROLES = [
    { key: 'lider',        label: 'Líderes',        color: '#004466', bg: '#e0f7fa' },
    { key: 'guerrero',     label: 'Guerreros',       color: '#b45309', bg: '#fef3c7' },
    { key: 'organizador',  label: 'Organizadores',   color: '#065f46', bg: '#d1fae5' },
    { key: 'simpatizante', label: 'Simpatizantes',   color: '#6b7280', bg: '#f3f4f6' },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol || ''} />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div className="card">
          <h2 className="font-semibold text-base mb-1" style={{ color: 'var(--texto-principal)' }}>Templarios</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--texto-secundario)' }}>Estadísticas por quien afilió</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 text-center" style={{ background: '#e0f7fa' }}>
              <p className="text-2xl font-bold" style={{ color: '#004466' }}>{totalGeneral}</p>
              <p className="text-xs mt-0.5" style={{ color: '#004466' }}>Total afiliados</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#fef3c7' }}>
              <p className="text-2xl font-bold" style={{ color: '#b45309' }}>{stats.length}</p>
              <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>Templarios activos</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card text-center py-10">
            <svg className="animate-spin h-6 w-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24" style={{ color: '#004466' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>Cargando estadísticas...</p>
          </div>
        ) : stats.length === 0 ? (
          <div className="card text-center py-10">
            <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>Sin datos</p>
            <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>No hay afiliados registrados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.map((enc) => {
              const abierto = expandido === enc.afiliado_por
              const pct = totalGeneral > 0 ? Math.round((enc.total / totalGeneral) * 100) : 0
              return (
                <div key={enc.afiliado_por} className="card hover:shadow-md transition-shadow">
                  <button className="w-full text-left" onClick={() => setExpandido(abierto ? null : enc.afiliado_por)}>
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

                    {/* Barra votan vs no votan en Pinula */}
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
                          {ROLES.map(({ key, label, color, bg }) => (
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
              <p className="text-3xl font-bold" style={{ color: '#004466' }}>{totalesLegales.total}</p>
              <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Total afiliados legales</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-600">{totalesLegales.vinculados}</p>
              <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Vinculados</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold" style={{ color: '#92400e' }}>{totalesLegales.pendientes}</p>
              <p className="text-xs mt-1 font-medium" style={{ color: 'var(--texto-secundario)' }}>Pendientes de vincular</p>
            </div>
          </div>

          {loadingLegales ? (
            <div className="card text-center py-10">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#004466' }}></div>
            </div>
          ) : statsLegales.length === 0 ? (
            <div className="card text-center py-10">
              <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>No hay datos todavia</p>
            </div>
          ) : (
            <div className="card space-y-4">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>
                Vinculados por templario
              </h3>
              <div className="space-y-2.5">
                {statsLegales.filter((e) => e.afiliado_por !== 'Sin registrar').map((e) => {
                  const max = Math.max(...statsLegales.filter((s) => s.afiliado_por !== 'Sin registrar').map((s) => s.vinculados), 1)
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
      </main>
    </div>
  )
}
