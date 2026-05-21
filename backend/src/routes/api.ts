import { Router, Response } from 'express';
import { ProfileModel, ProfileSnapshotModel, PostModel, RefreshRunModel } from '../models/index.js';
import { runScraperSync } from '../services/scraper.js';
import { generateWeeklySummary } from '../services/ai.js';
import { AuthRequest, authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/dashboard-data
router.get('/dashboard-data', async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) {
      return res.status(400).json({ error: 'x-workspace-id header is required' });
    }

    const [profiles, snapshots, posts, runs] = await Promise.all([
      ProfileModel.find({ workspace_id: workspaceId }).sort({ platform: 1 }).lean(),
      ProfileSnapshotModel.find({ workspace_id: workspaceId }).select('profile_id captured_at followers total_views').sort({ captured_at: 1 }).lean(),
      PostModel.find({ workspace_id: workspaceId }).select('id profile_id posted_at url thumbnail_url caption likes comments shares views engagement_rate media_type')
        .sort({ posted_at: -1 }).limit(500).lean(),
      RefreshRunModel.find({ workspace_id: workspaceId }).sort({ started_at: -1 }).limit(1).lean()
    ]);

    res.json({
      profiles,
      snapshots,
      posts,
      lastRun: runs[0] || null
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/refresh-social
router.post('/refresh-social', async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) {
      return res.status(400).json({ error: 'x-workspace-id header is required' });
    }
    const trigger = req.headers['x-trigger'] as string || 'manual';
    const { profileId } = req.body || {};
    
    // Trigger the scraper run in the background (asynchronously)
    runScraperSync(trigger, workspaceId, profileId).catch((error) => {
      console.error('Error in background scraper run:', error);
    });
    
    // Return immediately to the frontend to prevent connection timeouts/hanging
    res.json({ success: true, message: 'Scrape started in background' });
  } catch (error) {
    console.error('Error in refresh-social route:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/weekly-summary
router.post('/weekly-summary', async (req: AuthRequest, res: Response) => {
  try {
    const { stats, brandName } = req.body;
    if (!stats || typeof stats !== 'object') {
      return res.status(400).json({ error: 'Missing stats payload' });
    }
    
    const summary = await generateWeeklySummary(stats, brandName || "your brand");
    res.json({ summary });
  } catch (error) {
    console.error('Error generating weekly summary:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
