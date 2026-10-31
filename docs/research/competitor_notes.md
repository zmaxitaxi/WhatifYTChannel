# Competitor notes

Observed 2026-10-31. Sources: each video's public page and oEmbed metadata, and each channel's About text. YouTube served bot-protection pages to the fetcher, so **view counts, like counts, durations and subscriber counts were not available**, and the videos themselves were not watched frame by frame. Numbers will come from `python3 -m discovery.competitors observe` once a YouTube Data API key is set. Treat format notes below as read from titles, descriptions and channel descriptions.

## Channels watched

| Channel | Example Short | Published | Topic area | Cadence (from About) |
|---|---|---|---|---|
| [OutwardAnimates](https://www.youtube.com/@OutwardAnimates) | [What if you dropped 10kg of tungsten from space?](https://www.youtube.com/shorts/uj4plcsfc6k) | 2026-10-21 | Physics | Weekly, about one minute each |
| [Neuro Byte](https://www.youtube.com/@NeuroByytte) | [What if the sun vanished for twenty four hours?](https://www.youtube.com/shorts/c_RGq-o98rk) | 2026-02-17 | Science | Daily, 2:00 AM |
| [What if Ai Videos](https://www.youtube.com/@WhatifAiVideossss) | [What if you sold Pop Rocks to Vikings? (Day 1–3)](https://www.youtube.com/shorts/tqAYGIQIRNM) | 2026-03-10 | History comedy | Not stated |
| [Mr. B.Curious](https://www.youtube.com/@MrBones_Curious) | [What If You Had AI In Ancient Greece?](https://www.youtube.com/shorts/Jy2_J-jAnR8) | 2026-03-01 | History and tech | Not stated |

Channel ids are in `discovery/data/competitors.json`.

## What each one does

**OutwardAnimates** (our visual reference in CONTEXT.md). The description opens with a two-sentence scene ("400 km up. No push, no rocket. You just let go.") and then gives concrete numbers: 73 cm rod, 9,497 km/h peak, 7.5 kg TNT equivalent. It deflates the scary version ("That's a crater, not a nuke") and ends with a question to the audience ("What should we drop next?"). The channel promises one what-if a week, about a minute long, zooming out from an everyday starting point.

**Neuro Byte.** An AI-generated skeleton character narrates science what-ifs. Titles are plain questions plus hashtags (#3d #ai #skeleton). Volume over polish: one upload a day.

**What if Ai Videos.** History hypotheticals told as a day-by-day timeline ("Day 1–3"), with a comedic hook in the description ("They think it's alive… then the whole hall wants 'mouth thunder'") and a cliffhanger question. Also uses a skeleton character and emoji in titles.

**Mr. B.Curious.** Animated history-meets-technology premises. Very short descriptions (hashtags only); the channel pitches "smart facts" and "bold comparisons".

## Patterns across the set

1. **The title is the whole premise.** Every title is a single "What if …?" question a viewer understands without context. Our V-titles already follow this; keep them under about 50 characters so they are not cut off on phones.
2. **Concrete numbers carry credibility.** OutwardAnimates leads with real figures. This matches our FactPack rule: one sourced number per consequence beat, with units on screen.
3. **A recurring character is common.** Three of four use a skeleton mascot. Our plan already allows recurring characters with a stable identity; a recurring student or professor could play the same role without copying the skeleton look.
4. **Time-stepped structure.** "Day 1–3" timelines give a built-in sense of progress. Our story template (0–3 s premise, 3–12 s setup, 12–30 s transformation…) can borrow explicit time labels ("Week 1", "Year 10") as captions, using the plan's time-compression treatment.
5. **End on a question.** Both descriptions that have text end with a question to the viewer. Our descriptions should too ("Which campus should move next?").
6. **Nobody here covers universities.** All four work in science or general history. That gap is why originality scores are high for most of our slate, and why map/elimination formats (V08, V12) score lower: those formats are common elsewhere even if the university twist is new.

## What to do differently

- Stay restrained on titles: one question, no emoji walls or hashtag-only descriptions. The plan's serif, understated style is a differentiator against the AI-skeleton channels.
- Separate facts from fiction on screen. None of the references visibly label hypotheticals; our hypothetical and source treatments are a trust advantage, especially for V06, V07 and V09.
- Publish rival swaps apart. Rivalry topics (V02, C05) attract two fan bases, which is good for comments, but repeating the swap format back-to-back will feel samey.

## Next observations

- Run `discovery.competitors observe` daily for a week to get views-per-day for each channel's recent Shorts, then replace the `trend_strength` estimates in `discovery/data/topics.json`.
- Add two or three college-content channels (campus tours, admissions, ranking commentary) to `competitors.json`. That is the audience we are actually competing for, and none of the current four covers it.
