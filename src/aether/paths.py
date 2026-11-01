from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = ROOT / "data"
FIXTURE = ROOT / "fixtures" / "v01_boston_continuous.json"
DIST = ROOT / "web" / "dist"
