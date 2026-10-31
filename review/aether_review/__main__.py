"""Run the review pages:  python -m aether_review

Binds to loopback only. Set AETHER_API_URL to point at Max's API
(default http://127.0.0.1:8000) and AETHER_REVIEW_PORT to change the port.
"""

import os

import uvicorn

from .app import create_app

if __name__ == "__main__":
    uvicorn.run(create_app(), host="127.0.0.1", port=int(os.environ.get("AETHER_REVIEW_PORT", "8001")))
