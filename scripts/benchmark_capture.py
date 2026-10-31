"""Compare lossless Playwright screenshot paths at the one production resolution."""

import base64
import json
import statistics
import time

from playwright.sync_api import sync_playwright

from aether.capture import scene_server
from aether.paths import FIXTURE
from aether.validation import load_spec

spec = load_spec(FIXTURE.read_text())
with scene_server(spec) as origin, sync_playwright() as playwright:
    with playwright.chromium.launch() as browser:
        page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        page.goto(origin + "/static/renderer.html?spec=/spec.json", wait_until="networkidle")
        page.wait_for_function("window.aether?.ready")
        session = page.context.new_cdp_session(page)
        results = {"page_screenshot": [], "cdp_lossless": []}
        for frame in range(10):
            page.evaluate("frame => window.aether.renderFrame(frame)", frame)
            start = time.monotonic()
            normal = page.screenshot(type="png")
            results["page_screenshot"].append(time.monotonic() - start)
            start = time.monotonic()
            fast = base64.b64decode(
                session.send(
                    "Page.captureScreenshot",
                    {"format": "png", "captureBeyondViewport": False, "optimizeForSpeed": True},
                )["data"]
            )
            results["cdp_lossless"].append(time.monotonic() - start)
            # Compression can differ, so compare decoded pixels, not encoded byte strings.
            from io import BytesIO

            from PIL import Image

            assert Image.open(BytesIO(normal)).tobytes() == Image.open(BytesIO(fast)).tobytes()
        print(
            json.dumps(
                {
                    key: {"median_seconds": statistics.median(values)}
                    for key, values in results.items()
                },
                indent=2,
            )
        )
