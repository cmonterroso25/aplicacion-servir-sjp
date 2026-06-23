'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, type Sector, type Perfil } from '@/lib/supabase'
import { TIPOS_UBICACION, OPCIONES_UBICACION, type TipoUbicacion } from '@/lib/ubicaciones'

const ROLES_AFILIADO = ['Simpatizante', 'Organizador', 'Guerrero', 'Lider', 'Templario']

function NuevoAfiliadoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [sectores, setSectores] = useState<Sector[]>([])
  const [loading, setLoading] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  const [dpi, setDpi] = useState('')
  const [verificandoDpi, setVerificandoDpi] = useState(false)
  const [votaPinula, setVotaPinula] = useState<boolean | null>(null)
  const [mensajeDpi, setMensajeDpi] = useState('')

  const [primerApellido, setPrimerApellido] = useState('')
  const [segundoApellido, setSegundoApellido] = useState('')
  const [primerNombre, setPrimerNombre] = useState('')
  const [segundoNombre, setSegundoNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [sectorId, setSectorId] = useState('')
  const [tipoUbicacion, setTipoUbicacion] = useState<TipoUbicacion | ''>('')
  const [nombreUbicacion, setNombreUbicacion] = useState('')
  const [afiliadoPor, setAfiliadoPor] = useState('')
  const [rolAfiliado, setRolAfiliado] = useState('Simpatizante')
  const [encargados, setEncargados] = useState<string[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase
        .from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) {
        setPerfil(p)
        setAfiliadoPor(p.nombre_completo || p.email || '')
      }
      const { data: s } = await supabase
        .from('sectores').select('*').order('nombre')
      if (s) {
        setSectores(s)
        const nombres = s.map((x: any) => x.encargado_nombre).filter(Boolean)
        setEncargados([...new Set(nombres)] as string[])
      }

      const dpiParam             = searchParams.get('dpi')
      const primerNombreParam    = searchParams.get('primer_nombre')
      const segundoNombreParam   = searchParams.get('segundo_nombre')
      const primerApellidoParam  = searchParams.get('primer_apellido')
      const segundoApellidoParam = searchParams.get('segundo_apellido')

      if (dpiParam)              setDpi(dpiParam)
      if (primerNombreParam)     setPrimerNombre(primerNombreParam)
      if (segundoNombreParam)    setSegundoNombre(segundoNombreParam)
      if (primerApellidoParam)   setPrimerApellido(primerApellidoParam)
      if (segundoApellidoParam)  setSegundoApellido(segundoApellidoParam)

      if (dpiParam) {
        setVotaPinula(true)
        setMensajeDpi('Si vota en San Jose Pinula — datos autocompletados')
      }
    }
    init()
  }, [router, searchParams])

  const verificarDpi = async () => {
    const d = dpi.trim()
    if (d.length < 5) return
    setVerificandoDpi(true)
    setMensajeDpi('')
    setVotaPinula(null)
    const { data } = await supabase
      .from('empadronados')
      .select('primer_nombre, segundo_nombre, primer_apellido, segundo_apellido')
      .eq('dpi', d)
      .single()
    if (data) {
      setPrimerNombre(data.primer_nombre || '')
      setSegundoNombre(data.segundo_nombre || '')
      
      const apellidos = (data.primer_apellido || "").trim().split(" ")
      if (apellidos.length >= 2) {
        alert("Split: " + JSON.stringify(apellidos)); setPrimerApellido(apellidos[0])
        setSegundoApellido(apellidos.slice(1).join(' '))
      } else {
        setPrimerApellido(data.primer_apellido || '')
        setSegundoApellido(data.segundo_apellido || '')
      }
      setVotaPinula(true)
      setMensajeDpi('Si vota en San Jose Pinula — datos autocompletados')
    } else {
      setVotaPinula(false)
      setMensajeDpi('No vota en San Jose Pinula — puedes agregarlo igual')
    }
    setVerificandoDpi(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!primerApellido || !primerNombre) {
      setError('Nombre y apellido son obligatorios.')
      return
    }
    if (!perfil) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('afiliados').insert({
      primer_apellido: primerApellido.toUpperCase(),
      segundo_apellido: segundoApellido.toUpperCase() || null,
      primer_nombre: primerNombre.toUpperCase(),
      segundo_nombre: segundoNombre.toUpperCase() || null,
      dpi: dpi || null,
      telefono: telefono || null,
      fecha_nacimiento: fechaNacimiento || null,
      sector_id: sectorId ? parseInt(sectorId) : null,
      encargado_id: perfil.id,
      tipo_ubicacion: tipoUbicacion || null,
      nombre_ubicacion: nombreUbicacion || null,
      vota_en_pinula: votaPinula === null ? true : votaPinula,
      afiliado_por: afiliadoPor,
      rol_afiliado: rolAfiliado,
    })
    if (err) {
      setError('Error al guardar. Intenta de nuevo.')
      setLoading(false)
      return
    }
    setGuardado(true)
    setTimeout(() => router.replace('/afiliados'), 1500)
  }

  const opcionesUbicacion = tipoUbicacion ? OPCIONES_UBICACION[tipoUbicacion] : []

  const colorRol: Record<string, { bg: string; color: string }> = {
    Simpatizante: { bg: '#e0f7fa', color: '#004466' },
    Organizador:  { bg: '#fff3e0', color: '#b45309' },
    Guerrero:     { bg: '#fce4ec', color: '#9b1c3a' },
    Lider:        { bg: '#e8f5e9', color: '#166534' },
    Templario:    { bg: '#ede7f6', color: '#4527a0' },
  }

  if (guardado) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-fondo)' }}>
        <div className="card text-center py-10 max-w-sm w-full mx-4">
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: '#dcfce7' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-semibold text-green-700 text-lg">Afiliado guardado</p>
          <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <header className="bg-white border-b shadow-sm sticky top-0 z-10" style={{ borderColor: 'var(--color-borde)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg" style={{ color: 'var(--texto-secundario)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-bold text-sm" style={{ color: '#004466' }}>Nuevo Afiliado</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="card space-y-3">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>Verificacion de empadronamiento</h2>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={dpi}
                onChange={(e) => { setDpi(e.target.value); setVotaPinula(null); setMensajeDpi('') }}
                className="input-field flex-1"
                placeholder="Numero de DPI (opcional)"
              />
              <button
                type="button"
                onClick={verificarDpi}
                disabled={verificandoDpi || dpi.length < 5}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#004466', minWidth: '100px' }}>
                {verificandoDpi ? 'Buscando...' : 'Verificar'}
              </button>
            </div>
            {mensajeDpi && (
              <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
                style={{ background: votaPinula ? '#dcfce7' : '#fee2e2', color: votaPinula ? '#166534' : '#991b1b' }}>
                <span>{mensajeDpi}</span>
              </div>
            )}
          </div>

          <div className="card space-y-3">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>Datos personales</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--texto-secundario)' }}>Primer apellido *</label>
                <input type="text" value={primerApellido} onChange={(e) => setPrimerApellido(e.target.value)} className="input-field" required />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--texto-secundario)' }}>Segundo apellido</label>
                <input type="text" value={segundoApellido} onChange={(e) => setSegundoApellido(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--texto-secundario)' }}>Primer nombre *</label>
                <input type="text" value={primerNombre} onChange={(e) => setPrimerNombre(e.target.value)} className="input-field" required />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--texto-secundario)' }}>Segundo nombre</label>
                <input type="text" value={segundoNombre} onChange={(e) => setSegundoNombre(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--texto-secundario)' }}>Telefono</label>
                <input type="tel" inputMode="numeric" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input-field" placeholder="12345678" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--texto-secundario)' }}>Fecha de nacimiento</label>
                <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className="input-field" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--texto-secundario)' }}>Afiliado por</label>
                <select value={afiliadoPor} onChange={(e) => setAfiliadoPor(e.target.value)} className="input-field">
                    <option value="">Selecciona un encargado...</option>
                    {encargados.map((enc) => (
                      <option key={enc} value={enc}>{enc}</option>
                    ))}
                  </select>
              </div>
            </div>
          </div>

          <div className="card space-y-3">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>Rol del afiliado</h2>
            <div className="flex flex-wrap gap-2">
              {ROLES_AFILIADO.map((rol) => (
                <button
                  key={rol}
                  type="button"
                  onClick={() => setRolAfiliado(rol)}
                  className="px-3 py-1.5 text-sm rounded-lg border font-medium transition-all"
                  style={rolAfiliado === rol
                    ? { ...colorRol[rol], borderColor: colorRol[rol].color, fontWeight: 700 }
                    : { background: 'white', color: 'var(--texto-secundario)', borderColor: 'var(--color-borde)' }}>
                  {rol}
                </button>
              ))}
            </div>
          </div>

          <div className="card space-y-3">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>Sector y ubicacion</h2>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--texto-secundario)' }}>Sector</label>
              <select value={sectorId} onChange={(e) => setSectorId(e.target.value)} className="input-field">
                <option value="">Selecciona un sector...</option>
                {sectores.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--texto-secundario)' }}>Tipo de ubicacion</label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_UBICACION.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => { setTipoUbicacion(t.value); setNombreUbicacion('') }}
                    className="px-3 py-1.5 text-sm rounded-lg border font-medium transition-all"
                    style={tipoUbicacion === t.value
                      ? { background: '#004466', color: 'white', borderColor: '#004466' }
                      : { background: 'white', color: 'var(--texto-secundario)', borderColor: 'var(--color-borde)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {tipoUbicacion && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--texto-secundario)' }}>
                  {TIPOS_UBICACION.find(t => t.value === tipoUbicacion)?.label}
                </label>
                {opcionesUbicacion.length > 0 ? (
                  <select value={nombreUbicacion} onChange={(e) => setNombreUbicacion(e.target.value)} className="input-field">
                    <option value="">Selecciona...</option>
                    {opcionesUbicacion.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={nombreUbicacion}
                    onChange={(e) => setNombreUbicacion(e.target.value)}
                    className="input-field"
                    placeholder={`Nombre del ${TIPOS_UBICACION.find(t => t.value === tipoUbicacion)?.label.toLowerCase()}...`}
                  />
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar afiliado'}
          </button>
        </form>
      </main>
    </div>
  )
}

export default function NuevoAfiliadoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-fondo)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#004466' }}></div>
      </div>
    }>
      <NuevoAfiliadoForm />
    </Suspense>
  )
}
