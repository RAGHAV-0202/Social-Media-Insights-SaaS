import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, Check, Sparkles, X } from 'lucide-react';
import { PLATFORMS } from '@/lib/social';

export default function Onboarding() {
  const { user, workspace, token } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [profiles, setProfiles] = useState<Record<string, string>>({
    instagram: '',
    facebook: '',
    tiktok: '',
    twitter: '',
    youtube: '',
    linkedin: '',
  });
  const [apifyKey, setApifyKey] = useState('');
  const [apifyKeyVerified, setApifyKeyVerified] = useState(false);
  const [verifyingKey, setVerifyingKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  const handleVerifyKey = async () => {
    if (!apifyKey.trim()) {
      toast({ title: 'Error', description: 'Please enter an Apify API key first.', variant: 'destructive' });
      return;
    }
    setVerifyingKey(true);
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

      setApifyKeyVerified(true);
      toast({ title: 'Success', description: 'Apify API key verified!' });
    } catch (err: any) {
      toast({ title: 'Verification Failed', description: err.message, variant: 'destructive' });
      setApifyKeyVerified(false);
      setApifyKey(''); // Clear invalid key
    } finally {
      setVerifyingKey(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If user entered an Apify key, it must be verified
    if (apifyKey.trim() !== '' && !apifyKeyVerified) {
      toast({ title: 'Error', description: 'Please verify your Apify key first.', variant: 'destructive' });
      return;
    }
    
    setLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      // Save verified key to workspace (if verified, otherwise skip)
      if (apifyKeyVerified && apifyKey.trim() !== '') {
        const saveRes = await fetch(`${baseUrl}/api/workspaces/${workspace?.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ apify_api_key: apifyKey.trim() }),
        });

        if (!saveRes.ok) {
          const saveData = await saveRes.json();
          throw new Error(saveData.error || 'Failed to save Apify key');
        }
      }

      // Connect each filled profile (accepts both handle and link formats)
      const profileResponses = await Promise.all(
        Object.entries(profiles)
          .filter(([_, handle]) => handle.trim() !== '')
          .map(([platform, handle]) => 
            fetch(`${baseUrl}/api/workspaces/${workspace?.id}/profiles`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ platform, handle }),
            })
          )
      );

      // Check for profile creation errors
      for (const res of profileResponses) {
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to create one or more profiles');
        }
      }

      // Trigger the first scrape!
      const scrapeRes = await fetch(`${baseUrl}/api/refresh-social`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'x-workspace-id': workspace?.id || '',
          'x-trigger': 'onboarding'
        }
      });

      if (!scrapeRes.ok) {
        const errorData = await scrapeRes.json();
        throw new Error(errorData.error || 'Failed to start syncing');
      }

      setSuccess(true);
      toast({ title: 'Success!', description: 'Your platforms are connected and syncing.' });
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to connect platforms.', variant: 'destructive' });
      setLoading(false);
    }
  };

  const getPlatformIcon = (id: string) => {
    const meta = PLATFORMS.find(p => p.id === id);
    if (!meta) return null;
    const Icon = meta.icon;
    return <Icon className="w-5 h-5" style={{ color: meta.color }} />;
  };

  return (
    <div className="theme-saas-ivory min-h-screen flex items-center justify-center bg-background bg-paper-grain p-4 relative overflow-hidden text-foreground">
      {/* Dynamic grain/blur effect background */}
      <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
      
      <Card className="w-full max-w-2xl p-8 border-border/60 bg-card shadow-[var(--shadow-card)] relative z-10 animate-fade-in-up">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-sm border border-primary/20">
            <Sparkles className="text-primary-foreground h-7 w-7" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight text-center font-serif-display">Connect Your Platforms</h1>
          <p className="text-muted-foreground mt-2 text-sm text-center max-w-md">
            Enter the handles or URLs for {workspace?.name}. We'll instantly begin tracking your performance.
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in zoom-in duration-500">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-xl font-medium text-foreground">Syncing your data...</h3>
            <p className="text-muted-foreground text-sm">Redirecting to your new dashboard</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {['instagram', 'tiktok', 'twitter', 'facebook', 'youtube', 'linkedin'].map((platform) => {
                return (
                  <div key={platform} className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground capitalize flex items-center gap-2">
                      {getPlatformIcon(platform)}
                      {platform}
                    </label>
                    <Input 
                      placeholder={platform === 'youtube' ? 'Channel URL or Handle' : '@handle'}
                      value={profiles[platform]}
                      onChange={(e) => setProfiles(prev => ({ ...prev, [platform]: e.target.value }))}
                      className="bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10"
                    />
                  </div>
                );
              })}
            </div>
            
            <div className="pt-4 border-t border-border/60 mt-2">
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                  <span>Apify API Key</span>
                  <span className="text-xs text-muted-foreground font-normal">Optional</span>
                </label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="apify_api_..."
                    type="password"
                    value={apifyKey}
                    onChange={(e) => {
                      setApifyKey(e.target.value);
                      if (apifyKeyVerified) setApifyKeyVerified(false); // Reset verification on change
                    }}
                    disabled={apifyKeyVerified}
                    className="bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10"
                  />
                  {apifyKey.trim() !== '' && (
                    <>
                      {apifyKeyVerified ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="px-3 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                          onClick={() => {
                            setApifyKey('');
                            setApifyKeyVerified(false);
                          }}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="px-3"
                          onClick={handleVerifyKey}
                          disabled={verifyingKey || apifyKey.trim() === ''}
                        >
                          {verifyingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                        </Button>
                      )}
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Bring your own Apify key to bypass system rate limits.</p>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={() => navigate('/dashboard')}
                >
                  Skip for now
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading || (Object.values(profiles).every(v => !v.trim()) && !apifyKey) || (apifyKey.trim() !== '' && !apifyKeyVerified)}
                  className="bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm h-11 px-8 font-medium transition-all"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                  {loading ? 'Connecting...' : 'Connect & Sync'}
                  {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
