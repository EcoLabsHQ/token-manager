# Admin Dashboard

React dashboard for platform analytics.

## Features

* **Analytics** — all tokens created (from the subgraph), per-token metrics, global stats, top-token ranking

{% hint style="info" %}
Holder/transfer/bridge metrics are currently **mocked** (derived deterministically from the token address) — not yet in the subgraph.
{% endhint %}

## Run

```bash
# Backend must be running first
cd admin
npm install
cp .env.example .env
npm run dev   # http://localhost:5174
```

| Env variable | Purpose |
| ------------ | ------- |
| `VITE_API_URL` | Backend URL (default `http://localhost:3001`) |
| `VITE_ADMIN_API_KEY` | Must match backend's `ADMIN_API_KEY` |

Uses the `/api/admin/*` endpoints (see [Backend](backend.md)). Stack: React 19, TypeScript, Vite, TailwindCSS, Radix UI, TanStack Query.
