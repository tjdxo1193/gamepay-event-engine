'use client';

import { useEffect, useState } from 'react';
import EventTimeline from '@/components/EventTimeline';
import { api } from '@/lib/api';

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aggregateId, setAggregateId] = useState('');
  const [filtered, setFiltered] = useState<any[] | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getRecentEvents(100);
        setEvents(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function searchByAggregate() {
    if (!aggregateId.trim()) {
      setFiltered(null);
      return;
    }
    try {
      const data = await api.getEventsByAggregate(aggregateId);
      setFiltered(data);
    } catch (err) {
      console.error(err);
    }
  }

  const displayEvents = filtered ?? events;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Event Timeline</h2>

      <div className="flex gap-3 mb-6">
        <input
          className="border rounded px-3 py-2 text-sm flex-1 max-w-md"
          value={aggregateId}
          onChange={(e) => setAggregateId(e.target.value)}
          placeholder="Filter by Order # or Subscription ID"
          onKeyDown={(e) => e.key === 'Enter' && searchByAggregate()}
        />
        <button onClick={searchByAggregate} className="bg-gray-800 text-white px-4 py-2 rounded text-sm">
          Filter
        </button>
        {filtered && (
          <button onClick={() => { setFiltered(null); setAggregateId(''); }} className="text-gray-500 px-4 py-2 text-sm hover:text-gray-700">
            Clear
          </button>
        )}
      </div>

      <div className="text-xs text-gray-400 mb-4">
        Showing {displayEvents.length} events {filtered ? `for "${aggregateId}"` : '(recent)'}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading events...</p>
      ) : (
        <EventTimeline events={displayEvents} />
      )}
    </div>
  );
}
