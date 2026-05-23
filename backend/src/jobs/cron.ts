import cron from 'node-cron';
import { runScraperSync } from '../services/scraper.js';
import { WorkspaceModel, RefreshRunModel } from '../models/index.js';

export function initCronJobs() {
  console.log('Initializing backend cron jobs...');

  // Run check every hour: "0 * * * *"
  cron.schedule('0 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Starting hourly scheduled social media refresh check...`);
    try {
      const workspaces = await WorkspaceModel.find({});
      
      for (const workspace of workspaces) {
        const freq = (workspace as any).update_frequency || 'every_12_hours';
        if (freq === 'manual') {
          continue;
        }

        // Determine frequency hours limit
        let requiredIntervalHours = 12;
        if ((workspace as any).apify_api_key) {
          // Only honors these frequencies if they brought their own API key
          if (freq === 'every_hour') requiredIntervalHours = 1;
          else if (freq === 'every_6_hours') requiredIntervalHours = 6;
          else if (freq === 'every_12_hours') requiredIntervalHours = 12;
          else if (freq === 'every_24_hours' || freq === 'daily') requiredIntervalHours = 24;
          else if (freq === 'every_2_days') requiredIntervalHours = 48;
          else if (freq === 'every_3_days') requiredIntervalHours = 72;
          else if (freq === 'every_7_days') requiredIntervalHours = 168;
        } else {
          // If no custom API key, force 12 hours minimum
          requiredIntervalHours = 12;
        }

        // Find the latest successful run
        const latestRun = await RefreshRunModel.findOne({
          workspace_id: workspace._id,
          status: 'success'
        }).sort({ started_at: -1 });

        let shouldRefresh = false;
        if (!latestRun) {
          // If never run, run it
          shouldRefresh = true;
        } else {
          const diffMs = Date.now() - new Date(latestRun.started_at).getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours >= requiredIntervalHours - 0.1) { // 0.1 hour grace period to avoid clock drift issues
            shouldRefresh = true;
          }
        }

        if (shouldRefresh) {
          console.log(`[Cron] Workspace ${workspace.name} (${workspace._id}) is due for refresh (freq: ${freq}). Running sync...`);
          try {
            const result = await runScraperSync('cron', workspace._id.toString());
            console.log(`[Cron] Workspace ${workspace.name} refresh finished:`, result.status);
          } catch (wsError) {
            console.error(`[Cron] Failed to refresh workspace ${workspace._id}:`, wsError);
          }
        }
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Scheduled social media refresh check failed globally:`, error);
    }
  });

  console.log('Cron scheduler initialized to check update frequencies hourly.');
}
