# Consulta de Empadronados — San José Pinula

Herramienta interna para verificar si una persona está empadronada en San José Pinula.

---

## Stack

- **Next.js 14** — Framework web
- **Supabase** — Base de datos PostgreSQL + autenticación
- **Vercel** — Hosting gratuito
- **Tailwind CSS** — Estilos

---

## Guía de Despliegue Paso a Paso

### PASO 1 — Preparar el CSV

1. Abre tu Excel con los datos
2. Asegúrate que las columnas tengan EXACTAMENTE estos nombres (sin tildes, sin espacios):
   ```
   dpi, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, genero, edad, departamento, municipio, direccion
   ```
3. Guardar como → **CSV UTF-8 (delimitado por comas)**

---

### PASO 2 — Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita
2. Click en **"New Project"**
3. Nombre: `pinula-empadronados`
4. Región: `South America (São Paulo)` — la más cercana
5. Genera y **guarda la contraseña de base de datos** en un lugar seguro
6. Espera 2 minutos a que cree el proyecto

---

### PASO 3 — Ejecutar el SQL de configuración

1. En el panel de Supabase ve a **SQL Editor**
2. Copia y pega el contenido del archivo `supabase_setup.sql`
3. Click en **Run**
4. Verifica que no haya errores

---

### PASO 4 — Importar los datos

1. Ve a **Table Editor → empadronados**
2. Click en el botón **Import CSV** (ícono de flecha arriba)
3. Selecciona tu archivo CSV
4. Verifica que las columnas correspondan correctamente
5. Click en **Import**
6. Espera a que termine (tarda menos de 1 minuto para 54k registros)
7. Verifica que aparezcan los registros en la tabla

---

### PASO 5 — Obtener las credenciales

1. En Supabase ve a **Settings → API**
2. Copia y guarda:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public** key (la clave larga que empieza con `eyJ...`)

---

### PASO 6 — Crear los usuarios del equipo

1. Ve a **Authentication → Users**
2. Click en **"Invite User"**
3. Ingresa el correo de cada persona del equipo
4. Repite para los 25 usuarios
5. Cada uno recibirá un correo para crear su contraseña

---

### PASO 7 — Configurar el proyecto localmente

```bash
# Clonar/copiar el proyecto
cd pinula-empadronados

# Instalar dependencias
npm install

# Crear el archivo de variables de entorno
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:
```
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

```bash
# Probar localmente
npm run dev
# Abre http://localhost:3000
```

---

### PASO 8 — Desplegar en Vercel

1. Sube el proyecto a GitHub (repositorio privado)
2. Ve a [vercel.com](https://vercel.com) y crea una cuenta
3. Click en **"New Project"** → importa desde GitHub
4. En **Environment Variables** agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key
5. Click en **Deploy**
6. En 2 minutos tendrás una URL pública tipo `https://pinula-empadronados.vercel.app`

---

## Uso de la Herramienta

### Buscar por nombre
- Escribe el apellido o nombre de la persona
- Ejemplo: `García` o `María García`
- Muestra hasta 50 resultados

### Buscar por DPI
- Escribe el número completo del DPI
- Búsqueda exacta, resultado inmediato

### Resultados
- ✅ **"Vota aquí"** = La persona SÍ está empadronada en San José Pinula
- ❌ **"No se encontraron resultados"** = La persona NO vota en el municipio

---

## Seguridad

- Acceso solo con correo y contraseña
- Cada usuario tiene credenciales individuales
- Row Level Security activo en la base de datos
- Nadie puede editar o borrar registros desde la app
- Solo el administrador (tú) puede modificar datos en Supabase

---

## Costos

| Servicio | Plan | Costo |
|----------|------|-------|
| Supabase | Free (hasta 500MB, 50k filas auth) | $0/mes |
| Vercel | Hobby | $0/mes |
| **Total** | | **$0/mes** |

Para 54k registros de texto, el plan gratuito de Supabase es más que suficiente.

---

## Mantenimiento

Para actualizar los datos (si llega un nuevo padrón):
1. Ve a Supabase → Table Editor → empadronados
2. Selecciona todos los registros → Delete
3. Importa el nuevo CSV

O desde SQL Editor:
```sql
TRUNCATE TABLE empadronados;
-- Luego importa el nuevo CSV
```
