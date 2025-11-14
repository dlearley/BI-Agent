class ForecastSandbox {
    constructor() {
        this.currentForecast = null;
        this.chart = null;
        this.apiBase = '/api/v1/forecast';
        this.authToken = 'mock-jwt-token'; // In production, this would come from auth
        
        this.initializeEventListeners();
        this.setDefaultDates();
        this.loadScenarios();
    }

    initializeEventListeners() {
        // Form inputs
        document.getElementById('generateForecast').addEventListener('click', () => this.generateForecast());
        document.getElementById('saveScenario').addEventListener('click', () => this.saveScenario());
        document.getElementById('refreshScenarios').addEventListener('click', () => this.loadScenarios());

        // Sliders
        document.getElementById('growthRate').addEventListener('input', (e) => {
            document.getElementById('growthRateValue').textContent = `${e.target.value}%`;
        });

        document.getElementById('seasonality').addEventListener('input', (e) => {
            document.getElementById('seasonalityValue').textContent = `${e.target.value}%`;
        });

        document.getElementById('trend').addEventListener('input', (e) => {
            document.getElementById('trendValue').textContent = `${e.target.value}%`;
        });

        // Enable/disable save scenario button based on forecast
        document.getElementById('scenarioName').addEventListener('input', (e) => {
            const hasForecast = this.currentForecast !== null;
            const hasName = e.target.value.trim().length > 0;
            document.getElementById('saveScenario').disabled = !(hasForecast && hasName);
        });
    }

    setDefaultDates() {
        const today = new Date();
        const ninetyDaysAgo = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000));
        
        document.getElementById('startDate').value = ninetyDaysAgo.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
    }

    async generateForecast() {
        try {
            this.showLoading(true);
            this.hideMessages();

            const forecastRequest = this.buildForecastRequest();
            
            const response = await fetch(`${this.apiBase}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify(forecastRequest)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to generate forecast');
            }

            this.currentForecast = data.data;
            this.displayForecastResults();
            this.showSuccess('Forecast generated successfully!');
            
        } catch (error) {
            console.error('Error generating forecast:', error);
            this.showError(`Failed to generate forecast: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    buildForecastRequest() {
        return {
            metric: document.getElementById('metric').value,
            model: document.getElementById('model').value,
            startDate: new Date(document.getElementById('startDate').value).toISOString(),
            endDate: new Date(document.getElementById('endDate').value).toISOString(),
            horizon: parseInt(document.getElementById('horizon').value),
            frequency: document.getElementById('frequency').value,
            assumptions: {
                growthRate: parseFloat(document.getElementById('growthRate').value) / 100,
                seasonality: parseFloat(document.getElementById('seasonality').value) / 100,
                trend: parseFloat(document.getElementById('trend').value) / 100
            },
            backtest: document.getElementById('enableBacktest').checked ? {
                enabled: true,
                testPeriods: 30
            } : {
                enabled: false,
                testPeriods: 0
            }
        };
    }

    displayForecastResults() {
        const resultsDiv = document.getElementById('results');
        resultsDiv.classList.remove('hidden');

        this.updateChart();
        this.updateMetrics();
        this.updateBacktestResults();
    }

    updateChart() {
        const ctx = document.getElementById('forecastChart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }

        const predictions = this.currentForecast.predictions;
        const labels = predictions.map(p => p.date);
        const values = predictions.map(p => p.value);
        const upperBounds = predictions.map(p => p.confidenceInterval.upper);
        const lowerBounds = predictions.map(p => p.confidenceInterval.lower);

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Forecast',
                        data: values,
                        borderColor: 'rgb(102, 126, 234)',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Upper Bound',
                        data: upperBounds,
                        borderColor: 'rgba(102, 126, 234, 0.3)',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        pointRadius: 0
                    },
                    {
                        label: 'Lower Bound',
                        data: lowerBounds,
                        borderColor: 'rgba(102, 126, 234, 0.3)',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${this.currentForecast.metric} Forecast - ${this.currentForecast.model.toUpperCase()} Model`
                    },
                    legend: {
                        display: true
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: this.getTimeUnit()
                        }
                    },
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    }

    getTimeUnit() {
        const frequency = document.getElementById('frequency').value;
        switch (frequency) {
            case 'daily': return 'day';
            case 'weekly': return 'week';
            case 'monthly': return 'month';
            default: return 'day';
        }
    }

    updateMetrics() {
        const metricsGrid = document.getElementById('metricsGrid');
        const metadata = this.currentForecast.metadata;
        
        metricsGrid.innerHTML = `
            <div class="metric-card">
                <div class="metric-label">Model Accuracy</div>
                <div class="metric-value">${(metadata.modelAccuracy * 100).toFixed(1)}%</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Data Points</div>
                <div class="metric-value">${metadata.dataPoints.toLocaleString()}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Forecast Period</div>
                <div class="metric-value">${document.getElementById('horizon').value} days</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Model Used</div>
                <div class="metric-value">${this.currentForecast.model.toUpperCase()}</div>
            </div>
        `;
    }

    updateBacktestResults() {
        const backtestDiv = document.getElementById('backtestResults');
        const backtestMetrics = document.getElementById('backtestMetrics');
        
        if (!this.currentForecast.backtest) {
            backtestDiv.style.display = 'none';
            return;
        }

        backtestDiv.style.display = 'block';
        const backtest = this.currentForecast.backtest;
        
        backtestMetrics.innerHTML = `
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Mean Absolute Error</div>
                    <div class="metric-value">${backtest.mae.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Root Mean Square Error</div>
                    <div class="metric-value">${backtest.rmse.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Mean Absolute % Error</div>
                    <div class="metric-value">${(backtest.mape * 100).toFixed(1)}%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">R-squared</div>
                    <div class="metric-value">${backtest.r2.toFixed(3)}</div>
                </div>
            </div>
        `;
    }

    async saveScenario() {
        try {
            const scenarioName = document.getElementById('scenarioName').value.trim();
            const scenarioDescription = document.getElementById('scenarioDescription').value.trim();
            const saveAsReport = document.getElementById('saveAsReport').checked;

            if (!scenarioName) {
                this.showError('Please enter a scenario name');
                return;
            }

            const scenarioRequest = {
                forecastId: this.currentForecast.id,
                name: scenarioName,
                description: scenarioDescription || undefined,
                assumptions: this.currentForecast.assumptions,
                isReport: saveAsReport
            };

            const response = await fetch(`${this.apiBase}/scenarios`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify(scenarioRequest)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save scenario');
            }

            this.showSuccess(`Scenario "${scenarioName}" saved successfully!`);
            
            // Clear form
            document.getElementById('scenarioName').value = '';
            document.getElementById('scenarioDescription').value = '';
            document.getElementById('saveAsReport').checked = false;
            
            // Reload scenarios
            this.loadScenarios();
            
        } catch (error) {
            console.error('Error saving scenario:', error);
            this.showError(`Failed to save scenario: ${error.message}`);
        }
    }

    async loadScenarios() {
        try {
            const response = await fetch(`${this.apiBase}/scenarios/list?includeReports=true`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load scenarios');
            }

            this.displayScenarios(data.data);
            
        } catch (error) {
            console.error('Error loading scenarios:', error);
            this.showError(`Failed to load scenarios: ${error.message}`);
        }
    }

    displayScenarios(scenarios) {
        const scenarioList = document.getElementById('scenarioList');
        
        if (scenarios.length === 0) {
            scenarioList.innerHTML = '<p style="color: #666; font-style: italic;">No scenarios found. Create your first forecast to get started!</p>';
            return;
        }

        scenarioList.innerHTML = scenarios.map(scenario => `
            <div class="scenario-item">
                <div class="scenario-info">
                    <h4>${scenario.name} ${scenario.isReport ? '📊' : '🔮'}</h4>
                    <p>${scenario.description || 'No description'}</p>
                    <small>Created: ${new Date(scenario.createdAt).toLocaleString()}</small>
                </div>
                <div class="scenario-actions">
                    <button class="btn btn-secondary btn-small" onclick="forecastSandbox.loadScenario('${scenario.id}')">
                        Load
                    </button>
                    ${scenario.isReport ? 
                        `<button class="btn btn-primary btn-small" onclick="forecastSandbox.exportReport('${scenario.id}')">
                            Export
                        </button>` : ''
                    }
                </div>
            </div>
        `).join('');
    }

    async loadScenario(scenarioId) {
        try {
            // In a real implementation, you'd load the scenario details and populate the form
            this.showSuccess('Scenario loading feature coming soon!');
        } catch (error) {
            console.error('Error loading scenario:', error);
            this.showError(`Failed to load scenario: ${error.message}`);
        }
    }

    async exportReport(scenarioId) {
        try {
            // In a real implementation, you'd generate and download a report
            this.showSuccess('Report export feature coming soon!');
        } catch (error) {
            console.error('Error exporting report:', error);
            this.showError(`Failed to export report: ${error.message}`);
        }
    }

    showLoading(show) {
        const loadingDiv = document.getElementById('loading');
        if (show) {
            loadingDiv.classList.remove('hidden');
        } else {
            loadingDiv.classList.add('hidden');
        }
    }

    showError(message) {
        this.hideMessages();
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    showSuccess(message) {
        this.hideMessages();
        const successDiv = document.getElementById('success');
        successDiv.textContent = message;
        successDiv.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            successDiv.classList.add('hidden');
        }, 5000);
    }

    hideMessages() {
        document.getElementById('error').classList.add('hidden');
        document.getElementById('success').classList.add('hidden');
    }
}

// Initialize the forecast sandbox when the page loads
const forecastSandbox = new ForecastSandbox();