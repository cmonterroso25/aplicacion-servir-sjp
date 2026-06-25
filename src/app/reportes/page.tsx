'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { exportToExcel } from '@/lib/exportXlsx'
import NavBar from '@/components/NavBar'

type Sector = { id: number; nombre: string }

const NOMBRE_COMPLETO = (a: any) =>
  [a.primer_nombre, a.segundo_nombre, a.primer_apellido, a.segundo_apellido]
    .filter(Boolean)
    .join(' ')

const mapAfiliado = (a: any, sectoresMap: Record<number, string>) => ({
  'Nombre completo': NOMBRE_COMPLETO(a),
  DPI: a.dpi || '',
  Teléfono: a.telefono || '',
  'Fecha nacimiento': a.fecha_nacimiento || '',
  Edad: a.edad || '',
  Género: a.genero || '',
  Sector: a.sector_id ? sectoresMap[a.sector_id] || '' : '',
  'Tipo ubicación': a.tipo_ubicacion || '',
  'Nombre ubicación': a.nombre_ubicacion || '',
  'Vota en Pinula': a.vota_en_pinula === true ? 'Sí' : a.vota_en_pinula === false ? 'No' : '',
  'Afiliado por': a.afiliado_por || '',
  'Rol afiliado': a.rol_afiliado || '',
  'Fecha de registro': a.created_at ? new Date(a.created_at).toLocaleDateString('es-GT') : '',
})

export default function ReportesPage() {
  const router = useRouter()
  const [rol, setRol] = useState<string>()
  const [sectores, setSectores] = useState<Sector[]>([])
  const [afiliadoPorOptions, setAfiliadoPorOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [sectorId, setSectorId] = useState('')
  const [afiliadoPor, setAfiliadoPor] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', user.id)
          .single()
        if (perfil?.rol === 'lider') { router.replace('/afiliados'); return }
        setRol(perfil?.rol)
      }

      const { data: sectoresData } = await supabase.from('sectores').select('id, nombre').order('nombre')
      setSectores(sectoresData || [])

      const { data: afiliadosData } = await supabase
        .from('afiliados')
        .select('afiliado_por')
        .not('afiliado_por', 'is', null)

      const unique = Array.from(new Set((afiliadosData || []).map((a) => a.afiliado_por).filter(Boolean)))
      setAfiliadoPorOptions(unique.sort())
    }
    init()
  }, [])

  const buildSectoresMap = (sectoresList: Sector[]) =>
    sectoresList.reduce((acc, s) => ({ ...acc, [s.id]: s.nombre }), {} as Record<number, string>)

  const handleExportPorFecha = async () => {
    if (!fechaInicio || !fechaFin) {
      alert('Selecciona ambas fechas')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('afiliados')
        .select('*')
        .gte('created_at', fechaInicio)
        .lte('created_at', `${fechaFin}T23:59:59`)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!data?.length) {
        alert('No hay afiliados en ese rango de fechas')
        return
      }

      const sectoresMap = buildSectoresMap(sectores)
      exportToExcel(data.map((a) => mapAfiliado(a, sectoresMap)), `afiliados_${fechaInicio}_${fechaFin}`, 'Por Fecha')
    } catch (err: any) {
      alert('Error al exportar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPorSector = async () => {
    if (!sectorId) {
      alert('Selecciona un sector')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('afiliados')
        .select('*')
        .eq('sector_id', sectorId)
        .order('primer_apellido')

      if (error) throw error
      if (!data?.length) {
        alert('No hay afiliados en ese sector')
        return
      }

      const sectorNombre = sectores.find((s) => s.id === Number(sectorId))?.nombre || 'sector'
      const sectoresMap = buildSectoresMap(sectores)
      exportToExcel(data.map((a) => mapAfiliado(a, sectoresMap)), `afiliados_sector_${sectorNombre}`, 'Por Sector')
    } catch (err: any) {
      alert('Error al exportar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPorAfiliadoPor = async () => {
    if (!afiliadoPor) {
      alert('Selecciona quién afilió')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('afiliados')
        .select('*')
        .eq('afiliado_por', afiliadoPor)
        .order('primer_apellido')

      if (error) throw error
      if (!data?.length) {
        alert('No hay afiliados para ese filtro')
        return
      }

      const sectoresMap = buildSectoresMap(sectores)
      exportToExcel(data.map((a) => mapAfiliado(a, sectoresMap)), `afiliados_por_${afiliadoPor}`, 'Por Afiliado Por')
    } catch (err: any) {
      alert('Error al exportar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--fondo)' }}>
      <NavBar rol={rol} />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-lg font-bold" style={{ color: '#004466' }}>Reportes</h1>

        <div className="bg-white rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-borde)' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#004466' }}>Afiliados por fecha</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs mb-1 text-gray-500">Desde</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-sm"
                style={{ borderColor: 'var(--color-borde)' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-500">Hasta</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-sm"
                style={{ borderColor: 'var(--color-borde)' }}
              />
            </div>
            <button
              onClick={handleExportPorFecha}
              disabled={loading}
              className="text-xs px-3 py-2 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ background: '#004466' }}>
              Exportar Excel
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-borde)' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#004466' }}>Afiliados por sector</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <select
              value={sectorId}
              onChange={(e) => setSectorId(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm"
              style={{ borderColor: 'var(--color-borde)' }}>
              <option value="">Selecciona sector</option>
              {sectores.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            <button
              onClick={handleExportPorSector}
              disabled={loading}
              className="text-xs px-3 py-2 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ background: '#004466' }}>
              Exportar Excel
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-borde)' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#004466' }}>Afiliados por "Afiliado por"</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <select
              value={afiliadoPor}
              onChange={(e) => setAfiliadoPor(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm"
              style={{ borderColor: 'var(--color-borde)' }}>
              <option value="">Selecciona</option>
              {afiliadoPorOptions.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
            <button
              onClick={handleExportPorAfiliadoPor}
              disabled={loading}
              className="text-xs px-3 py-2 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ background: '#004466' }}>
              Exportar Excel
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
