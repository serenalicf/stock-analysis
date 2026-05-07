
import asyncio
import os
import httpx
from dotenv import load_dotenv
from data.twelve_data import fetch_technical_indicators
from data.yfinance_data import fetch_support_resistance

load_dotenv()

async def test():
    ticker = "AAPL"
    print(f"Testing {ticker}...")
    
    try:
        print("Fetching indicators...")
        async with httpx.AsyncClient() as client:
            # Test a single indicator to see raw error
            from data.twelve_data import fetch_indicator
            res = await fetch_indicator(client, ticker, "rsi", "1day", {"time_period": 14})
            print("Raw RSI result:", res)
        indicators = await fetch_technical_indicators(ticker)
        print("Indicators summary:", indicators)
    except Exception as e:
        print("Indicators failed:", e)

    try:
        print("\nFetching S/R...")
        sr = await fetch_support_resistance(ticker)
        print("S/R:", sr)
    except Exception as e:
        print("S/R failed:", e)

if __name__ == "__main__":
    asyncio.run(test())
