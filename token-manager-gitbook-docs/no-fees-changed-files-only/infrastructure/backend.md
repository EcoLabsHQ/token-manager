# Backend

Express.js server providing the REST API, MCP server, and IPFS pinning.

## Setup & run

```bash
cd backend
npm install
cp .env.example .env   # DATABASE_URL, ADMIN_API_KEY, PINATA_JWT
psql -d minter -f schema.sql

npm run dev    # HTTP on port 3001 (REST + MCP)
npm run mcp    # MCP in stdio mode
```

## Endpoint groups

| Group | Endpoints | Docs |
| ----- | --------- | ---- |
| Admin (`X-API-Key` header) | `GET /api/admin/stats`, `GET /api/admin/verify` | [Admin Dashboard](admin-dashboard.md) |
| Token creation | `/api/tokens/...` calldata endpoints | [Agent REST API](../developers/agent-rest-api.md) |
| Metadata | `POST /api/metadata/pin`, `/pin-with-image`, `GET /api/metadata/:cid` | [Agent REST API](../developers/agent-rest-api.md) |
| Logos | `POST/GET /api/tokens/:chainId/:address/logo` | — |
| MCP | `POST /mcp` | [MCP Server](../developers/mcp-server.md) |
