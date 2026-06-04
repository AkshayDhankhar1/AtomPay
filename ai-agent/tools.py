"""LangChain Tools for the AtomPay AI Agent.

Each tool wraps a database query and returns human-readable results
that the LLM can use to answer user questions.
"""

import json
import asyncio
from langchain_core.tools import tool


# ── Tool 1: Check Wallet Balance ──

@tool
async def check_balance(user_id: str) -> str:
    """Check the user's current wallet balance, currency, and wallet status.
    Use this when the user asks about their balance, how much money they have, or wallet status.
    """
    from db import get_wallet_by_user_id, get_user_by_id

    user = await get_user_by_id(user_id)
    wallet = await get_wallet_by_user_id(user_id)

    if not wallet:
        return "Wallet not found. The user may not have set up their wallet yet."

    return json.dumps({
        "username": user.get("username", "Unknown") if user else "Unknown",
        "balance": wallet.get("balance", 0),
        "currency": wallet.get("currency", "INR"),
        "status": wallet.get("status", "Unknown"),
    })


# ── Tool 2: Get Recent Transactions ──

@tool
async def get_recent_transactions(user_id: str, limit: int = 10, transaction_type: str = "all") -> str:
    """Get the user's recent transactions.
    Use this when the user asks to see their transactions, payment history, or recent activity.

    Args:
        user_id: The user's ID
        limit: Number of transactions to fetch (default 10, max 50)
        transaction_type: Filter by 'debit', 'credit', or 'all'
    """
    from db import get_wallet_by_user_id, get_transactions_for_wallet

    wallet = await get_wallet_by_user_id(user_id)
    if not wallet:
        return "Wallet not found."

    tx_type = None if transaction_type == "all" else transaction_type
    txns = await get_transactions_for_wallet(wallet["_id"], min(limit, 50), tx_type)

    if not txns:
        return "No transactions found for the given criteria."

    return json.dumps({
        "total_found": len(txns),
        "filter": transaction_type,
        "transactions": txns
    })


# ── Tool 3: Spending Analysis ──

@tool
async def analyze_spending(user_id: str, days: int = 30) -> str:
    """Analyze the user's spending patterns over a period.
    Use this when the user asks about their spending habits, expenses, how much they've spent,
    who they send money to most, or wants a financial summary.

    Args:
        user_id: The user's ID
        days: Number of days to analyze (7, 14, 30, 60, 90)
    """
    from db import get_wallet_by_user_id, get_spending_aggregation

    wallet = await get_wallet_by_user_id(user_id)
    if not wallet:
        return "Wallet not found."

    data = await get_spending_aggregation(wallet["_id"], min(days, 90))
    return json.dumps(data)


# ── Tool 4: Daily Limit Check ──

@tool
async def check_daily_limit(user_id: str) -> str:
    """Check how much of the daily ₹1,00,000 transfer limit the user has consumed.
    Use this when the user asks about their daily limit, remaining limit, or how much more they can send.
    """
    from db import get_wallet_by_user_id, get_daily_limit_usage

    wallet = await get_wallet_by_user_id(user_id)
    if not wallet:
        return "Wallet not found."

    data = await get_daily_limit_usage(wallet["_id"])
    return json.dumps(data)


# ── Tool 5: Transaction Search ──

@tool
async def search_transactions(user_id: str, search_username: str = "", min_amount: float = 0, max_amount: float = 0) -> str:
    """Search transactions by username or amount range.
    Use this when the user wants to find specific transactions, payments to/from a particular person,
    or transactions within a certain amount range.

    Args:
        user_id: The user's ID
        search_username: Username to search for in transaction peers
        min_amount: Minimum transaction amount (0 means no minimum)
        max_amount: Maximum transaction amount (0 means no maximum)
    """
    from db import get_wallet_by_user_id, get_transactions_for_wallet

    wallet = await get_wallet_by_user_id(user_id)
    if not wallet:
        return "Wallet not found."

    all_txns = await get_transactions_for_wallet(wallet["_id"], 50)

    results = []
    for tx in all_txns:
        # Filter by username
        if search_username:
            peer = tx.get("peerUsername", "")
            if search_username.lower() not in peer.lower():
                continue

        # Filter by amount range
        amount = tx.get("amount", 0)
        if min_amount > 0 and amount < min_amount:
            continue
        if max_amount > 0 and amount > max_amount:
            continue

        results.append(tx)

    if not results:
        return f"No transactions found matching your search criteria."

    return json.dumps({
        "total_found": len(results),
        "search_criteria": {
            "username": search_username or "any",
            "min_amount": min_amount,
            "max_amount": max_amount
        },
        "transactions": results[:20]
    })


# ── Tool 6: Account Info ──

@tool
async def get_account_info(user_id: str) -> str:
    """Get the user's account information including username, email, and account status.
    Use this when the user asks about their profile, account details, or personal information.
    """
    from db import get_user_by_id, get_wallet_by_user_id

    user = await get_user_by_id(user_id)
    if not user:
        return "User not found."

    wallet = await get_wallet_by_user_id(user_id)

    return json.dumps({
        "username": user.get("username", ""),
        "email": user.get("email", ""),
        "active": user.get("active", False),
        "created_at": str(user.get("createdAt", "")),
        "wallet_status": wallet.get("status", "Not found") if wallet else "No wallet",
        "wallet_currency": wallet.get("currency", "INR") if wallet else "N/A",
    })


# ── Tool 7: Expense Control Tips ──

@tool
async def get_expense_tips(user_id: str, category: str = "general") -> str:
    """Provide personalized expense control techniques and financial tips based on the user's spending data.
    Use this when the user asks for advice on saving money, reducing expenses, budgeting tips,
    or how to control their spending.

    Args:
        user_id: The user's ID
        category: Tip category — 'general', 'budgeting', 'saving', 'investing', 'daily_habits'
    """
    from db import get_wallet_by_user_id, get_spending_aggregation, get_daily_limit_usage

    wallet = await get_wallet_by_user_id(user_id)
    spending_data = None
    daily_data = None

    if wallet:
        spending_data = await get_spending_aggregation(wallet["_id"], 30)
        daily_data = await get_daily_limit_usage(wallet["_id"])

    context = {
        "category": category,
        "user_spending_30d": spending_data,
        "daily_usage": daily_data,
        "tips_database": {
            "general": [
                "Follow the 50/30/20 rule: 50% needs, 30% wants, 20% savings",
                "Track every expense for a month to identify spending patterns",
                "Set up automatic transfers to a savings account on payday",
                "Review your subscriptions monthly and cancel unused ones",
                "Use the 24-hour rule: wait before making non-essential purchases over ₹1,000",
            ],
            "budgeting": [
                "Create category-wise monthly budgets (food, transport, entertainment)",
                "Use envelope budgeting: allocate fixed amounts to each category",
                "Track your daily spending against weekly targets",
                "Set realistic budgets based on your last 3 months of spending",
                "Review and adjust your budget every month",
            ],
            "saving": [
                "Save first, spend later — treat savings as a non-negotiable expense",
                "Build an emergency fund covering 6 months of expenses",
                "Use the ₹500 note challenge: save every ₹500 note you receive",
                "Automate your savings with recurring transfers",
                "Set specific savings goals with deadlines (vacation, gadget, etc.)",
            ],
            "investing": [
                "Start SIPs even with small amounts (₹500/month) for long-term wealth",
                "Diversify: don't put all money in one instrument",
                "Understand the power of compound interest — start early",
                "Keep 3-6 months expenses liquid, invest the rest",
                "Learn about index funds for low-cost, passive investing",
            ],
            "daily_habits": [
                "Cook at home more often — eating out can be 3-5x more expensive",
                "Use public transport or carpooling to reduce commute costs",
                "Buy generic/store brands for everyday items",
                "Plan your meals weekly to reduce food waste and impulse buying",
                "Use cashback and rewards programs strategically",
            ],
        }
    }

    return json.dumps(context)


# ── Export all tools ──

ALL_TOOLS = [
    check_balance,
    get_recent_transactions,
    analyze_spending,
    check_daily_limit,
    search_transactions,
    get_account_info,
    get_expense_tips,
]
