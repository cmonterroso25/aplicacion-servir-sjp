'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Correo o contrasena incorrectos.')
      setLoading(false)
      return
    }
    router.replace('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'linear-gradient(135deg, #001a22 0%, #003344 60%, #005566 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'rgba(0,238,255,0.15)', backdropFilter: 'blur(10px)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" style={{ color: '#00eeff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Consulta de Empadronados</h1>
          <p className="text-sm mt-1" style={{ color: '#00eeff' }}>San Jose Pinula - Uso interno</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--texto-principal)' }}>
                Correo electronico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="tu@correo.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--texto-principal)' }}>
                Contrasena
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
            <div className="text-center pt-1">
              <a href="/recuperar" className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
                Olvidaste tu contrasena?
              </a>
            </div>
          </form>
        </div>
        <p className="text-center text-xs mt-6" style={{ color: '#00eeff' }}>
          Acceso restringido - Solo personal autorizado
        </p>
      </div>
    </div>
  )
}
