"""Quick test script for the AI agent chat endpoint."""
import asyncio
import httpx
import traceback

async def test():
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                "http://localhost:8000/chat",
                json={"message": "hello", "user_id": "test123"}
            )
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.text}")
        except Exception as e:
            print(f"Error: {e}")
            traceback.print_exc()

asyncio.run(test())
