# Task 3 (BullMQ Queues) & Task 4 (Graceful Shutdown + Pooling)

What was built, where it lives, why each decision was made, and how it works.

---

## Task 3 — Asynchronous Event Queuing (BullMQ)

**Goal:** move non-critical work (emails, audit logging) off the HTTP request path
into Redis-backed queues, processed by a **separate worker process**.

### Files

| File | Change | Type |
|---|---|---|
| `backend/queues/index.js` | **New** — `email` + `audit` queues (producers) + `enqueueEmail` / `enqueueAudit` / `closeQueues` | added |
| `backend/workers/email.worker.js` | **New** — processes email jobs (transaction emails) | added |
| `backend/workers/audit.worker.js` | **New** — processes audit jobs → writes AuditLog | added |
| `backend/db/auditLog.js` | **New** — Mongo model for audit/analytics records | added |
| `backend/worker.js` | **New** — worker process entrypoint (`npm run start:worker`) | added |
| `backend/utils/mailer.js` | Added `sendTransactionEmail`; switched to named exports | modified |
| `backend/controllers/auth.controller.js` | Import updated to `{ sendOTPEmail }` | modified |
| `backend/controllers/transections.controller.js` | Enqueue email + audit on success and failure | modified |
| `backend/package.json` | Added `bullmq`; added `start:worker` script | modified |

### How it works

```
API process (producer)                 Worker process (consumer)
─────────────────────                  ─────────────────────────
transfer succeeds/fails                 npm run start:worker
   enqueueEmail({...})  ── Redis ──>    email worker  -> sendTransactionEmail
   enqueueAudit({...})  ── Redis ──>    audit worker  -> AuditLog.create
   (fire-and-forget)                    (retries x3, backoff)
```

- **Producers** (`queues/index.js`) only create BullMQ `Queue`s and push jobs.
  They're **fire-and-forget and fail-open** — a Redis/queue problem never affects
  the transfer response (the money already moved safely).
- **Workers** (`workers/*.worker.js`) run in a **separate process** so heavy work
  (sending email, DB writes) never competes with API request handling and can be
  scaled independently. Each `Worker` gets its own Redis connection
  (`createBullConnection`, `maxRetriesPerRequest: null` — a BullMQ requirement).
- **Job options:** `attempts: 3`, exponential backoff, auto-trim completed/failed
  jobs — standard resilient defaults.
- **Where producers fire:** in `transferMoney`, *after* `commitTransaction()` for
  success (email "you sent ₹X to @y" + audit `status: success`), and in the
  `catch` for failure (audit `status: failed` + failure email). The 2-phase
  commit block itself was **not modified**.
- **Lightweight producers:** the email job carries only `userId`; the worker looks
  up the email address itself, so the request path stays minimal.

### Decision: OTP emails kept synchronous (deliberate)

The task lists "email OTP" among async emails, but OTP emails were **intentionally
left synchronous**. OTPs are auth-critical and short-lived (~2 min). If they were
queued and the worker were down (or Redis stalled), users could not log in, and a
delayed OTP arrives already expired. **Transaction emails and audit logs** are the
right things to make async — non-critical, retry-friendly, no tight deadline.

---

## Task 4 — Graceful Shutdown & Connection Pooling

### Files

| File | Change | Type |
|---|---|---|
| `backend/index.js` | SIGTERM/SIGINT graceful shutdown; pre-warm Redis at boot | modified |
| `backend/worker.js` | SIGTERM/SIGINT graceful drain of workers | added (above) |
| `backend/db/db.js` | Strict Mongo connection pool options | modified |

### Graceful shutdown — API (`index.js`)

```
SIGTERM / SIGINT
  -> server.close()              // stop accepting NEW requests; let in-flight finish
       -> closeQueues()          // close producer queue connections
       -> mongoose.connection.close()
       -> closeRedis()
       -> process.exit(0)
  -> 10s safety-net timer -> force exit if something hangs
```

In-flight requests (including an active Mongo transaction) are allowed to finish
because `server.close()` waits for open connections to drain before the callback
runs.

### Graceful shutdown — worker (`worker.js`)

```
SIGTERM / SIGINT
  -> worker.close() for each worker   // waits for active jobs to finish
  -> mongoose.connection.close()
  -> closeRedis()
  -> process.exit(0)
```

`Worker.close()` stops pulling new jobs and waits for currently-running jobs to
complete, so no job is killed mid-flight.

### Connection pooling

- **MongoDB** (`db/db.js`): `maxPoolSize: 10`, `minPoolSize: 2`,
  `serverSelectionTimeoutMS: 5000`, `socketTimeoutMS: 45000`. A bounded, reused
  socket pool instead of opening connections per request.
- **Redis**: ioredis uses **one multiplexed connection** that pipelines many
  commands — that single shared client (`getRedis()`) *is* the idiomatic Redis
  "pool". It is now **pre-warmed at boot** so the first request doesn't pay
  connection setup. BullMQ gets its own dedicated connections.

---

## How this follows the existing patterns

- Inline errors with `msg`, no classes.
- `db/` for data/infra (`db.js`, `redis.js`, `cache.js`, `auditLog.js`); new
  `queues/` and `workers/` dirs only for the genuinely new concepts.
- `module.exports = { ... }` / single-function exports, arrow functions, camelCase,
  4-space indent, terse comments.
- The 2-phase commit transaction was not touched — producers were only added
  after commit / in the catch.

---

## How to run

```bash
# API
npm start
# Worker (separate process / service)
npm run start:worker
```

Deploy the worker as its **own** Railway service (same repo, start command
`npm run start:worker`, same env vars).

---

## Operational notes

1. **Redis eviction policy** — BullMQ warns the current instance uses
   `volatile-lru`; it should be **`noeviction`** so queued jobs are never evicted
   under memory pressure. Set `maxmemory-policy noeviction` in the Redis instance
   config (Redis Cloud: database → configuration).
2. **Latency / co-location** — same as before: keep Redis in the backend's region
   for fast, reliable queueing (see `BACKEND_CHANGES.md` §3).
3. **The worker must be running** for transaction emails/audit logs to be
   processed. If it's down, jobs queue up in Redis and process once it's back
   (they are not lost).

---

## Not done here

- ₹1,00,000/24h **velocity cap** in Redis (Task 1 follow-up) — still the Mongo
  aggregation.
