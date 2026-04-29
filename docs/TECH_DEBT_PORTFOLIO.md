# 기술 부채 → 포트폴리오 전환 계획

> 현업에서 작성한 코드 분석 결과, "당시 바빠서 못 했지만 지금 사이드 프로젝트로 풀어볼 만한" 기술 부채를 정리한 문서.

---

## TL;DR — 추천 순위

| 순위 | 항목 | 출처 | 소요 | 면접 임팩트 |
|---|---|---|---|---|
| 🥇 | **QR 로그인 보안 강화** | desktop-server | 1주 | ⭐⭐⭐ 보안 이슈 직접 해결 |
| 🥈 | **Statistics 페이지 React Query 전환 + 분해** | admin-page | 1주 | ⭐⭐⭐ 측정 가능한 성능 개선 |
| 🥉 | **QueryResultTransformer 성능 최적화** | 백엔드 3개 레포 | 3-4일 | ⭐⭐⭐ 벤치마크 가능 |
| 4 | **TFT PlacementsDetail 분해 (2,112줄)** | admin-page | 1-2주 | ⭐⭐⭐ God Component 해체 정석 |
| 5 | **이메일 발송기 통합 리팩토링** | batch-server | 1주 | ⭐⭐ 자체 코드의 TODO 해결 |

이 5개는 **기존 3개 프로젝트(GamePay/Notification/Gateway) 외에** 별도 mini-project로 정리하기 좋다.

---

## 1. QR 로그인 보안 강화 🥇

### 현업 상태
**파일**: [back-node-ggq-desktop-server/src/models/repositories/QrLoginRepository.ts:6](https://github.com/ggqcompany/back-node-ggq-desktop-server)

QR 로그인 request_id 추측 공격 방지가 미구현. 코드 주석에서 인지하고 있으나 시간 부족으로 미처리.

### 개선 방향 (사이드 프로젝트로 풀 때)

```typescript
// Before (현업)
async pollQrStatus(requestId: string) {
  return await this.repo.find({ requestId });
}

// After (이 프로젝트)
async pollQrStatus(requestId: string, pollingSecret: string) {
  // 1. Rate limiting (per-IP, per-requestId)
  await this.rateLimiter.check(`qr:${requestId}`, { max: 30, window: 60 });

  // 2. Polling secret 검증 (QR 생성 시 발급된 secret만 polling 가능)
  const stored = await this.redis.get(`qr:${requestId}`);
  if (!stored || stored.secret !== pollingSecret) throw new UnauthorizedError();

  // 3. 시도 횟수 추적 (이상 패턴 감지)
  await this.redis.incr(`qr:attempts:${requestId}`);

  return await this.repo.find({ requestId });
}
```

### 면접 어필 스토리
> "현업에서 QR 로그인을 운영했는데, 당시 request_id가 단순 UUID라 추측 공격 시 다른 사용자의 로그인 세션을 가로챌 가능성을 인지하고 있었습니다. 시간 제약으로 못 한 부분을 사이드 프로젝트로 풀어봤어요. (1) Redis sliding window rate limiting (2) polling secret 추가 (3) 이상 패턴 감지로 보안을 강화했습니다. OWASP 가이드라인 검토 후 적용한 거라 보안 컨텍스트로도 어필 가능합니다."

### 구현 범위
- 별도 인증 마이크로서비스로 분리
- BFF 패턴으로 desktop-mobile 페어링 구현
- 통합 테스트로 race condition / 추측 공격 시뮬레이션
- Grafana로 이상 패턴 모니터링

---

## 2. Statistics 페이지 React Query 전환 + 컴포넌트 분해 🥈

### 현업 상태
**파일**: [front-react-admin-page/client/src/pages/statistics/index.tsx](https://github.com/ggqcompany/front-react-admin-page) - **980줄, 6개 API 직접 fetch**

```tsx
// Before (현업)
useEffect(() => {
  Promise.allSettled([
    getUserStats(),
    getAmicaStats(),
    getPaymentStats(),
    getCreditStats(),
    getSubscriptionStats(),
    getTokenStats(),
  ]).then(setData);
}, []);
```

문제점:
- 캐싱 없음 (페이지 재방문 시 매번 6개 API 호출)
- dedup 없음
- 6개 섹션이 단일 컴포넌트
- 단위 테스트 없음

### 개선 방향

```tsx
// After
function UserStatsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'user'],
    queryFn: getUserStats,
    staleTime: 60_000,
  });
  // ...
}

// 6개 섹션을 독립 컴포넌트로 분해
<StatisticsPage>
  <Suspense fallback={<Skeleton />}>
    <UserStatsSection />
    <AmicaSection />
    <PaymentSection />
    {/* ... */}
  </Suspense>
</StatisticsPage>
```

### 면접 어필 스토리
> "현업 어드민 통계 페이지가 980줄짜리 단일 컴포넌트에서 useEffect로 6개 API를 직접 호출하는 구조였습니다. 페이지 재방문할 때마다 모든 데이터를 다시 받아오고, 한 섹션 에러가 다른 섹션 렌더링까지 영향을 줬어요. React Query로 전환하면서 6개 섹션을 독립 컴포넌트로 분해했고, 각 섹션이 자체 캐시/로딩/에러 상태를 갖도록 했습니다. Lighthouse로 측정해서 TTI 개선 수치 확보했습니다."

### 구현 범위
- React Query + Suspense로 데이터 페칭 분리
- Error Boundary로 섹션별 격리
- 각 섹션별 단위 테스트 + Storybook
- Before/After Lighthouse 점수 비교 (포트폴리오에 첨부)

---

## 3. QueryResultTransformer 성능 최적화 🥉

### 현업 상태
**파일**: 3개 백엔드 레포에 동일 구현체 존재
- `back-node-ggq-desktop-server/src/workers/QueryResultTransformer.ts:12`
- `back-node-ggq-payment-server/src/workers/QueryResultTransformer.ts:12`
- `back-node-ggq-batch-server/src/workers/QueryResultTransformer.ts:12`

DB 쿼리 결과 snake_case → camelCase 재귀 변환. 매 응답마다 호출되는 핫패스인데:
- 성능 측정 미실시
- 캐싱 전략 없음
- 3개 레포에 중복 코드 (단일 출처 원칙 위반)

### 개선 방향

```typescript
// 1. 벤치마크 작성
// benchmark.ts
benchmark('current', () => transformer.transform(largeRow));
benchmark('cached', () => cachedTransformer.transform(largeRow));
benchmark('compiled', () => compiledTransformer.transform(largeRow));

// 2. 키 변환 캐싱 (같은 컬럼명은 한 번만 변환)
class OptimizedTransformer {
  private keyCache = new Map<string, string>();

  transform(row: Record<string, unknown>) {
    const result: Record<string, unknown> = {};
    for (const key in row) {
      let camelKey = this.keyCache.get(key);
      if (!camelKey) {
        camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        this.keyCache.set(key, camelKey);
      }
      result[camelKey] = row[key];
    }
    return result;
  }
}

// 3. npm 패키지로 추출 (3개 레포 중복 제거)
// @company/query-transformer
```

### 면접 어필 스토리
> "현업 백엔드 3개 레포에 동일한 snake_case 변환 유틸이 복붙으로 존재했습니다. 매 DB 응답마다 호출되는 핫패스인데 벤치마크가 없어서 사이드로 측정해봤어요. 1만 건 응답에서 30%의 시간이 변환에 쓰이고 있었고, 키 변환 결과를 Map으로 캐싱하니 70% 단축됐습니다. 추가로 단일 패키지로 추출해서 3개 레포의 코드 중복을 제거하는 안까지 정리했습니다."

### 구현 범위
- benchmark.js로 4가지 구현 비교 (재귀/iterative/cached/compiled)
- 1만건/10만건/100만건 응답 시뮬레이션
- Flame graph로 핫패스 시각화
- npm 패키지로 추출 (별도 레포)

---

## 4. TFT PlacementsDetail 분해 (2,112줄)

### 현업 상태
**파일**: [front-react-admin-page/client/src/pages/TFT/PlacementsDetail/index.tsx](https://github.com/ggqcompany/front-react-admin-page) - **2,112줄**

God Component의 정석. 그리드 배치 로직 + 유닛 관리 + 저장 로직 + 검색 + 필터가 모두 한 파일.

### 개선 방향

```tsx
// Before: 2,112줄 단일 컴포넌트
export default function PlacementsDetail() { /* 모든 로직 */ }

// After: 도메인별 분해
<PlacementsDetail>
  <PlacementGrid />          // 그리드 배치 UI
  <UnitSelector />            // 유닛 검색/선택
  <ItemManager />             // 아이템 관리
  <SaveStateController />     // 저장 상태
</PlacementsDetail>

// Zustand로 상태 분리
const usePlacementStore = create<PlacementState>((set) => ({
  cells: [],
  moveUnit: (from, to) => { /* ... */ },
  saveSnapshot: () => { /* ... */ },
}));
```

### 면접 어필 스토리
> "현업에서 TFT 챔피언 배치 관리 어드민 페이지를 만들었는데, 기능이 추가되면서 2,000줄이 넘어갔습니다. 사이드로 분해해보니 그리드/유닛셀렉터/아이템관리/저장 4개 도메인이 명확하게 분리되더라고요. Zustand로 상태를 도메인별로 쪼개고, 각 컴포넌트를 독립적으로 테스트 가능하게 만들었습니다. 분해 후 라인수는 컴포넌트당 200~400줄로 줄었고, Storybook으로 각 상태를 시각화했어요."

### 구현 범위
- Zustand 스토어 도메인별 분리
- 4-5개 독립 컴포넌트로 분해
- 각 컴포넌트 단위 테스트
- Storybook으로 상태별 시각화

---

## 5. 이메일 발송기 통합 리팩토링

### 현업 상태
**파일**: [back-node-ggq-batch-server/src/workers/PersonalizedEmailSender.ts:26](https://github.com/ggqcompany/back-node-ggq-batch-server)

직접 작성한 코드의 TODO 주석:
```typescript
// TODO Admin Send Email과 리팩토링 필요
```

문제점:
- `PersonalizedEmailSender`는 재시도 로직 있음
- `AdminEmailSender`는 재시도 로직 없음
- 같은 일을 다르게 하는 두 개의 클래스
- SES 쿼터 체크가 per-send라 큐 레벨 throttling 없음

### 개선 방향

이건 **Phase 2 Notification Hub 프로젝트와 직접 연결됨**. 별도로 풀지 말고 Notification Hub의 메인 어필 포인트로 사용:

> "현업에서 이메일 발송 코드에 'TODO 리팩토링 필요'라는 주석을 직접 남겼었습니다. 두 발송기가 분리되어 있고 재시도 로직 일관성이 없었거든요. Notification Hub 사이드 프로젝트로 통합 디스패처를 BullMQ 기반으로 만들어서, 모든 채널(이메일/푸시/인앱)이 동일한 큐/재시도/DLQ 정책을 따르도록 통합했습니다."

---

## 추가 후보 (가치는 있지만 우선순위 낮음)

### 백엔드
- ⭐⭐ **결제 콜백 핸들러 완전성** ([PaymentCallbackHandler.ts:132,222,226](https://github.com/ggqcompany/back-node-ggq-desktop-server))
  - creditEventName 미구현, 이메일 미발송, postprocess 미처리
  - GamePay 프로젝트와 연결 가능

- ⭐⭐ **결제 카드 등록기 코드 중복** ([PaymentCardUpdater.ts:47](https://github.com/ggqcompany/back-node-ggq-payment-server))
  - PaymentCardRegisterHandler와 공통 로직 추출

- ⭐⭐ **하드코딩 매직 넘버** ([PickChampionsGetter.ts:221](https://github.com/ggqcompany/back-node-ggq-desktop-server))
  - 챔피언 점수 96/53/10/5/1 하드코딩 → Config로

### 프론트엔드
- ⭐⭐ **a11y 위반 3건** (jsx-a11y warn 모드 위반)
  - InputWithButton, SearchBar, FullScreenIcon의 `<div onClick>` → role="button" + onKeyDown
  - 빠르게 끝나지만 임팩트는 작음

- ⭐⭐ **Coupon 페이지 분해** (721줄)
  - 테이블/필터/생성 폼 분리

- ⭐⭐ **타입 안전성 개선**
  - admin-page 40+ any 타입
  - Permission/User 타입 정의 부재

---

## 실행 추천

### 옵션 A: 깊이 우선
**3개 메인 프로젝트(GamePay/Notification/Gateway)에 집중**하고, 기술 부채는 각 프로젝트에 자연스럽게 녹여낸다. 이미 진행 중.

### 옵션 B: 폭 + 깊이 (권장)
3개 메인 프로젝트 사이사이에 **5번째 mini-portfolio**로 위 항목 1-2개 추가:
- 메인 3개 = 시스템 설계 능력 어필 (큐, 이벤트, 게이트웨이)
- mini 1-2개 = 디테일 능력 어필 (성능 측정, 보안, 리팩토링)

추천 조합:
1. **GamePay Event Engine** (현업 결제 개선) ← 진행 중
2. **Notification Hub** (이메일 발송기 통합 어필 포함) ← 다음
3. **GG Gateway** (QR 로그인 보안 강화 어필 포함) ← 그 다음
4. **(미니) QueryResultTransformer 벤치마크** ← 부가 어필
5. **(미니) Statistics 페이지 React Query 전환** ← 풀스택 어필

이렇게 하면 5개 항목이 모두 **"현업의 한계를 인지 → 직접 개선"** 스토리로 연결된다.

---

## 면접 통합 스토리

> "현업에서 18개 마이크로서비스를 운영하면서 시간 부족으로 못 했던 개선 작업들이 있었습니다. 이직 준비하면서 그 부채들을 정리해봤어요.
>
> 큰 줄기는 3가지입니다.
> 1. 결제 시스템의 polling 패턴을 이벤트 기반으로 재설계 (GamePay)
> 2. 이메일 발송기의 일관성 없는 재시도 로직을 큐 기반으로 통합 (Notification Hub)
> 3. 각 서비스가 개별 인증/Axios를 가진 구조를 중앙 게이트웨이로 통합 (GG Gateway)
>
> 추가로 (1) QR 로그인 보안 강화, (2) 통계 페이지 React Query 전환, (3) DB 결과 변환기 성능 최적화 같은 디테일 작업도 진행했습니다.
>
> 모두 '시간 부족으로 못 했지만 인지하고 있던 문제'를 '직접 풀어본 결과'라서, 면접에서 단순 토이 프로젝트가 아니라 실무 컨텍스트가 있는 개선 사례로 어필할 수 있습니다."
