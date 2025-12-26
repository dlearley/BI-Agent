/**
 * Load Test for Analytics API
 * Tests API performance under expected concurrency
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const requestCounter = new Counter('requests');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Spike to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% of requests < 500ms, 99% < 1s
    'http_req_failed': ['rate<0.01'], // Error rate < 1%
    'errors': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Authentication token (in real scenario, would be obtained via login)
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };

  // Test 1: Health check
  const healthRes = http.get(`${BASE_URL}/health`, { headers });
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  });
  requestCounter.add(1);
  errorRate.add(healthRes.status !== 200);

  // Test 2: Get KPIs (most common endpoint)
  const kpisRes = http.get(`${BASE_URL}/api/v1/kpis`, { headers });
  check(kpisRes, {
    'kpis status is 200': (r) => r.status === 200,
    'kpis response time < 500ms': (r) => r.timings.duration < 500,
  });
  apiDuration.add(kpisRes.timings.duration);
  requestCounter.add(1);
  errorRate.add(kpisRes.status !== 200);

  // Test 3: Get pipeline KPIs
  const pipelineRes = http.get(`${BASE_URL}/api/v1/kpis/pipeline`, { headers });
  check(pipelineRes, {
    'pipeline kpis status is 200 or 304': (r) => r.status === 200 || r.status === 304,
    'pipeline kpis response time < 500ms': (r) => r.timings.duration < 500,
  });
  apiDuration.add(pipelineRes.timings.duration);
  requestCounter.add(1);
  errorRate.add(pipelineRes.status !== 200 && pipelineRes.status !== 304);

  // Test 4: Get revenue KPIs
  const revenueRes = http.get(`${BASE_URL}/api/v1/kpis/revenue`, { headers });
  check(revenueRes, {
    'revenue kpis status is 200 or 304': (r) => r.status === 200 || r.status === 304,
    'revenue kpis response time < 500ms': (r) => r.timings.duration < 500,
  });
  apiDuration.add(revenueRes.timings.duration);
  requestCounter.add(1);
  errorRate.add(revenueRes.status !== 200 && revenueRes.status !== 304);

  // Test 5: Get compliance KPIs
  const complianceRes = http.get(`${BASE_URL}/api/v1/kpis/compliance`, { headers });
  check(complianceRes, {
    'compliance kpis status is 200 or 304': (r) => r.status === 200 || r.status === 304,
    'compliance kpis response time < 500ms': (r) => r.timings.duration < 500,
  });
  apiDuration.add(complianceRes.timings.duration);
  requestCounter.add(1);
  errorRate.add(complianceRes.status !== 200 && complianceRes.status !== 304);

  // Test 6: Get outreach KPIs with filters
  const outreachRes = http.get(
    `${BASE_URL}/api/v1/kpis/outreach?facility_id=1&month=2024-01`, 
    { headers }
  );
  check(outreachRes, {
    'outreach kpis status is 200 or 304': (r) => r.status === 200 || r.status === 304,
    'outreach kpis response time < 500ms': (r) => r.timings.duration < 500,
  });
  apiDuration.add(outreachRes.timings.duration);
  requestCounter.add(1);
  errorRate.add(outreachRes.status !== 200 && outreachRes.status !== 304);

  // Think time between requests
  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const lines = [];
  
  lines.push(`${indent}Load Test Summary:`);
  lines.push(`${indent}==================`);
  
  const metrics = data.metrics;
  
  if (metrics.http_req_duration) {
    lines.push(`${indent}HTTP Request Duration:`);
    lines.push(`${indent}  avg: ${metrics.http_req_duration.values.avg.toFixed(2)}ms`);
    lines.push(`${indent}  p95: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
    lines.push(`${indent}  p99: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  }
  
  if (metrics.http_reqs) {
    lines.push(`${indent}Total Requests: ${metrics.http_reqs.values.count}`);
  }
  
  if (metrics.http_req_failed) {
    lines.push(`${indent}Failed Requests: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  }
  
  return lines.join('\n');
}
