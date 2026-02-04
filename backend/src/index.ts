import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import promoRoutes from './routes/promo';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/promo', promoRoutes);
app.use('/api/admin', adminRoutes);

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
});
