# Load, Readiness & Recovery

The Performance Management Chart alone is amateur-tier. Use the full picture, and turn recovery data into explicit go/modify/stop decisions.

## Load model (quantitative)

- **CTL / ATL / TSB** (fitness / fatigue / form) trend — `tp_get_fitness`
- **Ramp rate** — CTL build typically capped ~+3 to +7/week; flag overshoots. Sustained +8/wk or more is an injury/illness setup for most athletes.
- **ACWR** (acute:chronic workload ratio) — ~0.8–1.3 comfortable, >1.5 = spike flag. **Caveat:** ACWR's evidence base is contested (methodological critiques of the ratio); treat it as one heuristic among several, never a standalone verdict.
- **Monotony & strain** (Foster) — catch grinding, undifferentiated weeks. Monotony >2.0 with high load = elevated illness/overreach risk.
- **Per-discipline load** — never trust global TSS alone (swim and strength TSS are unreliable); track run load separately in both volume and intensity terms because musculoskeletal run tolerance, not aerobic fitness, is usually the run limiter.
- **Decoupling** (Pw:HR, Pa:HR) — aerobic fitness/fatigue signal on steady sessions; <5% on a long Z2 session indicates good aerobic durability.
- **Durability** — power/pace at threshold *after* accumulated work (e.g. 20-min effort after 2–3 h Z2) and the fade in efficiency late in long sessions. This is the strongest predictor of long-course performance and is trained and tested deliberately (see training-methods).

## Readiness decision rules (daily)

Use morning HRV (rMSSD, ln-transformed if the app provides it) as a **7-day rolling average vs. the athlete's own ~60-day baseline and normal range** (baseline ± ~0.5 × SD, the smallest worthwhile change). Single-day values are noise; trends are signal. HRV-guided training has RCT support for equal-or-better gains vs. rigid plans — but only when applied as trend logic:

- **GREEN — 7-day HRV within or above normal range, RHR normal, sleep adequate, no unusual soreness:** proceed as planned. This is also the *only* state in which to schedule breakthrough sessions.
- **AMBER — 7-day HRV below normal range, OR RHR elevated ~+5 bpm, OR poor sleep (<6 h) before a key session, OR persistent unusual soreness:** keep the session's duration but convert intensity to Z1–Z2, or swap with an easy day later in the week. Re-check tomorrow. Two consecutive amber days = treat as red.
- **RED — 7-day HRV suppressed ≥3 consecutive days, RHR +5–7 bpm with symptoms, or any illness signs:** rest or very easy 30–45 min Z1 only. Investigate cause: illness onset, under-fueling (check appetite, intake vs. targets), life stress, accumulated load. Cut the coming week's planned load 20–30% and rebuild from response.

Rules of engagement: never cancel a key session off one bad HRV reading with good context; never push a key session through a red state. Sharply *elevated* HRV alongside high RHR and feeling terrible can also signal parasympathetic overreaching — treat as amber/red, not green. If the athlete doesn't track HRV, run the same logic on RHR + sleep + subjective (fatigue, motivation, appetite, soreness) — triangulation is mandatory, single signals are not decisions.

## Sleep (the highest-leverage recovery tool)

- Target 8 h+ in bed, consistent schedule. Sleep extension (adding 30–60+ min for 1–2+ weeks) has evidence for measurable performance gains — prescribe it in heavy blocks and race week ("sleep banking").
- Chronic <7 h = degraded adaptation, elevated injury/illness risk; treat persistent short sleep as a load problem and reduce training until fixed. Flag it in every check-in where it appears.
- Screen in check-ins: duration, quality, timing consistency. Naps (20–90 min, before ~3 pm) are a legitimate tool in high-volume weeks.

## Illness rules (non-negotiable)

- **Neck check:** symptoms above the neck only (mild sore throat, runny nose), no fever, feeling ~okay → easy Z1 only, short, no intensity; reassess daily.
- **Below the neck, fever, chest involvement, body aches, or GI illness → full rest.** No exceptions. Resume only after 24 h symptom-free without medication.
- **Return:** as many easy days as days of fever; no intensity for ~1 week after any febrile illness. Watch RHR/HRV normalize before reintroducing quality. Training through fever risks myocarditis — this is a hard stop, say so plainly.

## Injury management

If pain/injury reported: prioritize recovery over progression; reduce/eliminate the offending load; substitute low-impact alternatives (aqua-jog, bike, swim) to preserve aerobic fitness; track in `injuries.md` with a pain score (0–10) per session — pain ≤3/10 that settles within 24 h is generally acceptable in tendon rehab, escalating or morning-after pain is not. Reassess before returning to intensity; rebuild run volume before run intensity. Red-flag or non-resolving (>2–3 weeks) issues → physio/sports physician referral.

## Data hygiene (apply before trusting any file)

- **Power:** discard spikes (>2× sprint-plausible watts), check for dropouts and left/right or dual-recording mismatches. Note indoor vs. outdoor power discrepancies per athlete — many hold different FTPs; keep separate references if the gap is >3–5%.
- **HR:** first-minutes strap dropouts and cadence-lock artifacts are common; ignore decoupling math on stop-start rides, intervals, or heat-affected sessions — it's only meaningful on steady continuous aerobic work.
- **Run pace:** GPS in cities/trails lies; prefer NGP/GAP for load, lap-corrected data for track work. Treadmill calibration is unreliable — use RPE/HR indoors.
- **Swim:** verify pool length settings (`tp_get_pool_length_settings`) before trusting swim paces.
- **Weight/HRV:** compare like-for-like (same time of day, same conditions). Weight trend = 7-day average, never single readings.
- If a file is suspect, say so and exclude it from analysis rather than analyzing garbage.

## Overtraining escalation

Distinguish: **functional overreaching** (planned, recovers within a recovery week — fine) vs. **non-functional overreaching** (performance suppressed >2 weeks despite rest) vs. **overtraining syndrome** (months). If performance, HRV, mood, and motivation stay suppressed through a genuine recovery week: halt progression, cut load 50%+, screen hard for under-fueling (most "overtraining" in age-groupers is under-fueling — check REDs criteria in the nutrition module), and refer to a sports physician if it persists.
