# Minter Backend

Backend simple con Express.js para validar códigos promocionales y generar firmas.

## Setup

```bash
npm install
cp .env.example .env
# Configura DATABASE_URL, PROMO_SIGNER_PRIVATE_KEY y ADMIN_API_KEY
```

## Base de Datos

Ejecuta el SQL en PostgreSQL:
```bash
psql -d minter -f schema.sql
```

## Ejecución

```bash
npm run dev
```

## Endpoints

### Promo (Público)
- `POST /api/promo/validate` - Valida código y devuelve firma
- `GET /api/promo/check/:code` - Verifica validez sin consumir
- `GET /api/promo/signer` - Dirección del signer

### Admin (Requiere API Key)
Todos los endpoints requieren header `X-API-Key`

- `GET /api/admin/verify` - Verificar validez de API key
- `GET /api/admin/promo-codes` - Listar códigos promo
- `POST /api/admin/promo-codes` - Crear código promo
- `PATCH /api/admin/promo-codes/:id` - Actualizar código promo
- `DELETE /api/admin/promo-codes/:id` - Eliminar código promo
- `GET /api/admin/stats` - Estadísticas del dashboard
