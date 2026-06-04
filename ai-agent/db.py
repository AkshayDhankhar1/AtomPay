"""Async MongoDB connection for the AI Agent.

Connects to the same AtomPay MongoDB database used by the Node.js backend.
Uses Motor (async pymongo driver) for non-blocking reads.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URL

_client: AsyncIOMotorClient | None = None
_db = None


async def get_db():
    """Get a reference to the AtomPay database."""
    global _client, _db
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URL)
        # Extract DB name from the connection string (after last '/')
        db_name = MONGO_URL.rstrip("/").split("/")[-1].split("?")[0]
        _db = _client[db_name]
    return _db


async def close_db():
    """Close the MongoDB connection."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None


# ── Helper functions for the LangChain tools ──

async def get_user_by_id(user_id: str) -> dict | None:
    """Fetch user document by _id."""
    from bson import ObjectId
    db = await get_db()
    return await db.users.find_one({"_id": ObjectId(user_id)})


async def get_wallet_by_user_id(user_id: str) -> dict | None:
    """Fetch wallet document for a user."""
    from bson import ObjectId
    db = await get_db()
    return await db.wallets.find_one({"user": ObjectId(user_id)})


async def get_transactions_for_wallet(wallet_id, limit: int = 50, tx_type: str = None) -> list:
    """Fetch transactions for a wallet, optionally filtered by type (debit/credit)."""
    from bson import ObjectId
    db = await get_db()

    query = {
        "$or": [
            {"fromWallet": wallet_id},
            {"toWallet": wallet_id}
        ]
    }

    cursor = db.transactions.find(query).sort("createdAt", -1).limit(limit)
    txns = []
    async for tx in cursor:
        is_debit = str(tx.get("fromWallet")) == str(wallet_id)
        tx_entry = {
            "transactionId": tx.get("transactionId", ""),
            "amount": tx.get("amount", 0),
            "status": tx.get("status", ""),
            "type": "debit" if is_debit else "credit",
            "note": tx.get("note", ""),
            "senderUsername": tx.get("senderUsername", ""),
            "receiverUsername": tx.get("receiverUsername", ""),
            "peerUsername": tx.get("receiverUsername") if is_debit else tx.get("senderUsername"),
            "createdAt": str(tx.get("createdAt", "")),
        }
        if tx_type and tx_entry["type"] != tx_type:
            continue
        txns.append(tx_entry)
    return txns


async def get_spending_aggregation(wallet_id, days: int = 30) -> dict:
    """Aggregate spending data for the last N days."""
    from bson import ObjectId
    from datetime import datetime, timedelta
    db = await get_db()

    since = datetime.utcnow() - timedelta(days=days)

    # Total sent (debits)
    pipeline_sent = [
        {"$match": {"fromWallet": wallet_id, "status": "success", "createdAt": {"$gte": since}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]

    # Total received (credits)
    pipeline_received = [
        {"$match": {"toWallet": wallet_id, "status": "success", "createdAt": {"$gte": since}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]

    # Top recipients
    pipeline_top = [
        {"$match": {"fromWallet": wallet_id, "status": "success", "createdAt": {"$gte": since}}},
        {"$group": {"_id": "$receiverUsername", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 5},
    ]

    # Daily breakdown
    pipeline_daily = [
        {"$match": {"fromWallet": wallet_id, "status": "success", "createdAt": {"$gte": since}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}},
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": -1}},
    ]

    sent_result = await db.transactions.aggregate(pipeline_sent).to_list(1)
    received_result = await db.transactions.aggregate(pipeline_received).to_list(1)
    top_recipients = await db.transactions.aggregate(pipeline_top).to_list(5)
    daily_breakdown = await db.transactions.aggregate(pipeline_daily).to_list(60)

    return {
        "period_days": days,
        "total_sent": sent_result[0]["total"] if sent_result else 0,
        "sent_count": sent_result[0]["count"] if sent_result else 0,
        "total_received": received_result[0]["total"] if received_result else 0,
        "received_count": received_result[0]["count"] if received_result else 0,
        "net_flow": (received_result[0]["total"] if received_result else 0) - (sent_result[0]["total"] if sent_result else 0),
        "top_recipients": [{"username": r["_id"], "amount": r["total"], "count": r["count"]} for r in top_recipients],
        "daily_breakdown": [{"date": d["_id"], "amount": d["total"], "count": d["count"]} for d in daily_breakdown],
    }


async def get_daily_limit_usage(wallet_id) -> dict:
    """Check how much of the ₹1,00,000 daily limit has been used."""
    from datetime import datetime, timedelta
    db = await get_db()

    since = datetime.utcnow() - timedelta(hours=24)
    pipeline = [
        {"$match": {"fromWallet": wallet_id, "status": "success", "createdAt": {"$gte": since}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    result = await db.transactions.aggregate(pipeline).to_list(1)
    used = result[0]["total"] if result else 0
    return {
        "daily_limit": 100000,
        "used": used,
        "remaining": max(0, 100000 - used),
        "percentage_used": round((used / 100000) * 100, 1),
        "transaction_count_today": result[0]["count"] if result else 0,
    }
