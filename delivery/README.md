# AETHER delivery: final checks and publishing hand-off

Workstream C, deliverable 5 (Francis): final-media inspection, titles,
descriptions, sources, and the hand-off for manual publishing. Publishing stays
manual; nothing here talks to YouTube.

## What it does

1. **Inspects the finished MP4** with FFprobe and FFmpeg against the one delivery
   format in `TECHNICAL_PLAN.md`: H.264, 1080 × 1920, 9:16, constant 30 fps,
   `yuv420p`, BT.709 tags, exact frame count, 45–75 s, AAC stereo 48 kHz,
   fast-start, true peak at or below −1 dBTP, and about −16 LUFS (a warning,
   because loudness needs a human ear too).
2. **Validates the publish metadata** a writer fills in per video
   (`examples/v01_publish.json`): title and description limits, no `<`/`>`,
   tag length, hashtag rules, at least one source, every source re-checked
   (`"verified": true`), and the hypothetical note.
3. **Writes a hand-off folder** with the MP4, `title.txt`, `description.txt`,
   `tags.txt`, `inspection.json`, a `manifest.json` with the video hash, and
   `HANDOFF.md`: the status, anything to fix, paste-ready text, and the
   reviewer and YouTube Studio checklist.
4. **Records the live URL** after someone publishes, so the analytics import
   (deliverable 8) can match videos to jobs.

Any error marks the hand-off **BLOCKED** and the command exits 1. A blocked
hand-off cannot have a publish recorded against it.

## Usage

```bash
cd delivery
pip install -e '.[dev]'          # pydantic, pytest; needs ffmpeg/ffprobe on PATH

python -m aether_delivery inspect final.mp4 --frames 1800
python -m aether_delivery handoff final.mp4 examples/v01_publish.json --out handoff
python -m aether_delivery record handoff/V01_2026-10-31 --url https://youtube.com/shorts/...

python -m pytest
```

`--frames` / `expected_frames` is `output.totalFrames` from the ProductionSpec.
Without it the frame-count check is a warning rather than a pass.

## Metadata fields

| Field | Notes |
|---|---|
| `title` | Up to 100 characters; over 60 is a warning because the Shorts player cuts it off |
| `hook` | Opening lines of the description |
| `hypothetical_note` | Defaults to a standard line; must not be empty |
| `assumptions` | Calculations and imagined parts, in plain words |
| `sources` | One per on-screen fact, from the fact pack; `verified` is set by a person after re-checking |
| `sound_credits` | Exact attribution lines the sound licenses require |
| `hashtags` / `tags` | `#Shorts` expected; at most 15 hashtags; tags at most 500 characters total |
| `made_for_kids`, `altered_or_synthetic_disclosure`, `category` | Copied into the Studio checklist |

## Reference encode settings

The checker accepts any MP4 that meets the format. For the final encode
(deliverable 4) these settings produce a passing file from a lossless visual
intermediate and a mixed audio track:

```bash
ffmpeg -i visual_lossless.mkv -i mix.wav \
  -c:v libx264 -crf 18 -pix_fmt yuv420p -r 30 \
  -vf "scale=out_color_matrix=bt709" \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -ar 48000 -ac 2 -movflags +faststart final.mp4
```

Color tags alone do not prove correct conversion; check encoded color ramps by eye
as the plan says.
