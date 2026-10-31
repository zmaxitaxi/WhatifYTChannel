"""The approved sound library: generation, manifest, and integrity checks.

library.json records, for every asset, its source, usage rights, attribution
requirements, and SHA-256 (TECHNICAL_PLAN.md section 4, Audio). Jobs may only
reference assets listed there, and the mixer refuses a file whose hash has
drifted from the manifest.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .synth import SAMPLE_RATE, SOUND_DESIGNS, render_design
from .wavio import read_wav, write_wav

AUDIO_ROOT = Path(__file__).resolve().parent.parent
LIBRARY_DIR = AUDIO_ROOT / "library"
MANIFEST_PATH = LIBRARY_DIR / "library.json"
LIBRARY_VERSION = "1.0.0"

CATEGORIES = (
    "ambience",
    "movement",
    "crowd",
    "transition",
    "arrival",
    "disappearance",
    "impact",
    "ui",
    "stinger",
)

RIGHTS = {
    "license": "Original work owned by the AETHER team; procedurally generated, no third-party recordings or samples.",
    "commercialUse": True,
    "attributionRequired": False,
    "attribution": None,
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 16), b""):
            h.update(block)
    return h.hexdigest()


@dataclass(frozen=True)
class LibraryAsset:
    id: str
    category: str
    path: Path
    sha256: str
    samples: int
    loopable: bool
    sync_point_samples: int

    def load(self) -> np.ndarray:
        actual = sha256_file(self.path)
        if actual != self.sha256:
            raise ValueError(
                f"sound asset {self.id} hash mismatch: manifest {self.sha256[:12]}, file {actual[:12]}"
            )
        audio, rate = read_wav(self.path)
        if rate != SAMPLE_RATE:
            raise ValueError(f"sound asset {self.id} is {rate} Hz, expected {SAMPLE_RATE}")
        return audio


def build_library(out_dir: Path = LIBRARY_DIR) -> dict:
    """Regenerate every asset WAV and write library.json. Returns the manifest."""
    assets = {}
    for design in SOUND_DESIGNS:
        if design.category not in CATEGORIES:
            raise ValueError(f"{design.asset_id}: unknown category {design.category}")
        audio = render_design(design)
        rel = Path("sfx") / f"{design.asset_id}.wav"
        path = out_dir / rel
        write_wav(path, audio, SAMPLE_RATE, bits=16)
        peak = float(np.max(np.abs(audio)))
        assets[design.asset_id] = {
            "id": design.asset_id,
            "category": design.category,
            "description": design.description,
            "file": rel.as_posix(),
            "sha256": sha256_file(path),
            "format": {"container": "wav", "codec": "pcm_s16le", "sampleRate": SAMPLE_RATE, "channels": 2},
            "samples": int(len(audio)),
            "durationSeconds": round(len(audio) / SAMPLE_RATE, 6),
            "peakDbfs": round(20 * np.log10(max(peak, 1e-9)), 2),
            "loopable": design.loopable,
            "syncPointSeconds": design.sync_point_s,
            "source": {
                "type": "procedural",
                "generator": f"audio/aether_audio/synth.py::{design.generator.__name__}",
                "seed": design.seed,
            },
            "rights": RIGHTS,
            "approved": True,
        }
    manifest = {
        "libraryVersion": LIBRARY_VERSION,
        "sampleRate": SAMPLE_RATE,
        "categories": list(CATEGORIES),
        "assets": assets,
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "library.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def load_library(manifest_path: Path = MANIFEST_PATH) -> dict[str, LibraryAsset]:
    manifest = json.loads(manifest_path.read_text())
    base = manifest_path.parent
    out = {}
    for asset_id, a in manifest["assets"].items():
        if not a.get("approved", False):
            continue
        out[asset_id] = LibraryAsset(
            id=asset_id,
            category=a["category"],
            path=base / a["file"],
            sha256=a["sha256"],
            samples=a["samples"],
            loopable=a["loopable"],
            sync_point_samples=int(round(a["syncPointSeconds"] * manifest["sampleRate"])),
        )
    return out


def verify_library(manifest_path: Path = MANIFEST_PATH) -> list[str]:
    """Return a list of problems; empty means every file matches the manifest."""
    problems = []
    manifest = json.loads(manifest_path.read_text())
    for asset_id, a in manifest["assets"].items():
        path = manifest_path.parent / a["file"]
        if not path.exists():
            problems.append(f"{asset_id}: missing file {a['file']}")
            continue
        if sha256_file(path) != a["sha256"]:
            problems.append(f"{asset_id}: sha256 mismatch")
        for key in ("source", "rights"):
            if key not in a:
                problems.append(f"{asset_id}: missing {key}")
        if "attributionRequired" not in a.get("rights", {}):
            problems.append(f"{asset_id}: rights missing attributionRequired")
    return problems
