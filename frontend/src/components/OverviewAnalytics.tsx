import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { AnalyticsSections } from './AnalyticsSections';

// Wrapper that fetches the same dashboard payload as the main Dashboard page
// then forwards posts/profiles/snapshots into AnalyticsSections. This keeps
// visuals identical while using a different component structure.
export default function OverviewAnalytics() {
  const { token, workspace } = useAuth();

  const { data } = useQuery({
    queryKey: ['dashboard-data-overview', workspace?.id],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/dashboard-data`, {
        headers: { 'Authorization': `Bearer ${token}`, 'x-workspace-id': workspace?.id || '' }
      });
      if (!res.ok) throw new Error('Failed to fetch overview analytics');
      return res.json();
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const posts = data?.posts ?? [];
  const profiles = data?.profiles ?? [];
  const snapshots = data?.snapshots ?? [];

  const to = useMemo(() => new Date(), []);
  const from = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <AnalyticsSections posts={posts} profiles={profiles} snapshots={snapshots} from={from} to={to} />
      </div>
    </section>
  );
}
