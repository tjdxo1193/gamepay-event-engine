'use client';

import { useEffect, useState } from 'react';
import StatsCard from '@/components/StatsCard';
import EventTimeline from '@/components/EventTimeline';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsData, eventsData] = await Promise.all([
          api.getTotalStats(),
          api.getRecentEvents(20),
        ]);
        setStats(statsData);
        setEvents(eventsData);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Total Revenue"
          value={stats ? `${Number(stats.totalRevenue || 0).toLocaleString()}` : '0'}
          subtitle="KRW"
          color="green"
        />
        <StatsCard
          title="Transactions"
          value={stats?.totalTransactions || 0}
          subtitle="total"
          color="blue"
        />
        <StatsCard
          title="Successful"
          value={stats?.successfulTransactions || 0}
          color="green"
        />
        <StatsCard
          title="Failed / Refunds"
          value={`${stats?.failedTransactions || 0} / ${stats?.refundCount || 0}`}
          color="red"
        />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Events</h3>
      <EventTimeline events={events} />
    </div>
  );
}
