#!/usr/bin/env node

/**
 * Load Test for Analytics API using autocannon
 * Tests API performance under expected concurrency
 */

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DURATION = parseInt(process.env.DURATION || '60'); // seconds
const CONNECTIONS = parseInt(process.env.CONNECTIONS || '50');
const PIPELINING = parseInt(process.env.PIPELINING || '1');

// Latency targets (in milliseconds)
const LATENCY_TARGETS = {
  p50: 100,  // 50th percentile < 100ms
  p95: 500,  // 95th percentile < 500ms
  p99: 1000, // 99th percentile < 1000ms
};

const endpoints = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/api/v1/kpis' },
  { method: 'GET', path: '/api/v1/kpis/pipeline' },
  { method: 'GET', path: '/api/v1/kpis/revenue' },
  { method: 'GET', path: '/api/v1/kpis/compliance' },
  { method: 'GET', path: '/api/v1/kpis/outreach' },
];

async function runLoadTest() {
  console.log('Starting Analytics API Load Test');
  console.log('=================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Duration: ${DURATION}s`);
  console.log(`Connections: ${CONNECTIONS}`);
  console.log('');

  const results = [];

  for (const endpoint of endpoints) {
    console.log(`Testing ${endpoint.method} ${endpoint.path}...`);

    const result = await new Promise((resolve, reject) => {
      const instance = autocannon({
        url: `${BASE_URL}${endpoint.path}`,
        method: endpoint.method,
        connections: CONNECTIONS,
        pipelining: PIPELINING,
        duration: DURATION,
        headers: {
          'Content-Type': 'application/json',
        },
      }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });

      autocannon.track(instance, { renderProgressBar: true });
    });

    results.push({
      endpoint: `${endpoint.method} ${endpoint.path}`,
      ...analyzeResult(result),
    });

    console.log('');
  }

  // Generate summary report
  const report = generateReport(results);
  console.log(report);

  // Save reports
  saveReports(results, report);

  // Check if targets were met
  const targetsMet = checkTargets(results);
  process.exit(targetsMet ? 0 : 1);
}

function analyzeResult(result) {
  const latency = result.latency;
  const requests = result.requests;
  const throughput = result.throughput;
  const errors = result.errors + result.timeouts;

  return {
    requests_total: requests.total,
    requests_per_sec: requests.average,
    latency_mean: latency.mean,
    latency_p50: latency.p50,
    latency_p95: latency.p95,
    latency_p99: latency.p99,
    latency_max: latency.max,
    throughput_avg: throughput.average,
    throughput_total: throughput.total,
    errors: errors,
    error_rate: requests.total > 0 ? (errors / requests.total) * 100 : 0,
    duration: result.duration,
  };
}

function generateReport(results) {
  const lines = [];
  
  lines.push('');
  lines.push('='.repeat(100));
  lines.push('LOAD TEST SUMMARY REPORT');
  lines.push('='.repeat(100));
  lines.push('');
  lines.push(`Timestamp: ${new Date().toISOString()}`);
  lines.push(`Test Configuration: ${CONNECTIONS} connections, ${DURATION}s duration`);
  lines.push('');
  lines.push('-'.repeat(100));
  lines.push(
    'Endpoint'.padEnd(35) +
    'Req/s'.padEnd(10) +
    'P50(ms)'.padEnd(10) +
    'P95(ms)'.padEnd(10) +
    'P99(ms)'.padEnd(10) +
    'Errors'.padEnd(10) +
    'Status'
  );
  lines.push('-'.repeat(100));

  for (const result of results) {
    const p50_status = result.latency_p50 <= LATENCY_TARGETS.p50 ? '✓' : '✗';
    const p95_status = result.latency_p95 <= LATENCY_TARGETS.p95 ? '✓' : '✗';
    const p99_status = result.latency_p99 <= LATENCY_TARGETS.p99 ? '✓' : '✗';
    const error_status = result.error_rate < 1 ? '✓' : '✗';
    
    const overall_status = 
      result.latency_p95 <= LATENCY_TARGETS.p95 && 
      result.latency_p99 <= LATENCY_TARGETS.p99 && 
      result.error_rate < 1 
        ? 'PASS' 
        : 'FAIL';
    
    lines.push(
      result.endpoint.padEnd(35) +
      result.requests_per_sec.toFixed(2).padEnd(10) +
      result.latency_p50.toFixed(2).padEnd(10) +
      result.latency_p95.toFixed(2).padEnd(10) +
      result.latency_p99.toFixed(2).padEnd(10) +
      result.errors.toString().padEnd(10) +
      overall_status
    );
  }

  lines.push('-'.repeat(100));
  lines.push('');
  lines.push('LATENCY TARGETS:');
  lines.push(`  P50: ${LATENCY_TARGETS.p50}ms | P95: ${LATENCY_TARGETS.p95}ms | P99: ${LATENCY_TARGETS.p99}ms`);
  lines.push('');
  
  const passed = results.filter(r => 
    r.latency_p95 <= LATENCY_TARGETS.p95 && 
    r.latency_p99 <= LATENCY_TARGETS.p99 && 
    r.error_rate < 1
  ).length;
  const failed = results.length - passed;
  
  lines.push(`OVERALL: ${passed}/${results.length} endpoints passed latency targets`);
  lines.push('');
  lines.push('='.repeat(100));
  
  return lines.join('\n');
}

function checkTargets(results) {
  let allPassed = true;

  for (const result of results) {
    if (result.latency_p95 > LATENCY_TARGETS.p95) {
      console.error(`❌ ${result.endpoint}: P95 latency ${result.latency_p95.toFixed(2)}ms exceeds target ${LATENCY_TARGETS.p95}ms`);
      allPassed = false;
    }
    if (result.latency_p99 > LATENCY_TARGETS.p99) {
      console.error(`❌ ${result.endpoint}: P99 latency ${result.latency_p99.toFixed(2)}ms exceeds target ${LATENCY_TARGETS.p99}ms`);
      allPassed = false;
    }
    if (result.error_rate >= 1) {
      console.error(`❌ ${result.endpoint}: Error rate ${result.error_rate.toFixed(2)}% exceeds target 1%`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\n✅ All endpoints met latency targets!');
  } else {
    console.log('\n❌ Some endpoints failed to meet latency targets');
  }

  return allPassed;
}

function saveReports(results, report) {
  const reportDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  
  // Save text report
  const textFile = path.join(reportDir, `load-test_${timestamp}.txt`);
  fs.writeFileSync(textFile, report);
  console.log(`\nText report saved to: ${textFile}`);

  // Save JSON report
  const jsonFile = path.join(reportDir, `load-test_${timestamp}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    configuration: {
      base_url: BASE_URL,
      duration: DURATION,
      connections: CONNECTIONS,
      pipelining: PIPELINING,
    },
    targets: LATENCY_TARGETS,
    results: results,
  }, null, 2));
  console.log(`JSON report saved to: ${jsonFile}`);
}

// Run the load test
if (require.main === module) {
  runLoadTest().catch(err => {
    console.error('Load test failed:', err);
    process.exit(1);
  });
}

module.exports = { runLoadTest };
