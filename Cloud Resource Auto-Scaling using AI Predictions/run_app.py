"""
One-Click Launcher for Cloud Resource Auto-Scaling with AI Predictions.
Starts FastAPI server and automatically opens the Web Dashboard in your browser.
"""

import webbrowser
import time
import sys
import uvicorn

def main():
    print("=========================================================================")
    print("  Cloud Resource Auto-Scaling using AI Predictions (0 Cost AWS)")
    print("=========================================================================")
    print("  [*] Environment: Local / AWS Free Tier (Guaranteed ₹0.00 / $0.00 Cost)")
    print("  [*] Starting server at http://localhost:8000 ...")
    print("  [*] Opening browser dashboard...")
    print("=========================================================================\n")

    # Open browser after 1.5 seconds
    def open_browser():
        time.sleep(1.5)
        webbrowser.open("http://localhost:8000")

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    # Launch server
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)

if __name__ == "__main__":
    main()
