# GamePay Event Engine — 프로젝트 명세서

> 이직 포트폴리오용 사이드 프로젝트
> 작성자: 황성태 (SeongTaeHwang)

---

## 한 줄 요약

**현업에서 운영 중인 결제/구독 시스템의 아키텍처적 한계를 인지하고, 같은 도메인을 처음부터 이벤트 기반으로 재설계해본 프로젝트.**

---

## 왜 이 프로젝트를 골랐는가 (4개 후보 중)

이직 포트폴리오 기획 단계에서 4개의 사이드 프로젝트 후보를 분석했다. 각 후보는 현업의 서로 다른 gap을 메우는 방향이었다.

### 후보 비교

| 후보 | 메우는 gap | 도메인 | 난이도 | 면접 임팩트 |
|---|---|---|---|---|
| **GamePay Event Engine** ⭐ | 메시지 큐, 이벤트 드리븐, DB 마이그레이션, 통합 테스트 | 결제/구독 | 중상 | **매우 높음** |
| Notification Hub | 메시지 큐, ORM 비교, 관측성, 부하 테스트 | 알림 | 중 | 높음 |
| GG Gateway | API Gateway, WebSocket, 분산 추적, 부하 테스트 | 인프라 | 상 | 높음 |
| Match Data Pipeline | DB 마이그레이션, K8s, 쿼리 최적화 | 게임 통계 | 상 | 중 |

### 최종 선택: GamePay → Notification → Gateway 순

**Match Data Pipeline은 제외**했다. 이유:
- 다른 3개와 관측성/큐잉 영역이 겹친다
- K8s 운영 경험 어필이 핵심인데, 이건 사이드 프로젝트로 증명하기 어렵다
- 게임 통계 도메인은 현업과 너무 같아서 "회사에서 한 거 또 했네" 인상

### 왜 GamePay를 첫 번째로 만드는가

3개 중에서도 **이걸 가장 먼저 만든 이유**가 명확하다.

#### 1. 면접 ROI가 가장 높다
"결제 시스템"은 시니어 백엔드 면접의 단골 주제다. 트랜잭션, 멱등성, 동시성, 정합성 같은 어려운 주제를 한꺼번에 다룰 수 있다. 면접관도 깊이 있게 질문하기 좋다.

#### 2. Before/After 대비가 가장 극명하다
- **Before (현업)**: `while(true) + zpopmin + sleep(1000)` - 한 줄로 그릴 수 있다
- **After (이 프로젝트)**: BullMQ delayed jobs + exponential backoff + DLQ - 그림으로도 명확하다

다른 3개 후보는 "있던 기능을 더 좋게"인데, 이건 "잘못된 패턴을 올바른 패턴으로"라서 스토리가 더 강하다.

#### 3. 도메인이 익숙하다
현업에서 결제, 자동갱신, 환불, 구독 라이프사이클을 모두 다뤄봤다. 도메인 학습 비용 없이 아키텍처 개선에 집중할 수 있다. 첫 프로젝트일수록 빠르게 가시적인 결과를 내야 다음 프로젝트의 동력이 된다.

#### 4. Notification / Gateway의 기반이 된다
- Notification Hub가 결제 완료 이벤트를 구독해서 알림을 보낸다 → GamePay의 EventBus를 활용
- GG Gateway가 결제 API를 라우팅한다 → GamePay가 downstream 서비스 역할

즉 GamePay를 먼저 만들면, 다음 두 프로젝트가 단독 데모가 아니라 **연결된 마이크로서비스 생태계**가 된다. 면접에서 "3개 프로젝트가 실제로 통신한다"고 말할 수 있다.

#### 5. 현업 코드를 가장 많이 분석해본 영역이다
1,144개 커밋이 있는 desktop-server, 194개의 payment-server를 깊이 봤다. 어디가 약점인지 가장 정확히 안다. 사이드 프로젝트는 "왜 이렇게 만들었는지" 설명할 수 있어야 의미가 있다.

---

## 왜 이 프로젝트를 만드는가

### 배경

현업(GGQ)에서 2년간 Node.js 마이크로서비스 18개를 운영하며 결제, 구독, 배치, 알림, 통계 시스템을 구축했다. 4,000개 이상의 커밋을 남기는 동안 시스템은 동작했지만, 운영하면서 보이는 한계들이 있었다.

### 현업의 한계점

운영 코드를 분석하면서 발견한 구조적 약점들:

#### 1. 메시지 큐가 없다
결제 자동갱신을 처리하는 `AutopayHandler`가 `while(true)` 무한 루프 안에서 Redis Sorted Set의 `zpopmin`으로 만료 구독을 폴링한다.

```typescript
// 현업 패턴 (요약)
while (true) {
  const expired = await redis.zpopmin('subscription:expired', 1);
  if (!expired) {
    await sleep(1000);
    continue;
  }
  await processRenewal(expired); // 실패하면? 재시도? 죽으면?
}
```

문제점:
- 프로세스 크래시 시 처리 중이던 작업 유실
- 재시도 정책 없음 (실패하면 그냥 끝)
- 백프레셔(backpressure) 제어 불가
- Dead Letter Queue 없음 (영구 실패 건 추적 불가)

#### 2. 동기 HTTP 호출
서비스 간 통신이 모두 Axios 동기 호출이다. payment-server → batch-server → desktop-server로 이어지는 호출 체인 중 하나라도 실패하면 데이터 정합성이 깨질 수 있다.

#### 3. CQRS / 이벤트 소싱 없음
통계 페이지가 매번 write DB에 무거운 쿼리를 날리고, `node-ts-cache`로 인메모리 TTL 캐싱만 한다. 캐시 invalidation 전략이 약하고, 멀티 인스턴스 환경에서 캐시 일관성이 보장되지 않는다.

#### 4. DB 마이그레이션 도구 없음
스키마 변경이 모두 수동 SQL 스크립트다. 누가, 언제, 왜 변경했는지 추적이 어렵고 롤백 절차가 없다.

#### 5. 통합 테스트 부재
`Dummy.test.ts`라는 빈 파일들만 존재한다. 실제 DB와 Redis가 들어간 통합 테스트가 없어서 리팩토링이 두려운 코드들이 쌓여 있다.

---

## 이 프로젝트의 목표

> **"운영해보니 이런 한계가 있더라. 그래서 직접 개선해봤다"** 라고 면접에서 말할 수 있는 포트폴리오를 만든다.

### 측정 가능한 목표

| 목표 | 측정 방법 |
|---|---|
| 메시지 유실 없는 자동갱신 | 프로세스 강제 종료 후 재시작했을 때 큐 작업 보존 검증 |
| 자동 재시도 + 영구 실패 격리 | 의도적 실패 주입으로 DLQ 동작 검증 |
| 이벤트 기반 데이터 흐름 | event_store에 모든 상태 변경이 영속화되는지 검증 |
| 멱등성 보장 | 동일 결제 요청 100회 동시 호출 시 1건만 처리 |
| 테스트 신뢰성 | 실제 MySQL/Redis 컨테이너를 띄운 통합 테스트 작성 |
| 스키마 버전 관리 | dbmate up/down으로 마이그레이션 가능 |

### 면접 어필 포인트

면접관에게 이렇게 말할 수 있도록:

> "현업에서는 결제 자동갱신을 while-true + zpopmin으로 폴링했는데, 메시지 유실이 가능한 구조라 BullMQ 기반으로 재설계해봤습니다. exponential backoff, Dead Letter Queue, 동시성 제어가 자연스럽게 따라왔고, Testcontainers로 실제 인프라에 대한 통합 테스트를 작성해서 리팩토링 안정성도 확보했습니다."

이 한 마디가 이 프로젝트의 전부다.

---

## 무엇을 만드는가

### 도메인

게임 회사의 **결제 / 구독 / 자동갱신** 시스템. 현업 도메인을 그대로 가져왔지만, 코드는 한 줄도 복사하지 않고 처음부터 다시 설계한다.

### 기능 범위

#### 1. 결제 (Payment)
- 결제 생성: PG 호출 전 PENDING 상태로 주문 기록
- 결제 완료: 트랜잭션 ID 매핑 + COMPLETED 전환
- 결제 실패: 사유 기록 + FAILED 전환
- 결제 환불: 부분/전체 환불 지원
- 결제 조회: 주문번호 / 사용자별 목록

#### 2. 구독 (Subscription)
- 구독 생성: 월간/연간 플랜 지원
- 구독 취소: 자동갱신 비활성화
- 구독 만료: 배치로 자동 처리
- 활성 구독 조회

#### 3. 자동갱신 (Autopay)
- 5분마다 만료 임박 구독 스캔
- BullMQ로 갱신 작업 큐잉
- 결제 → 구독 연장 트랜잭션 처리
- 실패 시 exponential backoff (2초 → 4초 → 8초)
- 3회 실패 후 Dead Letter Queue 격리

#### 4. 이벤트 / 통계 (Event Store + CQRS)
- 모든 상태 변경이 `event_store` 테이블에 영속화
- aggregate ID로 특정 결제/구독의 전체 이벤트 히스토리 조회
- 이벤트 타입별 필터링
- `payment_summary` 읽기 모델이 자동 갱신 (CQRS)
- 일별/누적 매출, 거래수, 환불수 통계

### 어드민 대시보드 (서브)

Next.js로 만든 운영 콘솔:

- **Dashboard**: 누적 통계 + 최근 이벤트 타임라인
- **Payments**: 결제 생성 폼, 사용자별 결제 검색
- **Subscriptions**: 구독 생성/취소, 상태 조회
- **Events**: 이벤트 타임라인, aggregate별 필터링

대시보드는 백엔드 메인 프로젝트의 서브 어필 포인트다. "백엔드 80% + 프론트 20%" 비중으로, 백엔드 면접에서 풀스택 가능성도 함께 어필하기 위한 장치다.

---

## 어떻게 만드는가

### 기술 스택과 선택 이유

| 기술 | 선택 이유 |
|---|---|
| **Node.js + TypeScript** | 현업과 동일한 기반. 비교가 명확해진다 |
| **Express.js** | 현업과 동일. 굳이 Fastify 같은 걸로 갈 필요 없음 |
| **tsyringe (DI)** | 현업과 동일한 의존성 주입 패턴 유지 |
| **BullMQ** | 핵심 개선 포인트. while-true 대체 |
| **MySQL 8.0 (Raw SQL)** | 현업과 동일하게 ORM 없이. 단, dbmate로 버전 관리 |
| **Redis 7 (ioredis)** | BullMQ 백엔드 + 멱등성 키 + 캐시 |
| **Testcontainers** | 핵심 개선 포인트. Real DB/Redis로 통합 테스트 |
| **dbmate** | 핵심 개선 포인트. 스키마 버전 관리 |
| **Next.js 15 + Tailwind** | 어드민 대시보드 (서브) |
| **Docker Compose** | 원커맨드 기동: docker compose up |

### 아키텍처

```
┌─────────────────────────────────────────────────────┐
│              REST API (Express)                      │
│  POST /payments  POST /subscriptions  GET /stats     │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
    ┌──────────▼──────────┐ ┌────────▼────────────┐
    │   PaymentHandler    │ │ SubscriptionHandler  │
    │   (idempotency)     │ │ (duplicate check)    │
    └──────────┬──────────┘ └────────┬────────────┘
               │                      │
    ┌──────────▼──────────────────────▼───────────┐
    │              EventBus                        │
    │  publish → event_store (영속화)              │
    │          → local handlers (디스패치)         │
    └──────┬──────────────┬───────────────────────┘
           │              │
    ┌──────▼─────┐ ┌──────▼──────────────────┐
    │  BullMQ    │ │ PaymentSummaryProjector  │
    │  Queues    │ │ (CQRS Read Model)        │
    └──────┬─────┘ │ payment_summary table    │
           │       └─────────────────────────┘
    ┌──────▼──────────────┐
    │   AutopayWorker     │
    │   - 5분 주기 스캔   │
    │   - 3회 재시도      │
    │   - exp. backoff    │
    │   - Dead Letter Q   │
    └─────────────────────┘
```

### 레이어 구조 (현업과 동일 유지)

```
src/
├── config/         ← 인프라 (DB pool, Redis, DI 컨테이너)
├── common/         ← 공통 타입, 에러
├── models/
│   ├── entities/   ← 도메인 엔티티 (Payment, Subscription, Event)
│   └── repositories/ ← Raw SQL 리포지토리
├── events/         ← EventBus (발행 + 영속화 + 디스패치)
├── queues/         ← BullMQ 큐 매니저
├── handlers/       ← 비즈니스 로직 (현업의 Handler 패턴)
├── workers/        ← 백그라운드 작업 (Autopay, Projector)
├── controllers/    ← Express 요청 처리
└── routes/         ← API 라우팅
```

레이어 구조를 현업과 동일하게 유지한 이유: "다른 회사 가서도 익숙한 구조에서 시작할 수 있다"를 어필하기 위함.

### 핵심 설계 결정

#### 1. BullMQ로 while-true 대체
```typescript
// 현업: 무한 루프 폴링
while(true) { ... await sleep(1000); }

// 이 프로젝트: BullMQ repeatable job
queue.add('scan-expired', {}, {
  repeat: { every: 5 * 60 * 1000 }, // 5분 주기
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
});
```

장점:
- 프로세스 크래시 시 작업 보존 (Redis에 저장됨)
- 재시도 정책 자동
- DLQ 자동 이동
- 동시 처리 (concurrency: 5)

#### 2. 이벤트 소싱
모든 상태 변경이 `event_store` 테이블에 JSON으로 저장된다.

```sql
CREATE TABLE event_store (
  event_id VARCHAR(36) NOT NULL UNIQUE,
  event_type VARCHAR(64),
  aggregate_id VARCHAR(128),
  payload JSON,
  version INT,
  occurred_at DATETIME,
  UNIQUE INDEX idx_aggregate_version (aggregate_id, version)
);
```

장점:
- 어떤 시점의 상태든 재생 가능
- 새 read model 추가가 쉬움 (이벤트 replay)
- 감사 로그(audit log)가 자연스럽게 따라옴

#### 3. CQRS 읽기 모델
`PaymentSummaryProjector`가 결제 이벤트를 구독하여 `payment_summary` 테이블을 자동 갱신한다.

```typescript
this.eventBus.subscribe(EventType.PAYMENT_COMPLETED, (event) => {
  await this.db.execute(
    `INSERT INTO payment_summary (date, total_revenue, ...)
     VALUES (DATE(?), ?, ...)
     ON DUPLICATE KEY UPDATE
       total_revenue = total_revenue + VALUES(total_revenue)`,
    [...]
  );
});
```

장점:
- 통계 쿼리가 write 모델 부하를 주지 않음
- 캐시 invalidation 고민 없음 (이벤트 도착 시 자동 갱신)

#### 4. 멱등성 (Idempotency)
Redis 키로 중복 결제 방지:

```typescript
const idempotencyKey = `payment:idempotency:${userId}:${productId}`;
const existing = await redis.get(idempotencyKey);
if (existing) throw new DuplicatePaymentError(existing);

// ... 결제 생성 ...

await redis.set(idempotencyKey, orderNumber, 'EX', 3600);
```

추가로 `event_store`의 `(aggregate_id, version)` UNIQUE 인덱스가 이벤트 중복 삽입도 차단한다.

#### 5. Testcontainers 통합 테스트
```typescript
beforeAll(async () => {
  mysqlContainer = await new MySqlContainer('mysql:8.0').start();
  redisContainer = await new GenericContainer('redis:7-alpine').start();
  // 실제 DB에 마이그레이션 실행 후 테스트
});
```

장점:
- mock 없이 실제 SQL 동작 검증
- 트랜잭션, 인덱스, 제약조건이 실제로 동작하는지 확인
- 리팩토링 안정성 확보

---

## 현재 진행 상황

### 완료 (Phase 1)

총 **18개 atomic commit**, 약 1만 줄의 코드.

- ✅ 백엔드 인프라: DB pool, Redis, DI 컨테이너
- ✅ 도메인 엔티티 + Raw SQL 리포지토리
- ✅ EventBus + BullMQ 큐 매니저
- ✅ Payment / Subscription 핸들러
- ✅ AutopayWorker (현업 while-true 대체)
- ✅ PaymentSummaryProjector (CQRS read model)
- ✅ 14개 REST 엔드포인트 + 에러 핸들링
- ✅ Testcontainers 기반 통합 테스트
- ✅ Docker Compose 원커맨드 기동
- ✅ DB 마이그레이션 4개 (dbmate 호환)
- ✅ Next.js 어드민 대시보드 4페이지

### 진행 예정

#### Phase 2: Notification Hub (2-3주)
이메일/푸시/인앱 알림을 BullMQ 기반으로 처리하는 별도 마이크로서비스.
- 현업 `PersonalizedEmailSender`의 Redlock + 수동 재시도 → BullMQ 기반 보장 배달
- Prisma vs Raw SQL 비교 (동일 스키마 양쪽 구현)
- Prometheus + Grafana 메트릭 대시보드
- k6 부하 테스트 (10,000건 알림 E2E 지연시간)

#### Phase 3: GG Gateway (3-4주)
중앙 API Gateway. 현업에 없던 부분.
- JWT 중앙 인증 + Redis sliding window rate limiter
- Circuit Breaker 패턴
- OpenTelemetry E2E 분산 추적 + Jaeger
- Socket.io 실시간 WebSocket 푸시
- k6 부하 테스트로 한계점 탐색

---

## 면접 스토리 (1분 발표용)

> "GGQ에서 18개 마이크로서비스를 운영하면서 결제 자동갱신이 while-true + zpopmin 폴링으로 돌아가는 걸 봤습니다. 메시지 유실 가능하고, 재시도 정책도 없는 구조였어요.
>
> 그래서 같은 도메인을 BullMQ 기반으로 재설계해봤습니다. delayed jobs로 5분 주기 스캔, exponential backoff 자동 재시도, 3회 실패 시 Dead Letter Queue 격리를 자연스럽게 얻었습니다.
>
> 그 위에 이벤트 소싱과 CQRS read model을 얹어서 통계 페이지가 write DB를 건드리지 않도록 했고, Testcontainers로 실제 MySQL/Redis에 대한 통합 테스트를 작성했습니다. 현업에서는 Dummy.test.ts라는 빈 파일만 있었거든요.
>
> 코드는 GitHub에 공개되어 있고, docker compose up 한 번으로 전체 스택이 뜹니다."

---

## 평가 기준 (스스로 점검)

면접 전 이 항목들로 자체 점검:

- [ ] `docker compose up` 한 번으로 모든 의존성이 뜨는가
- [ ] 통합 테스트가 실제 DB/Redis에서 통과하는가
- [ ] DLQ에 영구 실패 건이 들어가는 시나리오를 시연 가능한가
- [ ] event_store에서 특정 결제의 모든 이벤트 히스토리를 보여줄 수 있는가
- [ ] CQRS 읽기 모델이 이벤트 발생 시 자동 갱신되는 걸 보여줄 수 있는가
- [ ] 마이그레이션을 dbmate up/down 으로 시연 가능한가
- [ ] README에 "현업 대비 개선점" 표가 명시되어 있는가
- [ ] 어드민 대시보드에서 결제 생성 → 이벤트 타임라인 갱신 흐름이 보이는가

---

## 라이센스

MIT
