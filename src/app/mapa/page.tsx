'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase, type Perfil } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false })

const ROLES_SIN_ACCESO = ['lider', 'colaborador']

export default function MapaPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSector, setSelectedSector] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const { data: p } = await supabase
        .from('perfiles').select('*').eq('id', session.user.id).single()

      if (p) {
        if (ROLES_SIN_ACCESO.includes(p.rol)) { router.replace('/afiliados'); return }
        setPerfil(p)
      }

      setLoading(false)
    }

    init()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
        <NavBar rol={perfil?.rol} />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <div className="card text-center py-10">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#004466' }}></div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol} />

      {/* Mapa a pantalla completa */}
      <div className="flex-1 w-full">
        <MapComponent onSelectedSectorChange={setSelectedSector} />
      </div>
    </div>
  )
}
