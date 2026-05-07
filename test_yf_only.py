
import yfinance as yf
import pandas as pd

def test_yf():
    ticker = "AAPL"
    print(f"Testing yfinance for {ticker}...")
    try:
        t = yf.Ticker(ticker)
        # Try a different period
        hist = t.history(period="5d")
        print("History:")
        print(hist)
        if hist.empty:
            print("History is empty")
        else:
            print("Successfully fetched data")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_yf()
