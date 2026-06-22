'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Empadronado, type Perfil } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

type BusquedaTipo = 'nombre' | 'dpi'

export default function ConsultaPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [busquedaTipo, setBusquedaTipo] = useState<BusquedaTipo>('nombre')
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Empadronado[]>([])
  const [loading, setLoading] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState('')
  const [totalResultados, setTotalResultados] = useState(0)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      setUserEmail(session.user.email || '')
      const { data: p } = await supabase
  .from('perfiles')
  .select('*')
  .eq('id', session.user.id)
  .single()

if (p) setPerfil(p)
    }
    checkAuth()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const buscar = useCallback(async () => {
    const termino = query.trim()
    if (!termino || termino.length < 2) {
      setError('Escribe al menos 2 caracteres para buscar.')
      return
    }
    setLoading(true)
    setError('')
    setBuscado(false)
    try {
      let queryBuilder = supabase
        .from('empadronados')
        .select('*', { count: 'exact' })
        .limit(50)

      if (busquedaTipo === 'dpi') {
        queryBuilder = queryBuilder.eq('dpi', termino)
      } else {
        const palabras = termino.toUpperCase().split(' ').filter((p: string) => p.length > 0)
        if (palabras.length === 1) {
          queryBuilder = queryBuilder.or(
            `primer_nombre.ilike.%${palabras[0]}%,primer_apellido.ilike.%${palabras[0]}%,segundo_apellido.ilike.%${palabras[0]}%`
          )
        } else {
          queryBuilder = queryBuilder
            .ilike('primer_apellido', `%${palabras[palabras.length - 1]}%`)
            .ilike('primer_nombre', `%${palabras[0]}%`)
        }
      }

      const { data, error: supaError, count } = await queryBuilder
      if (supaError) throw supaError
      setResultados(data || [])
      setTotalResultados(count || 0)
    } catch {
      setError('Error al realizar la busqueda. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setBuscado(true)
    }
  }, [query, busquedaTipo])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') buscar()
  }

  const limpiar = () => {
    setQuery('')
    setResultados([])
    setBuscado(false)
    setError('')
    setTotalResultados(0)
  }

  const formatNombre = (p: Empadronado) => {
    return [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido]
      .filter(Boolean)
      .join(' ')
  }

  const BTN = { background: '#004466', color: '#ffffff' }
  const BTN_ACTIVE = { background: '#004466', color: '#ffffff', borderColor: '#004466' }
  const BTN_INACTIVE = { background: 'white', color: '#006677', borderColor: '#b3f0f7' }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol || ''} />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div className="card">
          <h2 className="font-semibold text-base mb-4" style={{ color: 'var(--texto-principal)' }}>Verificar empadronado</h2>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setBusquedaTipo('nombre'); limpiar() }}
              className="flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-all"
              style={busquedaTipo === 'nombre' ? BTN_ACTIVE : BTN_INACTIVE}>
              Por nombre
            </button>
            <button
              onClick={() => { setBusquedaTipo('dpi'); limpiar() }}
              className="flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-all"
              style={busquedaTipo === 'dpi' ? BTN_ACTIVE : BTN_INACTIVE}>
              Por DPI
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode={busquedaTipo === 'dpi' ? 'numeric' : 'text'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input-field flex-1"
              placeholder={busquedaTipo === 'dpi' ? 'Numero de DPI...' : 'Nombre o apellido...'}
              autoFocus
            />
            {query && (
              <button onClick={limpiar} className="px-3 rounded-lg border text-sm" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                X
              </button>
            )}
            <button onClick={buscar} disabled={loading} className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-60" style={{ ...BTN, minWidth: '90px' }}>
              {loading ? (
                <svg className="animate-spin h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              ) : 'Buscar'}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {busquedaTipo === 'nombre' && (
            <p className="mt-2 text-xs" style={{ color: 'var(--texto-secundario)' }}>
              Tip: escribe apellido para encontrar mas rapido. Ej: Garcia o Maria Garcia
            </p>
          )}
        </div>

        {buscado && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium" style={{ color: 'var(--texto-secundario)' }}>
                {resultados.length === 0
                  ? 'No se encontraron resultados'
                  : totalResultados > 50
                  ? `Mostrando 50 de ${totalResultados} resultados`
                  : `${totalResultados} resultado${totalResultados !== 1 ? 's' : ''} encontrado${totalResultados !== 1 ? 's' : ''}`}
              </p>
            </div>

            {resultados.length === 0 && (
              <div className="card text-center py-10">
                <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: '#fee2e2' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="font-semibold text-red-700 text-lg">No vota en San Jose Pinula</p>
                <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>No se encontro ningun registro con esa busqueda.</p>
              </div>
            )}

            <div className="space-y-3">
              {resultados.map((persona) => (
                <div key={persona.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: '#004466' }}>
                          {persona.primer_nombre.charAt(0)}
                        </div>
                        <h3 className="font-semibold text-base truncate" style={{ color: 'var(--texto-principal)' }}>
                          {formatNombre(persona)}
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm ml-10">
                        <div>
                          <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>DPI: </span>
                          <span className="font-mono">{persona.dpi}</span>
                        </div>
                        <div>
                          <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>Edad: </span>
                          <span>{persona.edad} años</span>
                        </div>
                        <div>
                          <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>Genero: </span>
                          <span>{persona.genero}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>Direccion: </span>
                          <span>{persona.direccion}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full" style={{ background: '#e0f7fa', color: '#004466' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Vota aqui
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!buscado && !loading && (
          <div className="card text-center py-10">
            <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: '#e0f7fa' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" style={{ color: '#004466' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>Listo para consultar</p>
            <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>
              Escribe un nombre, apellido o DPI para verificar si la persona vota en San Jose Pinula.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
