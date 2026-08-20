'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  supabase,
  type Perfil,
  type Reunion,
  type InventarioProducto,
  type InventarioIngreso,
  type InventarioEntrega,
  type InventarioStockActual,
  type InventarioCostoPorColaborador,
} from '@/lib/supabase'
import NavBar from '@/components/NavBar'

type Vista = 'stock' | 'ingresos' | 'entregas' | 'reporte'

function hoyISO() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

const formatMoneda = (n: number | null | undefined) =>
  `Q${(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatFecha = (f?: string | null) => {
  if (!f) return '—'
  try {
    return new Date(f + 'T00:00:00').toLocaleDateString('es-GT')
  } catch {
    return f
  }
}

export default function InventarioPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<Vista>('stock')
  const [error, setError] = useState('')

  const [productos, setProductos] = useState<InventarioProducto[]>([])
  const [stock, setStock] = useState<InventarioStockActual[]>([])
  const [ingresos, setIngresos] = useState<InventarioIngreso[]>([])
  const [entregas, setEntregas] = useState<InventarioEntrega[]>([])
  const [reporte, setReporte] = useState<InventarioCostoPorColaborador[]>([])
  const [colaboradores, setColaboradores] = useState<Perfil[]>([])
  const [reuniones, setReuniones] = useState<Reunion[]>([])

  const [mostrarFormProducto, setMostrarFormProducto] = useState(false)
  const [formProducto, setFormProducto] = useState({ nombre: '', categoria: '', unidad_medida: '', costo_unitario: '' })
  const [guardandoProducto, setGuardandoProducto] = useState(false)

  const [mostrarFormIngreso, setMostrarFormIngreso] = useState(false)
  const [formIngreso, setFormIngreso] = useState({ producto_id: '', cantidad: '', costo_unitario: '', proveedor: '', notas: '', fecha: hoyISO() })
  const [guardandoIngreso, setGuardandoIngreso] = useState(false)

  const [mostrarFormEntrega, setMostrarFormEntrega] = useState(false)
  const [formEntrega, setFormEntrega] = useState({ producto_id: '', perfil_id: '', cantidad: '', costo_unitario: '', reunion_id: '', notas: '', fecha: hoyISO() })
  const [guardandoEntrega, setGuardandoEntrega] = useState(false)

  const [devoluciones, setDevoluciones] = useState<Record<number, string>>({})
  const [guardandoDevolucion, setGuardandoDevolucion] = useState<number | null>(null)

  const cargarTodo = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: prodData },
        { data: stockData },
        { data: ingData },
        { data: entData },
        { data: repData },
        { data: colData },
        { data: reuData },
      ] = await Promise.all([
        supabase.from('inventario_productos').select('*').order('nombre'),
        supabase.from('inventario_stock_actual').select('*').order('nombre'),
        supabase.from('inventario_ingresos').select('*, inventario_productos(nombre, unidad_medida)').order('fecha', { ascending: false }).order('id', { ascending: false }).limit(200),
        supabase.from('inventario_entregas').select('*, inventario_productos(nombre, unidad_medida), perfiles(nombre_completo, email), reuniones(titulo)').order('fecha', { ascending: false }).order('id', { ascending: false }).limit(200),
        supabase.from('inventario_costo_por_colaborador').select('*').order('costo_neto_entregado', { ascending: false }),
        supabase.from('perfiles').select('*').order('nombre_completo'),
        supabase.from('reuniones').select('*').order('fecha', { ascending: false }).limit(100),
      ])
      setProductos(prodData || [])
      setStock(stockData || [])
      setIngresos((ingData as any) || [])
      setEntregas((entData as any) || [])
      setReporte(repData || [])
      setColaboradores(colData || [])
      setReuniones(reuData || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (p) setPerfil(p)
      if (p?.rol !== 'admin') { router.replace('/'); return }
      await cargarTodo()
    }
    init()
  }, [router, cargarTodo])

  const productosActivos = productos.filter((p) => p.activo)

  const crearProducto = async () => {
    setError('')
    if (!formProducto.nombre.trim()) { setError('El nombre del producto es obligatorio.'); return }
    setGuardandoProducto(true)
    const { error: err } = await supabase.from('inventario_productos').insert({
      nombre: formProducto.nombre.trim(),
      categoria: formProducto.categoria.trim() || null,
      unidad_medida: formProducto.unidad_medida.trim() || null,
      costo_unitario: parseFloat(formProducto.costo_unitario || '0') || 0,
    })
    setGuardandoProducto(false)
    if (err) { setError('Error al crear el producto: ' + err.message); return }
    setFormProducto({ nombre: '', categoria: '', unidad_medida: '', costo_unitario: '' })
    setMostrarFormProducto(false)
    await cargarTodo()
  }

  const toggleActivoProducto = async (p: InventarioProducto) => {
    await supabase.from('inventario_productos').update({ activo: !p.activo }).eq('id', p.id)
    await cargarTodo()
  }

  const handleProductoIngresoChange = (id: string) => {
    const prod = productos.find((p) => String(p.id) === id)
    setFormIngreso((prev) => ({ ...prev, producto_id: id, costo_unitario: prod ? String(prod.costo_unitario) : prev.costo_unitario }))
  }

  const crearIngreso = async () => {
    setError('')
    if (!formIngreso.producto_id) { setError('Selecciona un producto.'); return }
    const cantidad = parseFloat(formIngreso.cantidad)
    if (!cantidad || cantidad <= 0) { setError('La cantidad debe ser mayor a 0.'); return }
    setGuardandoIngreso(true)
    const { error: err } = await supabase.from('inventario_ingresos').insert({
      producto_id: parseInt(formIngreso.producto_id),
      cantidad,
      costo_unitario: parseFloat(formIngreso.costo_unitario || '0') || 0,
      proveedor: formIngreso.proveedor.trim() || null,
      notas: formIngreso.notas.trim() || null,
      fecha: formIngreso.fecha,
      creado_por: perfil?.id,
    })
    setGuardandoIngreso(false)
    if (err) { setError('Error al registrar el ingreso: ' + err.message); return }
    setFormIngreso({ producto_id: '', cantidad: '', costo_unitario: '', proveedor: '', notas: '', fecha: hoyISO() })
    setMostrarFormIngreso(false)
    await cargarTodo()
  }

  const handleProductoEntregaChange = (id: string) => {
    const prod = productos.find((p) => String(p.id) === id)
    setFormEntrega((prev) => ({ ...prev, producto_id: id, costo_unitario: prod ? String(prod.costo_unitario) : prev.costo_unitario }))
  }

  const crearEntrega = async () => {
    setError('')
    if (!formEntrega.producto_id) { setError('Selecciona un producto.'); return }
    if (!formEntrega.perfil_id) { setError('Selecciona a quién se le entrega.'); return }
    const cantidad = parseFloat(formEntrega.cantidad)
    if (!cantidad || cantidad <= 0) { setError('La cantidad debe ser mayor a 0.'); return }
    setGuardandoEntrega(true)
    const { error: err } = await supabase.from('inventario_entregas').insert({
      producto_id: parseInt(formEntrega.producto_id),
      perfil_id: formEntrega.perfil_id,
      cantidad,
      costo_unitario: parseFloat(formEntrega.costo_unitario || '0') || 0,
      reunion_id: formEntrega.reunion_id ? parseInt(formEntrega.reunion_id) : null,
      notas: formEntrega.notas.trim() || null,
      fecha: formEntrega.fecha,
      entregado_por: perfil?.id,
    })
    setGuardandoEntrega(false)
    if (err) { setError('Error al registrar la entrega: ' + err.message); return }
    setFormEntrega({ producto_id: '', perfil_id: '', cantidad: '', costo_unitario: '', reunion_id: '', notas: '', fecha: hoyISO() })
    setMostrarFormEntrega(false)
    await cargarTodo()
  }

  const registrarDevolucion = async (entrega: InventarioEntrega) => {
    setError('')
    const valor = parseFloat(devoluciones[entrega.id] || '')
    if (!valor || valor <= 0) { setError('Ingresa una cantidad de devolución válida.'); return }
    const disponibleParaDevolver = entrega.cantidad - entrega.cantidad_devuelta
    if (valor > disponibleParaDevolver) { setError(`No puedes devolver más de ${disponibleParaDevolver} (lo ya entregado y no devuelto).`); return }
    setGuardandoDevolucion(entrega.id)
    const { error: err } = await supabase
      .from('inventario_entregas')
      .update({ cantidad_devuelta: entrega.cantidad_devuelta + valor })
      .eq('id', entrega.id)
    setGuardandoDevolucion(null)
    if (err) { setError('Error al registrar la devolución: ' + err.message); return }
    setDevoluciones((prev) => ({ ...prev, [entrega.id]: '' }))
    await cargarTodo()
  }

  const thBase = "text-left px-3 py-2 font-semibold whitespace-nowrap"
  const inputField = "input-field"

  const totalCostoStock = stock.reduce((acc, s) => acc + s.stock_actual * s.costo_unitario, 0)

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
        <NavBar rol={perfil?.rol || ''} />
        <div className="max-w-7xl mx-auto px-4 py-10 text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#004466' }}></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <NavBar rol={perfil?.rol || ''} />
      <header className="bg-white border-b shadow-sm sticky top-0 z-10" style={{ borderColor: 'var(--color-borde)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#004466' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-sm" style={{ color: '#004466' }}>Inventario</h1>
              <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>Control de insumos de la sede</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {([
              { key: 'stock', label: 'Stock y productos' },
              { key: 'ingresos', label: 'Ingresos' },
              { key: 'entregas', label: 'Entregas' },
              { key: 'reporte', label: 'Costo por colaborador' },
            ] as { key: Vista; label: string }[]).map((t) => (
              <button
                key={t.key}
                onClick={() => setVista(t.key)}
                className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all"
                style={vista === t.key
                  ? { background: '#004466', color: 'white', borderColor: '#004466' }
                  : { background: 'white', color: 'var(--texto-secundario)', borderColor: 'var(--color-borde)' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="card" style={{ borderColor: '#9b1c3a', background: '#fef2f2' }}>
            <p className="text-sm" style={{ color: '#9b1c3a' }}>{error}</p>
          </div>
        )}

        {vista === 'stock' && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-medium" style={{ color: 'var(--texto-secundario)' }}>
                {stock.length} producto{stock.length !== 1 ? 's' : ''} · Valor total en stock: {formatMoneda(totalCostoStock)}
              </p>
              <button
                onClick={() => setMostrarFormProducto((v) => !v)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                style={{ background: '#004466' }}>
                {mostrarFormProducto ? 'Cancelar' : '+ Nuevo producto'}
              </button>
            </div>

            {mostrarFormProducto && (
              <div className="card space-y-3">
                <p className="text-sm font-semibold" style={{ color: 'var(--texto-principal)' }}>Nuevo producto</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input className={inputField} placeholder="Nombre" value={formProducto.nombre} onChange={(e) => setFormProducto({ ...formProducto, nombre: e.target.value })} />
                  <input className={inputField} placeholder="Categoría" value={formProducto.categoria} onChange={(e) => setFormProducto({ ...formProducto, categoria: e.target.value })} />
                  <input className={inputField} placeholder="Unidad de medida" value={formProducto.unidad_medida} onChange={(e) => setFormProducto({ ...formProducto, unidad_medida: e.target.value })} />
                  <input className={inputField} type="number" step="0.01" placeholder="Costo unitario" value={formProducto.costo_unitario} onChange={(e) => setFormProducto({ ...formProducto, costo_unitario: e.target.value })} />
                </div>
                <button onClick={crearProducto} disabled={guardandoProducto} className="text-sm px-4 py-1.5 rounded-lg font-semibold text-white disabled:opacity-50" style={{ background: '#166534' }}>
                  {guardandoProducto ? 'Guardando...' : 'Guardar producto'}
                </button>
              </div>
            )}

            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#f0f6f9', borderBottom: '1px solid var(--color-borde)' }}>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Producto</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Categoría</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Unidad</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Costo unitario</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Ingresado</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Entregado neto</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Stock actual</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Valor en stock</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-8 text-sm" style={{ color: 'var(--texto-secundario)' }}>Todavía no hay productos registrados.</td></tr>
                  ) : (
                    stock.map((s, idx) => {
                      const prod = productos.find((p) => p.id === s.producto_id)
                      return (
                        <tr key={s.producto_id} className="border-b" style={{ borderColor: 'var(--color-borde)', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                          <td className="px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--texto-principal)' }}>{s.nombre}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{s.categoria || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{s.unidad_medida || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{formatMoneda(s.costo_unitario)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{s.total_ingresado}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{s.total_entregado_neto}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-semibold" style={{ color: s.stock_actual < 0 ? '#9b1c3a' : 'var(--texto-principal)' }}>{s.stock_actual}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{formatMoneda(s.stock_actual * s.costo_unitario)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {prod && (
                              <button
                                onClick={() => toggleActivoProducto(prod)}
                                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={s.activo ? { background: '#dcfce7', color: '#166534' } : { background: '#f3f4f6', color: 'var(--texto-secundario)' }}>
                                {s.activo ? 'Activo' : 'Inactivo'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {vista === 'ingresos' && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-medium" style={{ color: 'var(--texto-secundario)' }}>
                {ingresos.length} ingreso{ingresos.length !== 1 ? 's' : ''} recientes
              </p>
              <button
                onClick={() => setMostrarFormIngreso((v) => !v)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                style={{ background: '#004466' }}>
                {mostrarFormIngreso ? 'Cancelar' : '+ Nuevo ingreso'}
              </button>
            </div>

            {mostrarFormIngreso && (
              <div className="card space-y-3">
                <p className="text-sm font-semibold" style={{ color: 'var(--texto-principal)' }}>Nuevo ingreso de stock</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select className={inputField} value={formIngreso.producto_id} onChange={(e) => handleProductoIngresoChange(e.target.value)}>
                    <option value="">Selecciona un producto...</option>
                    {productosActivos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <input className={inputField} type="number" step="0.01" placeholder="Cantidad" value={formIngreso.cantidad} onChange={(e) => setFormIngreso({ ...formIngreso, cantidad: e.target.value })} />
                  <input className={inputField} type="number" step="0.01" placeholder="Costo unitario" value={formIngreso.costo_unitario} onChange={(e) => setFormIngreso({ ...formIngreso, costo_unitario: e.target.value })} />
                  <input className={inputField} placeholder="Proveedor" value={formIngreso.proveedor} onChange={(e) => setFormIngreso({ ...formIngreso, proveedor: e.target.value })} />
                  <input className={inputField} type="date" value={formIngreso.fecha} onChange={(e) => setFormIngreso({ ...formIngreso, fecha: e.target.value })} />
                  <input className={inputField} placeholder="Notas (opcional)" value={formIngreso.notas} onChange={(e) => setFormIngreso({ ...formIngreso, notas: e.target.value })} />
                </div>
                <button onClick={crearIngreso} disabled={guardandoIngreso} className="text-sm px-4 py-1.5 rounded-lg font-semibold text-white disabled:opacity-50" style={{ background: '#166534' }}>
                  {guardandoIngreso ? 'Guardando...' : 'Guardar ingreso'}
                </button>
              </div>
            )}

            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#f0f6f9', borderBottom: '1px solid var(--color-borde)' }}>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Fecha</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Producto</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Cantidad</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Costo unitario</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Costo total</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Proveedor</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {ingresos.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-sm" style={{ color: 'var(--texto-secundario)' }}>Todavía no hay ingresos registrados.</td></tr>
                  ) : (
                    ingresos.map((ing, idx) => (
                      <tr key={ing.id} className="border-b" style={{ borderColor: 'var(--color-borde)', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatFecha(ing.fecha)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-semibold" style={{ color: 'var(--texto-principal)' }}>{ing.inventario_productos?.nombre || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{ing.cantidad} {ing.inventario_productos?.unidad_medida || ''}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatMoneda(ing.costo_unitario)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatMoneda(ing.cantidad * ing.costo_unitario)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{ing.proveedor || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{ing.notas || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {vista === 'entregas' && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-medium" style={{ color: 'var(--texto-secundario)' }}>
                {entregas.length} entrega{entregas.length !== 1 ? 's' : ''} recientes
              </p>
              <button
                onClick={() => setMostrarFormEntrega((v) => !v)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                style={{ background: '#004466' }}>
                {mostrarFormEntrega ? 'Cancelar' : '+ Nueva entrega'}
              </button>
            </div>

            {mostrarFormEntrega && (
              <div className="card space-y-3">
                <p className="text-sm font-semibold" style={{ color: 'var(--texto-principal)' }}>Nueva entrega</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select className={inputField} value={formEntrega.producto_id} onChange={(e) => handleProductoEntregaChange(e.target.value)}>
                    <option value="">Selecciona un producto...</option>
                    {productosActivos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <select className={inputField} value={formEntrega.perfil_id} onChange={(e) => setFormEntrega({ ...formEntrega, perfil_id: e.target.value })}>
                    <option value="">¿A quién se entrega?</option>
                    {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nombre_completo || c.email}</option>)}
                  </select>
                  <input className={inputField} type="number" step="0.01" placeholder="Cantidad" value={formEntrega.cantidad} onChange={(e) => setFormEntrega({ ...formEntrega, cantidad: e.target.value })} />
                  <input className={inputField} type="number" step="0.01" placeholder="Costo unitario" value={formEntrega.costo_unitario} onChange={(e) => setFormEntrega({ ...formEntrega, costo_unitario: e.target.value })} />
                  <select className={inputField} value={formEntrega.reunion_id} onChange={(e) => setFormEntrega({ ...formEntrega, reunion_id: e.target.value })}>
                    <option value="">Sin actividad asociada</option>
                    {reuniones.map((r) => <option key={r.id} value={r.id}>{r.titulo} — {formatFecha(r.fecha)}</option>)}
                  </select>
                  <input className={inputField} type="date" value={formEntrega.fecha} onChange={(e) => setFormEntrega({ ...formEntrega, fecha: e.target.value })} />
                  <input className={inputField} placeholder="Notas (opcional)" value={formEntrega.notas} onChange={(e) => setFormEntrega({ ...formEntrega, notas: e.target.value })} />
                </div>
                <button onClick={crearEntrega} disabled={guardandoEntrega} className="text-sm px-4 py-1.5 rounded-lg font-semibold text-white disabled:opacity-50" style={{ background: '#166534' }}>
                  {guardandoEntrega ? 'Guardando...' : 'Guardar entrega'}
                </button>
              </div>
            )}

            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#f0f6f9', borderBottom: '1px solid var(--color-borde)' }}>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Fecha</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Producto</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Colaborador</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Actividad</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Entregado</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Devuelto</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Neto</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Costo neto</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Registrar devolución</th>
                  </tr>
                </thead>
                <tbody>
                  {entregas.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-8 text-sm" style={{ color: 'var(--texto-secundario)' }}>Todavía no hay entregas registradas.</td></tr>
                  ) : (
                    entregas.map((e, idx) => {
                      const neto = e.cantidad - e.cantidad_devuelta
                      const disponible = neto
                      return (
                        <tr key={e.id} className="border-b" style={{ borderColor: 'var(--color-borde)', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                          <td className="px-3 py-2.5 whitespace-nowrap">{formatFecha(e.fecha)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-semibold" style={{ color: 'var(--texto-principal)' }}>{e.inventario_productos?.nombre || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{e.perfiles?.nombre_completo || e.perfiles?.email || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{e.reuniones?.titulo || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{e.cantidad}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{e.cantidad_devuelta}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-semibold">{neto}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{formatMoneda(neto * e.costo_unitario)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {disponible > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-20 text-xs border rounded px-2 py-1"
                                  style={{ borderColor: 'var(--color-borde)' }}
                                  placeholder="Cant."
                                  value={devoluciones[e.id] || ''}
                                  onChange={(ev) => setDevoluciones((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                                />
                                <button
                                  onClick={() => registrarDevolucion(e)}
                                  disabled={guardandoDevolucion === e.id}
                                  className="text-xs px-2 py-1 rounded-lg font-semibold text-white disabled:opacity-50"
                                  style={{ background: '#004466' }}>
                                  {guardandoDevolucion === e.id ? '...' : 'Registrar'}
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs" style={{ color: 'var(--texto-secundario)' }}>Completo</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {vista === 'reporte' && (
          <>
            <p className="text-sm font-medium" style={{ color: 'var(--texto-secundario)' }}>
              Estimado de producto entregado a cada colaborador (valorizado a costo unitario histórico)
            </p>
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#f0f6f9', borderBottom: '1px solid var(--color-borde)' }}>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Colaborador</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>N.° entregas</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Costo bruto entregado</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Costo devuelto</th>
                    <th className={thBase} style={{ color: 'var(--texto-secundario)' }}>Costo neto entregado</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-sm" style={{ color: 'var(--texto-secundario)' }}>Todavía no hay entregas registradas.</td></tr>
                  ) : (
                    reporte.map((r, idx) => (
                      <tr key={r.perfil_id} className="border-b" style={{ borderColor: 'var(--color-borde)', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                        <td className="px-3 py-2.5 whitespace-nowrap font-semibold" style={{ color: 'var(--texto-principal)' }}>{r.nombre_completo || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{r.num_entregas}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatMoneda(r.costo_bruto_entregado)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatMoneda(r.costo_devuelto)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-semibold" style={{ color: '#004466' }}>{formatMoneda(r.costo_neto_entregado)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
