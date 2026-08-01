# Architecture

Cloudflare Pages가 정적 Shell을 제공하고 한 Worker가 `/api/v1`을 처리한다. 하나의 D1 안에서 Core와 업무 module이 transaction boundary를 공유하되, 코드는 `worker/core`와 `worker/modules`로 분리한다. R2는 `files` metadata를 통한 file-storage adapter로만 접근한다.

Core는 identity, company, site, contract, membership, role, permission, entitlement, session, invitation, audit를 소유한다. UI는 route 기반으로 module을 선택하며 권한 없는 module code는 렌더링하지 않는다.

## v0.2.2 authentication bootstrap

`POST /api/v1/auth/login` creates the canonical HttpOnly session and returns the same Context contract used by `GET /api/v1/session`. The frontend transfers that response once through tab-scoped `sessionStorage`, removes it on consumption, and builds the shell without a duplicate session bootstrap request. Every protected API continues to authenticate and authorize against D1; the bootstrap is never an authorization cache.

## Source and release architecture

Git `main` owns the verified source baseline. Feature branches own work in progress, Integration owns remote verification, and versioned Integrated ZIPs provide external recovery artifacts. Production is outside this pipeline until separately approved.

## Document work and inspection boundaries

Safety periodic definitions schedule document work; instances represent a due document, checklist results provide structured field data, and periodic documents preserve submitted and approved revision snapshots. Source modules remain canonical and are read to construct the draft.

Construction owns `CONSTRUCTION_INSPECTION` and the request → review → revision/resubmission → approval state machine. Quality does not consume these records as quality tests.

Quality legal obligations are versioned masters. A site obligation requires an explicit administrator applicability decision. Quality work basis records accept only verified legal obligations, approved quality plans, applicable standards, or applicable specifications. Unclassified legacy records remain in a classification report until administrator confirmation.

## Quality CSI preparation boundary

Quality owns internal test scheduling, results, evidence, reports, nonconformance, calibration, review, `READY_FOR_CSI`, and the user-confirmed `CSI_RECORDED` fact. It does not own CSI credentials, browser automation, automatic upload, automatic submission, or national records. The transition to `CSI_RECORDED` is an audited local confirmation, not a remote submission response.
