# Installation

## Prerequisites

Node.js 18+, PostgreSQL, Foundry (for contracts).

## Install

```bash
git clone https://github.com/EcoLabsHQ/token-manager.git
cd token-manager
cd ui && npm install
cd ../backend && npm install
cd ../contracts && forge install
cd ../subgraph && npm install
```

## Configure

Create a `.env` in each workspace:

| Workspace | Variables |
| --------- | --------- |
| `backend/` | `DATABASE_URL`, `ADMIN_API_KEY`, `PINATA_JWT` |
| `admin/` | `VITE_API_URL`, `VITE_ADMIN_API_KEY` (must match backend's `ADMIN_API_KEY`) |
| `contracts/` | `PRIVATE_KEY`, `ETHERSCAN_API_KEY` (deployment only) |

## Database

```bash
psql -d minter -f backend/schema.sql
```

## Repository layout

```
ui/         React frontend
backend/    Express API + MCP server
admin/      Admin dashboard
contracts/  Solidity (Foundry)
subgraph/   The Graph subgraphs
```
