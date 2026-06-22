'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Perfil } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

type Sector = {
  id: number
  nombre: string
  descripcion: string | null
  encargado_nombre: string | null
}

type Usuario = {
  id: string
  email: string
  nombre_completo: string | null
  rol: string
  created_at: string
}

type Vista = 'sectores' | 'usuarios'

export default function AdminPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [vista, setVista] = useState<Vista>('sectores')
  const [sectores, setSectores] = useState<Sector[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)

  // Formulario sector
  const [mostrarFormSector, setMostrarFormSector] = useState(false)
  const [editandoSector, setEditandoSector] = useState<Sector | null>(null)
  const [nombreSector, setNombreSector] = useState('')
  const [encargadoSector, setEncargadoSector] = useState('')
  const [loadingSector, setLoadingSector] = useState(false)

  // Formulario usuario
  const [mostrarFormUsuario, setMostrarFormUsuario] = useState(false)
  const [editandoUsuario, setEditandoUsuario] = useState<Usuario | null>(null)
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [rolUsuario, setRolUsuario] = useState('encargado')
  const [loadingUsuario, setLoadingUsuario] = useState(false)

  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase
        .from('perfiles').select('*').eq('id', session.user.id).single()
      if (!p || p.rol !== 'admin') { router.replace('/afiliados'); return }
      setPerfil(p)
      await cargarTodo()
    }
    init()
  }, [router])

  const cargarTodo = useCallback(async () => {
    setLoading(true)
    const { data: s } = await supabase.from('sectores').select('*').order('nombre')
    if (s) setSectores(s)
    const { data: u } = await supabase.from('perfiles').select('*').order('nombre_completo')
    if (u) setUsuarios(u)
    setLoading(false)
  }, [])

  const mostrarExito = (msg: string) => {
    setExito(msg)
    setTimeout(() => setExito(''), 3000)
  }

  // SECTORES
  const abrirFormSector = (sector?: Sector) => {
    if (sector) {
      setEditandoSector(sector)
      setNombreSector(sector.nombre)
      setEncargadoSector(sector.encargado_nombre || '')
    } else {
      setEditandoSector(null)
      setNombreSector('')
      setEncargadoSector('')
    }
    setMostrarFormSector(true)
    setError('')
  }

  const guardarSector = async () => {
    if (!nombreSector.trim()) { setError('El nombre del sector es obligatorio.'); return }
    setLoadingSector(true)
    setError('')
    if (editandoSector) {
      const { error: err } = await supabase
        .from('sectores')
        .update({ nombre: nombreSector.trim(), encargado_nombre: encargadoSector.trim() || null })
        .eq('id', editandoSector.id)
      if (err) { setError('Error al actualizar sector.'); setLoadingSector(false); return }
      mostrarExito('Sector actualizado correctamente.')
    } else {
      const { error: err } = await supabase
        .from('sectores')
        .insert({ nombre: nombreSector.trim(), encargado_nombre: encargadoSector.trim() || null })
      if (err) { setError('Error al crear sector.'); setLoadingSector(false); return }
      mostrarExito('Sector creado correctamente.')
    }
    setMostrarFormSector(false)
    setLoadingSector(false)
    await cargarTodo()
  }

  const eliminarSector = async (id: number) => {
    if (!confirm('Seguro que deseas eliminar este sector?')) return
    const { error: err } = await supabase.from('sectores').delete().eq('id', id)
    if (err) { setError('No se puede eliminar un sector con afiliados asignados.'); return }
    mostrarExito('Sector eliminado.')
    await cargarTodo()
  }

  // USUARIOS
  const abrirFormUsuario = (usuario: Usuario) => {
    setEditandoUsuario(usuario)
    setNombreUsuario(usuario.nombre_completo || '')
    setRolUsuario(usuario.rol)
    setMostrarFormUsuario(true)
    setError('')
  }

  const guardarUsuario = async () => {
    if (!editandoUsuario) return
    setLoadingUsuario(true)
    setError('')
    const { error: err } = await supabase
      .from('perfiles')
      .update({ nombre_completo: nombreUsuario.trim() || null, rol: rolUsuario })
      .eq('id', editandoUsuario.id)
    if (err) { setError('Error al actualizar usuario.'); setLoadingUsuario(false); return }
    mostrarExito('Usuario actualizado correctamente.')
    setMostrarFormUsuario(false)
    setLoadingUsuario(false)
    await cargarTodo()
  }

  const colorRol: Record<string, { bg: string; color: string }> = {
    admin:       { bg: '#ede7f6', color: '#4527a0' },
    colaborador: { bg: '#e0f7fa', color: '#004466' },
    encargado:   { bg: '#e8f5e9', color: '#166534' },
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
<NavBar rol={perfil?.rol || ''} />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {exito && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
            {exito}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setVista('sectores')}
            className="px-4 py-2 text-sm font-medium rounded-lg border transition-all"
            style={vista === 'sectores'
              ? { background: '#004466', color: 'white', borderColor: '#004466' }
              : { background: 'white', color: 'var(--texto-secundario)', borderColor: 'var(--color-borde)' }}>
            Sectores ({sectores.length})
          </button>
          <button
            onClick={() => setVista('usuarios')}
            className="px-4 py-2 text-sm font-medium rounded-lg border transition-all"
            style={vista === 'usuarios'
              ? { background: '#004466', color: 'white', borderColor: '#004466' }
              : { background: 'white', color: 'var(--texto-secundario)', borderColor: 'var(--color-borde)' }}>
            Usuarios ({usuarios.length})
          </button>
        </div>

        {loading ? (
          <div className="card text-center py-10">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#004466' }}></div>
          </div>
        ) : (
          <>
            {/* VISTA SECTORES */}
            {vista === 'sectores' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    onClick={() => abrirFormSector()}
                    className="text-sm px-4 py-1.5 rounded-lg font-semibold text-white"
                    style={{ background: '#004466' }}>
                    + Nuevo sector
                  </button>
                </div>

                {mostrarFormSector && (
                  <div className="card border-2 space-y-3" style={{ borderColor: '#004466' }}>
                    <h2 className="font-semibold text-sm" style={{ color: '#004466' }}>
                      {editandoSector ? 'Editar sector' : 'Nuevo sector'}
                    </h2>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--texto-secundario)' }}>Nombre del sector *</label>
                      <input type="text" value={nombreSector} onChange={(e) => setNombreSector(e.target.value)} className="input-field" placeholder="Ej: Casco Urbano 1 y 3" autoFocus />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--texto-secundario)' }}>Encargado del sector</label>
                      <input type="text" value={encargadoSector} onChange={(e) => setEncargadoSector(e.target.value)} className="input-field" placeholder="Nombre del encargado" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={guardarSector} disabled={loadingSector} className="btn-primary" style={{ width: 'auto', padding: '0.5rem 1.5rem' }}>
                        {loadingSector ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button onClick={() => { setMostrarFormSector(false); setError('') }} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {sectores.map((s) => (
                  <div key={s.id} className="card flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>{s.nombre}</p>
                      {s.encargado_nombre && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--texto-secundario)' }}>
                          Encargado: {s.encargado_nombre}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => abrirFormSector(s)} className="text-xs px-3 py-1.5 rounded-lg border font-medium" style={{ borderColor: '#004466', color: '#004466' }}>
                        Editar
                      </button>
                      <button onClick={() => eliminarSector(s.id)} className="text-xs px-3 py-1.5 rounded-lg border font-medium" style={{ borderColor: '#991b1b', color: '#991b1b' }}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* VISTA USUARIOS */}
            {vista === 'usuarios' && (
              <div className="space-y-3">
                {mostrarFormUsuario && editandoUsuario && (
                  <div className="card border-2 space-y-3" style={{ borderColor: '#004466' }}>
                    <h2 className="font-semibold text-sm" style={{ color: '#004466' }}>Editar usuario</h2>
                    <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>{editandoUsuario.email}</p>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--texto-secundario)' }}>Nombre completo</label>
                      <input type="text" value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)} className="input-field" autoFocus />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--texto-secundario)' }}>Rol</label>
                      <div className="flex gap-2">
                        {['admin', 'colaborador', 'encargado'].map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setRolUsuario(r)}
                            className="px-3 py-1.5 text-sm rounded-lg border font-medium capitalize transition-all"
                            style={rolUsuario === r
                              ? { ...colorRol[r], borderColor: colorRol[r].color }
                              : { background: 'white', color: 'var(--texto-secundario)', borderColor: 'var(--color-borde)' }}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={guardarUsuario} disabled={loadingUsuario} className="btn-primary" style={{ width: 'auto', padding: '0.5rem 1.5rem' }}>
                        {loadingUsuario ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button onClick={() => { setMostrarFormUsuario(false); setError('') }} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {usuarios.map((u) => (
                  <div key={u.id} className="card flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: '#004466' }}>
                        {(u.nombre_completo || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--texto-principal)' }}>
                          {u.nombre_completo || 'Sin nombre'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full capitalize"
                        style={{ background: colorRol[u.rol]?.bg || '#e0f7fa', color: colorRol[u.rol]?.color || '#004466' }}>
                        {u.rol}
                      </span>
                      <button onClick={() => abrirFormUsuario(u)} className="text-xs px-3 py-1.5 rounded-lg border font-medium" style={{ borderColor: '#004466', color: '#004466' }}>
                        Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
