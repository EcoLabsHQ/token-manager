# Admin Dashboard

Dashboard de administración para la plataforma Kolektivo Minter.

## Características

### Gestión de Códigos Promocionales
- Ver todos los códigos de descuento con fecha de creación y expiración
- Crear nuevos códigos con descuento porcentual o 100% gratis
- Establecer límite de usos por código
- Activar/desactivar códigos
- Seguimiento de uso por código

### Analytics de Tokens
- Ver todos los tokens creados en la plataforma (datos reales del subgraph)
- Métricas por token: fecha creación, admin, holders, transfers, bridges
- Estadísticas globales:
  - Total tokens creados
  - Holders combinados
  - Transfers combinados
  - Bridges combinados
- Ranking de tokens más exitosos

> **Nota:** Las métricas de holders, transfers y bridges están mockeadas (generadas de forma determinística basándose en la dirección del token) ya que no están disponibles actualmente en el subgraph.

## Seguridad

El dashboard está protegido con una API key. La key se configura en los archivos `.env`:

- **Backend:** `ADMIN_API_KEY` en `backend/.env`
- **Admin UI:** `VITE_ADMIN_API_KEY` en `admin/.env`

Ambos valores deben coincidir. Una API key por defecto ya está configurada para desarrollo.

## Instalación

```bash
cd admin
npm install
```

## Desarrollo

Primero, asegúrate de que el backend esté corriendo:

```bash
cd ../backend
npm run dev
```

Luego, inicia el servidor de desarrollo del admin:

```bash
cd admin
npm run dev
```

El dashboard estará disponible en `http://localhost:5174`

## Variables de Entorno

Copia el archivo `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

Variables disponibles:
- `VITE_API_URL` - URL del backend (default: `http://localhost:3001`)
- `VITE_ADMIN_API_KEY` - API key para autenticación con el backend

## Estructura

```
admin/
├── src/
│   ├── components/
│   │   ├── Layout.tsx          # Layout principal con sidebar
│   │   └── ui/                 # Componentes UI reutilizables
│   ├── lib/
│   │   ├── api.ts              # Funciones API y tipos
│   │   └── utils.ts            # Utilidades
│   ├── pages/
│   │   ├── Dashboard.tsx       # Vista general de estadísticas
│   │   ├── PromoCodes.tsx      # Gestión de códigos promo
│   │   └── Tokens.tsx          # Lista de tokens
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
└── vite.config.ts
```

## API Endpoints

El admin utiliza los siguientes endpoints del backend:

- `GET /api/admin/promo-codes` - Listar todos los códigos
- `POST /api/admin/promo-codes` - Crear nuevo código
- `PATCH /api/admin/promo-codes/:id` - Actualizar código
- `DELETE /api/admin/promo-codes/:id` - Eliminar código
- `GET /api/admin/stats` - Obtener estadísticas

## Tecnologías

- React 19
- TypeScript
- Vite
- TailwindCSS
- Radix UI
- TanStack Query
- React Router
