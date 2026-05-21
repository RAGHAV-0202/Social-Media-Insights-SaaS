import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useTheme, THEME_LIST } from '@/context/ThemeContext';
import { Loader2, ArrowLeft, LogOut, Trash2, Pencil, Check, X, RefreshCw } from 'lucide-react';
import { PLATFORMS } from '@/lib/social';

export default function Settings() {
  const { user, workspace, token, logout, setWorkspace, isLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [profiles, setProfiles] = useState<any[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  const [apifyKey, setApifyKey] = useState('');
  const [isKeyVerified, setIsKeyVerified] = useState(false);
  const [checkingKey, setCheckingKey] = useState(false);
  const [apifyUsage, setApifyUsage] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [updateFrequency, setUpdateFrequency] = useState('manual');
  const [apifyLimit, setApifyLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingHandle, setEditingHandle] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPlatform, setNewPlatform] = useState('instagram');
  const [newHandle, setNewHandle] = useState('');
  const [connectingPlatform, setConnectingPlatform] = useState(false);

  const connectedPlatforms = new Set(profiles.map(p => p.platform));
  const availablePlatforms = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'twitter', label: 'Twitter' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'linkedin', label: 'LinkedIn' }
  ].filter(p => !connectedPlatforms.has(p.value));

  useEffect(() => {
    if (availablePlatforms.length > 0) {
      const isCurrentAvailable = availablePlatforms.some(ap => ap.value === newPlatform);
      if (!isCurrentAvailable) {
        setNewPlatform(availablePlatforms[0].value);
      }
    } else {
      setNewPlatform('');
    }
  }, [profiles]);

  useEffect(() => {
    if (isLoading) return; // wait until auth state is resolved from storage
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [token, navigate, isLoading]);

  const fetchData = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      // Fetch profiles
      const res = await fetch(`${baseUrl}/api/workspaces/${workspace?.id}/profiles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }

      // Fetch workspace configuration
      const wsRes = await fetch(`${baseUrl}/api/workspaces/${workspace?.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (wsRes.ok) {
        const wsData = await wsRes.json();
        setWorkspaceName(wsData.name || '');
        setApifyKey(wsData.apify_api_key || '');
        setIsKeyVerified(!!wsData.apify_api_key);
        setUpdateFrequency(wsData.update_frequency || 'manual');
        setApifyLimit(wsData.apify_data_limit || 25);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchApifyUsage = async () => {
    if (!workspace?.id) return;
    setLoadingUsage(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/workspaces/${workspace.id}/apify-usage`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hasKey) {
          setApifyUsage(data);
        } else {
          setApifyUsage(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsage(false);
    }
  };

  useEffect(() => {
    if (isKeyVerified) {
      fetchApifyUsage();
    } else {
      setApifyUsage(null);
    }
  }, [isKeyVerified, workspace?.id]);

  const handleCheckKey = async () => {
    if (!apifyKey.trim()) {
      toast({ title: 'Error', description: 'Please enter an Apify API key first.', variant: 'destructive' });
      return;
    }
    setCheckingKey(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/workspaces/${workspace?.id}/verify-apify-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ apifyKey: apifyKey.trim() })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify key');
      }

      setIsKeyVerified(true);
      
      if (setWorkspace && data.workspace) {
        setWorkspace({ id: data.workspace.id || data.workspace._id, name: data.workspace.name });
      }
      
      toast({ title: 'Success', description: 'Apify API key verified and saved successfully.' });
    } catch (err: any) {
      toast({ title: 'Verification Failed', description: err.message, variant: 'destructive' });
      setIsKeyVerified(false);
    } finally {
      setCheckingKey(false);
    }
  };

  const handleRemoveKey = async () => {
    setSavingKey(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/workspaces/${workspace?.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: workspaceName.trim(),
          apify_api_key: null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to remove key');
      }
      const wsData = await res.json();
      
      setApifyKey('');
      setIsKeyVerified(false);
      setUpdateFrequency('manual');
      setApifyLimit(25);
      
      if (setWorkspace && wsData) {
        setWorkspace({ id: wsData.id || wsData._id, name: wsData.name });
      }

      toast({ title: 'Success', description: 'Apify API key removed and settings reset to defaults.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingKey(false);
    }
  };

  const handleSaveWorkspaceSettings = async () => {
    setSavingKey(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/workspaces/${workspace?.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: workspaceName.trim(),
          apify_api_key: isKeyVerified ? apifyKey.trim() : null,
          update_frequency: updateFrequency,
          apify_data_limit: Number(apifyLimit),
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update settings');
      }
      const wsData = await res.json();
      
      if (setWorkspace && wsData) {
        setWorkspace({ id: wsData.id || wsData._id, name: wsData.name });
      }

      toast({ title: 'Success', description: 'Workspace configuration updated.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/workspaces/${workspace?.id}/profiles/${profileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setProfiles(prev => prev.filter(p => p.id !== profileId));
        toast({ title: 'Profile removed', description: 'The social account was successfully removed.' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to remove profile.', variant: 'destructive' });
    }
  };

  const handleEditProfile = (profile: any) => {
    setEditingProfileId(profile.id);
    setEditingHandle(profile.handle);
  };

  const handleSaveProfile = async (profileId: string) => {
    if (!editingHandle.trim()) {
      toast({ title: 'Error', description: 'Handle cannot be empty.', variant: 'destructive' });
      return;
    }
    setSavingProfile(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/workspaces/${workspace?.id}/profiles/${profileId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ handle: editingHandle.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfiles(prev => prev.map(p => p.id === profileId ? updated : p));
        setEditingProfileId(null);
        toast({ title: 'Success', description: 'Platform handle updated.' });
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update handle');
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleConnectPlatform = async () => {
    if (!newHandle.trim()) return;
    setConnectingPlatform(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/workspaces/${workspace?.id}/profiles`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ platform: newPlatform, handle: newHandle.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setProfiles(prev => [...prev, created]);
        setNewHandle('');
        toast({ title: 'Success', description: `${newPlatform} account connected.` });
        
        // Trigger a background scrape for the new profile
        fetch(`${baseUrl}/api/refresh-social`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'x-workspace-id': workspace?.id || '',
            'x-trigger': 'settings'
          }
        }).catch(err => console.error('Failed to trigger background sync:', err));
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to connect profile');
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setConnectingPlatform(false);
    }
  };

  const getPlatformIcon = (id: string) => {
    const meta = PLATFORMS.find(p => p.id === id);
    if (!meta) return null;
    const Icon = meta.icon;
    return <Icon className="w-5 h-5" style={{ color: meta.color }} />;
  };

  return (
    <div className={`${theme} min-h-screen bg-background bg-paper-grain p-6 md:p-12 relative overflow-hidden text-foreground`}>
      <div className="max-w-4xl mx-auto relative z-10 space-y-8 animate-fade-in-up">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="hover:bg-muted rounded-full text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-serif-display">Settings</h1>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => { logout(); navigate('/login'); }}
            className="border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Workspace Settings */}
          <Card className="p-6 border-border/60 bg-card shadow-[var(--shadow-card)] flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-6 text-foreground font-serif-display">Workspace Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Workspace Name</label>
                  <Input 
                    type="text"
                    placeholder="Enter workspace name"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="mt-1 bg-background border-input text-foreground focus-visible:ring-primary font-medium"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Owner</label>
                  <div className="mt-1 p-3 bg-muted/30 border border-border/60 rounded-md text-foreground text-sm">
                    {user?.name} ({user?.email})
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-border/60">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Custom Apify API Key</label>
                  <p className="text-xs text-muted-foreground mb-4">Override the system API key to use your own Apify account limits.</p>
                  
                  {isKeyVerified ? (
                    <div className="space-y-3">
                      <div className="flex gap-2 items-center">
                        <Input 
                          type="password"
                          value="••••••••••••••••••••••••••••••••"
                          disabled
                          className="bg-muted/30 border-input text-muted-foreground flex-1"
                        />
                        <span className="shrink-0 flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium px-2.5 py-1.5 rounded-full border border-emerald-500/20">
                          <Check className="w-3.5 h-3.5" /> Verified
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setIsKeyVerified(false)}
                          className="flex-1 text-foreground hover:bg-muted font-medium h-9 text-xs"
                        >
                          Change Key
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={handleRemoveKey}
                          disabled={savingKey}
                          className="text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/20 h-9 text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                        </Button>
                      </div>

                      {/* Apify usage info (live API retrieval) */}
                      {loadingUsage ? (
                        <div className="flex items-center justify-center p-4 bg-muted/10 border border-border/40 rounded-lg">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
                          <span className="text-xs text-muted-foreground">Loading Apify usage stats...</span>
                        </div>
                      ) : apifyUsage ? (
                        <div className="p-3 bg-muted/20 border border-border/40 rounded-lg space-y-3 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-foreground text-[10px] uppercase tracking-wider">Apify Limits & Usage</span>
                            <div className="flex items-center gap-2">
                              {apifyUsage.monthlyUsageCycle && (
                                <span className="text-[9px] text-muted-foreground font-normal">
                                  Cycle resets: {new Date(apifyUsage.monthlyUsageCycle.endAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={fetchApifyUsage}
                                disabled={loadingUsage}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              >
                                {loadingUsage ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-2.5">
                            {/* Compute Units removed as requested */}

                            {apifyUsage.current?.monthlyUsageUsd !== undefined && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-muted-foreground">Cycle Spend</span>
                                  <span className="font-semibold text-foreground">
                                    ${apifyUsage.current.monthlyUsageUsd.toFixed(2)}
                                    {apifyUsage.limits?.maxMonthlyUsageUsd ? ` / $${apifyUsage.limits.maxMonthlyUsageUsd.toFixed(2)}` : ''} USD
                                  </span>
                                </div>
                                {apifyUsage.limits?.maxMonthlyUsageUsd ? (
                                  <div className="w-full bg-muted/50 rounded-full h-1 overflow-hidden">
                                    <div 
                                      className="bg-primary h-1 rounded-full transition-all duration-500" 
                                      style={{ width: `${Math.min(100, (apifyUsage.current.monthlyUsageUsd / apifyUsage.limits.maxMonthlyUsageUsd) * 100)}%` }} 
                                    />
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {apifyUsage.limits?.maxActorMemoryGbytes !== undefined && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-muted-foreground">RAM Allocation</span>
                                  <span className="font-semibold text-foreground">
                                    {(apifyUsage.current?.actorMemoryGbytes || 0).toFixed(0)} / {apifyUsage.limits.maxActorMemoryGbytes} GB
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input 
                        type="password"
                        placeholder="apify_api_..."
                        value={apifyKey}
                        onChange={(e) => setApifyKey(e.target.value)}
                        className="bg-background border-input text-foreground focus-visible:ring-primary flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && apifyKey.trim() && !checkingKey) {
                            handleCheckKey();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={handleCheckKey}
                        disabled={checkingKey || !apifyKey.trim()}
                        className="bg-primary hover:bg-primary/95 text-primary-foreground font-medium shrink-0 h-10 px-4"
                      >
                        {checkingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
                      </Button>
                    </div>
                  )}
                </div>
                

                {/* Ingestion & Frequency settings (premium, unlocked by user key) */}
                <div className="pt-6 mt-6 border-t border-border/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Advanced Sync Ingestion</h3>
                    {!isKeyVerified && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium px-2 py-0.5 rounded-full border border-amber-500/20">
                        🔒 Locked (Requires custom Key)
                      </span>
                    )}
                  </div>

                  <div className={`space-y-4 ${!isKeyVerified ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Auto-Refresh Frequency</label>
                      <select
                        value={updateFrequency}
                        onChange={(e) => setUpdateFrequency(e.target.value)}
                        disabled={!isKeyVerified}
                        className="w-full p-2.5 bg-background border border-input rounded-md text-sm text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      >
                        <option value="manual">Manual Refresh Only</option>
                        <option value="every_hour">Hourly Refresh</option>
                        <option value="every_6_hours">Every 6 Hours</option>
                        <option value="every_12_hours">Every 12 Hours</option>
                        <option value="every_24_hours">Daily Refresh</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Historical Ingestion Limit (per account)</label>
                      <select
                        value={apifyLimit}
                        onChange={(e) => setApifyLimit(Number(e.target.value))}
                        disabled={!isKeyVerified}
                        className="w-full p-2.5 bg-background border border-input rounded-md text-sm text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      >
                        <option value={10}>Last 10 posts</option>
                        <option value={20}>Last 20 posts</option>
                        <option value={25}>Last 25 posts (Default)</option>
                        <option value={50}>Last 50 posts</option>
                        <option value={100}>Last 100 posts</option>
                        <option value={150}>Last 150 posts</option>
                        <option value={200}>Last 200 posts</option>
                        <option value={500}>Last 500 posts</option>
                        <option value={1000}>Last 1000 posts</option>
                      </select>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Controls the depth of historical posts fetched from Apify actors per refresh cycle.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-border/60">
              <Button 
                onClick={handleSaveWorkspaceSettings} 
                disabled={savingKey || !workspaceName.trim()} 
                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm h-10 font-medium"
              >
                {savingKey ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Workspace Settings
              </Button>
            </div>
          </Card>

          {/* Connected Profiles */}
          <Card className="p-6 border-border/60 bg-card shadow-[var(--shadow-card)] flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-6 text-foreground font-serif-display">Connected Platforms</h2>
              
              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : profiles.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-border/60 rounded-lg mb-6">
                  <p className="text-muted-foreground text-sm">No social accounts connected yet.</p>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {profiles.map(p => {
                    const isEditing = editingProfileId === p.id;
                    return (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30 gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-muted rounded-md border border-border/30 shrink-0">
                            {getPlatformIcon(p.platform)}
                          </div>
                          {isEditing ? (
                            <div className="flex-1 flex gap-2">
                              <Input 
                                type="text"
                                value={editingHandle}
                                onChange={(e) => setEditingHandle(e.target.value)}
                                className="h-9 py-1 bg-background text-foreground text-sm font-medium border-input focus-visible:ring-primary min-w-[120px]"
                              />
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleSaveProfile(p.id)}
                                disabled={savingProfile}
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 h-9 w-9"
                              >
                                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setEditingProfileId(null)}
                                disabled={savingProfile}
                                className="text-muted-foreground hover:bg-muted h-9 w-9"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground capitalize">{p.platform}</p>
                              <p className="text-xs text-muted-foreground truncate">{p.handle}</p>
                            </div>
                          )}
                        </div>
                        
                        {!isEditing && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleEditProfile(p)}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteProfile(p.id)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Form to connect a new platform directly in Settings */}
            <div className="pt-6 border-t border-border/60 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Connect a New Account</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <select
                      value={newPlatform}
                      onChange={(e) => setNewPlatform(e.target.value)}
                      disabled={availablePlatforms.length === 0}
                      className="w-full h-10 p-2.5 bg-background border border-input rounded-md text-sm text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-50"
                    >
                      {availablePlatforms.length > 0 ? (
                        availablePlatforms.map((plat) => (
                          <option key={plat.value} value={plat.value}>
                            {plat.label}
                          </option>
                        ))
                      ) : (
                        <option value="">No platform left</option>
                      )}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="text"
                      placeholder={availablePlatforms.length > 0 ? (newPlatform === 'youtube' ? 'Channel URL or Handle' : '@handle') : 'All connected'}
                      value={newHandle}
                      onChange={(e) => setNewHandle(e.target.value)}
                      disabled={availablePlatforms.length === 0}
                      className="bg-background border-input text-foreground focus-visible:ring-primary h-10 disabled:opacity-50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newHandle.trim() && !connectingPlatform && availablePlatforms.length > 0) {
                          handleConnectPlatform();
                        }
                      }}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleConnectPlatform} 
                  disabled={connectingPlatform || !newHandle.trim() || availablePlatforms.length === 0} 
                  className="w-full bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm h-10 font-medium"
                >
                  {connectingPlatform ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {availablePlatforms.length > 0 ? 'Connect Platform' : 'All Platforms Connected'}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 border-border/60 bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground font-serif-display">Theme Gallery</h2>
              <p className="text-xs text-muted-foreground mt-1">Pick a visual style from the horizontal strip below. Each tile stays compact, so it won’t stretch the workspace layout.</p>
            </div>
            <span className="hidden sm:inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
              {theme}
            </span>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
            {THEME_LIST.map((t) => {
              const isGradient = t.preview.startsWith('linear-gradient');
              const isAurora = t.id === 'theme-aurora';
              const isDark = t.id === 'dark';

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`group shrink-0 snap-start text-left rounded-2xl border p-4 transition-all duration-200 min-w-[260px] max-w-[260px] ${theme === t.id ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_20px_40px_-24px_hsl(var(--primary)/0.45)]' : 'border-border/60 hover:border-border hover:shadow-[var(--shadow-card)]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.id === 'theme-saas-ivory' ? 'Claude-style warm paper' : t.id === 'theme-indigo' ? 'Cool blue and purple' : t.id === 'theme-aurora' ? 'Soft gradient light theme' : 'Low-light navy palette'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${theme === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {theme === t.id ? 'Selected' : 'Preview'}
                    </span>
                  </div>

                  <div
                    className={`mt-4 relative overflow-hidden rounded-xl border border-dashed ${isDark ? 'border-white/10 bg-[#0B1221]' : 'border-border/60 bg-card'}`}
                    style={{ backgroundImage: isGradient ? t.preview : undefined, backgroundColor: !isGradient ? t.preview : undefined }}
                  >
                    <div className={`absolute inset-0 ${isDark ? 'bg-[radial-gradient(circle_at_top_left,rgba(91,140,255,0.14),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.16),transparent_45%)]' : isAurora ? 'bg-[radial-gradient(circle_at_top_left,rgba(91,140,255,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(232,121,249,0.12),transparent_45%)]' : 'bg-[radial-gradient(circle_at_top_right,rgba(204,120,92,0.08),transparent_45%)]'} pointer-events-none`} />
                    <div className="relative min-h-32 p-4 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="h-3 w-20 rounded-full bg-foreground/10" />
                        <div className="h-6 w-3/5 rounded-lg bg-foreground/10" />
                        <div className="h-2 w-full rounded-full bg-foreground/10" />
                        <div className="h-2 w-4/5 rounded-full bg-foreground/10" />
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-foreground/10" />
                        <div className="h-8 flex-1 rounded-full bg-foreground/10" />
                        <div className="h-8 w-14 rounded-full bg-foreground/10" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
