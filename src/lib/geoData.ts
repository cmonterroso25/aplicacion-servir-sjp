import { kml } from '@mapbox/togeojson'

export interface Sector {
  id: string
  nombre: string
  type: string
  geometry: any
  properties: Record<string, any>
}

export interface MapData {
  sectores: Sector[]
  bounds: [[number, number], [number, number]] | null
}

function parseKMLToGeoJSON(kmlText: string): any {
  try {
    // Create a DOMParser in the browser
    const parser = new DOMParser()
    const doc = parser.parseFromString(kmlText, 'text/xml')

    // Check for parsing errors
    if (doc.getElementsByTagName('parsererror').length > 0) {
      console.error('XML parsing error:', doc.getElementsByTagName('parsererror')[0].textContent)
      return { type: 'FeatureCollection', features: [] }
    }

    const geoJSON = kml(doc)
    console.log('KML parsed successfully, features:', geoJSON.features?.length || 0)
    return geoJSON
  } catch (error) {
    console.error('Error parsing KML:', error)
    return { type: 'FeatureCollection', features: [] }
  }
}

function calculateBounds(features: any[]): [[number, number], [number, number]] | null {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180

  features.forEach((feature) => {
    if (feature.geometry?.type === 'Polygon' && feature.geometry.coordinates) {
      feature.geometry.coordinates[0]?.forEach(([lon, lat]: [number, number]) => {
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
        minLon = Math.min(minLon, lon)
        maxLon = Math.max(maxLon, lon)
      })
    }
  })

  return minLat < 90 && maxLat > -90 && minLon < 180 && maxLon > -180
    ? [[minLat, minLon], [maxLat, maxLon]]
    : null
}

export async function loadSectoresFromKML(): Promise<MapData> {
  try {
    const response = await fetch('/data/san-jose-pinula.kml')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const kmlText = await response.text()
    const geoJSON = parseKMLToGeoJSON(kmlText)

    const sectores: Sector[] = (geoJSON.features || [])
      .filter((f: any) => f.geometry?.type === 'Polygon')
      .map((f: any, idx: number) => ({
        id: `sector-${idx}`,
        nombre: f.properties?.name || `Sector ${idx + 1}`,
        type: 'sector',
        geometry: f.geometry,
        properties: f.properties || {},
      }))

    const bounds = calculateBounds(geoJSON.features || [])

    return { sectores, bounds }
  } catch (error) {
    console.error('Error loading sectores KML:', error)
    return { sectores: [], bounds: null }
  }
}

function extractKMLColors(kmlText: string): Record<string, string> {
  const colorMap: Record<string, string> = {}

  try {
    // Usar regex para extraer estilos y sus colores
    // Buscar CascadingStyle con kml:id
    const stylePattern = /kml:id="([^"]+)"[\s\S]*?<LineStyle>\s*<color>([a-f0-9]{8})<\/color>/gi
    let match
    const styleColorMap: Record<string, string> = {}

    while ((match = stylePattern.exec(kmlText)) !== null) {
      const styleId = match[1]
      const colorAbgr = match[2]

      // Convertir ABGR a RGB
      const abgr = colorAbgr.substring(2) // Remove alpha (primera 2 caracteres)
      const rgb = '#' + abgr.substring(4) + abgr.substring(2, 4) + abgr.substring(0, 2)
      styleColorMap[styleId] = rgb
      console.log(`Style ${styleId}: ${colorAbgr} -> ${rgb}`)
    }

    // Buscar StyleMap y seguir referencias
    const styleMapPattern = /<StyleMap id="([^"]+)"[\s\S]*?<styleUrl>#([^<]+)_normal<\/styleUrl>/gi
    const styleMapReferenceMap: Record<string, string> = {}

    while ((match = styleMapPattern.exec(kmlText)) !== null) {
      const mapId = match[1]
      const styleId = match[2] + '_normal'
      styleMapReferenceMap[mapId] = styleId
    }

    // Buscar Placemarks y mapear a colores
    const placemarksPattern = /<Placemark[^>]*>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<styleUrl>#([^<]+)<\/styleUrl>/gi

    while ((match = placemarksPattern.exec(kmlText)) !== null) {
      const name = match[1]
      const styleRef = match[2]

      // Resolver referencias
      let colorId = styleRef
      if (styleMapReferenceMap[styleRef]) {
        colorId = styleMapReferenceMap[styleRef]
      }

      if (styleColorMap[colorId]) {
        colorMap[name] = styleColorMap[colorId]
        console.log(`Sector "${name}" -> ${styleColorMap[colorId]}`)
      }
    }
  } catch (error) {
    console.error('Error extracting KML colors:', error)
  }

  return colorMap
}

export async function loadGeoDataForMap(): Promise<any> {
  try {
    const response = await fetch('/data/san-jose-pinula-sectors.kml')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const kmlText = await response.text()
    console.log('KML file fetched, size:', kmlText.length)

    // Extraer colores del KML
    const kmlColors = extractKMLColors(kmlText)

    const geoJSON = parseKMLToGeoJSON(kmlText)
    console.log('GeoJSON loaded with', geoJSON.features?.length || 0, 'features')

    // Agregar colores a las propiedades
    if (geoJSON.features?.length) {
      geoJSON.features.forEach((f: any, i: number) => {
        const sectorName = f.properties?.name
        if (sectorName && kmlColors[sectorName]) {
          f.properties.color = kmlColors[sectorName]
          console.log(`Feature ${i}: ${sectorName} -> ${f.properties.color}`)
        }
      })
    }

    return geoJSON
  } catch (error) {
    console.error('Error loading map data:', error)
    return { type: 'FeatureCollection', features: [] }
  }
}
