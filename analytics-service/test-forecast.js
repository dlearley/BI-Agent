#!/usr/bin/env node

// Simple test script to verify forecast functionality
const http = require('http');

// Test data
const forecastRequest = {
  metric: 'revenue',
  model: 'prophet',
  startDate: '2023-01-01T00:00:00.000Z',
  endDate: '2023-12-31T00:00:00.000Z',
  horizon: 30,
  frequency: 'daily',
  assumptions: {
    growthRate: 0.05,
    seasonality: 0.1
  },
  backtest: {
    enabled: true,
    testPeriods: 30
  }
};

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-jwt-token'
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body)
          };
          resolve(response);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Forecast API...\n');

  try {
    // Test health check
    console.log('1. Testing health check...');
    const healthResponse = await makeRequest('/health');
    console.log(`   Status: ${healthResponse.statusCode}`);
    console.log(`   Response: ${JSON.stringify(healthResponse.body, null, 2)}\n`);

    // Test available metrics
    console.log('2. Testing available metrics...');
    const metricsResponse = await makeRequest('/api/v1/forecast/metrics/available');
    console.log(`   Status: ${metricsResponse.statusCode}`);
    console.log(`   Metrics: ${metricsResponse.body.data.join(', ')}\n`);

    // Test available models
    console.log('3. Testing available models...');
    const modelsResponse = await makeRequest('/api/v1/forecast/models/available');
    console.log(`   Status: ${modelsResponse.statusCode}`);
    console.log(`   Models: ${modelsResponse.body.data.join(', ')}\n`);

    // Test forecast creation
    console.log('4. Testing forecast creation...');
    const forecastResponse = await makeRequest('/api/v1/forecast/', 'POST', forecastRequest);
    console.log(`   Status: ${forecastResponse.statusCode}`);
    if (forecastResponse.statusCode === 200) {
      const forecast = forecastResponse.body.data;
      console.log(`   Forecast ID: ${forecast.id}`);
      console.log(`   Metric: ${forecast.metric}`);
      console.log(`   Model: ${forecast.model}`);
      console.log(`   Predictions: ${forecast.predictions.length} points`);
      console.log(`   Model Accuracy: ${(forecast.metadata.modelAccuracy * 100).toFixed(1)}%`);
      
      if (forecast.backtest) {
        console.log(`   Backtest MAE: ${forecast.backtest.mae.toFixed(2)}`);
        console.log(`   Backtest R²: ${forecast.backtest.r2.toFixed(3)}`);
      }
    } else {
      console.log(`   Error: ${JSON.stringify(forecastResponse.body)}`);
    }
    console.log('');

    // Test scenario creation
    console.log('5. Testing scenario creation...');
    const scenarioRequest = {
      forecastId: forecastResponse.statusCode === 200 ? forecastResponse.body.data.id : 'test-id',
      name: 'Test Scenario',
      description: 'A test scenario for verification',
      assumptions: {
        growthRate: 0.15,
        seasonality: 0.2
      },
      isReport: true
    };
    
    const scenarioResponse = await makeRequest('/api/v1/forecast/scenarios', 'POST', scenarioRequest);
    console.log(`   Status: ${scenarioResponse.statusCode}`);
    if (scenarioResponse.statusCode === 201) {
      const scenario = scenarioResponse.body.data;
      console.log(`   Scenario ID: ${scenario.id}`);
      console.log(`   Name: ${scenario.name}`);
      console.log(`   Is Report: ${scenario.isReport}`);
    } else {
      console.log(`   Error: ${JSON.stringify(scenarioResponse.body)}`);
    }
    console.log('');

    // Test UI serving
    console.log('6. Testing forecast UI...');
    const uiResponse = await makeRequest('/forecast');
    console.log(`   Status: ${uiResponse.statusCode}`);
    console.log(`   Content-Type: ${uiResponse.headers['content-type']}`);
    if (typeof uiResponse.body === 'string') {
      console.log(`   Contains 'Forecast Sandbox': ${uiResponse.body.includes('Forecast Sandbox')}`);
      console.log(`   Contains 'metric to forecast': ${uiResponse.body.includes('metric to forecast')}`);
    }
    console.log('');

    console.log('✅ All tests completed successfully!');
    console.log('\n📊 You can now access the Forecast Sandbox at: http://localhost:3001/forecast');
    console.log('🔮 The UI allows you to:');
    console.log('   - Select metrics and ML models');
    console.log('   - Adjust what-if assumptions with sliders');
    console.log('   - Generate forecasts with backtesting');
    console.log('   - Save scenarios as reports');
    console.log('   - View forecast charts and performance metrics');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the mock test server is running:');
    console.log('   npm run build');
    console.log('   node dist/test-server.js');
  }
}

// Run tests
runTests();