/**
 * Example script demonstrating dashboard API usage
 * This script shows how to create dashboards, widgets, queries, and exports
 */

import { DashboardClient, createDashboardClient } from '../sdk/dashboard-client';
import { 
  WidgetType, 
  DashboardStatus, 
  ExportType 
} from '../types';

// Configuration
const config = {
  baseURL: 'http://localhost:3000/api/v1',
  apiKey: 'your-jwt-token-here' // Replace with actual token
};

// Create client
const client = createDashboardClient(config);

async function runDashboardExample(): Promise<void> {
  console.log('🚀 Starting Dashboard API Example...\n');

  try {
    // 1. Create a new dashboard
    console.log('📊 Creating dashboard...');
    const dashboard = await client.createDashboard({
      name: 'Sales Performance Dashboard',
      description: 'Real-time sales performance metrics and analytics',
      tags: ['sales', 'performance', 'kpi'],
      isPublic: false
    });
    
    console.log('✅ Dashboard created:', dashboard.data?.name);
    console.log('   ID:', dashboard.data?.id);
    console.log('   Status:', dashboard.data?.status);
    console.log('');

    const dashboardId = dashboard.data!.id;

    // 2. Create queries for widgets
    console.log('🔍 Creating queries...');
    
    // Sales KPI query
    const salesKpiQuery = await client.createQuery({
      name: 'Sales KPI Query',
      description: 'Total sales revenue and growth metrics',
      queryText: `
        SELECT 
          SUM(amount) as total_sales,
          COUNT(*) as transaction_count,
          AVG(amount) as avg_transaction_value,
          LAG(SUM(amount)) OVER (ORDER BY DATE_TRUNC('month', created_at)) as prev_month_sales
        FROM sales_transactions 
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) DESC
        LIMIT 1
      `,
      queryType: 'sql',
      parameters: [
        {
          name: 'start_date',
          type: 'date',
          required: false,
          description: 'Start date for sales data'
        },
        {
          name: 'end_date',
          type: 'date',
          required: false,
          description: 'End date for sales data'
        }
      ],
      isTemplate: false
    });
    
    console.log('✅ Sales KPI query created:', salesKpiQuery.data?.name);

    // Sales trend query
    const salesTrendQuery = await client.createQuery({
      name: 'Sales Trend Query',
      description: 'Monthly sales trend over time',
      queryText: `
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          SUM(amount) as revenue,
          COUNT(*) as transactions
        FROM sales_transactions 
        WHERE created_at >= NOW() - INTERVAL '24 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month ASC
      `,
      queryType: 'sql',
      isTemplate: false
    });
    
    console.log('✅ Sales trend query created:', salesTrendQuery.data?.name);

    // Regional sales query
    const regionalSalesQuery = await client.createQuery({
      name: 'Regional Sales Query',
      description: 'Sales by region',
      queryText: `
        SELECT 
          region,
          country,
          SUM(amount) as revenue,
          COUNT(*) as transactions
        FROM sales_transactions st
        JOIN locations l ON st.location_id = l.id
        WHERE st.created_at >= NOW() - INTERVAL '12 months'
        GROUP BY region, country
        ORDER BY revenue DESC
      `,
      queryType: 'sql',
      isTemplate: false
    });
    
    console.log('✅ Regional sales query created:', regionalSalesQuery.data?.name);
    console.log('');

    // 3. Create widgets
    console.log('📈 Creating widgets...');
    
    // KPI Widget
    const kpiWidget = await client.createWidget({
      dashboardId,
      name: 'Total Sales Revenue',
      type: WidgetType.KPI,
      queryId: salesKpiQuery.data!.id,
      config: {
        title: 'Total Sales Revenue',
        subtitle: 'Last 30 days',
        kpi: {
          format: 'currency',
          trend: true,
          comparison: {
            period: 'previous_month',
            type: 'percentage'
          }
        },
        colors: ['#10b981', '#ef4444'] // Green for positive, red for negative
      },
      position: {
        id: 'widget-kpi-1',
        x: 0,
        y: 0,
        w: 4,
        h: 2
      },
      refreshInterval: 300 // 5 minutes
    });
    
    console.log('✅ KPI widget created:', kpiWidget.data?.name);

    // Line chart widget
    const lineWidget = await client.createWidget({
      dashboardId,
      name: 'Sales Trend',
      type: WidgetType.LINE,
      queryId: salesTrendQuery.data!.id,
      config: {
        title: 'Monthly Sales Trend',
        subtitle: '24-month overview',
        colors: ['#3b82f6'],
        legend: {
          show: true,
          position: 'top'
        },
        axes: {
          x: {
            label: 'Month',
            type: 'time'
          },
          y: {
            label: 'Revenue ($)',
            min: 0
          }
        }
      },
      position: {
        id: 'widget-line-1',
        x: 4,
        y: 0,
        w: 8,
        h: 4
      },
      refreshInterval: 600 // 10 minutes
    });
    
    console.log('✅ Line chart widget created:', lineWidget.data?.name);

    // Bar chart widget
    const barWidget = await client.createWidget({
      dashboardId,
      name: 'Regional Sales',
      type: WidgetType.BAR,
      queryId: regionalSalesQuery.data!.id,
      config: {
        title: 'Sales by Region',
        subtitle: 'Top 10 regions',
        colors: ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
        legend: {
          show: true,
          position: 'right'
        },
        axes: {
          x: {
            label: 'Region',
            type: 'category'
          },
          y: {
            label: 'Revenue ($)',
            min: 0
          }
        }
      },
      position: {
        id: 'widget-bar-1',
        x: 0,
        y: 4,
        w: 6,
        h: 4
      },
      refreshInterval: 900 // 15 minutes
    });
    
    console.log('✅ Bar chart widget created:', barWidget.data?.name);

    // Table widget
    const tableWidget = await client.createWidget({
      dashboardId,
      name: 'Regional Sales Details',
      type: WidgetType.TABLE,
      queryId: regionalSalesQuery.data!.id,
      config: {
        title: 'Regional Sales Details',
        table: {
          pagination: true,
          pageSize: 10,
          sortable: true,
          filterable: true
        }
      },
      position: {
        id: 'widget-table-1',
        x: 6,
        y: 4,
        w: 6,
        h: 4
      },
      refreshInterval: 900 // 15 minutes
    });
    
    console.log('✅ Table widget created:', tableWidget.data?.name);
    console.log('');

    // 4. Get widget data
    console.log('📊 Fetching widget data...');
    
    const kpiData = await client.getWidgetData({
      widgetId: kpiWidget.data!.id,
      useCache: true
    });
    
    console.log('✅ KPI data retrieved:', kpiData.data?.cached ? 'from cache' : 'fresh');
    
    const lineData = await client.getWidgetData({
      widgetId: lineWidget.data!.id,
      useCache: true
    });
    
    console.log('✅ Line chart data retrieved:', lineData.data?.cached ? 'from cache' : 'fresh');
    console.log('');

    // 5. Publish dashboard
    console.log('🚀 Publishing dashboard...');
    const publishedDashboard = await client.publishDashboard(dashboardId);
    
    console.log('✅ Dashboard published!');
    console.log('   Status:', publishedDashboard.data?.status);
    console.log('   Published at:', publishedDashboard.data?.publishedAt);
    console.log('');

    // 6. Create export job
    console.log('📄 Creating export job...');
    const exportJob = await client.createExportJob({
      dashboardId,
      exportType: ExportType.PDF,
      formatOptions: {
        paperSize: 'A4',
        orientation: 'landscape',
        includeTimestamp: true,
        customHeader: 'Sales Performance Report',
        customFooter: 'Confidential - Internal Use Only'
      }
    });
    
    console.log('✅ Export job created:', exportJob.data?.id);
    console.log('   Status:', exportJob.data?.status);
    console.log('');

    // 7. Wait for export completion
    console.log('⏳ Waiting for export completion...');
    
    try {
      const completedExport = await client.waitForExportCompletion(exportJob.data!.id, 3000, 20);
      
      console.log('✅ Export completed!');
      console.log('   File size:', completedExport.fileSize, 'bytes');
      console.log('   File path:', completedExport.filePath);
      
      // Download the file (if available)
      if (completedExport.filePath) {
        const fileBlob = await client.downloadExportFile(completedExport);
        console.log('✅ Export file downloaded:', fileBlob.size, 'bytes');
      }
    } catch (error) {
      console.log('⚠️ Export completion check timed out:', error);
    }
    
    console.log('');

    // 8. Get final dashboard state
    console.log('📋 Getting final dashboard state...');
    const finalDashboard = await client.getDashboard(dashboardId, {
      includeWidgets: true,
      includeVersions: true,
      includeShares: true
    });
    
    console.log('✅ Final dashboard state:');
    console.log('   Name:', finalDashboard.data?.name);
    console.log('   Version:', finalDashboard.data?.version);
    console.log('   Status:', finalDashboard.data?.status);
    console.log('   Widgets:', finalDashboard.data?.widgets?.length);
    console.log('   Versions:', finalDashboard.data?.versions?.length);
    console.log('');

    // 9. Share dashboard
    console.log('🔗 Sharing dashboard...');
    const shareResponse = await fetch(`${config.baseURL}/dashboard/dashboards/${dashboardId}/share`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sharedWithUserId: 'user-123',
        permissionLevel: 'view'
      })
    });
    
    if (shareResponse.ok) {
      console.log('✅ Dashboard shared successfully');
    } else {
      console.log('⚠️ Dashboard sharing failed (may not be implemented in this example)');
    }

    console.log('\n🎉 Dashboard API Example completed successfully!');

  } catch (error) {
    console.error('❌ Error in dashboard example:', error);
    
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Helper function to demonstrate batch operations
async function demonstrateBatchOperations(): Promise<void> {
  console.log('\n🔄 Demonstrating batch operations...\n');

  try {
    // Create multiple widgets at once
    const widgetRequests = [
      {
        dashboardId: 'example-dashboard-id',
        name: 'Batch Widget 1',
        type: WidgetType.KPI,
        queryId: 'example-query-id',
        config: { title: 'Batch KPI 1' },
        position: { id: 'batch-1', x: 0, y: 0, w: 2, h: 2 }
      },
      {
        dashboardId: 'example-dashboard-id',
        name: 'Batch Widget 2',
        type: WidgetType.KPI,
        queryId: 'example-query-id',
        config: { title: 'Batch KPI 2' },
        position: { id: 'batch-2', x: 2, y: 0, w: 2, h: 2 }
      },
      {
        dashboardId: 'example-dashboard-id',
        name: 'Batch Widget 3',
        type: WidgetType.KPI,
        queryId: 'example-query-id',
        config: { title: 'Batch KPI 3' },
        position: { id: 'batch-3', x: 4, y: 0, w: 2, h: 2 }
      }
    ];

    console.log('Creating multiple widgets in batch...');
    // Note: This would require the actual dashboard ID and query ID
    console.log('Batch widget requests prepared:', widgetRequests.length);

    // Refresh all widgets for a dashboard
    console.log('Refreshing all dashboard widgets...');
    // await client.refreshDashboardWidgets('example-dashboard-id');
    console.log('Dashboard widgets refresh initiated');

  } catch (error) {
    console.error('❌ Error in batch operations:', error);
  }
}

// Run the example
if (require.main === module) {
  // Check if API key is provided
  if (config.apiKey === 'your-jwt-token-here') {
    console.log('⚠️ Please update the API key in the script before running');
    console.log('You can get a token by logging in or using your existing JWT token');
    process.exit(1);
  }

  runDashboardExample()
    .then(() => demonstrateBatchOperations())
    .catch(console.error);
}

export { runDashboardExample, demonstrateBatchOperations };