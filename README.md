<div align="center">

# ⚡ AtomPay
### Production-Grade Digital Payment Wallet API

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)

**[GitHub](https://github.com/AkshayDhankhar1)**

*Not a tutorial project. Built to understand what actually happens when ₹500 moves from one wallet to another — and what can go wrong.*

</div>

---

## What is AtomPay?

A digital payment wallet backend with the internals exposed. Most payment apps hide the complexity — AtomPay is built specifically to implement it: atomic transfers, race condition safety, fraud limits, and clean failure handling.

Think Paytm internals, not Paytm features.

---

## What's Built

### Auth & Security
- JWT authentication — tokens expire in 4 days
- Passwords and UPI PINs hashed separately with bcrypt — two independent security layers
- `select: false` on both — they never appear in any DB query response
- Zod validation on every route — bad input is rejected before it touches the database
- Change password and change PIN — both require the old credential before updating

### Wallet & Transactions
- Atomic money transfers via MongoDB sessions — 3 documents update together or not at all
- ₹5,000 signup bonus — wallet is auto-created the moment a user registers
- Wallet states: `Active` / `Frozen` / `Closed` — enforced on both sender and receiver
- Every transaction is tagged debit or credit from the user's perspective
- Transaction lifecycle: `pending` → `success` or `failed` with reason stored

### Fraud Prevention
- ₹1,00,000 per-day transfer cap — calculated with MongoDB aggregation pipeline on successful transactions from the last 24 hours, same approach as real UPI
- Self-transfers blocked
- Balance verified twice — once before session (fast reject), once inside session (race condition safety)

---

## Architecture

```
AtomPay/
├── controllers/
│   ├── auth.controller.js          # Signup, Login, Change Password, Change PIN
│   ├── transactions.controller.js  # Transfer — session logic + all fraud checks
│   └── wallet.controller.js        # Balance + transaction history
│
├── db/
│   ├── users.js                    # password + hashedPin both select:false
│   ├── wallet.js                   # Active / Frozen / Closed
│   └── transections.js             # pending → success/failed with failureReason
│
├── middlewares/
│   ├── auth.middlewares.js         # JWT verify, separates expired vs invalid token
│   └── validate.js                 # Zod middleware — rejects before controller
│
├── validators/
│   ├── auth.schema.js              # signup, login, changePassword, changePin
│   └── transaction.schema.js       # transfer with amount, pin, optional note
│
└── utils/
    └── jwt.js                      # Single place for token generation
```

---

## API

### `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/signup` | ❌ | Register — wallet created automatically |
| `POST` | `/login` | ❌ | Returns JWT |
| `PATCH` | `/change-password` | ✅ | Old password required |
| `PATCH` | `/change-pin` | ✅ | Old PIN required |

### `/api/wallet`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/balance` | ✅ | Balance + wallet status |
| `GET` | `/transactions` | ✅ | Last 50, newest first, debit/credit tagged |

### `/api/transaction`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/transfer` | ✅ | Send money — PIN required |

---

## How a Transfer Actually Works

```
1.  Amount ≥ ₹1?
2.  Sender exists + active?
3.  Sender wallet Active?
4.  Receiver exists + active?
5.  Receiver wallet Active?
6.  PIN correct? (bcrypt compare)
7.  Balance sufficient?
8.  Last 24hr total + this amount ≤ ₹1,00,000? (aggregation)
9.  → Start MongoDB session
10. Re-fetch both wallets inside session
11. Re-check balance inside session        ← closes race condition window
12. Save transaction as "pending"
13. Deduct sender, credit receiver
14. Update transaction to "success"
15. Commit

On any failure after step 9:
→ Session aborts — both wallets revert
→ Transaction saved as "failed" with reason
```

---

## Why These Decisions

**Sessions for transfers** — without them, a crash between steps 13 and 14 leaves one wallet updated and the other not. Sessions make it all-or-nothing.

**Double balance check** — the check at step 7 is fast. But between step 7 and step 13, a second concurrent request could spend the same money. Step 11 inside the session closes that gap.

**Aggregation for daily limit** — doing `Transaction.find()` and summing in JS loads all documents into memory. Aggregation computes the sum at the DB level. Same result, scales differently.

---

## What's Next

- [ ] Idempotency keys — so network retries don't double-charge
- [ ] Refresh tokens
- [ ] PIN lockout after 3 wrong attempts
- [ ] Admin routes — freeze/close any wallet
- [ ] Request money
- [ ] Monthly spend analytics
- [ ] Rate limiting
- [ ] OTP login
- [ ] QR code per wallet
- [ ] Pagination

---

<div align="center">

Built by **[Akshy Dhankhar](https://github.com/AkshayDhankhar1)**

*The interesting code is in `transactions.controller.js` — specifically the session logic and the aggregation pipeline for the daily limit.*

</div>