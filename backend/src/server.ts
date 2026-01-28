import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { prisma } from './db/prisma';
import * as cron from 'node-cron';

// Import config
import { swaggerSpec } from './config/swagger';

// Import cache and logger
import { redisCache } from './cache';
import { logger, requestLoggerMiddleware } from './utils/logger';

// Import monitoring
import { 
  metricsMiddleware, 
  metricsHandler, 
  healthHandler, 
  livenessHandler, 
  readinessHandler 
} from './monitoring';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import cardRoutes from './routes/cards';
import setRoutes from './routes/sets';
import collectionRoutes from './routes/collection';
import deckRoutes from './routes/decks';
import adminRoutes from './routes/admin';
// import adminOptimizedRoutes from './routes/admin-optimized';
import adminCleanRoutes from './routes/admin-clean';
import rulesRoutes from './routes/rules';

// Import services
import { ScryfallService } from './services/scryfall';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { authenticateToken, requireAdmin } from './middleware/auth';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

logger.info({
  port: PORT,
  nodeEnv: process.env.NODE_ENV,
  frontendUrl: process.env.FRONTEND_URL,
  jwtConfigured: !!process.env.JWT_SECRET,
  redisConfigured: !!process.env.REDIS_URL,
}, 'Server configuration loaded');

// Prisma Client is initialized in ./db/prisma and shared across the app
export { prisma };

// Trust proxy for rate limiting behind nginx/docker
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : ['127.0.0.1', '::1']);

// Request logging middleware (structured JSON logs)
app.use(requestLoggerMiddleware);

// Metrics middleware (must be early to capture all requests)
app.use(metricsMiddleware);

// Cookie parser for httpOnly refresh token
app.use(cookieParser());

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://scryfall.com", "https://cards.scryfall.io"],
    },
  },
}));

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://localhost:5173',
].filter(Boolean) as string[];

// In development, also allow GitHub Codespaces and local dev URLs
if (process.env.NODE_ENV === 'development') {
  // Pattern-based origins added at check time
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin) return callback(null, true);
    
    // Check against explicit allowed list
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, allow GitHub Codespaces and other dev patterns
    if (process.env.NODE_ENV === 'development') {
      if (
        origin.includes('github.dev') ||
        origin.includes('codespaces') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
    }
    
    // Reject unknown origins with clear error
    logger.warn({ origin }, 'CORS blocked request from unknown origin');
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'X-Request-ID'],
  exposedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting - uniquement en production
if (process.env.NODE_ENV === 'production') {
  app.use(rateLimiter);
}

// Health check with cache status (legacy)
app.get('/health', healthHandler);

// Kubernetes-style health endpoints
app.get('/api/health', healthHandler);
app.get('/api/health/live', livenessHandler);
app.get('/api/health/ready', readinessHandler);

// Prometheus metrics endpoint
app.get('/api/metrics', metricsHandler);

// API Documentation - Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Magicodex API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
}));

// OpenAPI spec as JSON
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/sets', setRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/admin', adminRoutes);
// app.use('/api/admin-optimized', authenticateToken, requireAdmin, adminOptimizedRoutes);
app.use('/api/admin-clean', authenticateToken, requireAdmin, adminCleanRoutes);
app.use('/api/rules', rulesRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
// app.use('*', (req, res) => {
//   res.status(404).json({ error: 'Route not found' });
// });

// Scheduled tasks
if (process.env.NODE_ENV === 'production') {
  // Daily sync at 2 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Starting daily Scryfall sync...');
    try {
      const scryfallService = new ScryfallService();
      await scryfallService.syncSets();
      await scryfallService.syncCards();
      logger.info('Daily sync completed successfully');
    } catch (error) {
      logger.error({ error }, 'Daily sync failed');
    }
  });
}

// Start server
const startServer = async () => {
  try {
    // Connect to Redis cache (optional, non-blocking)
    redisCache.connect().catch((err) => {
      logger.warn({ error: err }, 'Redis connection failed, continuing without cache');
    });
    
    app.listen(PORT, () => {
      logger.info({ port: PORT }, '🚀 Server running');
      logger.info({ docsUrl: `http://localhost:${PORT}/api/docs` }, '📚 API documentation available');
    });
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, 'Received shutdown signal, cleaning up...');
  
  try {
    // Disconnect Redis
    await redisCache.disconnect();
    logger.info('Redis disconnected');
    
    // Disconnect Prisma
    await prisma.$disconnect();
    logger.info('Database disconnected');
    
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (require.main === module) {
  startServer();
}

export default app;
