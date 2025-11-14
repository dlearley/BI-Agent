import { TimeSeriesPoint, AnomalyResult, FeatureImportance, DriversResult } from '../types';

export class MLService {
  detectAnomalies(data: TimeSeriesPoint[], options: {
    method?: 'esd' | 'zscore';
    seasonalPeriod?: number;
    threshold?: number;
    alpha?: number;
  } = {}): AnomalyResult {
    const {
      method = 'esd',
      seasonalPeriod = 7,
      threshold = 3,
      alpha = 0.05,
    } = options;

    if (data.length === 0) {
      return {
        anomalies: [],
        statistics: {
          mean: 0,
          stdDev: 0,
          threshold,
          method,
        },
      };
    }

    const values = data.map(d => d.value);
    const timestamps = data.map(d => d.timestamp);

    if (method === 'zscore') {
      return this.detectAnomaliesZScore(values, timestamps, threshold, seasonalPeriod);
    } else {
      return this.detectAnomaliesESD(values, timestamps, threshold, alpha, seasonalPeriod);
    }
  }

  private detectAnomaliesZScore(
    values: number[],
    timestamps: string[],
    threshold: number,
    seasonalPeriod: number
  ): AnomalyResult {
    const deseasonalized = this.removeSeasonality(values, seasonalPeriod);
    const mean = this.mean(deseasonalized);
    const stdDev = this.standardDeviation(deseasonalized, mean);

    const anomalies = [];

    for (let i = 0; i < values.length; i++) {
      const zScore = Math.abs((deseasonalized[i] - mean) / stdDev);
      if (zScore > threshold) {
        anomalies.push({
          timestamp: timestamps[i],
          value: values[i],
          expectedValue: mean,
          score: zScore,
          severity: this.getSeverity(zScore, threshold),
        });
      }
    }

    return {
      anomalies,
      statistics: {
        mean,
        stdDev,
        threshold,
        method: 'zscore',
      },
    };
  }

  private detectAnomaliesESD(
    values: number[],
    timestamps: string[],
    maxAnomalies: number,
    alpha: number,
    seasonalPeriod: number
  ): AnomalyResult {
    const deseasonalized = this.removeSeasonality(values, seasonalPeriod);
    const anomalies = [];
    const workingData = [...deseasonalized];
    const workingTimestamps = [...timestamps];
    const workingValues = [...values];

    const n = workingData.length;
    
    for (let i = 0; i < Math.min(maxAnomalies, Math.floor(n / 2)); i++) {
      const mean = this.mean(workingData);
      const stdDev = this.standardDeviation(workingData, mean);
      
      if (stdDev === 0) break;

      let maxDeviation = 0;
      let maxIndex = -1;

      for (let j = 0; j < workingData.length; j++) {
        const deviation = Math.abs(workingData[j] - mean);
        if (deviation > maxDeviation) {
          maxDeviation = deviation;
          maxIndex = j;
        }
      }

      const testStatistic = maxDeviation / stdDev;
      const p = n - i - 1;
      const criticalValue = this.getCriticalValue(p, alpha);

      if (testStatistic > criticalValue) {
        anomalies.push({
          timestamp: workingTimestamps[maxIndex],
          value: workingValues[maxIndex],
          expectedValue: mean,
          score: testStatistic,
          severity: this.getSeverity(testStatistic, criticalValue),
        });

        workingData.splice(maxIndex, 1);
        workingTimestamps.splice(maxIndex, 1);
        workingValues.splice(maxIndex, 1);
      } else {
        break;
      }
    }

    const finalMean = this.mean(values);
    const finalStdDev = this.standardDeviation(values, finalMean);

    return {
      anomalies,
      statistics: {
        mean: finalMean,
        stdDev: finalStdDev,
        threshold: maxAnomalies,
        method: 'esd',
      },
    };
  }

  private removeSeasonality(values: number[], period: number): number[] {
    if (values.length < period * 2) {
      return values;
    }

    const seasonalComponents = new Array(period).fill(0);
    const counts = new Array(period).fill(0);

    for (let i = 0; i < values.length; i++) {
      const seasonIndex = i % period;
      seasonalComponents[seasonIndex] += values[i];
      counts[seasonIndex]++;
    }

    for (let i = 0; i < period; i++) {
      if (counts[i] > 0) {
        seasonalComponents[i] /= counts[i];
      }
    }

    const overallMean = this.mean(seasonalComponents);
    for (let i = 0; i < period; i++) {
      seasonalComponents[i] -= overallMean;
    }

    return values.map((val, idx) => val - seasonalComponents[idx % period]);
  }

  private getCriticalValue(n: number, alpha: number): number {
    const tDist = this.tDistributionCriticalValue(n - 2, alpha / (2 * n));
    return ((n - 1) * tDist) / Math.sqrt(n * (n - 2 + tDist * tDist));
  }

  private tDistributionCriticalValue(df: number, alpha: number): number {
    if (df <= 0) return 3.0;
    const z = this.normalInverseCDF(1 - alpha);
    const g1 = (z * z * z + z) / 4;
    const g2 = (5 * z * z * z * z * z + 16 * z * z * z + 3 * z) / 96;
    return z + g1 / df + g2 / (df * df);
  }

  private normalInverseCDF(p: number): number {
    if (p <= 0 || p >= 1) {
      throw new Error('Probability must be between 0 and 1');
    }

    const a1 = -39.6968302866538;
    const a2 = 220.946098424521;
    const a3 = -275.928510446969;
    const a4 = 138.357751867269;
    const a5 = -30.6647980661472;
    const a6 = 2.50662827745924;

    const b1 = -54.4760987982241;
    const b2 = 161.585836858041;
    const b3 = -155.698979859887;
    const b4 = 66.8013118877197;
    const b5 = -13.2806815528857;

    const c1 = -0.00778489400243029;
    const c2 = -0.322396458041136;
    const c3 = -2.40075827716184;
    const c4 = -2.54973253934373;
    const c5 = 4.37466414146497;
    const c6 = 2.93816398269878;

    const d1 = 0.00778469570904146;
    const d2 = 0.32246712907004;
    const d3 = 2.445134137143;
    const d4 = 3.75440866190742;

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    let q: number;
    let r: number;
    let result: number;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      result = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      result = (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
        (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      result = -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }

    return result;
  }

  private getSeverity(score: number, threshold: number): 'low' | 'medium' | 'high' {
    if (score < threshold * 1.5) return 'low';
    if (score < threshold * 2) return 'medium';
    return 'high';
  }

  analyzeDrivers(
    features: Record<string, number[]>,
    target: number[],
    options: {
      method?: 'correlation' | 'importance';
      topN?: number;
    } = {}
  ): DriversResult {
    const { method = 'importance', topN = 5 } = options;

    if (target.length === 0 || Object.keys(features).length === 0) {
      return {
        drivers: [],
        metadata: {
          method,
          totalFeatures: 0,
          samplesAnalyzed: 0,
        },
      };
    }

    const featureImportances: FeatureImportance[] = [];

    for (const [featureName, featureValues] of Object.entries(features)) {
      if (featureValues.length !== target.length) {
        continue;
      }

      let importance: number;
      let contribution: number;

      if (method === 'correlation') {
        const correlation = Math.abs(this.pearsonCorrelation(featureValues, target));
        importance = correlation;
        contribution = this.calculateContribution(featureValues, target);
      } else {
        importance = this.calculateFeatureImportance(featureValues, target);
        contribution = this.calculateContribution(featureValues, target);
      }

      featureImportances.push({
        feature: featureName,
        importance,
        contribution,
        direction: contribution > 0 ? 'positive' : 'negative',
      });
    }

    featureImportances.sort((a, b) => b.importance - a.importance);

    return {
      drivers: featureImportances.slice(0, topN),
      metadata: {
        method,
        totalFeatures: Object.keys(features).length,
        samplesAnalyzed: target.length,
      },
    };
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;

    const meanX = this.mean(x);
    const meanY = this.mean(y);

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    if (denomX === 0 || denomY === 0) return 0;

    return numerator / Math.sqrt(denomX * denomY);
  }

  private calculateFeatureImportance(feature: number[], target: number[]): number {
    const correlation = Math.abs(this.pearsonCorrelation(feature, target));
    const variance = this.variance(feature);
    const normalizedVariance = variance / (1 + variance);
    
    return correlation * (0.7 + 0.3 * normalizedVariance);
  }

  private calculateContribution(feature: number[], target: number[]): number {
    const correlation = this.pearsonCorrelation(feature, target);
    const featureStdDev = this.standardDeviation(feature, this.mean(feature));
    const targetStdDev = this.standardDeviation(target, this.mean(target));
    
    if (targetStdDev === 0) return 0;
    
    return correlation * (featureStdDev / targetStdDev);
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private variance(values: number[]): number {
    const avg = this.mean(values);
    return this.mean(values.map(v => (v - avg) ** 2));
  }

  private standardDeviation(values: number[], mean?: number): number {
    if (values.length === 0) return 0;
    const avg = mean !== undefined ? mean : this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = this.mean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }
}

export const mlService = new MLService();
