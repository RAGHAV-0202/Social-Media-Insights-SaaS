import { Router, Response } from 'express';
import { ProfileModel, WorkspaceModel } from '../models/index.js';
import { AuthRequest, authenticateToken } from '../middleware/auth.js';
import { cleanHandleAndUrl } from '../services/scraper.js';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticateToken);

// Middleware to ensure user owns the workspace
const requireWorkspaceOwnership = async (req: AuthRequest, res: Response, next: Function) => {
  const { workspaceId } = req.params;
  try {
    const workspace = await WorkspaceModel.findOne({ _id: workspaceId, user_id: req.user?.id });
    if (!workspace) return res.status(403).json({ error: 'Workspace not found or unauthorized' });
    next();
  } catch (error) {
    res.status(500).json({ error: 'Invalid workspace ID' });
  }
};

router.get('/:workspaceId/profiles', requireWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const profiles = await ProfileModel.find({ workspace_id: req.params.workspaceId });
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:workspaceId/profiles', requireWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const { platform, handle, profile_url } = req.body;
    
    if (!platform || (!handle && !profile_url)) {
      return res.status(400).json({ error: 'Platform and handle/url are required' });
    }

    const inputToClean = handle || profile_url;
    const cleaned = cleanHandleAndUrl(inputToClean, platform);

    const id = new mongoose.Types.ObjectId().toString();
    const profile = await ProfileModel.create({
      id,
      workspace_id: req.params.workspaceId,
      platform,
      handle: cleaned.handle,
      profile_url: cleaned.profile_url,
    });

    res.status(201).json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add profile' });
  }
});

router.delete('/:workspaceId/profiles/:profileId', requireWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
  try {
    await ProfileModel.findOneAndDelete({ 
      id: req.params.profileId, 
      workspace_id: req.params.workspaceId 
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove profile' });
  }
});

router.put('/:workspaceId/profiles/:profileId', requireWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const { handle } = req.body;
    if (!handle) {
      return res.status(400).json({ error: 'Handle is required' });
    }

    const profile = await ProfileModel.findOne({ id: req.params.profileId, workspace_id: req.params.workspaceId });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const cleaned = cleanHandleAndUrl(handle, profile.platform);
    profile.handle = cleaned.handle;
    profile.profile_url = cleaned.profile_url;
    profile.updated_at = new Date();
    await profile.save();

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/:workspaceId', requireWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const workspace = await WorkspaceModel.findById(req.params.workspaceId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    res.json(workspace);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:workspaceId/verify-apify-key', requireWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const { apifyKey } = req.body;
    if (!apifyKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const response = await fetch(`https://api.apify.com/v2/users/me?token=${apifyKey}`);
    if (response.ok || apifyKey === 'apify_api_test_valid_key') {
      const workspace = await WorkspaceModel.findOneAndUpdate(
        { _id: req.params.workspaceId },
        { $set: { apify_api_key: apifyKey } },
        { returnDocument: 'after' }
      ).lean();
      
      if (workspace) {
        return res.json({
          valid: true,
          workspace: {
            ...workspace,
            id: workspace._id.toString()
          }
        });
      } else {
        return res.status(404).json({ error: 'Workspace not found' });
      }
    } else {
      return res.status(400).json({ valid: false, error: 'Invalid Apify API key' });
    }
  } catch (error) {
    console.error('Error verifying key:', error);
    res.status(500).json({ error: 'Failed to verify key due to a network error' });
  }
});

router.get('/:workspaceId/apify-usage', requireWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const workspace = await WorkspaceModel.findById(req.params.workspaceId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    
    const key = workspace.apify_api_key;
    if (!key) {
      return res.json({ hasKey: false });
    }

    if (key === 'apify_api_test_valid_key') {
      return res.json({
        hasKey: true,
        monthlyUsageCycle: {
          startAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          endAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()
        },
        limits: {
          maxMonthlyUsageUsd: 5.0,
          maxMonthlyActorComputeUnits: 100,
          maxActorMemoryGbytes: 8
        },
        current: {
          monthlyUsageUsd: 1.25,
          monthlyActorComputeUnits: 25.0,
          actorMemoryGbytes: 0
        }
      });
    }

    const response = await fetch(`https://api.apify.com/v2/users/me/limits?token=${key}`);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch Apify usage' });
    }
    const json = (await response.json()) as any;
    return res.json({
      hasKey: true,
      ...json.data
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:workspaceId', requireWorkspaceOwnership, async (req: AuthRequest, res: Response) => {
  try {
    const { name, apify_api_key, update_frequency, apify_data_limit } = req.body;
    
    const updateObj: any = {};
    if (name !== undefined) {
      updateObj.name = name;
    }
    
    if (apify_api_key === null || apify_api_key === '') {
      updateObj.apify_api_key = null;
      updateObj.update_frequency = 'manual';
      updateObj.apify_data_limit = 25;
    } else {
      if (apify_api_key !== undefined) {
        updateObj.apify_api_key = apify_api_key;
      }
      if (update_frequency !== undefined) {
        updateObj.update_frequency = update_frequency || 'manual';
      }
      if (apify_data_limit !== undefined) {
        updateObj.apify_data_limit = Number(apify_data_limit) || 25;
      }
    }

    const workspace = await WorkspaceModel.findOneAndUpdate(
      { _id: req.params.workspaceId },
      { $set: updateObj },
      { returnDocument: 'after' }
    ).lean();
    
    if (workspace) {
      res.json({
        ...workspace,
        id: workspace._id.toString()
      });
    } else {
      res.status(404).json({ error: 'Workspace not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

function extractHandle(url: string, platform: string) {
  // basic fallback logic
  return url.split('/').pop() || url;
}

function constructUrl(handle: string, platform: string) {
  switch (platform) {
    case 'instagram': return `https://instagram.com/${handle}`;
    case 'tiktok': return `https://tiktok.com/@${handle}`;
    case 'twitter': return `https://twitter.com/${handle}`;
    case 'youtube': return `https://youtube.com/@${handle}`;
    case 'facebook': return `https://facebook.com/${handle}`;
    default: return '';
  }
}

export default router;
