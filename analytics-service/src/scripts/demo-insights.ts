import { mlService } from '../services/ml.service';
import { TimeSeriesPoint } from '../types';

function generateDemoData(): {
  timeSeries: TimeSeriesPoint[];
  features: Record<string, number[]>;
  target: number[];
} {
  const timeSeries: TimeSeriesPoint[] = [];
  const features: Record<string, number[]> = {
    job_postings: [],
    response_rate: [],
    avg_salary: [],
    facility_rating: [],
  };
  const target: number[] = [];

  for (let i = 0; i < 30; i++) {
    const baseValue = 50;
    const trend = i * 2;
    const seasonalEffect = Math.sin(i * Math.PI / 7) * 5;
    const noise = Math.random() * 10 - 5;
    
    const anomalySpike = (i === 10 || i === 20) ? 80 : 0;
    
    const value = baseValue + trend + seasonalEffect + noise + anomalySpike;
    
    timeSeries.push({
      timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
      value: Math.max(0, value),
    });

    features.job_postings.push(10 + i * 0.5 + Math.random() * 2);
    features.response_rate.push(0.3 + i * 0.01 + Math.random() * 0.05);
    features.avg_salary.push(75000 + i * 500 + Math.random() * 1000);
    features.facility_rating.push(4.0 + i * 0.02 + Math.random() * 0.1);
    
    target.push(20 + i * 3 + Math.random() * 10);
  }

  return { timeSeries, features, target };
}

async function runDemo() {
  console.log('='.repeat(60));
  console.log('Insights ML Service Demo');
  console.log('='.repeat(60));
  console.log();

  const { timeSeries, features, target } = generateDemoData();

  console.log('1. ANOMALY DETECTION');
  console.log('-'.repeat(60));
  console.log(`Analyzing ${timeSeries.length} data points for anomalies...`);
  console.log();

  const anomalyResult = mlService.detectAnomalies(timeSeries, {
    method: 'esd',
    threshold: 5,
    alpha: 0.05,
    seasonalPeriod: 7,
  });

  console.log(`Statistics:`);
  console.log(`  Mean: ${anomalyResult.statistics.mean.toFixed(2)}`);
  console.log(`  Std Dev: ${anomalyResult.statistics.stdDev.toFixed(2)}`);
  console.log(`  Method: ${anomalyResult.statistics.method}`);
  console.log();

  console.log(`Detected ${anomalyResult.anomalies.length} anomalies:`);
  anomalyResult.anomalies.forEach((anomaly, idx) => {
    console.log(`  ${idx + 1}. ${anomaly.timestamp}: ${anomaly.value.toFixed(2)} (expected: ${anomaly.expectedValue.toFixed(2)}, score: ${anomaly.score.toFixed(2)}, severity: ${anomaly.severity})`);
  });
  console.log();

  console.log('2. DRIVER ANALYSIS');
  console.log('-'.repeat(60));
  console.log(`Analyzing ${Object.keys(features).length} features for importance...`);
  console.log();

  const driversResult = mlService.analyzeDrivers(features, target, {
    method: 'importance',
    topN: 4,
  });

  console.log(`Top Performance Drivers:`);
  driversResult.drivers.forEach((driver, idx) => {
    console.log(`  ${idx + 1}. ${driver.feature}`);
    console.log(`     Importance: ${(driver.importance * 100).toFixed(2)}%`);
    console.log(`     Contribution: ${driver.contribution.toFixed(3)} (${driver.direction})`);
  });
  console.log();

  console.log('3. TREND ANALYSIS');
  console.log('-'.repeat(60));

  const values = timeSeries.map(d => d.value);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  
  let slope = 0;
  const n = values.length;
  for (let i = 0; i < n; i++) {
    slope += (i - (n - 1) / 2) * (values[i] - mean);
  }
  slope = slope / values.reduce((sum, _, i) => sum + Math.pow(i - (n - 1) / 2, 2), 0);

  const direction = slope > 0.1 ? 'Increasing' : slope < -0.1 ? 'Decreasing' : 'Stable';
  const changeRate = (slope / mean) * 100;

  console.log(`  Direction: ${direction}`);
  console.log(`  Change Rate: ${changeRate.toFixed(2)}% per period`);
  console.log(`  Variance: ${variance.toFixed(2)}`);
  console.log();

  console.log('4. NARRATIVE SUMMARY');
  console.log('-'.repeat(60));

  let narrative = `Analysis of 30-day period shows ${direction.toLowerCase()} trend `;
  narrative += `with ${Math.abs(changeRate).toFixed(1)}% ${slope > 0 ? 'growth' : 'decline'} rate. `;
  
  if (variance > 100) {
    narrative += `High variance (${variance.toFixed(0)}) indicates significant fluctuations. `;
  } else {
    narrative += `Low variance (${variance.toFixed(0)}) suggests stable performance. `;
  }

  if (anomalyResult.anomalies.length > 0) {
    const highSeverity = anomalyResult.anomalies.filter(a => a.severity === 'high').length;
    narrative += `Detected ${anomalyResult.anomalies.length} anomalies`;
    if (highSeverity > 0) {
      narrative += `, including ${highSeverity} high-severity events requiring attention.`;
    } else {
      narrative += '. ';
    }
  } else {
    narrative += `No significant anomalies detected. `;
  }

  if (driversResult.drivers.length > 0) {
    const topDriver = driversResult.drivers[0];
    narrative += `Key performance driver: ${topDriver.feature} with ${(topDriver.importance * 100).toFixed(1)}% importance.`;
  }

  console.log(narrative);
  console.log();

  console.log('='.repeat(60));
  console.log('Demo Complete');
  console.log('='.repeat(60));
}

if (require.main === module) {
  runDemo().catch(console.error);
}

export { runDemo };
