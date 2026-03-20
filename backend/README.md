# Minter Backend

Backend con Express.js para validar códigos promocionales, gestionar tokens y proveer un servidor MCP para agentes de IA.

## Setup

```bash
npm install
cp .env.example .env
# Configura DATABASE_URL, PROMO_SIGNER_PRIVATE_KEY, ADMIN_API_KEY, PINATA_JWT, etc.
```

## Base de Datos

Ejecuta el SQL en PostgreSQL:
```bash
psql -d minter -f schema.sql
```

## Ejecución

```bash
npm run dev    # Servidor HTTP en puerto 3001
npm run mcp    # Servidor MCP en modo stdio (para desarrollo local)
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

### Tokens
- `POST /api/tokens/:chainId/:address/logo` - Subir logo de token
- `GET /api/tokens/:chainId/:address/logo` - Obtener logo de token

### Token Creation API (para Agentes)
Endpoints REST que generan calldata para que agentes puedan crear tokens:

- `GET /api/tokens/chains` - Obtener chains soportadas y configuración de factories
- `GET /api/tokens/:chainId/fee` - Obtener fee de creación para una chain
- `POST /api/tokens/:chainId/create/calldata` - Generar calldata para crear un token
- `POST /api/tokens/:chainId/create-with-bridge/calldata` - Generar calldata para crear token L2 con bridge
- `POST /api/tokens/bridge/calldata` - Generar calldata para bridgear tokens L1→L2
- `POST /api/tokens/full-deployment/calldata` - Generar todos los calldata para un deployment completo

### Metadata (IPFS)
- `POST /api/metadata/pin` - Pinear metadata a IPFS
- `POST /api/metadata/pin-with-image` - Pinear metadata e imagen a IPFS
- `GET /api/metadata/:cid` - Obtener metadata desde IPFS

---

## 🤖 MCP Server (Model Context Protocol)

El backend incluye un servidor MCP completo que permite a agentes de IA crear y gestionar tokens en Celo y Ethereum.

### Endpoint
```
POST http://localhost:3001/mcp
```

### Herramientas Disponibles

| Categoría | Herramienta | Descripción |
|-----------|-------------|-------------|
| **Descubrimiento** | `get_supported_chains` | Obtener chains soportadas y factory addresses |
| | `get_token_creation_params` | Obtener parámetros y ABI para crear tokens |
| **Consulta** | `list_tokens` | Listar tokens creados en una chain |
| | `get_token_details` | Detalles de un token (holders, transfers) |
| | `get_tokens_by_owner` | Tokens propiedad de una dirección |
| **Metadata** | `pin_token_metadata` | Pinear metadata a IPFS |
| | `get_token_metadata` | Obtener metadata desde IPFS |
| **Promo** | `validate_promo_code` | Validar código promo y obtener firma |
| **Logos** | `get_token_logo` | URL del logo de un token |
| | `list_token_logos` | Listar todos los logos de una chain |
| **Transacciones** | `build_create_token_transaction` | Construir tx para crear token (soporta promoCode) |
| **On-Chain** | `get_creation_fee` | Consultar fee de creación desde el contrato |
| **Wallet** | `get_wallet_balance` | Balance de CELO/ETH de una wallet |
| | `estimate_gas` | Estimar gas con buffer de seguridad |
| | `get_transaction_status` | Estado de tx y dirección del token creado |

### Configuración para Agentes

#### Claude Desktop / Cline (HTTP)
```json
{
  "mcpServers": {
    "token-minter": {
      "url": "http://localhost:3001/mcp",
      "transport": "http"
    }
  }
}
```

#### Modo stdio (desarrollo local)
```json
{
  "mcpServers": {
    "token-minter": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/backend"
    }
  }
}
```

### Flujo Típico de Creación de Token

1. **Obtener info de chains**: `get_supported_chains`
2. **Verificar balance**: `get_wallet_balance`
3. **Consultar fee de creación**: `get_creation_fee`
4. **Pinear metadata a IPFS**: `pin_token_metadata`
5. **(Opcional) Validar promo code**: `validate_promo_code`
6. **Construir transacción**: `build_create_token_transaction` (soporta `promoCode` directo)
7. **Firmar y enviar**: El agente usa un wallet para firmar
8. **Verificar resultado**: `get_transaction_status` → obtiene dirección del token creado

Ver [src/mcp/README.md](src/mcp/README.md) para documentación completa.
