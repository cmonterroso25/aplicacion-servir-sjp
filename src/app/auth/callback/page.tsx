'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [debug, setDebug] = useState('')

  useEffect(() => {
    // Capturar todo lo que llega en la URL
    const hash = window.location.hash
    const search = window.location.search
    const href = window.location.href
    
    setDebug(`HREF: ${href}\nHASH: ${hash}\nSEARCH: ${search}`)
    console.log('=== AUTH CALLBACK DEBUG ===')
    console.log('href:', href)
    console.log('hash:', hash)
    console.log('search:', search)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('EVENT:', event)
        console.log('SESSION:', session ? 'existe' : 'null')
        setDebug(prev => prev + `\n\nEVENT: ${event}\nSESSION: ${session ? 'existe' : 'null'}`)
        
        if (event === 'PASSWORD_RECOVERY' && session) {
          router.replace('/auth/actualizar-contrasena')
        } else if (event === 'SIGNED_IN' && session) {
          router.replace('/auth/actualizar-contrasena')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"