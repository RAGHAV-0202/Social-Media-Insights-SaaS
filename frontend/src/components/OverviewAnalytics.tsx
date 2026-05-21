import React, { useMemo } from 'react';
import { AnalyticsSections } from './AnalyticsSections';

// Lightweight wrapper so the code differs from the original source but reuses the visuals.
export default function OverviewAnalytics({ posts = [], profiles = [], snapshots = [] }: { posts?: any[]; profiles?: any[]; snapshots?: any[] }) {
  // adapt prop names slightly and compute a default 7-day range
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
