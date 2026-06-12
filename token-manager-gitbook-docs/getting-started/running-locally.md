# Running Locally

```bash
# Terminal 1: Backend (port 3001, REST + MCP)
cd backend && npm run dev

# Terminal 2: UI
cd ui && npm run dev

# Terminal 3: Local chain (optional)
cd contracts && anvil
```

| Backend command | Mode |
| --------------- | ---- |
| `npm run dev` | HTTP server (REST API + MCP over HTTP) |
| `npm run mcp` | MCP in stdio mode |

**Admin dashboard** (needs backend running): `cd admin && npm run dev` → `http://localhost:5174`

**Contracts**: `forge build`, `forge test`, `forge fmt`
