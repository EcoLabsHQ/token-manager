import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import promoRoutes from './routes/promo.js';
import adminRoutes from './routes/admin.js';
import tokensRoutes from './routes/tokens.js';
import metadataRoutes from './routes/metadata.js';
import mcpRoutes from './mcp/routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' })); // Increased limit for base64 images

// Routes
app.use('/api/promo', promoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tokens', tokensRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/mcp', mcpRoutes); // MCP endpoint

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Promo validation endpoint: POST /api/promo/validate`);
  console.log(`🔍 Check promo code: GET /api/promo/check/:code`);
  console.log(`🔑 Get signer address: GET /api/promo/signer`);
  console.log(`🖼️  Token logos endpoint: /api/tokens/:chainId/:address/logo`);
  console.log(`📦 Metadata IPFS pinning: POST /api/metadata/pin`);
  console.log(`🤖 MCP endpoint: POST /mcp`);
});
