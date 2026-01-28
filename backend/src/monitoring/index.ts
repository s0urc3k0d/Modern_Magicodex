/**
 * Monitoring module exports
 */

export { 
  metrics, 
  metricsMiddleware, 
  metricsHandler, 
  METRIC_NAMES,
  recordAuthLogin,
  recordAuthRegister,
  recordCacheAccess,
  recordSyncRun,
  recordCollectionAdd,
  recordDeckCreated,
  setActiveUsers,
} from './metrics';

export {
  healthHandler,
  livenessHandler,
  readinessHandler,
  type HealthStatus,
  type ComponentHealth,
} from './health';
