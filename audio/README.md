# AETHER audio and delivery (`audio/`) — Francis, Workstream C task 4

Sound library, frame-timed cues, the audio mix, and the final Shorts encode
from `TECHNICAL_PLAN.md` §4 (Audio, Export).

```
audio/
  aether_audio/        Python package (needs Python 3.12+, numpy, ffmpeg/ffprobe on PATH)
    synth.py           procedural sound design: the provenance of every library asset
    library.py         builds/loads/verifies library/library.json (source, rights, sha256)
    contracts.py       SoundCueTrack contract + validation against the CompiledScenePlan
    mix.py             cue placement, premix, loudness (-16 LUFS, <= -1 dBTP)
    encode.py          final H.264/AAC Shorts encode + FFprobe/ebur128 inspection
    slate.py           sync-check slate video for when no renderer capture exists
  library/             approved assets (16-bit 48 kHz stereo WAV) + library.json
  cues/                one cue track per job
  tests/               python -m unittest discover -s tests
```

## Quick start

```bash
cd audio
pip install -r requirements.txt
python -m aether_audio verify-library
python -m aether_audio validate --cues cues/v01_stanford_boston_slice.cues.json \
    --plan ../renderer/fixtures/v01_stanford_boston_slice.json

# Mix + encode + inspect. --video takes one file or Patrick's chunk directory
# (chunk_000.mp4, chunk_001.mp4, ...). Leave it out to get a sync-check slate.
python -m aether_audio package --cues cues/v01_stanford_boston_slice.cues.json \
    --plan ../renderer/fixtures/v01_stanford_boston_slice.json \
    --out-dir ./scratch/v01 --video ../renderer/scratch/v01_slice
```

`package` writes `mix.wav`, `<jobId>.mp4`, and `report.json` (cue placements,
loudness iterations, every delivery check). It exits non-zero if any check fails.

## Sound library

15 effects covering every category the plan names: ambience, movement, crowd,
transition, arrival, disappearance, impact (plus UI and a reaction stinger).

| id | category | use |
|---|---|---|
| `amb_campus_day` | ambience | sunny campus breeze + birds (loops) |
| `amb_winter_wind` | ambience | gusting snowy wind (loops) |
| `amb_map_air` | ambience | high-altitude air for map shots (loops) |
| `crowd_murmur` | crowd | unintelligible student walla (loops) |
| `mv_rumble_lift` | movement | rumble/creak swelling as a campus lifts off |
| `mv_flight_swoosh` | movement | long airborne pass, left to right |
| `tr_whoosh_up` / `tr_whoosh_down` | transition | whoosh whose peak lands on the cut |
| `arr_impact_snow` | arrival | heavy landing thump + snow puff |
| `arr_shimmer` | arrival | bell sparkle for a reveal |
| `dis_poof` | disappearance | reverse swell that snaps into a pop |
| `imp_hit_low` | impact | short low hit for emphasis |
| `ui_caption_pop` / `ui_counter_tick` | ui | caption card pop, metric counter tick |
| `stinger_surprise` | stinger | two-note "wait, what?" for a reaction |

**Rights.** Every asset is generated from code in `synth.py` with a fixed
seed: no recordings, samples, or third-party material. `library.json` records
for each asset its generator and seed (source), licence (team-owned, commercial
use OK), `attributionRequired: false`, and its SHA-256. The mixer refuses a
file whose hash no longer matches. To add or change a sound, edit `synth.py`,
run `python -m aether_audio build-library`, listen, and commit the WAVs and
manifest together. Imported sounds (e.g. CC0 recordings) can be added later
with `source.type: "imported"` and their real licence/attribution.

## Cue track contract

Frames are the renderer's frames: `time = frame / 30`, ranges are half-open
`[start, end)`. At 48 kHz one frame is exactly **1,600 samples**, so audio
edits fall on the same boundaries as video frames.

```json
{
  "id": "s2_cut_whoosh",
  "assetId": "tr_whoosh_up",
  "syncFrame": 90,
  "endFrame": null,
  "gainDb": -8,
  "fadeInFrames": 0,
  "fadeOutFrames": 0,
  "pan": 0,
  "shotId": "shot_2_stanford_lift",
  "syncEvent": "Whoosh peaks on the cut to the Stanford orbit."
}
```

- `syncFrame` is where the asset's **sync point** lands, not where the file
  starts. Each asset declares `syncPointSeconds` (0 for most; 0.62 s for
  `tr_whoosh_up`), so a whoosh that needs a run-up still peaks exactly on the
  cut. Sound that would start before frame 0 is trimmed.
- `endFrame` (optional) stops the cue; looping ambiences repeat to fill it,
  and without it they run to the end of the programme.
- `gainDb` is limited to [-60, +6]; `pan` is constant-power balance in [-1, 1];
  fades are raised-cosine.
- `syncEvent` says which visual event the cue belongs to, for reviewers.

`validate` checks asset ids against the approved library, frames against the
plan's `totalFrames`, shot ids, fades that fit inside the cue, and one-shot
assets that would be asked to play past their end.

This mirrors the "Sound" section of the `ProductionSpec`. Max: when the
Pydantic models land, `contracts.py` can be replaced by them; the JSON field
names above are the proposal.

## Mix and loudness

1. Sum all cues into a float premix on the exact programme length.
2. Measure integrated loudness (FFmpeg `ebur128`) and apply one static gain to
   reach **-16 LUFS**.
3. Catch only the transients with a brickwall limiter running at 4x sample rate
   (approximate true peak), ceiling **-1.5 dBTP** (0.5 dB below the -1 dBTP
   contract to leave room for AAC overshoot). Re-measure and correct the gain
   until within 0.2 LU.

Why not `loudnorm` directly: sound-effect mixes have a high crest factor, so
loudnorm's linear mode can't reach -16 LUFS without breaking the true-peak
limit, and it silently switches to its dynamic mode, which pumps.

## Delivery encode

`encode_short` produces the only output format: H.264 High, 1080x1920, constant
30 fps, exactly `totalFrames` frames, SAR 1:1 / DAR 9:16, `yuv420p` with an
explicit BT.709 TV-range conversion and matching tags, CRF 18, AAC-LC stereo
48 kHz 192 kb/s, `+faststart`. Patrick's lossless chunks are joined with the
concat demuxer, so there is exactly one lossy encode.

`inspect_short` then checks with FFprobe and ebur128: codec, dimensions, frame
rate, decoded frame count, pixel format, colour tags and range, aspect ratios,
audio codec/rate/channels, `moov` before `mdat`, duration, integrated loudness
(±1 LU) and true peak (<= -1 dBTP) of the encoded AAC. It also lists sudden
momentary-loudness jumps (>= 12 LU within 100 ms) so a reviewer can confirm
they're intended hits rather than bad edits.

## V01 cue sheet (Stanford → Boston slice, 360 frames)

| frames | cue | why |
|---|---|---|
| 0–186 | campus ambience | sunny Stanford bed; fades as the map takes over |
| 0–96 | crowd murmur (quiet) | student life behind Maya |
| 0 | caption pop | hook caption appears |
| 8 | surprise stinger | Maya's reaction reads |
| 90 | rising whoosh peak + caption pop | cut to Stanford orbit |
| 126–180 | lift rumble | swells under the lift-off (renderer lifts the campus over 135–180) |
| 180 | rising whoosh peak + caption pop | cut to the US map as the campus launches |
| 174–276 | map air bed | cross-country flight |
| 184–268 | flight swoosh | campus travels the arc, panned left to right |
| 194–263 | 17 counter ticks | one each time the distance counter passes another 250 km, so ticks follow its ease-in/ease-out |
| 270 | falling whoosh peak + landing impact | cut down into snowy Boston |
| 262–360 | winter wind | snowy arrival; fades out to the end |
| 284 | arrival shimmer | sandstone-in-snow reveal |

`cap_04` has no pop on purpose: the landing impact already marks that cut.
