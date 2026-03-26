"""
HYDRA INTEL — Server Runner

Launch with: python run_server.py
"""

import sys
import os

# Ensure project root in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn

if __name__ == "__main__":
    print()
    print("  HYDRA INTEL -- API Server")
    print("  http://localhost:8000")
    print("  http://localhost:8000/docs  (Swagger UI)")
    print()

    uvicorn.run(
        "server.app:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )

