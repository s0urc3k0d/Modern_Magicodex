/**
 * Tests for metrics system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  metrics,
  METRIC_NAMES,
  recordAuthLogin,
  recordAuthRegister,
  recordCacheAccess,
} from '../../src/monitoring/metrics';

describe('Metrics System', () => {
  beforeEach(() => {
    // Reset metrics before each test
    metrics.reset();
  });

  describe('Counter metrics', () => {
    it('should increment counter', () => {
      metrics.incCounter('test_counter');
      metrics.incCounter('test_counter');
      metrics.incCounter('test_counter');
      
      expect(metrics.getCounter('test_counter')).toBe(3);
    });

    it('should support labels', () => {
      metrics.incCounter('test_counter', { method: 'GET' });
      metrics.incCounter('test_counter', { method: 'POST' });
      metrics.incCounter('test_counter', { method: 'GET' });
      
      expect(metrics.getCounter('test_counter', { method: 'GET' })).toBe(2);
      expect(metrics.getCounter('test_counter', { method: 'POST' })).toBe(1);
    });

    it('should support custom increment value', () => {
      metrics.incCounter('test_counter', undefined, 5);
      metrics.incCounter('test_counter', undefined, 3);
      
      expect(metrics.getCounter('test_counter')).toBe(8);
    });
  });

  describe('Gauge metrics', () => {
    it('should set gauge value', () => {
      metrics.setGauge('test_gauge', 42);
      expect(metrics.getGauge('test_gauge')).toBe(42);
    });

    it('should update gauge value', () => {
      metrics.setGauge('test_gauge', 10);
      metrics.setGauge('test_gauge', 20);
      
      expect(metrics.getGauge('test_gauge')).toBe(20);
    });

    it('should support labels', () => {
      metrics.setGauge('test_gauge', 100, { region: 'eu' });
      metrics.setGauge('test_gauge', 200, { region: 'us' });
      
      expect(metrics.getGauge('test_gauge', { region: 'eu' })).toBe(100);
      expect(metrics.getGauge('test_gauge', { region: 'us' })).toBe(200);
    });
  });

  describe('Histogram metrics', () => {
    it('should observe values', () => {
      metrics.observeHistogram('test_histogram', 50);
      metrics.observeHistogram('test_histogram', 100);
      metrics.observeHistogram('test_histogram', 200);
      
      const json = metrics.toJSON() as any;
      const hist = json.histograms.test_histogram?.['{}'];
      
      expect(hist).toBeDefined();
      expect(hist.count).toBe(3);
      expect(hist.sum).toBe(350);
    });
  });

  describe('Prometheus format export', () => {
    it('should export counters in Prometheus format', () => {
      metrics.incCounter('http_requests', { method: 'GET', status: '200' });
      
      const output = metrics.toPrometheusFormat();
      
      expect(output).toContain('# TYPE http_requests counter');
      expect(output).toContain('http_requests');
    });

    it('should export gauges in Prometheus format', () => {
      metrics.setGauge('active_connections', 10);
      
      const output = metrics.toPrometheusFormat();
      
      expect(output).toContain('# TYPE active_connections gauge');
      expect(output).toContain('active_connections 10');
    });

    it('should export histograms with buckets', () => {
      metrics.observeHistogram('request_duration', 50);
      
      const output = metrics.toPrometheusFormat();
      
      expect(output).toContain('# TYPE request_duration histogram');
      expect(output).toContain('request_duration_bucket');
      expect(output).toContain('request_duration_sum');
      expect(output).toContain('request_duration_count');
    });
  });

  describe('Helper functions', () => {
    it('recordAuthLogin should increment login counter', () => {
      recordAuthLogin(true);
      recordAuthLogin(false);
      
      const successCount = metrics.getCounter(METRIC_NAMES.AUTH_LOGIN_TOTAL, { success: 'true' });
      const failCount = metrics.getCounter(METRIC_NAMES.AUTH_LOGIN_TOTAL, { success: 'false' });
      
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
    });

    it('recordAuthRegister should increment register counter', () => {
      recordAuthRegister(true);
      
      const count = metrics.getCounter(METRIC_NAMES.AUTH_REGISTER_TOTAL, { success: 'true' });
      expect(count).toBe(1);
    });

    it('recordCacheAccess should track hits and misses', () => {
      recordCacheAccess(true, 'cards');
      recordCacheAccess(true, 'cards');
      recordCacheAccess(false, 'cards');
      
      const hits = metrics.getCounter(METRIC_NAMES.CACHE_HITS_TOTAL, { cache: 'cards' });
      const misses = metrics.getCounter(METRIC_NAMES.CACHE_MISSES_TOTAL, { cache: 'cards' });
      
      expect(hits).toBe(2);
      expect(misses).toBe(1);
    });
  });

  describe('JSON export', () => {
    it('should export all metrics as JSON', () => {
      metrics.incCounter('test_counter');
      metrics.setGauge('test_gauge', 42);
      metrics.observeHistogram('test_histogram', 100);
      
      const json = metrics.toJSON() as any;
      
      expect(json.counters).toBeDefined();
      expect(json.gauges).toBeDefined();
      expect(json.histograms).toBeDefined();
    });
  });

  describe('METRIC_NAMES constants', () => {
    it('should have HTTP metrics', () => {
      expect(METRIC_NAMES.HTTP_REQUESTS_TOTAL).toBe('http_requests_total');
      expect(METRIC_NAMES.HTTP_REQUEST_DURATION_MS).toBe('http_request_duration_ms');
    });

    it('should have Auth metrics', () => {
      expect(METRIC_NAMES.AUTH_LOGIN_TOTAL).toBe('auth_login_total');
      expect(METRIC_NAMES.AUTH_REGISTER_TOTAL).toBe('auth_register_total');
    });

    it('should have Cache metrics', () => {
      expect(METRIC_NAMES.CACHE_HITS_TOTAL).toBe('cache_hits_total');
      expect(METRIC_NAMES.CACHE_MISSES_TOTAL).toBe('cache_misses_total');
    });
  });
});
