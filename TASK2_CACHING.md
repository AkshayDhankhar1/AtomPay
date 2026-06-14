# Task 2 — Distributed Caching Strategy (Redis)

Everything implemented for Task 2: **what** was built, **where** it lives, **why**
each decision was made, and **how** it works. Download/keep this file as the
reference for the caching + idempotency layer.

---

## 0. Goal

Three things, all backed by the shared Redis client in `backend/db/redis.js`:

1. **Idempotency caching** — use Redis `SET NX` to instantly reject duplicate
   transaction requests (by `Idempotency-Key` header) *before* they touch MongoDB.
2. **Read-heavy caching** — cache user **balance** and **transaction history**.
3. **Strict invalidation** — delete the balance/history cache *only after* a
   successful MongoDB 2-phase commit resolves, so stale financial data is never
   served.

**Hard constraint honored:** the core multi-document transaction (2-phase commit)
in `transferMoney` was **not changed**. Invalidation is only *added after*
`commitTransaction()` resolves.

---

## 1. Files — what changed and where

| File | Change | Type |
|---|---|---|
| `backend/db/cache.js` | **New** — `cacheGet` / `cacheSet` / `cacheDel` JSON helpers over Redis | added |
| `backend/middlewares/idempotency.js` | **Rewritten** — Mongo `findOne`/`create` → Redis `SET NX` atomic claim | modified |
| `backend/controllers/wallet.controller.js` | Read-through cache for balance + transactions | modified |
| `backend/controllers/transections.controller.js` | Invalidate both parties' cache **after** commit | modified |
| `backend/db/idempotencyKey.js` | **Removed** — Mongo idempotency model no longer used | deleted |

No route files changed — `idempotency()` is still wired the same way on
`POST /api/transaction/transfer`.

---

## 2. Feature 1 — Idempotency with `SET NX`

**Where:** `backend/middlewares/idempotency.js`

**Why it was rewritten:** the old version did `IdempotencyKey.findOne()` then
`create()`. Between those two calls there is a **race window** — two retries of
the same payment (e.g. a double-tap or an auto-retry after a dropped network)
could *both* pass the `findOne` check and *both* execute the transfer = **double
charge**. The unique index only stopped the second *cache write*, not the second
*charge*.

**How it works now:**

```
Idempotency-Key header present?
  no  -> next() (normal processing)
  yes -> SET idem:<userId>:<key> "pending" EX 60 NX   (atomic claim)
           claim OK (didn't exist)  -> first request:
                                       process, then on res.json:
                                         2xx -> store {statusCode, body} EX 24h
                                         else -> DEL key (allow retry)
           claim fails (exists)     -> duplicate:
                                         value "pending" -> 409 (still processing)
                                         value "done"    -> replay cached response
```

**Key design decisions:**

- **`SET NX` is a single atomic operation** → the race window is gone. Only one
  concurrent request can ever win the claim.
- **Key format `idem:<userId>:<key>`** → namespaced per user so two users can't
  collide on the same client-generated key.
- **`LOCK_TTL = 60s`** → if the handler crashes mid-request, the lock expires and
  the key can be retried; it can't get stuck forever.
- **`RESPONSE_TTL = 86400s` (24h)** → successful responses replay for a day.
- **Failures release the lock (`DEL`)** → a failed transfer moved no money, so the
  same key may be retried. (The frontend also generates a fresh key on error.)
- **Fail-open on Redis error** → a Redis problem won't block legitimate transfers.
- **Same `res.json` override pattern** you used originally, so the controller
  needs zero changes.

---

## 3. Feature 2 — Read-through caching (balance + history)

**Where:** `backend/controllers/wallet.controller.js`

**How (read-through pattern):**

```
GET balance:
  cached = cacheGet("cache:balance:<userId>")
  if cached -> return it
  else -> read Mongo -> cacheSet(..., 300s) -> return

GET transactions:
  cached = cacheGet("cache:txns:<userId>")
  if cached -> return it
  else -> read Mongo -> cacheSet(..., 30s) -> return
```

**Key design decisions:**

- **`BALANCE_TTL = 300s`, `TXNS_TTL = 30s`** → TTLs are only a *safety net*; both
  keys are explicitly invalidated on every successful transfer (Feature 3), so
  the cache normally reflects reality immediately. History gets a shorter TTL
  because it changes more often.
- **Per-user keys** (`cache:balance:<userId>`, `cache:txns:<userId>`).
- **`db/cache.js` helper, fail-open** → if Redis is down, `cacheGet` returns
  `null` and the controller transparently falls back to MongoDB. Caching can
  never break a request.
- The same `userId` (from the JWT, `req.user.id`) is used for both reading and
  invalidation, so keys always match.

---

## 4. Feature 3 — Strict invalidation after commit

**Where:** `backend/controllers/transections.controller.js`, immediately after
`await session.commitTransaction()`:

```js
await session.commitTransaction();

await cacheDel(
    `cache:balance:${senderId}`,
    `cache:balance:${receiver._id}`,
    `cache:txns:${senderId}`,
    `cache:txns:${receiver._id}`
);
```

**Key design decisions:**

- **Both parties invalidated** — a transfer changes the receiver's balance *and*
  history too, not just the sender's. Forgetting the receiver would serve them a
  stale balance.
- **Only after the commit resolves** — never before. If the transaction aborts,
  nothing moved, so nothing is invalidated (the cache is still correct).
- **The 2-phase commit block is untouched** — this is purely an addition after
  it, satisfying the "don't alter the atomic transaction" constraint.

---

## 5. Redis keys reference

| Key | Written by | Read by | TTL | Cleared by |
|---|---|---|---|---|
| `idem:<userId>:<key>` | idempotency middleware | idempotency middleware | 60s pending / 24h done | TTL, or DEL on failure |
| `cache:balance:<userId>` | wallet controller | wallet controller | 300s | transfer invalidation |
| `cache:txns:<userId>` | wallet controller | wallet controller | 30s | transfer invalidation |
| `rl:*` (from Task 1) | rate limiter | rate limiter | window | TTL |

---

## 6. How this follows the existing code patterns

- Inline error responses with the **`msg`** key (no error classes).
- `db/` directory for data/infra (`db.js`, `redis.js`, now `cache.js`).
- `module.exports = { ... }` / `module.exports = fn` factory style.
- The idempotency middleware keeps the original **`idempotency()` factory** and
  **`res.json` override** approach. The only stylistic change is `async/await`
  instead of `.then()` chains (used elsewhere in the codebase already).
- camelCase, 4-space indentation, terse comments.

---

## 7. Verification done

A local script exercised the real Redis instance and confirmed:

1. `cacheSet` / `cacheGet` / `cacheDel` round-trip correctly.
2. First request **claims** the key and caches its success response.
3. A **duplicate** request **replays** the cached response without re-processing.
4. Two **concurrent** duplicates → exactly one claims, the other gets **409**.

---

## 8. Important operational note (latency)

The cache and idempotency calls are network round-trips to Redis. The current
Redis instance is **~78 ms away** (measured), with spikes past the 200 ms
`commandTimeout`. Consequences **until Redis is co-located with the backend**:

- **Caching will frequently miss** (commands time out → fail-open → falls back to
  Mongo). It won't speed anything up; it may add a little latency.
- **Idempotency may occasionally fail-open** on a timeout (a rare duplicate could
  slip through during a Redis stall).

**Fix:** put Redis in the **same region/datacenter** as the backend (Railway
Redis plugin, or Redis Cloud/Upstash in the backend's region). Round-trips drop
to ~1 ms, caching becomes effective, and idempotency is rock-solid. See
`BACKEND_CHANGES.md` §3 for the full latency analysis.

---

## 9. What's intentionally NOT done here

- The ₹1,00,000/24h **velocity cap** is still the Mongo aggregation (Task 1
  follow-up), not Redis — separate task.
- **BullMQ queues / workers** (Task 3) and **graceful shutdown** (Task 4) are
  separate tasks.
