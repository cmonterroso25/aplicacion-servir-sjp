'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Perfil } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

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
}

const ROLES_SIN_ACCESO = ['lider', 'colaborador', 'templario']

export default function EstadisticasPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [estadisticas, setEstadisticas] = useState<EstadisticaSector[]>([])
  const [totales, setTotales] = useState({ total: 0, vota: 0, no_vota: 0 })
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

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
      }
    }
    init()
  }, [router])

  const cargarEstadisticas = async (rol: string, userId: string) => {
    setLoading(true)
    setErrorCarga('')
    try {
      // Traer los encargados reales por sector desde sectores_encargados
      // (un sector puede tener mas de un encargado).
      // Si este query falla (ej. permisos), seguimos sin encargados en vez
      // de tumbar toda la pagina.
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

      // Traer TODAS las filas paginando de 1000 en 1000
      // (Supabase/PostgREST limita cada respuesta a 1000 filas por defecto)
      let allData: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        let q = supabase
          .from('afiliados')
          .select('sector_id, vota_en_pinula, rol_afiliado, sectores(nombre), encargado_id')
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

      // Agrupar por sector
      const mapa: Record<string, EstadisticaSector> = {}

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
          }
        }

        mapa[key].total++
        if (a.vota_en_pinula) mapa[key].vota_pinula++
        else mapa[key].no_vota++

        const rol_a = (a.rol_afiliado || 'Simpatizante').toLowerCase()
        if (rol_a === 'simpatizante') mapa[key].simpatizante++
        else if (rol_a === 'organizador') mapa[key].organizador++
        else if (rol_a === 'guerrero') mapa[key].guerrero++
        else if (rol_a === 'lider') mapa[key].lider++
        else if (rol_a === 'templario') mapa[key].templario++
      })

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

  const porcentaje = (parte: number, total: number) =>
    total === 0 ? 0 : Math.round((parte / total) * 100)

  const colorRol: Record<string, string> = {
    simpatizante: '#004466',
    organizador: '#b45309',
    guerrero: '#9b1c3a',
    lider: '#166534',
    templario: '#4527a0',
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol} />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

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
                      className="text-xs font-medium w-20 sm:w-28 flex-shrink-0 truncate text-right"
                      style={{ color: 'var(--texto-secundario)' }}
                      title={e.sector}
                    >
                      {e.sector}
                    </p>
                    <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: 'var(--color-fondo)' }}>
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
            {estadisticas.map((e) => (
              <div key={e.sector} className="card space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--texto-principal)' }}>{e.sector}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--texto-secundario)' }}>
                      Encargado: {e.encargado}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold" style={{ color: '#004466' }}>{e.total}</p>
                    <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>afiliados</p>
                  </div>
                </div>

                {/* Barra de progreso votan vs no votan */}
                <div>
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
                <div className="flex flex-wrap gap-2">
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
              </div>
            ))}
          </div>
          </>
        )}
      </main>
    </div>
  )
}
