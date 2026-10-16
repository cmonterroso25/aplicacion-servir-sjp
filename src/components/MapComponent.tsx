'use client'

import { useEffect, useRef, useState } from 'react'
import { loadGeoDataForMap } from '@/lib/geoData'
import { supabase } from '@/lib/supabase'

interface MapComponentProps {
  onSelectedSectorChange?: (sector: string | null) => void
}

interface TooltipData {
  nombre: string
  encargado?: string
  coordinadores?: number
  x: number
  y: number
}

interface SectorInfo {
  nombre: string
  encargado?: string
  afiliados: number
  color: string
}

const SECTORES_AMARILLOS = [
  'Residenciales San José',
  'Residenciales San Jose',
]

// Sectores que pertenecen a Aldea San Luis (misma familia de color)
const SECTORES_ALDEA_SAN_LUIS = [
  'San Luis Letrán',
  'San Luis Puerta Negra',
  'Los de a 20',
  'Aldea San Luis',
]

const SECTORES_CASCO_URBANO_COLORS = ['Zona 1', 'Zona 2', 'Zona 3', 'Zona 4', 'Colonia Santa Sofía']
const COLOR_CASCO_URBANO = '#d32f2f' // Rojo

// Mapeo de nombres del KML a nombres en Supabase
const NOMBRE_SUPABASE_MAP: Record<string, string> = {
  'Aldea Las Anonas': 'Las Anonas',
  'Aldea Ciénaga Grande': 'Cienaga Grande',
  'Aldea Santa Inés Pinula': 'Santa Ines Pinula',
  'Aldea El Platanar': 'El Platanar',
  'Aldea Santa Rita': 'Santa Rita',
  'Aldea Contreras': 'Contreras',
  'Aldea Concepción Pinula': 'Concepcion Pinula',
  'Aldea San Luis': 'San Luis',
  'Colonia Santa Sofía': 'Colonia Santa Sofia',
  'Montecristo Í': 'Montecristo',
  'Zona 1': 'Casco Urbano 1 y 3',
  'Zona 3': 'Casco Urbano 1 y 3',
  'Zona 2': 'Casco Urbano 2 y 4',
  'Zona 4': 'Casco Urbano 2 y 4',
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function getNombreSupabase(nombreKml: string): string {
  return NOMBRE_SUPABASE_MAP[nombreKml] || nombreKml
}

function findSupabaseSector(kmlName: string, supabaseList: any[]): any {
  // Primero intentar coincidencia exacta con mapeo
  const mapped = getNombreSupabase(kmlName)
  const exact = supabaseList.find(s => s.nombre === mapped)
  if (exact) return exact

  // Si no, intentar coincidencia exacta directa
  const direct = supabaseList.find(s => s.nombre === kmlName)
  if (direct) return direct

  // Si no, intentar búsqueda normalizada (sin acentos)
  const normalizedKml = normalizeString(kmlName)
  const normalized = supabaseList.find(s => normalizeString(s.nombre) === normalizedKml)
  if (normalized) return normalized

  return null
}

function getSectorColor(color: string, sectorName: string): string {
  const c = color.toLowerCase()
  const normalizedName = sectorName.trim().toLowerCase()

  // Si es un sector del casco urbano, devolverlo en rojo
  const isCascoUrbano = SECTORES_CASCO_URBANO_COLORS.some(s =>
    s.trim().toLowerCase() === normalizedName
  )
  if (isCascoUrbano) {
    return COLOR_CASCO_URBANO
  }

  // Si es un sector que debe ser amarillo (pero NO Aldea San Luis), devolverlo en amarillo
  const isAmarillo = SECTORES_AMARILLOS.some(s =>
    s.trim().toLowerCase() === normalizedName
  )
  if (isAmarillo) {
    return '#fbc02d'
  }

  // Si es amarillo pero NO está en la lista, cambiar a azul
  if (c === '#fbc02d' || c === '#ffb300' || c === '#ffc107' || c === '#ffa500') {
    return '#42a5f5'
  }

  return color
}

function darkenColor(color: string, amount: number = 0.3): string {
  const hex = color.replace('#', '')
  const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - Math.floor(255 * amount))
  const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - Math.floor(255 * amount))
  const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - Math.floor(255 * amount))
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

function calculateBounds(features: any[]): { minLon: number; maxLon: number; minLat: number; maxLat: number } {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity

  features.forEach((feature) => {
    if (feature.geometry?.type === 'Polygon' && feature.geometry.coordinates) {
      feature.geometry.coordinates[0]?.forEach(([lon, lat]: [number, number]) => {
        minLon = Math.min(minLon, lon)
        maxLon = Math.max(maxLon, lon)
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
      })
    }
  })

  return { minLon, maxLon, minLat, maxLat }
}

function coordinatesToPath(coords: [number, number][], activeBounds: any, width: number, height: number): string {
  const padding = 20
  const availWidth = width - padding * 2
  const availHeight = height - padding * 2

  const lonRange = activeBounds.maxLon - activeBounds.minLon || 1
  const latRange = activeBounds.maxLat - activeBounds.minLat || 1

  // Usar escala uniforme para no distorsionar
  const scaleX = availWidth / lonRange
  const scaleY = availHeight / latRange
  const scale = Math.min(scaleX, scaleY) * 1.0

  const centerX = padding + availWidth / 2
  const centerY = padding + availHeight / 2
  const centerLon = (activeBounds.minLon + activeBounds.maxLon) / 2
  const centerLat = (activeBounds.minLat + activeBounds.maxLat) / 2

  return coords
    .map(([lon, lat], i) => {
      const x = centerX + (lon - centerLon) * scale
      const y = centerY - (lat - centerLat) * scale
      return `${i === 0 ? 'M' : 'L'} ${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`
    })
    .join(' ') + ' Z'
}

export default function MapComponent({ onSelectedSectorChange }: MapComponentProps) {
  const svgContainer = useRef<HTMLDivElement>(null)

  const [mapData, setMapData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sectores, setSectores] = useState<string[]>([])
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [sectorInfo, setSectorInfo] = useState<SectorInfo | null>(null)
  const [hoveredSector, setHoveredSector] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [bounds, setBounds] = useState<any>(null)
  const [filteredBounds, setFilteredBounds] = useState<any>(null)
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 })
  const [filterMode, setFilterMode] = useState<'all' | 'urbana' | 'casco'>('all')
  const [coordinadoresPorNombre, setCoordinadoresPorNombre] = useState<Record<string, number>>({})
  const [viewMode, setViewMode] = useState<'coordinadores' | 'afiliados'>('coordinadores')
  const [afiliadosPorNombre, setAfiliadosPorNombre] = useState<Record<string, number>>({})
  const [selectedView, setSelectedView] = useState<string>('coordinadores-all')
  const [isMobile, setIsMobile] = useState(false)
  const sectorColorMap = useRef<Record<string, string>>({})
  const sectorEncargadoMap = useRef<Record<string, string>>({})
  const sectorSupabaseIdMap = useRef<Record<string, number>>({})
  const sectorAfiliadosMap = useRef<Record<string, number>>({})

  const SECTORES_EXCLUIDOS_URBANA = ['Aldea Santa Rita', 'Aldea Contreras', 'Parte Alta', 'Aldea Concepción Pinula', 'Municipio San José Pinula', 'Reserva del Bosque']
  const SECTORES_CASCO_URBANO = ['Zona 1', 'Zona 2', 'Zona 3', 'Zona 4', 'Colonia Santa Sofía']

  const getSectoresVisibles = () => {
    if (filterMode === 'urbana') {
      return sectores.filter(s => !SECTORES_EXCLUIDOS_URBANA.includes(s))
    }
    if (filterMode === 'casco') {
      return SECTORES_CASCO_URBANO.filter(s => sectores.includes(s))
    }
    return sectores
  }

  const calcularBoundsParaSectores = (sectorNames: string[]) => {
    if (!mapData?.features || sectorNames.length === 0) return null
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
    let foundAny = false

    mapData.features.forEach((feature: any) => {
      const name = feature.properties?.name
      if (sectorNames.includes(name) && feature.geometry?.type === 'Polygon' && feature.geometry.coordinates?.[0]) {
        foundAny = true
        feature.geometry.coordinates[0].forEach(([lon, lat]: [number, number]) => {
          minLon = Math.min(minLon, lon)
          maxLon = Math.max(maxLon, lon)
          minLat = Math.min(minLat, lat)
          maxLat = Math.max(maxLat, lat)
        })
      }
    })

    return foundAny ? { minLon, maxLon, minLat, maxLat } : null
  }

  useEffect(() => {
    const loadSectorInfo = async () => {
      if (!selectedSector || !mapData) return

      try {
        const feature = mapData.features?.find((f: any) => f.properties?.name === selectedSector)
        if (!feature) return

        const encargado = sectorEncargadoMap.current[selectedSector]
        const afiliadosCount = sectorAfiliadosMap.current[selectedSector] || 0

        setSectorInfo({
          nombre: selectedSector,
          encargado: encargado || undefined,
          afiliados: afiliadosCount,
          color: sectorColorMap.current[selectedSector] || '#42a5f5',
        })
      } catch (error) {
        console.error('Error loading sector info:', error)
        setSectorInfo({
          nombre: selectedSector,
          afiliados: 0,
          color: sectorColorMap.current[selectedSector] || '#42a5f5',
        })
      }
    }

    loadSectorInfo()
  }, [selectedSector, mapData])

  useEffect(() => {
    const handleResize = () => {
      if (svgContainer.current) {
        setSvgDimensions({
          width: svgContainer.current.clientWidth,
          height: svgContainer.current.clientHeight,
        })
      }
      setIsMobile(window.innerWidth < 640)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Cargar información de encargados y afiliados
  useEffect(() => {
    console.log('useEffect loadEncargadosAndAfiliados ejecutado, sectores.length:', sectores.length)
    const loadEncargadosAndAfiliados = async () => {
      if (sectores.length === 0) {
        console.log('Sectores vacíos, retornando')
        return
      }

      try {
        const { data: sectoresData } = await supabase
          .from('sectores')
          .select('id, nombre, encargado_nombre')

        sectorEncargadoMap.current = {}
        sectorSupabaseIdMap.current = {}
        sectorAfiliadosMap.current = {}

        // Crear mapeo inverso del NOMBRE_SUPABASE_MAP
        const supabaseToKmlMap: Record<string, string> = {}
        Object.entries(NOMBRE_SUPABASE_MAP).forEach(([kmlName, supabaseNombre]) => {
          supabaseToKmlMap[supabaseNombre] = kmlName
        })

        console.log('Sectores Supabase cargados:', sectoresData?.length, sectoresData?.map((s: any) => s.nombre))
        console.log('Sectores KML:', sectores)

        // Procesar cada sector del KML
        const sectorIds = new Set<number>()
        sectores.forEach((kmlSectorName: string) => {
          const supabaseData = findSupabaseSector(kmlSectorName, sectoresData || [])

          if (supabaseData) {
            console.log(`Matched: "${kmlSectorName}" -> "${supabaseData.nombre}"`)
            if (supabaseData.id) sectorIds.add(supabaseData.id)

            if (supabaseData.encargado_nombre) {
              sectorEncargadoMap.current[kmlSectorName] = supabaseData.encargado_nombre
            }

            if (supabaseData.id) {
              sectorSupabaseIdMap.current[kmlSectorName] = supabaseData.id
            }
          } else {
            console.log(`No match found for: "${kmlSectorName}"`)
          }
        })

        // Cargar afiliados por sector
        if (sectorIds.size > 0) {
          const sectorIdArray = Array.from(sectorIds)
          const { data: afiliadosData } = await supabase
            .from('afiliados')
            .select('sector_id')
            .in('sector_id', sectorIdArray)

          // Contar afiliados por ID
          const afiliadosPorId: Record<number, number> = {}
          afiliadosData?.forEach((a: any) => {
            if (a.sector_id) {
              afiliadosPorId[a.sector_id] = (afiliadosPorId[a.sector_id] || 0) + 1
            }
          })

          // Asignar conteo a cada sector del KML
          sectores.forEach((kmlSectorName: string) => {
            const sectorId = sectorSupabaseIdMap.current[kmlSectorName]
            if (sectorId) {
              sectorAfiliadosMap.current[kmlSectorName] = afiliadosPorId[sectorId] || 0
            }
          })
        }
      } catch (error) {
        console.error('Error loading encargados and afiliados:', error)
      }
    }

    loadEncargadosAndAfiliados()
  }, [sectores])

  // Cargar coordinadores por sector
  useEffect(() => {
    const loadCoordinadores = async () => {
      try {
        const response = await fetch('/api/coordinadores-mapa')
        const data = await response.json()
        console.log('Coordinadores cargados:', data.porNombre)
        setCoordinadoresPorNombre(data.porNombre || {})
      } catch (error) {
        console.error('Error loading coordinadores:', error)
      }
    }
    loadCoordinadores()
  }, [])

  // Cargar afiliados por sector
  useEffect(() => {
    const loadAfiliados = async () => {
      try {
        const response = await fetch('/api/afiliados-por-sector')
        const data = await response.json()
        console.log('Afiliados cargados:', data.afiliadosPorNombre)
        setAfiliadosPorNombre(data.afiliadosPorNombre || {})
      } catch (error) {
        console.error('Error loading afiliados:', error)
      }
    }
    loadAfiliados()
  }, [])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const data = await loadGeoDataForMap()
        setMapData(data)

        if (data && data.features && data.features.length > 0) {
          const sectorNames = data.features
            .map((f: any) => f.properties?.name)
            .filter((name: any) => name)
            .sort()
          setSectores(sectorNames)

          // Calcular bounds y colores
          const calculatedBounds = calculateBounds(data.features)
          setBounds(calculatedBounds)

          // Asignar colores
          sectorColorMap.current = {}
          data.features.forEach((f: any) => {
            const name = f.properties?.name
            if (name) {
              let color = f.properties?.color || '#42a5f5'
              color = getSectorColor(color, name)
              sectorColorMap.current[name] = color
            }
          })

          // Aplicar el mismo color azul a todos los sectores de Aldea San Luis
          const aldeasanluisColor = sectorColorMap.current['Aldea San Luis'] || '#42a5f5'
          sectorColorMap.current['San Luis Puerta Negra'] = aldeasanluisColor
          sectorColorMap.current['San Luis Letrán'] = aldeasanluisColor
          sectorColorMap.current['Los de a 20'] = aldeasanluisColor
        }
      } catch (error) {
        console.error('Error in loadData:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Actualizar filteredBounds cuando cambia el filterMode
  useEffect(() => {
    if (filterMode !== 'all' && mapData) {
      const visibles = getSectoresVisibles()
      const newFilteredBounds = calcularBoundsParaSectores(visibles)
      setFilteredBounds(newFilteredBounds)
    }
  }, [filterMode, mapData, sectores])

  return (
    <div className="w-full h-full relative overflow-hidden">
      <style>{`
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(66, 165, 245, 0.3); }
          50% { box-shadow: 0 0 40px rgba(66, 165, 245, 0.6); }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .sector-info-panel {
          animation: slideIn 0.4s ease-out, glow 3s ease-in-out infinite;
        }
        .svg-container {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          background-size: 200% 200%;
          animation: shimmer 8s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .map-controls-floating {
          position: fixed;
          left: 20px;
          top: 20px;
          width: 320px;
          max-height: calc(100vh - 40px);
          overflow-y-auto;
          z-index: 1000;
        }
        .map-footer-floating {
          position: fixed;
          bottom: 20px;
          left: 20px;
          right: 20px;
          z-index: 999;
          max-width: calc(100% - 40px);
        }
        svg path {
          transition: opacity 0.2s, stroke-width 0.2s, filter 0.2s;
          cursor: pointer;
        }
        svg path:hover {
          filter: brightness(1.1);
        }
        .sector-tooltip {
          position: fixed;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 10px;
          padding: 14px 18px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), 0 0 1px rgba(0, 0, 0, 0.1);
          z-index: 1001;
          pointer-events: none;
          white-space: nowrap;
          border: 1px solid rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(10px);
          animation: slideIn 0.2s ease-out;
        }
        .sector-tooltip p {
          margin: 0;
          font-size: 14px;
          line-height: 1.4;
        }
        .sector-tooltip .nombre {
          font-weight: 600;
          color: var(--texto-principal);
        }
        .sector-tooltip .encargado {
          font-size: 12px;
          color: var(--texto-secundario);
          margin-top: 4px;
        }
      `}</style>

      {/* SVG container a pantalla completa */}
      <div
        ref={svgContainer}
        className="svg-container absolute inset-0 w-full h-full"
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="font-semibold" style={{ color: 'var(--texto-principal)' }}>
                Cargando mapa...
              </p>
            </div>
          </div>
        )}

        {!loading && mapData && bounds && svgDimensions.width > 0 && (
          <>
            {(() => {
              // Calcular bounds correctos antes de renderizar
              const visibles = getSectoresVisibles()
              console.log('Filter:', filterMode, 'Visibles:', visibles.length, visibles.slice(0, 3))

              const newBounds = filterMode !== 'all' ? calcularBoundsParaSectores(visibles) : null
              console.log('Calculated bounds:', newBounds)

              const activeBoundsComputed = filterMode !== 'all'
                ? newBounds || bounds
                : bounds

              return (
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
              preserveAspectRatio="xMidYStart slice"
            >
              <defs>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity="0.5" floodColor="#000000" />
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2" floodColor="#000000" />
                </filter>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.3"/>
                </linearGradient>
                <filter id="highlight">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
                </filter>
              </defs>

              {mapData.features?.map((feature: any, idx: number) => {
                const name = feature.properties?.name || `Sector ${idx}`
                const isVisible = visibles.includes(name)
                const baseColor = sectorColorMap.current[name] || '#42a5f5'
                const darkColor = darkenColor(baseColor, 0.4)
                const isSelected = selectedSector === name
                const isHovered = hoveredSector === name

                if (!isVisible) return null

                if (feature.geometry?.type === 'Polygon' && feature.geometry.coordinates?.[0]) {
                  const pathData = coordinatesToPath(
                    feature.geometry.coordinates[0],
                    activeBoundsComputed,
                    svgDimensions.width,
                    svgDimensions.height
                  )

                  // Calcular centroide para el texto
                  const coords = feature.geometry.coordinates[0]
                  let sumX = 0, sumY = 0
                  coords.forEach(([lon, lat]: [number, number]) => {
                    sumX += lon
                    sumY += lat
                  })
                  const centerLon = sumX / coords.length
                  const centerLat = sumY / coords.length

                  const padding = 60
                  const availWidth = svgDimensions.width - padding * 2
                  const availHeight = svgDimensions.height - padding * 2
                  const lonRange = bounds.maxLon - bounds.minLon || 1
                  const latRange = bounds.maxLat - bounds.minLat || 1
                  const scaleX = availWidth / lonRange
                  const scaleY = availHeight / latRange
                  const scale = Math.min(scaleX, scaleY) * 1.0
                  const centerX_svg = padding + availWidth / 2
                  const centerY_svg = padding + availHeight / 2
                  const centerLon_mid = (bounds.minLon + bounds.maxLon) / 2
                  const centerLat_mid = (bounds.minLat + bounds.maxLat) / 2
                  const textX = centerX_svg + (centerLon - centerLon_mid) * scale
                  const textY = centerY_svg - (centerLat - centerLat_mid) * scale

                  return (
                    <g key={idx}>
                      <path
                        d={pathData}
                        fill={baseColor}
                        fillOpacity="0.9"
                        filter="url(#shadow)"
                        style={{
                          transition: 'all 0.3s ease',
                          opacity: isHovered ? 1 : 0.85,
                        }}
                      />
                      <path
                        d={pathData}
                        fill="url(#grad)"
                        fillOpacity={isSelected ? 0.4 : isHovered ? 0.2 : 0.05}
                        pointerEvents="none"
                      />
                      <path
                        d={pathData}
                        fill="none"
                        stroke={isSelected ? '#ffffff' : darkColor}
                        strokeWidth={isSelected ? 4 : isHovered ? 3 : 2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        opacity={isSelected ? 1 : 0.8}
                        style={{
                          transition: 'all 0.3s ease',
                        }}
                      />
                      <path
                        d={pathData}
                        fill="white"
                        fillOpacity="0"
                        stroke="none"
                        onClick={() => {
                          // No mostrar panel en vista de coordinadores
                          if (viewMode !== 'coordinadores') {
                            setSelectedSector(name)
                            onSelectedSectorChange?.(name)
                          }
                        }}
                        onMouseEnter={() => {
                          setHoveredSector(name)
                        }}
                        onMouseLeave={() => {
                          setHoveredSector(null)
                          setTooltip(null)
                        }}
                        onMouseMove={(e) => {
                          const rect = svgContainer.current?.getBoundingClientRect()
                          if (rect) {
                            // Obtener número de coordinadores
                            let numCoord = coordinadoresPorNombre[name] || 0
                            if (numCoord === 0) {
                              const nombreNormalizado = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
                              numCoord = coordinadoresPorNombre[nombreNormalizado] || 0
                              if (numCoord === 0) {
                                const nombreSupabase = getNombreSupabase(name)
                                numCoord = coordinadoresPorNombre[nombreSupabase] || 0
                              }
                            }

                            setTooltip({
                              nombre: name,
                              encargado: sectorEncargadoMap.current[name],
                              coordinadores: numCoord,
                              x: e.clientX + 10,
                              y: e.clientY + 10,
                            })
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />

                    </g>
                  )
                }
                return null
              })}

              {/* Renderizar coordinadores o mapas de calor según viewMode */}
              {viewMode === 'coordinadores' && (
                <>
                  {/* Puntos verdes iluminados de coordinadores */}
                  <defs>
                    <radialGradient id="coord-gradient" cx="30%" cy="30%">
                      <stop offset="0%" stopColor="#4ade80" stopOpacity="1" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0.6" />
                    </radialGradient>
                    <filter id="coordinador-glow" x="-100%" y="-100%" width="300%" height="300%">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {mapData.features?.map((feature: any) => {
                const sectorName = feature.properties?.name
                if (!sectorName) return null

                const displayBounds = filterMode !== 'all' ? filteredBounds : bounds
                if (!displayBounds) return null

                // No renderizar coordinadores de sectores invisibles
                const visibles = getSectoresVisibles()
                if (!visibles.includes(sectorName)) return null

                // Buscar coordinadores: nombre exacto primero, luego normalizado, luego mapeo a Supabase
                let numCoordinadores = coordinadoresPorNombre[sectorName] || 0

                // Si no hay coordinadores, intentar normalizado
                if (numCoordinadores === 0) {
                  const normalizarNombre = (n: string) =>
                    n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
                  const nombreNormalizado = normalizarNombre(sectorName)
                  for (const [key, value] of Object.entries(coordinadoresPorNombre)) {
                    if (normalizarNombre(key) === nombreNormalizado) {
                      numCoordinadores = value
                      break
                    }
                  }
                }

                // Si no hay coordinadores, intentar con el nombre mapeado de Supabase
                if (numCoordinadores === 0) {
                  const nombreSupabase = getNombreSupabase(sectorName)
                  numCoordinadores = coordinadoresPorNombre[nombreSupabase] || 0
                }
                if (numCoordinadores === 0) return null

                const coords = feature.geometry?.coordinates?.[0]
                if (!coords || coords.length === 0) return null

                const padding = 60
                const availWidth = svgDimensions.width - padding * 2
                const availHeight = svgDimensions.height - padding * 2
                const lonRange = displayBounds.maxLon - displayBounds.minLon || 1
                const latRange = displayBounds.maxLat - displayBounds.minLat || 1
                const scaleX = availWidth / lonRange
                const scaleY = availHeight / latRange
                const scale = Math.min(scaleX, scaleY) * 1.0
                const centerX_coord = padding + availWidth / 2
                const centerY_coord = padding + availHeight / 2
                const centerLon_mid = (displayBounds.minLon + displayBounds.maxLon) / 2
                const centerLat_mid = (displayBounds.minLat + displayBounds.maxLat) / 2

                // Convertir coordenadas del polígono a SVG
                const polygonPoints = coords.map(([lon, lat]: [number, number]) => ({
                  x: centerX_coord + (lon - centerLon_mid) * scale,
                  y: centerY_coord - (lat - centerLat_mid) * scale,
                }))

                // Ray casting algorithm para verificar si punto está dentro del polígono
                const isPointInPolygon = (px: number, py: number): boolean => {
                  let inside = false
                  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
                    const xi = polygonPoints[i].x,
                      yi = polygonPoints[i].y
                    const xj = polygonPoints[j].x,
                      yj = polygonPoints[j].y
                    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
                    if (intersect) inside = !inside
                  }
                  return inside
                }

                // Calcular bounds del polígono
                const bounds_poly = {
                  minX: Math.min(...polygonPoints.map((p: any) => p.x)),
                  maxX: Math.max(...polygonPoints.map((p: any) => p.x)),
                  minY: Math.min(...polygonPoints.map((p: any) => p.y)),
                  maxY: Math.max(...polygonPoints.map((p: any) => p.y)),
                }

                // Generar puntos distribuidos
                const generatedPoints = []
                const cellSize = Math.sqrt((bounds_poly.maxX - bounds_poly.minX) * (bounds_poly.maxY - bounds_poly.minY) / Math.max(1, numCoordinadores * 2))

                // Primera pasada: generar más puntos candidatos que necesarios
                const candidatePoints = []
                for (let x = bounds_poly.minX; x < bounds_poly.maxX; x += cellSize) {
                  for (let y = bounds_poly.minY; y < bounds_poly.maxY; y += cellSize) {
                    const seed = (Math.round(x * 100) + Math.round(y * 100) + sectorName.charCodeAt(0)) * 9301 + 49297
                    const offsetX = ((seed * 1103515245 + 12345) % 2147483648) / 2147483648 * cellSize * 0.8 - cellSize * 0.4
                    const offsetY = (((seed * 2) * 1103515245 + 12345) % 2147483648) / 2147483648 * cellSize * 0.8 - cellSize * 0.4

                    const pointX = x + offsetX
                    const pointY = y + offsetY

                    if (isPointInPolygon(pointX, pointY)) {
                      candidatePoints.push({ x: pointX, y: pointY })
                    }
                  }
                }

                // Si no hay suficientes candidatos, generar más con una grilla más densa
                if (candidatePoints.length < numCoordinadores) {
                  const smallerCellSize = cellSize / 2
                  for (let x = bounds_poly.minX; x < bounds_poly.maxX && candidatePoints.length < numCoordinadores * 3; x += smallerCellSize) {
                    for (let y = bounds_poly.minY; y < bounds_poly.maxY && candidatePoints.length < numCoordinadores * 3; y += smallerCellSize) {
                      const seed = (Math.round(x * 1000) + Math.round(y * 1000) + sectorName.charCodeAt(0) * 2) * 9301 + 49297
                      const offsetX = ((seed * 1103515245 + 12345) % 2147483648) / 2147483648 * smallerCellSize * 0.8 - smallerCellSize * 0.4
                      const offsetY = (((seed * 2) * 1103515245 + 12345) % 2147483648) / 2147483648 * smallerCellSize * 0.8 - smallerCellSize * 0.4

                      const pointX = x + offsetX
                      const pointY = y + offsetY

                      if (isPointInPolygon(pointX, pointY) && !candidatePoints.some(p => Math.abs(p.x - pointX) < 2 && Math.abs(p.y - pointY) < 2)) {
                        candidatePoints.push({ x: pointX, y: pointY })
                      }
                    }
                  }
                }

                // Seleccionar los primeros N puntos de forma determinista
                for (let i = 0; i < Math.min(numCoordinadores, candidatePoints.length); i++) {
                  generatedPoints.push(candidatePoints[i])
                }

                return (
                  <g key={`coord-${sectorName}`}>
                    {generatedPoints.map((point, i) => (
                      <g key={i}>
                        {isMobile ? (
                          <>
                            {/* Punto verde con contorno negro en móvil */}
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="2.5"
                              fill="#16a34a"
                              opacity="0.9"
                            />
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="2.5"
                              fill="none"
                              stroke="#000000"
                              strokeWidth="0.8"
                              opacity="0.7"
                            />
                          </>
                        ) : (
                          <>
                            {/* Círculo exterior verde oscuro */}
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="8"
                              fill="#16a34a"
                              opacity="0.9"
                              filter="url(#coordinador-glow)"
                            />
                            {/* Círculo con borde */}
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="8"
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth="2"
                              opacity="0.8"
                            />
                            {/* Punto central blanco brillante */}
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="4"
                              fill="#ffffff"
                              opacity="1"
                              filter="url(#coordinador-glow)"
                            />
                          </>
                        )}
                      </g>
                    ))}
                  </g>
                )
              })}
                </>
              )}

              {/* Mapa de calor de afiliados */}
              {viewMode === 'afiliados' && (
                <>
                  {mapData.features?.map((feature: any, idx: number) => {
                    const name = feature.properties?.name || `Sector ${idx}`
                    const isVisible = getSectoresVisibles().includes(name)
                    if (!isVisible) return null

                    // Obtener cantidad de afiliados
                    let numAfiliados = afiliadosPorNombre[name] || 0
                    if (numAfiliados === 0) {
                      const nombreSupabase = getNombreSupabase(name)
                      numAfiliados = afiliadosPorNombre[nombreSupabase] || 0
                    }

                    // Calcular intensidad (0-1) basado en el máximo
                    const maxAfiliados = Math.max(...Object.values(afiliadosPorNombre).filter(v => typeof v === 'number'))
                    const intensity = maxAfiliados > 0 ? numAfiliados / maxAfiliados : 0

                    // Escala de colores: amarillo claro → amarillo → naranja → rojo oscuro
                    let heatColor = '#f5f5f5' // gris muy claro para sin datos
                    if (intensity > 0) {
                      if (intensity > 0.75) {
                        heatColor = '#c41e3a' // rojo oscuro
                      } else if (intensity > 0.5) {
                        heatColor = '#ff6b35' // naranja rojo
                      } else if (intensity > 0.25) {
                        heatColor = '#ffa500' // naranja
                      } else {
                        heatColor = '#ffeb3b' // amarillo
                      }
                    }

                    if (feature.geometry?.type === 'Polygon' && feature.geometry.coordinates?.[0]) {
                      const pathData = coordinatesToPath(
                        feature.geometry.coordinates[0],
                        activeBoundsComputed,
                        svgDimensions.width,
                        svgDimensions.height
                      )

                      return (
                        <g key={`heat-${idx}`}>
                          <path
                            d={pathData}
                            fill={heatColor}
                            fillOpacity="0.85"
                            filter="url(#shadow)"
                            style={{
                              transition: 'all 0.3s ease',
                              opacity: hoveredSector === name ? 1 : 0.85,
                            }}
                          />
                          <path
                            d={pathData}
                            fill="none"
                            stroke={darkenColor(heatColor, 0.4)}
                            strokeWidth={hoveredSector === name ? 3 : 1.5}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            opacity="0.6"
                            style={{
                              transition: 'all 0.3s ease',
                            }}
                          />
                          <path
                            d={pathData}
                            fill="white"
                            fillOpacity="0"
                            stroke="none"
                            onMouseEnter={() => {
                              setHoveredSector(name)
                            }}
                            onMouseLeave={() => {
                              setHoveredSector(null)
                              setTooltip(null)
                            }}
                            onMouseMove={(e) => {
                              const rect = svgContainer.current?.getBoundingClientRect()
                              if (rect) {
                                setTooltip({
                                  nombre: name,
                                  encargado: sectorEncargadoMap.current[name],
                                  coordinadores: numAfiliados,
                                  x: e.clientX + 10,
                                  y: e.clientY + 10,
                                })
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        </g>
                      )
                    }
                    return null
                  })}
                </>
              )}
            </svg>
              )
            })()}

            {tooltip && (
              <div
                className="sector-tooltip"
                style={{
                  left: `${tooltip.x}px`,
                  top: `${tooltip.y}px`,
                }}
              >
                <p className="nombre">{tooltip.nombre}</p>
                {tooltip.encargado && <p className="encargado">📍 {tooltip.encargado}</p>}
                {tooltip.coordinadores !== undefined && tooltip.coordinadores > 0 && (
                  <p className="encargado" style={{ marginTop: '4px' }}>
                    👥 {tooltip.coordinadores} {viewMode === 'coordinadores' ? 'coordinador' : 'afiliado'}{tooltip.coordinadores !== 1 ? 'es' : ''}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Selector de vista y botones de región - MÓVIL (abajo) */}
      <div className="sm:hidden fixed bottom-2 left-2 right-2 z-50 bg-white rounded-lg p-2 shadow-lg border border-gray-300 max-h-48 overflow-y-auto">
        {/* Selector Coordinadores/Afiliados */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => {
              setViewMode('coordinadores')
              setSelectedView(`coordinadores-${filterMode}`)
            }}
            className={`flex-1 px-2 py-0.5 rounded text-xs font-semibold transition-all ${
              viewMode === 'coordinadores'
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Coord
          </button>
          <button
            onClick={() => {
              setViewMode('afiliados')
              setSelectedView(`afiliados-${filterMode}`)
            }}
            className={`flex-1 px-2 py-0.5 rounded text-xs font-semibold transition-all ${
              viewMode === 'afiliados'
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Afil
          </button>
        </div>

        {/* Botones de región (móvil - horizontal) */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => {
              setFilterMode('all')
              setSelectedView(`${viewMode}-all`)
            }}
            className={`flex-1 px-2 py-0.5 rounded text-xs font-semibold transition-all ${
              filterMode === 'all'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-50'
            }`}
          >
            SJP
          </button>
          <button
            onClick={() => {
              setFilterMode('urbana')
              setSelectedView(`${viewMode}-urbana`)
            }}
            className={`flex-1 px-2 py-0.5 rounded text-xs font-semibold transition-all ${
              filterMode === 'urbana'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Urb
          </button>
          <button
            onClick={() => {
              setFilterMode('casco')
              setSelectedView(`${viewMode}-casco`)
            }}
            className={`flex-1 px-2 py-0.5 rounded text-xs font-semibold transition-all ${
              filterMode === 'casco'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Casco
          </button>
        </div>

        {/* Leyenda móvil compacta - 2 columnas */}
        {viewMode === 'afiliados' && (() => {
          const maxAfiliados = Math.max(...Object.values(afiliadosPorNombre).filter(v => typeof v === 'number'), 0)
          const rango25 = Math.ceil(maxAfiliados * 0.25)
          const rango50 = Math.ceil(maxAfiliados * 0.5)
          const rango75 = Math.ceil(maxAfiliados * 0.75)

          return (
            <div className="bg-gray-50 rounded p-1.5 text-xs">
              <p className="font-bold text-gray-700 mb-1 text-xs">Densidad</p>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#c41e3a' }}></div>
                  <span className="text-gray-600 text-xs">{rango75}-{maxAfiliados}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ff6b35' }}></div>
                  <span className="text-gray-600 text-xs">{rango50}-{rango75}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ffa500' }}></div>
                  <span className="text-gray-600 text-xs">{rango25}-{rango50}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ffeb3b' }}></div>
                  <span className="text-gray-600 text-xs">1-{rango25}</span>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Selector de vista y botones de región - DESKTOP (derecha) */}
      <div className="hidden sm:fixed top-20 right-2 z-50 w-72 sm:block">
        {/* Selector Coordinadores/Afiliados */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setViewMode('coordinadores')
              setSelectedView(`coordinadores-${filterMode}`)
            }}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              viewMode === 'coordinadores'
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Coordinadores
          </button>
          <button
            onClick={() => {
              setViewMode('afiliados')
              setSelectedView(`afiliados-${filterMode}`)
            }}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              viewMode === 'afiliados'
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Afiliados
          </button>
        </div>

        {/* Botones de región (desktop - vertical) */}
        <div className="space-y-2 mb-4">
          <button
            onClick={() => {
              setFilterMode('all')
              setSelectedView(`${viewMode}-all`)
            }}
            className={`block w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              filterMode === 'all'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            San José Pinula
          </button>
          <button
            onClick={() => {
              setFilterMode('urbana')
              setSelectedView(`${viewMode}-urbana`)
            }}
            className={`block w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              filterMode === 'urbana'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Area urbana
          </button>
          <button
            onClick={() => {
              setFilterMode('casco')
              setSelectedView(`${viewMode}-casco`)
            }}
            className={`block w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              filterMode === 'casco'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Casco urbano
          </button>
        </div>

        {/* Leyenda para mapa de calor (desktop) */}
        {viewMode === 'afiliados' && (() => {
          const maxAfiliados = Math.max(...Object.values(afiliadosPorNombre).filter(v => typeof v === 'number'), 0)
          const rango25 = Math.ceil(maxAfiliados * 0.25)
          const rango50 = Math.ceil(maxAfiliados * 0.5)
          const rango75 = Math.ceil(maxAfiliados * 0.75)

          return (
            <div className="bg-white rounded-lg p-4 border border-gray-300 shadow-lg">
              <h3 className="font-bold text-gray-700 mb-3 text-sm">Densidad de Afiliados</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: '#c41e3a' }}></div>
                  <span className="text-xs text-gray-600">{rango75}-{maxAfiliados}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: '#ff6b35' }}></div>
                  <span className="text-xs text-gray-600">{rango50}-{rango75}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: '#ffa500' }}></div>
                  <span className="text-xs text-gray-600">{rango25}-{rango50}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: '#ffeb3b' }}></div>
                  <span className="text-xs text-gray-600">1-{rango25}</span>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Panel de controles flotante */}
      <div className="map-controls-floating space-y-4">
        {/* Panel de información del sector */}
        {sectorInfo && (
          <div className="sector-info-panel rounded-2xl overflow-hidden border backdrop-blur-xl"
            style={{
              background: `linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.92) 100%)`,
              borderColor: sectorInfo.color + '40',
              boxShadow: `0 20px 60px rgba(0, 0, 0, 0.15), 0 0 40px ${sectorInfo.color}20`,
            }}>
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-bold" style={{ color: 'var(--texto-principal)' }}>
                    {sectorInfo.nombre}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setSelectedSector(null)
                    setSectorInfo(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  ✕
                </button>
              </div>

              <div className="h-1 rounded-full" style={{ background: sectorInfo.color }} />

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: `${sectorInfo.color}20` }}>
                  <div className="text-2xl">👥</div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>
                      Afiliados Activos
                    </p>
                    <p className="text-2xl font-bold" style={{ color: sectorInfo.color }}>
                      {sectorInfo.afiliados}
                    </p>
                  </div>
                </div>

                {sectorInfo.encargado && (
                  <div className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: `${sectorInfo.color}20` }}>
                    <div className="text-2xl">👤</div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>
                        Encargado
                      </p>
                      <p className="font-semibold" style={{ color: 'var(--texto-principal)' }}>
                        {sectorInfo.encargado}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <button
                className="w-full py-2 rounded-lg font-semibold text-white transition-all duration-200 transform hover:scale-105 active:scale-95"
                style={{ background: sectorInfo.color }}
              >
                Ver detalles
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  )
}
