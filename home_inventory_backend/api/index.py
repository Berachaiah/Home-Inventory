import sys
import os

# Vercel's Python runtime executes files under /api as the entrypoint, but our
# app code (main.py, models.py, routers/, etc.) lives one level up at the repo
# root. Add that to the path so `import main` resolves the same way it does locally.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app  # noqa: E402

# Vercel's Python runtime detects this `app` object and serves it as an ASGI app.
