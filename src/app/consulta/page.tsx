'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Empadronado } from '@/lib/supabase'

type BusquedaTipo = 'nombre' | 'dpi'

export default function ConsultaPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
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
        // Búsqueda por nombre o apellido
        const palabras = termino.toUpperCase().split(' ').filter(p => p.length > 0)
        
        if (palabras.length === 1) {
          // Una sola palabra: buscar en nombre O apellido
          queryBuilder = queryBuilder.or(
            `primer_nombre.ilike.%${palabras[0]}%,primer_apellido.ilike.%${palabras[0]}%,segundo_apellido.ilike.%${palabras[0]}%`
          )
        } else {
          // Múltiples palabras: primera puede ser nombre, resto apellidos
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
      setError('Error al realizar la búsqueda. Intenta de nuevo.')
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--gris-fondo)' }}>
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10" style={{ borderColor: 'var(--gris-borde)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--verde-pinula)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-sm" style={{ color: 'var(--verde-pinula)' }}>
                Empadronados San José Pinula
              </h1>
              <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>Consulta interna</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--texto-secundario)' }}
            title={userEmail}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Search Card */}
        <div className="card">
          <h2 className="font-semibold text-base mb-4" style={{ color: 'var(--texto-principal)' }}>
            Verificar empadronado
          </h2>

          {/* Toggle tipo de búsqueda */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setBusquedaTipo('nombre'); limpiar() }}
              className="flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-all"
              style={{
                background: busquedaTipo === 'nombre' ? 'var(--verde-pinula)' : 'white',
                color: busquedaTipo === 'nombre' ? 'white' : 'var(--texto-secundario)',
                borderColor: busquedaTipo === 'nombre' ? 'var(--verde-pinula)' : 'var(--gris-borde)',
              }}>
              Por nombre
            </button>
            <button
              onClick={() => { setBusquedaTipo('dpi'); limpiar() }}
              className="flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-all"
              style={{
                background: busquedaTipo === 'dpi' ? 'var(--verde-pinula)' : 'white',
                color: busquedaTipo === 'dpi' ? 'white' : 'var(--texto-secundario)',
                borderColor: busquedaTipo === 'dpi' ? 'var(--verde-pinula)' : 'var(--gris-borde)',
              }}>
              Por DPI
            </button>
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              type={busquedaTipo === 'dpi' ? 'text' : 'text'}
              inputMode={busquedaTipo === 'dpi' ? 'numeric' : 'text'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input-field flex-1"
              placeholder={
                busquedaTipo === 'dpi'
                  ? 'Número de DPI...'
                  : 'Nombre o apellido...'
              }
              autoFocus
            />
            {query && (
              <button
                onClick={limpiar}
                className="px-3 rounded-lg border text-sm transition-colors"
                style={{ borderColor: 'var(--gris-borde)', color: 'var(--texto-secundario)' }}>
                ✕
              </button>
            )}
            <button
              onClick={buscar}
              disabled={loading}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors flex items-center gap-2 disabled:opacity-60"
              style={{ background: 'var(--verde-pinula)', minWidth: '90px' }}>
              {loading ? (
                <svg className="animate-spin h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Buscar
                </>
              )}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {busquedaTipo === 'nombre' && (
            <p className="mt-2 text-xs" style={{ color: 'var(--texto-secundario)' }}>
              Tip: escribe apellido para encontrar más rápido. Ej: "García" o "María García"
            </p>
          )}
        </div>

        {/* Results */}
        {buscado && (
          <div>
            {/* Contador */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium" style={{ color: 'var(--texto-secundario)' }}>
                {resultados.length === 0
                  ? 'No se encontraron resultados'
                  : totalResultados > 50
                  ? `Mostrando 50 de ${totalResultados} resultados — refina la búsqueda`
                  : `${totalResultados} resultado${totalResultados !== 1 ? 's' : ''} encontrado${totalResultados !== 1 ? 's' : ''}`}
              </p>
            </div>

            {/* No encontrado */}
            {resultados.length === 0 && (
              <div className="card text-center py-10">
                <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
                  style={{ background: '#fee2e2' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="font-semibold text-red-700 text-lg">No vota en San José Pinula</p>
                <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>
                  No se encontró ningún registro con esa búsqueda en el municipio.
                </p>
              </div>
            )}

            {/* Resultados */}
            <div className="space-y-3">
              {resultados.map((persona) => (
                <div key={persona.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Nombre */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ background: persona.genero === 'F' ? '#b45309' : 'var(--verde-pinula)' }}>
                          {persona.primer_nombre.charAt(0)}
                        </div>
                        <h3 className="font-semibold text-base truncate" style={{ color: 'var(--texto-principal)' }}>
                          {formatNombre(persona)}
                        </h3>
                      </div>

                      {/* Datos en grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm ml-10">
                        <div>
                          <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>DPI: </span>
                          <span className="font-mono" style={{ color: 'var(--texto-principal)' }}>{persona.dpi}</span>
                        </div>
                        <div>
                          <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>Edad: </span>
                          <span style={{ color: 'var(--texto-principal)' }}>{persona.edad} años</span>
                        </div>
                        <div>
                          <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>Género: </span>
                          <span style={{ color: 'var(--texto-principal)' }}>
                            {persona.genero === 'F' ? 'Femenino' : 'Masculino'}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>Dirección: </span>
                          <span style={{ color: 'var(--texto-principal)' }}>{persona.direccion}</span>
                        </div>
                      </div>
                    </div>

                    {/* Badge de confirmación */}
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full"
                        style={{ background: '#dcfce7', color: '#166534' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Vota aquí
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado inicial */}
        {!buscado && !loading && (
          <div className="card text-center py-10">
            <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
              style={{ background: '#e8f5ee' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" style={{ color: 'var(--verde-pinula)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="font-medium" style={{ color: 'var(--texto-principal)' }}>Listo para consultar</p>
            <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>
              Escribe un nombre, apellido o DPI para verificar si la persona vota en San José Pinula.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
