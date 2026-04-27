const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function fetcher<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'API Error');
  return json.data;
}

export const api = {
  // Payments
  createPayment: (data: { userId: string; productId: string; amount: number }) =>
    fetcher<{ orderNumber: string }>('/api/v1/payments', { method: 'POST', body: JSON.stringify(data) }),

  completePayment: (data: { orderNumber: string; transactionId: string; paidAmount: number }) =>
    fetcher<void>('/api/v1/payments/complete', { method: 'POST', body: JSON.stringify(data) }),

  getPayment: (orderNumber: string) =>
    fetcher<any>(`/api/v1/payments/${orderNumber}`),

  getUserPayments: (userId: string) =>
    fetcher<any[]>(`/api/v1/users/${userId}/payments`),

  refundPayment: (orderNumber: string, data: { refundAmount: number; reason: string }) =>
    fetcher<void>(`/api/v1/payments/${orderNumber}/refund`, { method: 'POST', body: JSON.stringify(data) }),

  // Subscriptions
  createSubscription: (data: { userId: string; planId: string; plan: string }) =>
    fetcher<{ subscriptionId: string }>('/api/v1/subscriptions', { method: 'POST', body: JSON.stringify(data) }),

  cancelSubscription: (id: string, reason: string) =>
    fetcher<void>(`/api/v1/subscriptions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

  getSubscription: (id: string) =>
    fetcher<any>(`/api/v1/subscriptions/${id}`),

  // Events & Stats
  getRecentEvents: (limit = 50) =>
    fetcher<any[]>(`/api/v1/events/recent?limit=${limit}`),

  getEventsByAggregate: (aggregateId: string) =>
    fetcher<any[]>(`/api/v1/events/aggregate/${aggregateId}`),

  getDailySummary: (startDate: string, endDate: string) =>
    fetcher<any[]>(`/api/v1/stats/daily?startDate=${startDate}&endDate=${endDate}`),

  getTotalStats: () =>
    fetcher<any>('/api/v1/stats/total'),
};
