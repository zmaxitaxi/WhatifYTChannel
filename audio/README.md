# AETHER audio and delivery (`audio/`) — Francis, Workstream C task 4

Sound library, frame-timed cues, the audio mix, and the final Shorts encode
from `TECHNICAL_PLAN.md` §4 (Audio, Export).

The retained V13 degree-expiry film adds `music_degree_pulse`: an original,
seamless twelve-second warm chord/pulse underscore from `degree_sfx.py`. It
repeats across the full 72-second film with soft entry/exit fades, beneath five
restrained scene effects. The target remains −22 LUFS. The earlier Stanford
cue sheet below retains its sparse-effect treatment; neither active film uses
bird/chirp/wind beds.


The current continuous Stanford journey uses `music_boston_sunrise`: a complete
72-second original score from `boston_score.py`, developing from warm intimate
keys into a brighter final third. It is not looped. Eight brief contextual
cues mark the campus, instrument workshop, research activity, ferry, computers,
and final workshop arrival. The encoded target remains −22 LUFS.

For future videos, continuous background music suited to the story is the
default. Its mood and energy can change with the world, including a brighter,
more hopeful future. Choose music for each premise; the degree loop and its
five-effect cue sheet are episode details. Keep effects restrained and spaced
apart over the music. See `../docs/CREATIVE_DIRECTION.md` for the shared taste.

```
audio/
  aether_audio/        Python package (needs Python 3.12+, numpy, ffmpeg/ffprobe on PATH)
    synth.py           original procedural sound designs and registry
    timeline_sfx.py    short, soft scene Foley for the alternate-history cut
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

29 assets covering music and every category the plan names: ambience, movement, crowd,
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

The older 72-second Stanford timeline uses the following twelve effects, one
per distinct scene. Each lasts 0.8–1.4 seconds with a soft attack and faded tail;
the rest of the scene is quiet. No ambience loops, bird chirps, or wind beds are
used. Cue timing and relative gains live in
`../fixtures/v01_stanford_boston_timeline.json`.

| scene | asset | sound |
|---|---|---|
| Founding decision | `fx_paper_stamp` | paper handling and desk stamp |
| Charles River campus | `fx_campus_bell` | one warm collegiate bell |
| California garage | `fx_garage_latch` | key and muffled latch |
| Boston workshop | `fx_workshop_dial` | instrument dial clicks and low oscillator |
| Research park | `fx_construction_taps` | three muted construction taps |
| Sand Hill Road | `fx_suitcase_roll` | suitcase wheels over pavement joints |
| Computer lab | `fx_keyboard` | mechanical keys and low confirmation tone |
| Silicon Harbor | `fx_harbor_buoy` | low harbor bell |
| Startup ferry | `fx_ferry_depart` | brief engine pulse and water laps |
| World connections | `fx_port_crate` | cargo crate and latches |
| Housing squeeze | `fx_housing_keys` | keys and door latch |
| Future Boston | `fx_future_resolve` | restrained three-note resolution |

**Rights.** Every asset is generated from code in `synth.py`, `timeline_sfx.py`,
`degree_sfx.py`, or `boston_score.py` with a fixed
seed: no recordings, samples, or third-party material. `library.json` records
for each asset its generator and seed (source), licence (team-owned, commercial
use OK), `attributionRequired: false`, and its SHA-256. The mixer refuses a
file whose hash no longer matches. To add or change a sound, edit its generator,
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
   reach the cue track's target (default **-16 LUFS**; active timeline **-22 LUFS**).
3. Catch only the transients with a brickwall limiter running at 4x sample rate
   (approximate true peak), ceiling **-3.5 dBTP** (2.5 dB below the -1 dBTP
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
