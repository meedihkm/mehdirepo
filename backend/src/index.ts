// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - POINT D'ENTRÉE PRINCIPAL
// Serveur Express avec WebSocket pour temps réel
// ═══════════════════════════════════════════════════════════════════════════════

import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { authenticateSocket } from './middlewares/auth.middleware';
import routes from './routes';
import { initializeDatabase } from './database';
import { initializeRedis } from './cache';
import { initializeWorker } from './worker';

// ═══════════════════════════════════════════════════════════════════════════════
// CRÉATION DE L'APPLICATION
// ═══════════════════════════════════════════════════════════════════════════════

const app: Express = express();
const httpServer = createServer(app);

// Socket.IO pour temps réel
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.cors.origins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Rendre io accessible dans les controllers
app.set('io', io);

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARES GLOBAUX
// ═══════════════════════════════════════════════════════════════════════════════

// Sécurité
app.use(helmet({
  contentSecurityPolicy: false, // Désactivé pour API
}));

// CORS
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.env !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requêtes, veuillez réessayer plus tard',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Trust proxy (pour Caddy/Nginx)
app.set('trust proxy', 1);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.version,
    env: config.env,
  });
});

// API v1
app.use('/api/v1', routes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET
// ═══════════════════════════════════════════════════════════════════════════════

io.use(authenticateSocket);

io.on('connection', (socket) => {
  const user = socket.data.user;
  logger.info(`WebSocket connected: ${user.id} (${user.role})`);

  // Rejoindre la room de l'organisation
  socket.join(`org:${user.organizationId}`);

  // Room spécifique au rôle
  socket.join(`org:${user.organizationId}:${user.role}`);

  // Room utilisateur individuel
  socket.join(`user:${user.id}`);

  // Position livreur (temps réel)
  socket.on('position:update', async (data) => {
    if (user.role === 'deliverer') {
      // Broadcast aux admins de l'organisation
      socket.to(`org:${user.organizationId}:admin`).emit('deliverer:position', {
        delivererId: user.id,
        position: data,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Déconnexion
  socket.on('disconnect', (reason) => {
    logger.info(`WebSocket disconnected: ${user.id} - ${reason}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES POUR ÉMETTRE DES ÉVÉNEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const emitToOrganization = (orgId: string, event: string, data: any) => {
  io.to(`org:${orgId}`).emit(event, data);
};

export const emitToUser = (userId: string, event: string, data: any) => {
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToAdmins = (orgId: string, event: string, data: any) => {
  io.to(`org:${orgId}:admin`).emit(event, data);
};

export const emitToDeliverers = (orgId: string, event: string, data: any) => {
  io.to(`org:${orgId}:deliverer`).emit(event, data);
};

// ═══════════════════════════════════════════════════════════════════════════════
// DÉMARRAGE DU SERVEUR
// ═══════════════════════════════════════════════════════════════════════════════

const start = async () => {
  try {
    // Initialiser la base de données
    logger.info('Connecting to database...');
    await initializeDatabase();
    logger.info('Database connected');

    // Initialiser Redis
    logger.info('Connecting to Redis...');
    await initializeRedis();
    logger.info('Redis connected');

    // Initialiser le worker (jobs en arrière-plan)
    if (config.env !== 'test') {
      logger.info('Starting background worker...');
      await initializeWorker();
      logger.info('Worker started');
    }

    // Démarrer le serveur
    httpServer.listen(config.port, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚚 AWID API v${config.version} started successfully!              ║
║                                                               ║
║   Environment: ${config.env.padEnd(45)}║
║   Port: ${config.port.toString().padEnd(52)}║
║   API: http://localhost:${config.port}/api/v1${' '.repeat(31)}║
║   Health: http://localhost:${config.port}/health${' '.repeat(28)}║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Arrêt gracieux
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    
    // Fermer les connexions
    // await closeDatabase();
    // await closeRedis();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force exit après 30 secondes
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Démarrer
start();

export { app, httpServer, io };
