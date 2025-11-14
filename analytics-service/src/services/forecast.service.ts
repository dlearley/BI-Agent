import { 
  ForecastRequest, 
  ForecastResponse, 
  ForecastScenario, 
  ForecastModel, 
  ForecastMetric,
  BacktestResults,
  ForecastPoint,
  ForecastAssumptions
} from '../types';
import { redis } from '../config/redis';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export class ForecastService {
  private mlServiceUrl: string;
  private mlServiceTimeout: number;

  constructor() {
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    this.mlServiceTimeout = parseInt(process.env.ML_SERVICE_TIMEOUT || '30000');
  }

  async createForecast(request: ForecastRequest): Promise<ForecastResponse> {
    try {
      // Generate unique forecast ID
      const forecastId = uuidv4();
      
      // Call ML service
      const mlResponse = await this.callMLService({
        ...request,
        id: forecastId
      });

      // Cache the forecast
      await this.cacheForecast(forecastId, mlResponse);

      // Store in database for persistence
      await this.saveForecastToDatabase(forecastId, request, mlResponse);

      return mlResponse;
    } catch (error) {
      console.error('Error creating forecast:', error);
      throw new Error('Failed to create forecast');
    }
  }

  async getForecast(forecastId: string): Promise<ForecastResponse | null> {
    try {
      // Try to get from cache first
      const cached = await redis.get(`forecast:${forecastId}`);
      if (cached) {
        return cached;
      }

      // Get from database
      const forecast = await db.query(`
        SELECT * FROM forecasts WHERE id = $1
      `, [forecastId]);

      if (forecast.length === 0) {
        return null;
      }

      const forecastData = forecast[0];
      const response: ForecastResponse = {
        id: forecastData.id,
        metric: forecastData.metric as ForecastMetric,
        model: forecastData.model as ForecastModel,
        predictions: JSON.parse(forecastData.predictions),
        backtest: forecastData.backtest ? JSON.parse(forecastData.backtest) : undefined,
        assumptions: JSON.parse(forecastData.assumptions),
        metadata: {
          createdAt: forecastData.created_at,
          modelAccuracy: forecastData.model_accuracy,
          dataPoints: forecastData.data_points
        }
      };

      // Cache for future requests
      await this.cacheForecast(forecastId, response);

      return response;
    } catch (error) {
      console.error('Error getting forecast:', error);
      throw new Error('Failed to retrieve forecast');
    }
  }

  async createScenario(
    forecastId: string, 
    name: string, 
    description: string | undefined,
    assumptions: ForecastAssumptions,
    createdBy: string,
    isReport: boolean = false
  ): Promise<ForecastScenario> {
    try {
      const scenarioId = uuidv4();
      
      // Verify forecast exists
      const forecast = await this.getForecast(forecastId);
      if (!forecast) {
        throw new Error('Forecast not found');
      }

      // Save scenario to database
      await db.query(`
        INSERT INTO forecast_scenarios (id, name, description, forecast_id, assumptions, created_by, is_report)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [scenarioId, name, description, forecastId, JSON.stringify(assumptions), createdBy, isReport]);

      const scenario: ForecastScenario = {
        id: scenarioId,
        name,
        description,
        forecastId,
        assumptions,
        createdAt: new Date().toISOString(),
        createdBy,
        isReport
      };

      return scenario;
    } catch (error) {
      console.error('Error creating scenario:', error);
      throw new Error('Failed to create scenario');
    }
  }

  async getScenarios(userId: string, includeReports: boolean = false): Promise<ForecastScenario[]> {
    try {
      const result = await db.query(`
        SELECT * FROM forecast_scenarios 
        WHERE created_by = $1 
        AND ($2 = true OR is_report = false)
        ORDER BY created_at DESC
      `, [userId, includeReports]);

      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        forecastId: row.forecast_id,
        assumptions: JSON.parse(row.assumptions),
        createdAt: row.created_at,
        createdBy: row.created_by,
        isReport: row.is_report
      }));
    } catch (error) {
      console.error('Error getting scenarios:', error);
      throw new Error('Failed to retrieve scenarios');
    }
  }

  async getAvailableMetrics(): Promise<ForecastMetric[]> {
    return Object.values(ForecastMetric);
  }

  async getAvailableModels(): Promise<ForecastModel[]> {
    return Object.values(ForecastModel);
  }

  private async callMLService(request: ForecastRequest & { id: string }): Promise<ForecastResponse> {
    const response = await fetch(`${this.mlServiceUrl}/forecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.mlServiceTimeout)
    });

    if (!response.ok) {
      throw new Error(`ML service error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    // Transform ML service response to our format
    return {
      id: request.id,
      metric: request.metric,
      model: request.model,
      predictions: data.predictions || [],
      backtest: data.backtest,
      assumptions: request.assumptions || {},
      metadata: {
        createdAt: new Date().toISOString(),
        modelAccuracy: data.modelAccuracy || 0,
        dataPoints: data.dataPoints || 0
      }
    };
  }

  private async cacheForecast(forecastId: string, forecast: ForecastResponse): Promise<void> {
    await redis.set(
      `forecast:${forecastId}`, 
      forecast,
      3600 // Cache for 1 hour
    );
  }

  private async saveForecastToDatabase(
    forecastId: string, 
    request: ForecastRequest, 
    response: ForecastResponse
  ): Promise<void> {
    await db.query(`
      INSERT INTO forecasts (
        id, metric, model, predictions, backtest, assumptions, 
        model_accuracy, data_points, start_date, end_date, horizon, frequency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      forecastId,
      request.metric,
      request.model,
      JSON.stringify(response.predictions),
      response.backtest ? JSON.stringify(response.backtest) : null,
      JSON.stringify(request.assumptions || {}),
      response.metadata.modelAccuracy,
      response.metadata.dataPoints,
      request.startDate,
      request.endDate,
      request.horizon,
      request.frequency
    ]);
  }
}

export const forecastService = new ForecastService();