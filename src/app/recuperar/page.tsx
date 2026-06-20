'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function RecuperarContrasena() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:3000/auth/callback',
    })

    if (error) {
      setError(`Error: ${error.message}`)
      setLoading(false)
      return
    }

    setEnviado(true)
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0f2419 0%, #1a6b3c 60%, #22913f 100%)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Recuperar acceso</h1>
          <p className="text-green-200 text-sm mt-1">San José Pinula — Consulta de empadronados</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {enviado ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
                style={{ background: '#dcfce7' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-green-600"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="font-semibold text-green-700">Correo enviado</p>
              <p className="text-sm mt-2" style={{ color: '#4a6b55' }}>
                Revisa tu bandeja de entrada y haz clic en el link para crear tu contraseña.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5"
                  style={{ color: '#0f2419' }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="tu@correo.com"
                  required
                  autoFocus
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
                    Enviando...
                  </span>
                ) : 'Enviar link de acceso'}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-4">
          <a href="/login" className="text-green-300 text-sm hover:text-white transition-colors">
            ← Volver al login
          </a>
        </div>
      </div>
    </div>
  )
}