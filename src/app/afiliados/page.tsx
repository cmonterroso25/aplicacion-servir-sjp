'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Afiliado, type Perfil } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

const colorRol: Record<string, { bg: string; color: string }> = {
  Simpatizante: { bg: '#e0f7fa', color: '#004466' },
  Organizador:  { bg: '#fff3e0', color: '#b45309' },
  Guerrero:     { bg: '#fce4ec', color: '#9b1c3a' },
  Lider:        { bg: '#e8f5e9', color: '#166534' },
  Templario:    { bg: '#ede7f6', color: '#4527a0' },
}

export default function AfiliadosPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [afiliados, setAfiliados] = useState<Afiliado[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase
        .from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) setPerfil(p)
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol || ''} />
      <header className="bg-white border-b shadow-sm sticky top-0 z-10" style={{ borderColor: 'var(--color-borde)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
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

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="card">
          <div className="flex gap-2">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              className="input-field flex-1"
              placeholder="Buscar por nombre, apellido o DPI..."
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

        <p className="text-sm font-medium" style={{ color: 'var(--texto-secundario)' }}>
          {loading ? 'Cargando...' : `${total} afiliado${total !== 1 ? 's' : ''}`}
        </p>

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
          <div className="space-y-3">
            {afiliados.map((a) => {
              const rol = (a as any).rol_afiliado || 'Simpatizante'
              const estiloRol = colorRol[rol] || colorRol['Simpatizante']
              const encargadoSector = (a.sectores as any)?.encargado_nombre
              return (
                <div key={a.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: '#004466' }}>
                          {a.primer_apellido.charAt(0)}
                        </div>
                        <h3 className="font-semibold text-base" style={{ color: 'var(--texto-principal)' }}>{formatNombre(a)}</h3>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: estiloRol.bg, color: estiloRol.color }}>
                          {rol}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm ml-10">
                        {a.dpi && (
                          <div>
                            <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>DPI: </span>
                            <span className="font-mono">{a.dpi}</span>
                          </div>
                        )}
                        {a.telefono && (
                          <div>
                            <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>Tel: </span>
                            <span>{a.telefono}</span>
                          </div>
                        )}
                        {a.sectores && (
                          <div>
                            <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>Sector: </span>
                            <span>{a.sectores.nombre}</span>
                          </div>
                        )}
                        {a.tipo_ubicacion && a.nombre_ubicacion && (
                          <div>
                            <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>Ubicacion: </span>
                            <span>{a.nombre_ubicacion}</span>
                          </div>
                        )}
                        {perfil?.rol !== 'encargado' && encargadoSector && (
                          <div>
                            <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>Encargado del sector: </span>
                            <span>{encargadoSector}</span>
                          </div>
                        )}
                        {(a as any).afiliado_por && (
                          <div>
                            <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>Afiliado por: </span>
                            <span>{(a as any).afiliado_por}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full flex-shrink-0"
                      style={{ background: a.vota_en_pinula ? '#dcfce7' : '#fee2e2', color: a.vota_en_pinula ? '#166534' : '#991b1b' }}>
                      {a.vota_en_pinula ? 'Vota en Pinula' : 'No vota aqui'}
                    </span>
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
