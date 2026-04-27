'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function SubscriptionsPage() {
  const [searchId, setSearchId] = useState('');
  const [subscription, setSubscription] = useState<any>(null);
  const [error, setError] = useState('');

  // Create form
  const [form, setForm] = useState({ userId: '', planId: 'plan-monthly', plan: 'MONTHLY' });
  const [createResult, setCreateResult] = useState('');

  async function createSubscription(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await api.createSubscription(form);
      setCreateResult(`Created: ${result.subscriptionId}`);
      setForm({ userId: '', planId: 'plan-monthly', plan: 'MONTHLY' });
    } catch (err: any) {
      setCreateResult(`Error: ${err.message}`);
    }
  }

  async function searchSubscription() {
    if (!searchId.trim()) return;
    setError('');
    try {
      const data = await api.getSubscription(searchId);
      setSubscription(data);
    } catch (err: any) {
      setError(err.message);
      setSubscription(null);
    }
  }

  async function cancelSubscription() {
    if (!subscription) return;
    try {
      await api.cancelSubscription(subscription.subscriptionId, 'Admin cancelled');
      const updated = await api.getSubscription(subscription.subscriptionId);
      setSubscription(updated);
    } catch (err: any) {
      setError(err.message);
    }
  }

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
    PENDING_RENEWAL: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Subscriptions</h2>

      {/* Create */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Create Subscription</h3>
        <form onSubmit={createSubscription} className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">User ID</label>
            <input
              className="border rounded px-3 py-2 text-sm"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              placeholder="user-001"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Plan</label>
            <select
              className="border rounded px-3 py-2 text-sm"
              value={form.plan}
              onChange={(e) => setForm({
                ...form,
                plan: e.target.value,
                planId: e.target.value === 'MONTHLY' ? 'plan-monthly' : 'plan-annual',
              })}
            >
              <option value="MONTHLY">Monthly (9,900 KRW)</option>
              <option value="ANNUAL">Annual (99,000 KRW)</option>
            </select>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            Create
          </button>
        </form>
        {createResult && <p className="mt-3 text-sm text-gray-600">{createResult}</p>}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Search Subscription</h3>
        <div className="flex gap-3 mb-4">
          <input
            className="border rounded px-3 py-2 text-sm flex-1 max-w-sm"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Enter Subscription ID (SUB-...)"
            onKeyDown={(e) => e.key === 'Enter' && searchSubscription()}
          />
          <button onClick={searchSubscription} className="bg-gray-800 text-white px-4 py-2 rounded text-sm">
            Search
          </button>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {subscription && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm">{subscription.subscriptionId}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[subscription.status] || ''}`}>
                {subscription.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">User:</span> {subscription.userId}</div>
              <div><span className="text-gray-500">Plan:</span> {subscription.plan}</div>
              <div><span className="text-gray-500">Start:</span> {new Date(subscription.startDate).toLocaleDateString('ko-KR')}</div>
              <div><span className="text-gray-500">End:</span> {new Date(subscription.endDate).toLocaleDateString('ko-KR')}</div>
              <div><span className="text-gray-500">Auto Renew:</span> {subscription.autoRenew ? 'Yes' : 'No'}</div>
            </div>
            {subscription.status === 'ACTIVE' && (
              <button
                onClick={cancelSubscription}
                className="mt-2 bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
