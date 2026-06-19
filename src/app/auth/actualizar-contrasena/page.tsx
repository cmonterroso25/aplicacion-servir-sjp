'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ActualizarContrasena() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [sesionLista, setSesionLista] = useState(false)

  useEffect(() => {
    // Supabase maneja el hash automáticamente con onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          if (session) {
            setSesionLista(true)
          }
        }
      }
    )

    // También verificar si ya hay sesión activa
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSesionLista(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('Error al actualizar. El link puede haber expirado — solicita uno nuevo.')
      setLoading(false)
      return
    }

    setListo(true)
    setTimeout(() => router.replace('/consulta'), 2000)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0f2419 0%, #1a6b3c 60%, #22913f 100%)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Crear contraseña</h1>
          <p className="text-green-200 text-sm mt-1">San José Pinula — Consulta de empadronados</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {listo ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
                style={{ background: '#dcfce7' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-green-600"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-green-700">¡Contraseña creada!</p>
              <p className="text-sm mt-1" style={{ color: '#4a6b55' }}>Entrando a la app...</p>
            </div>
          ) : !sesionLista ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm" style={{ color: '#4a6b55' }}>Verificando link...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5"
                  style={{ color: '#0f2419' }}>
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="Mínimo 8 caracteres"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5"
                  style={{ color: '#0f2419' }}>
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  className="input-field"
                  placeholder="Repite la contraseña"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Guardando...
                  </span>
                ) : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}