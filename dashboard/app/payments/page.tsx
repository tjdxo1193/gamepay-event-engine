'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function PaymentsPage() {
  const [userId, setUserId] = useState('');
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Create payment form
  const [newPayment, setNewPayment] = useState({ userId: '', productId: '', amount: '' });
  const [createResult, setCreateResult] = useState('');

  async function searchPayments() {
    if (!userId.trim()) return;
    setLoading(true);
    try {
      const data = await api.getUserPayments(userId);
      setPayments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function createPayment(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await api.createPayment({
        userId: newPayment.userId,
        productId: newPayment.productId,
        amount: Number(newPayment.amount),
      });
      setCreateResult(`Created: ${result.orderNumber}`);
      setNewPayment({ userId: '', productId: '', amount: '' });
    } catch (err: any) {
      setCreateResult(`Error: ${err.message}`);
    }
  }

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    REFUNDED: 'bg-purple-100 text-purple-800',
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Payments</h2>

      {/* Create Payment */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Create Payment</h3>
        <form onSubmit={createPayment} className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">User ID</label>
            <input
              className="border rounded px-3 py-2 text-sm"
              value={newPayment.userId}
              onChange={(e) => setNewPayment({ ...newPayment, userId: e.target.value })}
              placeholder="user-001"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Product ID</label>
            <input
              className="border rounded px-3 py-2 text-sm"
              value={newPayment.productId}
              onChange={(e) => setNewPayment({ ...newPayment, productId: e.target.value })}
              placeholder="prod-monthly"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount (KRW)</label>
            <input
              className="border rounded px-3 py-2 text-sm"
              type="number"
              value={newPayment.amount}
              onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
              placeholder="9900"
              required
            />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            Create
          </button>
        </form>
        {createResult && <p className="mt-3 text-sm text-gray-600">{createResult}</p>}
      </div>

      {/* Search Payments */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Search User Payments</h3>
        <div className="flex gap-3 mb-4">
          <input
            className="border rounded px-3 py-2 text-sm flex-1 max-w-xs"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter User ID"
            onKeyDown={(e) => e.key === 'Enter' && searchPayments()}
          />
          <button onClick={searchPayments} className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900">
            Search
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Order #</th>
                <th>Product</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.orderNumber} className="border-b hover:bg-gray-50">
                  <td className="py-2 font-mono text-xs">{p.orderNumber}</td>
                  <td>{p.productId}</td>
                  <td>{Number(p.amount).toLocaleString()} {p.currency}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[p.status] || ''}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleString('ko-KR')}</td>
                </tr>
              ))}
              {payments.length === 0 && !loading && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No payments found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
