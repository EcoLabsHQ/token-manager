# Minter Backend

Backend simple con Express.js para validar códigos promocionales y generar firmas.

## Setup

```bash
npm install
cp .env.example .env
# Configura DATABASE_URL y PROMO_SIGNER_PRIVATE_KEY
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

- `POST /api/promo/validate` - Valida código y devuelve firma
- `GET /api/promo/check/:code` - Verifica validez sin consumir
- `GET /api/promo/signer` - Dirección del signer
