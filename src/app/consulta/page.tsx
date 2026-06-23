'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Empadronado, type Perfil } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

export default function ConsultaPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Empadronado[]>([])
  const [loading, setLoading] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase
        .from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) setPerfil(p)
    }
    checkAuth()
  }, [router])

  const buscar = useCallback(async () => {
    const termino = query.trim()
    if (!termino || termino.length < 2) {
      setError('Escribe el numero de DPI para buscar.')
      return
    }
    setLoading(true)
    setError('')
    setBuscado(false)
    try {
      const { data, error: supaError } = await supabase
        .from('empadronados')
        .select('*')
        .eq('dpi', termino)
        .limit(5)
      if (supaError) throw supaError
      setResultados(data || [])
    } catch {
      setError('Error al realizar la busqueda. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setBuscado(true)
    }
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') buscar()
  }

  const limpiar = () => {
    setQuery('')
    setResultados([])
    setBuscado(false)
    setError('')
  }

  const formatNombre = (p: Empadronado) =>
    [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido]
      .filter(Boolean).join(' ')

  const irAFiliar = (persona: Empadronado) => {
    const params = new URLSearchParams({
      dpi:              persona.dpi || '',
      primer_nombre:    persona.primer_nombre || '',
      segundo_nombre:   persona.segundo_nombre || '',
      primer_apellido:  persona.primer_apellido || '',
      segundo_apellido: persona.segundo_apellido || '',
    })
    router.push(`/afiliados/nuevo?${params.toString()}`)
  }

  const BTN = { background: '#004466', color: '#ffffff' }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol || ''} />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div className="card">
          <h2 className="font-semibold text-base mb-4" style={{ color: 'var(--texto-principal)' }}>
            Verificar empadronado
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input-field flex-1"
              placeholder="Numero de DPI..."
              autoFocus
            />
            {query && (
              <button
                onClick={limpiar}
                className="px-3 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                X
              </button>
            )}
            <button
              onClick={buscar}
              disabled={loading}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-60"
              style={{ ...BTN, minWidth: '90px' }}>
              {loading ? (
                <svg className="animate-spin h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : 'Buscar'}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {buscado && (
          <div>
            {resultados.length === 0 ? (
              <div className="card text-center py-10">
                <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: '#fee2e2' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="font-semibold text-red-700 text-lg">No vota en San Jose Pinula</p>
                <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>
                  No se encontro ningun registro con ese DPI.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {resultados.map((persona) => (
                  <div key={persona.id} className="card hover:shadow-md transition-shadow">

                    <div className="flex justify-between items-center mb-2">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full"
                        style={{ background: '#e0f7fa', color: '#004466' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Vota aqui
                      </span>

                      <button
                        onClick={() => irAFiliar(persona)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
                        style={{ background: '#004466', color: 'white' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        Afiliar ahora
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-bold flex-shrink-0"
                        style={{ background: '#004466' }}>
                        {persona.primer_nombre.charAt(0)}
                      </div>
                      <h3 className="font-bold text-base leading-snug" style={{ color: 'var(--texto-principal)' }}>
                        {formatNombre(persona)}
                      </h3>
                    </div>

                    <div className="flex flex-col gap-2 text-sm">
                      <div className="flex gap-2">
                        <span className="font-medium w-20 flex-shrink-0" style={{ color: 'var(--texto-secundario)' }}>DPI:</span>
                        <span className="font-mono break-all">{persona.dpi}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-medium w-20 flex-shrink-0" style={{ color: 'var(--texto-secundario)' }}>Edad:</span>
                        <span>{persona.edad} años</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-medium w-20 flex-shrink-0" style={{ color: 'var(--texto-secundario)' }}>Genero:</span>
                        <span>{persona.genero}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-medium w-20 flex-shrink-0" style={{ color: 'var(--texto-secundario)' }}>Direccion:</span>
                        <span>{persona.direccion}</span>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
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
              Ingresa un numero de DPI para verificar si la persona vota en San Jose Pinula.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
