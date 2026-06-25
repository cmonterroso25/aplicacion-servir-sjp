export type TipoUbicacion = 
  | 'zona'
  | 'manzana'
  | 'residencial'
  | 'seccion'
  | 'condominio'
  | 'caserio'
  | 'colonia'
  | 'callejon'
  | 'barrio'
  | 'area'

export const TIPOS_UBICACION: { value: TipoUbicacion; label: string }[] = [
  { value: 'zona', label: 'Zona' },
  { value: 'manzana', label: 'Manzana' },
  { value: 'residencial', label: 'Residencial' },
  { value: 'seccion', label: 'Seccion' },
  { value: 'condominio', label: 'Condominio' },
  { value: 'caserio', label: 'Caserio' },
  { value: 'colonia', label: 'Colonia' },
  { value: 'callejon', label: 'Callejon' },
  { value: 'barrio', label: 'Barrio' },
  { value: 'area', label: 'Area' },
]

export const OPCIONES_UBICACION: Record<TipoUbicacion, string[]> = {
  zona: ['Zona 1', 'Zona 2', 'Zona 3', 'Zona 4'],
  manzana: Array.from({ length: 175 }, (_, i) => `Manzana ${i + 1}`),
  residencial: [
    'Azucenas', 'Azaleas', 'Claveles', 'Rosas', 'Tulipanes', 'Margaritas',
    'Santa Cruz del Valle', 'Violetas I', 'Violetas II', 'Geranios I', 'Geranios II',
    'Azahares', 'Los Pinos', 'Orquideas', 'Almendros', 'Campanario',
    'San Jose de las Fuentes I', 'San Jose de las Fuentes II',
    'Canadas de San Jose', 'Hortensias', 'Hortensias Premium', 'Los Angeles',
    'Girasoles I', 'Girasoles II', 'Los Olivares', 'Villas de San Jose',
  ],
  seccion: ['Seccion A', 'Seccion B', 'Seccion C', 'Seccion D'],
  condominio: [
    'Montecristo I', 'Montecristo II', 'Montesinos I', 'Montesinos II',
    'Villas del Renacer I', 'Villas del Renacer II', 'Hacienda San Angel',
    'Hacienda Nueva', 'Club Alta Vista', 'Almeria', 'Florenza', 'Navarra',
    'Canadas de San Jose', 'Condado Real', 'Breza', 'Lo de Valdez',
    'Pinabetes', 'Manantiales', 'Paseo Santaluz', 'Albarela',
    'Bosques de Pinula', 'Residencial Cienaga Grande',
  ],
  caserio: [],
  colonia: [],
  callejon: [],
  barrio: [],
  area: ['San Luis Letran', 'San Luis Puerta Negra', 'Los de a 20'],
}