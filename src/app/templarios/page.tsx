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

type EncargadoStats = {
  encargado_id: string
  encargado_nombre: string
  total: number
  sectores: SectorCount[]
  roles: RolCount
  afiliados_por: Record<string, number>
}

export default function TemplariosPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [stats, setStats] = useState<EncargadoStats[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) setPerfil(p)
      await cargarStats()
    }
    init()
  }, [router])

  const cargarStats = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('afiliados')
        .select(`
          encargado_id,
          rol_afiliado,
          afiliado_por,
          sectores ( nombre ),
          perfiles ( nombre_completo, email )
        `)
        .not('encargado_id', 'is', null)

      if (error) throw error

      const mapa: Record<string, EncargadoStats> = {}

      for (const row of data || []) {
        const eid = row.encargado_id as string
        const nombre = (row.perfiles as any)?.nombre_completo || (row.perfiles as any)?.email || 'Sin nombre'
        const sectorNombre = (row.sectores as any)?.nombre || 'Sin sector'
        const rol = (row.rol_afiliado || '').toLowerCase()
        const afiliadoPor = (row.afiliado_por as string) || 'Sin registrar'

        if (!mapa[eid]) {
          mapa[eid] = {
            encargado_id: eid,
            encargado_nombre: nombre,
            total: 0,
            sectores: [],
            roles: { lider: 0, guerrero: 0, organizador: 0, simpatizante: 0, otro: 0 },
            afiliados_por: {}
          }
        }

        mapa[eid].total++

        const sectorExistente = mapa[eid].sectores.find(s => s.nombre === sectorNombre)
        if (sectorExistente) {
          sectorExistente.total++
        } else {
          mapa[eid].sectores.push({ nombre: sectorNombre, total: 1 })
        }

        mapa[eid].afiliados_por[afiliadoPor] = (mapa[eid].afiliados_por[afiliadoPor] || 0) + 1

        if (rol.includes('líder') || rol.includes('lider')) mapa[eid].roles.lider++
        else if (rol.includes('guerrero')) mapa[eid].roles.guerrero++
        else if (rol.includes('organizador')) mapa[eid].roles.organizador++
        else if (rol.includes('simpatizante')) mapa[eid].roles.simpatizante++
        else mapa[eid].roles.otro++
      }

      const resultado = Object.values(mapa).sort((a, b) => b.total - a.total)
      setStats(resultado)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const totalGeneral = stats.reduce((s, e) => s + e.total, 0)

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
          <p className="text-sm mb-4" style={{ color: 'var(--texto-secundario)' }}>Estadísticas por encargado de sector</p>
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
            <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>No hay afiliados con encargado asignado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.map((enc) => {
              const abierto = expandido === enc.encargado_id
              const pct = totalGeneral > 0 ? Math.round((enc.total / totalGeneral) * 100) : 0
              return (
                <div key={enc.encargado_id} className="card hover:shadow-md transition-shadow">
                  <button className="w-full text-left" onClick={() => setExpandido(abierto ? null : enc.encargado_id)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm" style={{ background: '#004466' }}>
                          {enc.encargado_nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--texto-principal)' }}>{enc.encargado_nombre}</p>
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
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--texto-secundario)' }}>Afiliado por</p>
                        <div className="space-y-1.5">
                          {Object.entries(enc.afiliados_por).sort((a, b) => b[1] - a[1]).map(([nombre, total]) => (
                            <div key={nombre} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#f8fafc' }}>
                              <span className="text-xs font-medium" style={{ color: 'var(--texto-principal)' }}>{nombre}</span>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#e0f7fa', color: '#004466' }}>
                                {total} afiliado{total !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ))}
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
      </main>
    </div>
  )
}
