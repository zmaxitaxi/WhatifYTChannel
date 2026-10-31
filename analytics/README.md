# Analytics import and production-quality readouts

Workstream C, deliverable 8 in `TECHNICAL_PLAN.md`. Pulls channel metrics in from YouTube,
joins them with the human quality rubric, and writes a readout that says which Shorts are
working, where viewers drop off, and which videos or jobs miss the release bar.

Standard-library Python 3.12+ only (no installs). State lives in a local SQLite file
(`analytics_data/analytics.sqlite3` by default, git-ignored, WAL mode).

## What goes in

| Source | Command | Notes |
|---|---|---|
| YouTube Studio export | `import-csv` | Studio → Analytics → Advanced mode → Export → CSV, then use `Table data.csv`. The "Total" row is skipped. Unknown columns are ignored; missing ones stay empty, never 0. |
| Studio retention export | `import-retention-csv` | One video's curve: `Video position (%)`, `Absolute audience retention (%)`. |
| YouTube Analytics API | `import-api` | Owner-authorized. Needs `YT_ANALYTICS_ACCESS_TOKEN` (OAuth token, `yt-analytics.readonly` scope). Pulls views, watch time, average view duration/percentage, likes, comments, shares, subscribers; `--retention` adds each video's curve. |
| Human rubric | `rate` | The seven 1–5 dimensions from §6: premise, recognition, action, captions, camera, style, sound. Rate a `--job` before upload or a `--video` after. |
| Linking | `link` | Ties a YouTube video id to its concept (V01–V12) and controller job id, so pre-upload ratings follow the video. |

Every import is an append-only snapshot with an `observed_at` time, so repeated imports give
view growth instead of overwriting history. When the same metric exists in both sources the
latest API value wins and Studio-only values (impressions, CTR, stayed-to-watch) fill the gaps;
the JSON readout records which source each number came from.

## What comes out

`report` writes Markdown (default) or `--format json`:

- Channel summary: views, mean average view %, mean hook retention, average view % for rubric passes vs fails, weakest rubric dimension.
- Per video: metrics, views gained since the previous snapshot, rubric result, and flags.
- Retention: share still watching at 3 s, at the midpoint and at the end, and the biggest single drop mapped to seconds and to a 30 fps frame number so it can be matched to a story beat or caption cue.
- Rated jobs that have not been uploaded yet, with pass/fail.

Release bar (from §6): rubric average ≥ 4 and no single score below 3. The other flags
(hook < 70 % at 3 s, a ≥ 10-point drop between curve points, average view % < 70, duration
outside 45–75 s) are starting heuristics; change them in `report.Thresholds`.

See `examples/sample_readout.md` for output built from the fixtures.

## Usage

```bash
cd analytics
python -m aether_analytics import-csv "Table data.csv" --period-start 2026-11-03 --period-end 2026-11-10
python -m aether_analytics import-retention-csv retention.csv --video <youtubeId>
python -m aether_analytics link --video <youtubeId> --concept V01 --job <jobId>
python -m aether_analytics rate --job <jobId> --reviewer francis \
  --premise 5 --recognition 4 --action 4 --captions 5 --camera 4 --style 4 --sound 4
python -m aether_analytics report --out reports/readout.md
python -m aether_analytics report --format json --out reports/readout.json
```

On Windows use `py -m aether_analytics ...`. Pass `--db path` before the command to use another database.

API pull (token obtained outside this tool, e.g. with Google's OAuth Playground or `google-auth`):

```bash
export YT_ANALYTICS_ACCESS_TOKEN=...
python -m aether_analytics import-api --start 2026-11-01 --end 2026-11-10 --retention
```

## Tests

```bash
cd analytics
python -m unittest discover -s tests -v
```

The API importer is tested with a fake transport; no network or credentials needed.

## Integration notes

- When Max's controller lands, `job_id` should be the controller's job id and the readout's JSON can be served by the review pages (deliverable 6).
- Ratings recorded here are the same rubric used for human-rating calibration; if the controller grows its own ratings table, this module should read from it rather than keep a second copy.
