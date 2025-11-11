import { analyticsService } from '../services/analytics.service';
import { queueService } from '../services/queue.service';
import config from '../config';

async function refreshAnalytics(): Promise<void> {
  try {
    console.log('🔄 Starting analytics refresh...');
    
    const viewName = process.argv[2]; // Optional: specific view to refresh
    
    if (viewName) {
      console.log(`📊 Refreshing specific view: ${viewName}`);
      await analyticsService.refreshMaterializedViews(viewName);
    } else {
      console.log('📊 Refreshing all analytics views...');
      await analyticsService.refreshMaterializedViews();
    }
    
    // Get last refresh times
    const refreshTimes = await analyticsService.getLastRefreshTimes();
    console.log('\n📅 Last refresh times:');
    refreshTimes.forEach((refresh: any) => {
      console.log(`  ${refresh.view_name}: ${refresh.last_updated}`);
    });
    
    // Get queue stats
    const queueStats = await queueService.getQueueStats();
    console.log('\n📋 Queue statistics:');
    console.log(`  Waiting: ${queueStats.waiting}`);
    console.log(`  Active: ${queueStats.active}`);
    console.log(`  Completed: ${queueStats.completed}`);
    console.log(`  Failed: ${queueStats.failed}`);
    
    console.log('\n✅ Analytics refresh completed successfully');
    
  } catch (error) {
    console.error('❌ Analytics refresh failed:', error);
    process.exit(1);
  }
}

async function scheduleRefresh(): Promise<void> {
  try {
    console.log('⏰ Scheduling analytics refresh...');
    
    const viewName = process.argv[2]; // Optional: specific view to refresh
    const delay = parseInt(process.argv[3] || '0'); // Optional: delay in milliseconds
    
    const job = await queueService.enqueueRefreshJob(viewName, delay);
    
    console.log(`✅ Refresh job enqueued successfully`);
    console.log(`  Job ID: ${job.id}`);
    console.log(`  View: ${viewName || 'all'}`);
    console.log(`  Delay: ${delay}ms`);
    console.log(`  Estimated execution: ${new Date(Date.now() + delay).toISOString()}`);
    
  } catch (error) {
    console.error('❌ Failed to schedule refresh:', error);
    process.exit(1);
  }
}

async function showHelp(): Promise<void> {
  console.log('Analytics Refresh Script');
  console.log('');
  console.log('Usage:');
  console.log('  node refresh-analytics.js [command] [options]');
  console.log('');
  console.log('Commands:');
  console.log('  refresh [view]     - Immediately refresh analytics (all views or specific view)');
  console.log('  schedule [view] [delay] - Schedule refresh job (all views or specific view)');
  console.log('  help              - Show this help message');
  console.log('');
  console.log('Views:');
  console.log('  pipeline          - Refresh pipeline KPIs only');
  console.log('  compliance        - Refresh compliance KPIs only');
  console.log('  revenue           - Refresh revenue KPIs only');
  console.log('  outreach          - Refresh outreach KPIs only');
  console.log('  (no view)         - Refresh all views');
  console.log('');
  console.log('Examples:');
  console.log('  node refresh-analytics.js refresh');
  console.log('  node refresh-analytics.js refresh pipeline');
  console.log('  node refresh-analytics.js schedule pipeline 5000');
  console.log('  node refresh-analytics.js schedule 10000');
}

async function main(): Promise<void> {
  const command = process.argv[2];
  
  switch (command) {
    case 'refresh':
      await refreshAnalytics();
      break;
    case 'schedule':
      await scheduleRefresh();
      break;
    case 'help':
      await showHelp();
      break;
    default:
      await showHelp();
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { refreshAnalytics, scheduleRefresh };