export type TipoUbicacion = 
  | 'zona'
  | 'manzana'
  | 'residencial'
  | 'seccion'
  | 'condominio'


export const TIPOS_UBICACION: { value: TipoUbicacion; label: string }[] = [
  { value: 'zona', label: 'Zona' },
  { value: 'manzana', label: 'Manzana' },
  { value: 'residencial', label: 'Residencial' },
  { value: 'seccion', label: 'Sección' },
  { value: 'condominio', label: 'Condominio' },
 
]

export const OPCIONES_UBICACION: Record<TipoUbicacion, string[]> = {
  zona: ['Zona 1', 'Zona 2', 'Zona 3', 'Zona 4'],
  manzana: Array.from({ length: 175 }, (_, i) => `Manzana ${i + 1}`),
  residencial: [
    'Azucenas', 'Azaleas', 'Claveles', 'Rosas', 'Tulipanes', 'Margaritas',
    'Santa Cruz del Valle', 'Violetas I', 'Violetas II', 'Geranios I', 'Geranios II',
    'Azahares', 'Los Pinos', 'Orquideas', 'Almendros', 'Campanario',
    'San José de las Fuentes I', 'San José de las Fuentes II',
    'Cañadas de San José', 'Hortensias', 'Hortensias Premium', 'Los Angeles',
    'Girasoles I', 'Girasoles II', 'Los Olivares', 'Villas de San José',
  ],
  seccion: ['Sección A', 'Sección B', 'Sección C', 'Sección D'],
  condominio: [
    'Montecristo I', 'Montecristo II', 'Montesinos I', 'Montesinos II',
    'Villas del Renacer I', 'Villas del Renacer II', 'Hacienda San Angel',
    'Hacienda Nueva', 'Club Alta Vista', 'Almeria', 'Florenza', 'Navarra',
    'Cañadas de San José', 'Condado Real', 'Breza', 'Lo de Valdez',
    'Pinabetes', 'Manantiales', 'Paseo Santaluz', 'Albarela',
    'Bosques de Pinula', 'Residencial Ciénaga Grande',
  ],
  
}
