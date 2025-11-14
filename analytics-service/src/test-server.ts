import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const app: express.Application = express();

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'mocked',
      redis: 'mocked',
    },
  });
});

// Mock ML service endpoint
app.post('/forecast', async (req, res) => {
  const { metric, model, horizon } = req.body;
  
  const mockResponse = {
    id: uuidv4(),
    metric,
    model,
    predictions: Array.from({ length: horizon }, (_, i) => ({
      date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      value: Math.random() * 1000 + 500,
      confidenceInterval: {
        lower: Math.random() * 500 + 200,
        upper: Math.random() * 1500 + 800
      }
    })),
    backtest: {
      mae: Math.random() * 100,
      rmse: Math.random() * 150,
      mape: Math.random() * 0.1,
      r2: Math.random() * 0.3 + 0.7,
      actualVsPredicted: Array.from({ length: 10 }, (_, i) => ({
        date: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        actual: Math.random() * 1000 + 500,
        predicted: Math.random() * 1000 + 500
      }))
    },
    assumptions: req.body.assumptions || {},
    metadata: {
      createdAt: new Date().toISOString(),
      modelAccuracy: Math.random() * 0.2 + 0.8,
      dataPoints: Math.floor(Math.random() * 500) + 100
    }
  };

  res.json(mockResponse);
});

// Mock forecast API endpoints
app.get('/api/v1/forecast/metrics/available', (req, res) => {
  res.json({
    success: true,
    data: ['revenue', 'pipeline_count', 'time_to_fill', 'compliance_rate', 'outreach_response_rate'],
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/forecast/models/available', (req, res) => {
  res.json({
    success: true,
    data: ['prophet', 'arima', 'xgboost'],
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/v1/forecast/', async (req, res) => {
  try {
    // Call mock ML service
    const mlResponse = await fetch('http://localhost:8001/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    const forecastData = await mlResponse.json();
    
    res.json({
      success: true,
      data: forecastData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create forecast',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/v1/forecast/scenarios', (req, res) => {
  const { name, description, forecastId, assumptions, isReport } = req.body;
  
  res.status(201).json({
    success: true,
    data: {
      id: uuidv4(),
      name,
      description,
      forecastId,
      assumptions,
      createdAt: new Date().toISOString(),
      createdBy: 'test-user',
      isReport: isReport || false
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/forecast/scenarios/list', (req, res) => {
  res.json({
    success: true,
    data: [],
    timestamp: new Date().toISOString(),
  });
});

// Serve static files for the forecast UI
app.use('/js', express.static(path.join(__dirname, '../public/js')));
app.use('/forecast.html', express.static(path.join(__dirname, '../public/forecast.html')));
app.use('/forecast', express.static(path.join(__dirname, '../public/forecast.html')));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

const port = process.env.PORT || 3001;
const server = app.listen(port, () => {
  console.log(`🚀 Mock test server running on port ${port}`);
  console.log(`📊 Forecast UI available at http://localhost:${port}/forecast`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Mock server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Mock server closed');
    process.exit(0);
  });
});

export default app;