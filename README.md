# GamePay Event Engine

> Event-driven payment & subscription engine with BullMQ, CQRS, and event sourcing.
> Built as a portfolio project to improve upon production patterns.

## Why This Project Exists

### Production Problem (GGQ)

Production 결제 시스템에서 발견한 아키텍처 한계:

| Area | Production | This Project |
|---|---|---|
| **Autopay** | `while(true)` + `zpopmin` 폴링 | BullMQ delayed jobs + exponential backoff |
| **서비스 간 통신** | 동기 Axios HTTP (메시지 유실 가능) | EventBus + event store (이벤트 영속화) |
| **통계 쿼리** | node-ts-cache 인메모리 TTL | CQRS read model (이벤트 기반 materialization) |
| **중복 결제 방지** | 주문번호 DB 체크만 | Redis idempotency key + DB unique constraint |
| **실패 처리** | Redis hash에 수동 추적 | Dead Letter Queue + 자동 재시도 |
| **DB 스키마** | 수동 SQL (버전 관리 없음) | dbmate migration files |
| **테스트** | Dummy.test.ts (빈 파일) | Testcontainers 통합 테스트 (Real MySQL + Redis) |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    REST API (Express)                │
│  POST /payments  POST /subscriptions  GET /stats    │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
    ┌──────────▼──────────┐ ┌────────▼────────────┐
    │   PaymentHandler    │ │ SubscriptionHandler  │
    │   (idempotency)     │ │ (duplicate check)    │
    └──────────┬──────────┘ └────────┬────────────┘
               │                      │
    ┌──────────▼──────────────────────▼───────────┐
    │              EventBus                        │
    │  publish → event_store (persist)             │
    │          → local handlers (dispatch)         │
    └──────┬──────────────┬───────────────────────┘
           │              │
    ┌──────▼─────┐ ┌──────▼──────────────────┐
    │  BullMQ    │ │ PaymentSummaryProjector  │
    │  Queues    │ │ (CQRS Read Model)        │
    └──────┬─────┘ │ payment_summary table    │
           │       └─────────────────────────┘
    ┌──────▼──────────────┐
    │   AutopayWorker     │
    │   - 5min scan       │
    │   - 3 retries       │
    │   - exp. backoff    │
    │   - Dead Letter Q   │
    └─────────────────────┘
```

## Tech Stack

- **Runtime**: Node.js 18 + TypeScript
- **Framework**: Express.js
- **DI**: tsyringe (singleton pattern)
- **Database**: MySQL 8.0 (raw SQL, no ORM)
- **Cache**: Redis 7 (ioredis)
- **Queue**: BullMQ (Redis-backed)
- **Event Store**: MySQL table with JSON payload
- **Testing**: Jest + Testcontainers
- **Container**: Docker Compose

## Quick Start

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Install dependencies
npm install

# 3. Run in development
npm run dev

# 4. Run tests (requires Docker for Testcontainers)
npm test
```

## API Endpoints

### Payments
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/payments` | Create payment |
| POST | `/api/v1/payments/complete` | Complete payment (callback) |
| POST | `/api/v1/payments/:orderNumber/refund` | Refund payment |
| GET | `/api/v1/payments/:orderNumber` | Get payment detail |
| GET | `/api/v1/users/:userId/payments` | List user payments |

### Subscriptions
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/subscriptions` | Create subscription |
| POST | `/api/v1/subscriptions/:id/cancel` | Cancel subscription |
| GET | `/api/v1/subscriptions/:id` | Get subscription |
| GET | `/api/v1/users/:userId/subscription` | Get active subscription |

### Events & Stats (CQRS Read Side)
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/events/recent` | Recent events timeline |
| GET | `/api/v1/events/type/:type` | Events by type |
| GET | `/api/v1/events/aggregate/:id` | Event history for entity |
| GET | `/api/v1/stats/daily?startDate&endDate` | Daily revenue summary |
| GET | `/api/v1/stats/total` | Aggregate statistics |

## Project Structure

```
src/
├── config/          # Database pool, Redis, DI container, env
├── common/          # Shared types, errors, decorators
├── models/
│   ├── entities/    # Payment, Subscription, Event
│   └── repositories/# Raw SQL repositories
├── events/          # EventBus (publish + persist + dispatch)
├── queues/          # BullMQ queue manager
├── handlers/        # Business logic (Payment, Subscription)
├── workers/         # AutopayWorker, PaymentSummaryProjector
├── controllers/     # Express request handlers
└── routes/          # API route definitions

db/
├── migrations/      # Versioned SQL migrations (dbmate-compatible)
└── init.sql         # Docker bootstrap script

tests/
└── integration/     # Testcontainers-based tests
```

## Key Design Decisions

### 1. BullMQ over while-true Polling
Production의 `AutopayHandler`는 `while(true)` + `zpopmin`으로 만료 구독을 폴링했다.
이 프로젝트에서는 BullMQ의 repeatable job (5분 주기)으로 교체하여:
- 프로세스 크래시 시 메시지 유실 방지
- Exponential backoff (2s → 4s → 8s) 자동 재시도
- Dead Letter Queue로 영구 실패 건 분리
- 동시 처리 (concurrency: 5) 지원

### 2. Event Sourcing
모든 결제/구독 상태 변경이 `event_store` 테이블에 영속화된다.
이벤트 재생으로 어떤 시점의 상태든 복원 가능하며,
새로운 read model을 추가할 때 기존 이벤트를 replay하면 된다.

### 3. CQRS Read Model
`PaymentSummaryProjector`가 결제 이벤트를 구독하여
`payment_summary` 테이블을 자동 갱신한다.
대시보드 쿼리가 write model에 영향을 주지 않는다.

### 4. Idempotency
Redis key (`payment:idempotency:{userId}:{productId}`, TTL 1h)로
동일 사용자의 중복 결제를 방지한다.
`event_store`의 `(aggregate_id, version)` unique index가
이벤트 중복 삽입도 방지한다.

### 5. Raw SQL (No ORM)
현업과 동일하게 raw SQL을 사용하되, dbmate migration으로 스키마 버전을 관리한다.
ORM 없이도 connection pooling, transaction, prepared statement를 활용한다.

## License

MIT
