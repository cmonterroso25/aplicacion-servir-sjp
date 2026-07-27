'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Perfil } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

const FECHA_ELECCIONES = new Date('2027-06-27T00:00:00')

const NOMBRES_FEMENINOS = ['Angelica Ramirez', 'Tatiana Rivera', 'Yanira Ramirez']

type Tiempo = { dias: number; horas: number; minutos: number; segundos: number; terminado: boolean }

function calcularTiempoRestante(): Tiempo {
  const ahora = new Date().getTime()
  const diferencia = FECHA_ELECCIONES.getTime() - ahora

  if (diferencia <= 0) {
    return { dias: 0, horas: 0, minutos: 0, segundos: 0, terminado: true }
  }

  const dias    = Math.floor(diferencia / (1000 * 60 * 60 * 24))
  const horas   = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60))
  const segundos = Math.floor((diferencia % (1000 * 60)) / 1000)

  return { dias, horas, minutos, segundos, terminado: false }
}

export default function InicioPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  // ← Arranca en null: servidor y cliente coinciden en el primer render.
  const [tiempo, setTiempo] = useState<Tiempo | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase
        .from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) setPerfil(p)
    }
    init()
  }, [router])

  useEffect(() => {
    // ← El cálculo real solo corre en el cliente, tras montar.
    setTiempo(calcularTiempoRestante())
    const intervalo = setInterval(() => {
      setTiempo(calcularTiempoRestante())
    }, 1000)
    return () => clearInterval(intervalo)
  }, [])

  const unidad = (valor: number, etiqueta: string) => (
    <div className="flex flex-col items-center">
      <span
        className="text-4xl sm:text-5xl font-extrabold tabular-nums leading-none"
        style={{ color: '#dc2626' }}>
        {String(valor).padStart(2, '0')}
      </span>
      <span className="text-xs sm:text-sm font-semibold mt-1" style={{ color: 'var(--texto-secundario)' }}>
        {etiqueta}
      </span>
    </div>
  )

  const nombreUsuario = perfil?.nombre_completo || perfil?.email || ''
  const esFemenino = NOMBRES_FEMENINOS.some(
    (n) => n.toLowerCase() === nombreUsuario.trim().toLowerCase()
  )
  const saludo = esFemenino ? 'Bienvenida' : 'Bienvenido'

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol || ''} />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="card text-center py-8">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: '#004466' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          <h1 className="font-bold text-xl sm:text-2xl mb-2" style={{ color: '#004466' }}>
            {nombreUsuario
              ? `${saludo}, ${nombreUsuario}`
              : 'Bienvenido a la aplicacion de Servir San Jose Pinula'}
          </h1>
          <p className="text-sm sm:text-base mb-1" style={{ color: 'var(--texto-secundario)' }}>
            Te recuerdo que quedan
          </p>

          {!tiempo ? (
            // ← Placeholder idéntico en servidor y cliente hasta que el useEffect calcule el valor real.
            <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap my-4">
              {unidad(0, 'Dias')}
              <span className="text-3xl font-bold" style={{ color: '#dc2626' }}>:</span>
              {unidad(0, 'Horas')}
              <span className="text-3xl font-bold" style={{ color: '#dc2626' }}>:</span>
              {unidad(0, 'Minutos')}
              <span className="text-3xl font-bold" style={{ color: '#dc2626' }}>:</span>
              {unidad(0, 'Segundos')}
            </div>
          ) : tiempo.terminado ? (
            <p className="font-bold text-lg my-4" style={{ color: '#dc2626' }}>
              ¡Las elecciones ya comenzaron!
            </p>
          ) : (
            <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap my-4">
              {unidad(tiempo.dias, 'Dias')}
              <span className="text-3xl font-bold" style={{ color: '#dc2626' }}>:</span>
              {unidad(tiempo.horas, 'Horas')}
              <span className="text-3xl font-bold" style={{ color: '#dc2626' }}>:</span>
              {unidad(tiempo.minutos, 'Minutos')}
              <span className="text-3xl font-bold" style={{ color: '#dc2626' }}>:</span>
              {unidad(tiempo.segundos, 'Segundos')}
            </div>
          )}

          <p className="text-sm sm:text-base" style={{ color: 'var(--texto-secundario)' }}>
            para las elecciones del 2027
          </p>

          <p className="text-xs mt-6" style={{ color: 'var(--texto-secundario)' }}>
            Elecciones generales: 27 de junio de 2027
          </p>
        </div>
      </main>
    </div>
  )
}
