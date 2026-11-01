# Video scripts (narration + on-screen text)

One script per video, V01 to V12. Each script lines up narration with the
12-cue, 60-second caption grid used by every storyboard
(hook 0–3 s, establish 3–12 s, transform 12–30 s, consequences 30–48 s,
reveal 48–57 s, resolve 57–60 s; see TECHNICAL_PLAN.md).

| File | What it is |
|---|---|
| `vNN_*.json` | Source of truth: per cue, the window, on-screen text, narration, delivery note and fact ids |
| `vNN_*.md` | Readable table plus a plain voice-over read with start times. Generated; edit the JSON |
| `vo_tool.py` | `check` and `render` |

## Rules the scripts follow

- **Tone:** realistic and funny. Only the premise is impossible; jokes come from real details
  (the 101, the 405, Mass Ave, the Red Line, mild-concerns protest signs), not cartoon props.
- **On-screen text** is the caption track, unchanged (`content/<slug>/captions.json`).
  V01's track is on main; V02–V12 tracks are in PR #11.
- **Narration complements the captions** instead of reading them out, so the video still
  works muted and the voice adds the jokes.
- **Numbers** spoken or shown must come from the video's fact pack (exact or rounded).
  Road names and round labels are listed in `allowedNumbers`. Where a pack value is still empty
  (IPEDS counts, rankings, MIT's area) the script says no number and the notes say where to add one.
- **Timing:** each line must fit its cue at 2.6 spoken words per second (about 156 wpm), plus
  0.2 s per sentence break and 0.3 s of air before the next cue. Numbers count as the words it
  takes to say them ("2,690" is five words). Scripts run about 40–48 s of speech in 60 s.
- **Narrator:** deadpan documentary for every video (Francis's pick, 2026-11-01): calm and dry,
  treats the impossible premise like a serious report, and lets understatement carry the jokes.

## Commands

```bash
# check every script (add --captions-root when the V02–V12 tracks are not on this branch)
python3 scripts/video_scripts/vo_tool.py check
python3 scripts/video_scripts/vo_tool.py check --captions-root /path/to/storyboards
# regenerate the Markdown after editing a JSON file
python3 scripts/video_scripts/vo_tool.py render
```

The estimate is a planning aid. Time the real voice track before locking a cut.
