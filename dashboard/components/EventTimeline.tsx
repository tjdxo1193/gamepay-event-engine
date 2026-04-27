'use client';

interface Event {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: string;
  occurredAt: string;
}

const typeColors: Record<string, string> = {
  PAYMENT_CREATED: 'bg-blue-100 text-blue-800',
  PAYMENT_COMPLETED: 'bg-green-100 text-green-800',
  PAYMENT_FAILED: 'bg-red-100 text-red-800',
  PAYMENT_REFUNDED: 'bg-yellow-100 text-yellow-800',
  SUBSCRIPTION_CREATED: 'bg-purple-100 text-purple-800',
  SUBSCRIPTION_RENEWED: 'bg-indigo-100 text-indigo-800',
  SUBSCRIPTION_CANCELLED: 'bg-orange-100 text-orange-800',
  SUBSCRIPTION_EXPIRED: 'bg-gray-100 text-gray-800',
};

export default function EventTimeline({ events }: { events: Event[] }) {
  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div key={event.eventId} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[event.eventType] || 'bg-gray-100 text-gray-800'}`}>
                {event.eventType}
              </span>
              <span className="text-xs text-gray-400 font-mono">{event.aggregateId}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {new Date(event.occurredAt).toLocaleString('ko-KR')}
            </p>
            <pre className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2 overflow-x-auto">
              {typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload, null, 2)}
            </pre>
          </div>
        </div>
      ))}
      {events.length === 0 && (
        <p className="text-center text-gray-400 py-8">No events yet</p>
      )}
    </div>
  );
}
