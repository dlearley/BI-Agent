import { Request, Response } from 'express';
import { forecastService } from '../services/forecast.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import { 
  ForecastRequest, 
  ForecastModel, 
  ForecastMetric,
  ForecastAssumptions 
} from '../types';

const forecastRequestSchema = z.object({
  metric: z.nativeEnum(ForecastMetric),
  model: z.nativeEnum(ForecastModel),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  horizon: z.number().min(1).max(365),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  assumptions: z.object({
    growthRate: z.number().optional(),
    seasonality: z.number().optional(),
    trend: z.number().optional(),
    externalFactors: z.record(z.number()).optional()
  }).optional(),
  backtest: z.object({
    enabled: z.boolean(),
    testPeriods: z.number().min(1).max(100)
  }).optional()
});

const createScenarioSchema = z.object({
  forecastId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  assumptions: z.object({
    growthRate: z.number().optional(),
    seasonality: z.number().optional(),
    trend: z.number().optional(),
    externalFactors: z.record(z.number()).optional()
  }),
  isReport: z.boolean().default(false)
});

export class ForecastController {
  async createForecast(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = forecastRequestSchema.parse(req.body) as ForecastRequest;
      const user = req.user!;

      const forecast = await forecastService.createForecast(validatedData);
      
      res.json({
        success: true,
        data: forecast,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating forecast:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to create forecast',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getForecast(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { forecastId } = req.params;
      
      if (!forecastId) {
        res.status(400).json({
          success: false,
          error: 'Forecast ID is required',
        });
        return;
      }

      const forecast = await forecastService.getForecast(forecastId);
      
      if (!forecast) {
        res.status(404).json({
          success: false,
          error: 'Forecast not found',
        });
        return;
      }
      
      res.json({
        success: true,
        data: forecast,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error getting forecast:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve forecast',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createScenario(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = createScenarioSchema.parse(req.body);
      const user = req.user!;

      const scenario = await forecastService.createScenario(
        validatedData.forecastId,
        validatedData.name,
        validatedData.description,
        validatedData.assumptions,
        user.id,
        validatedData.isReport
      );
      
      res.status(201).json({
        success: true,
        data: scenario,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating scenario:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to create scenario',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getScenarios(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { includeReports } = req.query;
      const user = req.user!;
      
      const scenarios = await forecastService.getScenarios(
        user.id, 
        includeReports === 'true'
      );
      
      res.json({
        success: true,
        data: scenarios,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error getting scenarios:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve scenarios',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAvailableMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const metrics = await forecastService.getAvailableMetrics();
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error getting available metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve available metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAvailableModels(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const models = await forecastService.getAvailableModels();
      
      res.json({
        success: true,
        data: models,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error getting available models:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve available models',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const forecastController = new ForecastController();