# Training Methods — Evidence-Tiered

## Evidence tiers (apply to everything you prescribe)

- **Tier A — proven:** consistent RCT/meta-analytic support in trained athletes. Prescribe by default.
- **Tier B — promising:** plausible mechanism + emerging or context-dependent evidence. Use deliberately, label it as Tier B to the athlete, and evaluate against their own response data.
- **Tier C — unsupported/disproven:** don't prescribe; if the athlete asks, say why honestly.

When the athlete's own logged response contradicts population evidence, their data wins — that's what the decision log is for.

## Periodization

Build the season **backward from the A-race** (`tp_get_atp` for annual structure and weekly TSS targets). Frame: Base → Build → Peak → Taper → Transition.

- **Traditional linear and block periodization both work** (Tier A that *structured* periodization beats unstructured training; no model is proven universally superior). Default to traditional progressive mesocycles; consider **block periodization** (concentrated 5–7-day HIT blocks followed by recovery, per Rønnestad's work) for time-crunched or well-trained athletes who've plateaued on mixed weeks — Tier B, monitor response closely.
- Mesocycle lengths: 4–6 wk (beginner/return), 6–8 wk (general), 8–12 wk (race-specific tri), 12–16 wk rolling (marathon/Ironman). Recovery week every 3–5 weeks — sooner for masters athletes (see below).
- Multi-year view: the athlete's development arc spans seasons. Note in the season review what capacity (aerobic base, durability, top-end, run tolerance) the *next* season should inherit and build on.

## Intensity distribution — individualized, not dogmatic

- ~80% of sessions easy / ~20% hard is a robust Tier A default for trained endurance athletes — but count honestly: Z2 that drifts to Z3 is not easy.
- **Pyramidal vs. polarized:** pyramidal (more threshold, less VO2) suits base phases and most long-course athletes; shifting **pyramidal → polarized as the race approaches** has direct RCT support in runners and matches elite practice. Short-course/Olympic needs more threshold/VO2 emphasis approaching the race. Decide by phase + the athlete's limiter, and say which model you're using and why.
- The most common age-grouper failure is the moderate-intensity rut: easy days too hard, hard days too easy. Police it with actual zone-time data, not intentions.

## Key session types (the proven toolkit)

- **Long aerobic sessions with durability work (Tier A for long-course):** steady Z2 with quality *late* — e.g. 3 h with the final 30–40 min at tempo/race effort, or threshold repeats after 2+ h of load. Durability (resisting fade after accumulated work) is a distinct, trainable quality and a top predictor of long-course results. Progress the "work before the work."
- **VO2max intervals (Tier A):** 4–8 × 3–6 min at ~106–120% FTP / 3–5 K effort, 1:0.75–1:1 recovery; or 30/15s (Rønnestad: 3 × 13 × 30 s hard / 15 s easy) which produce equal-or-better adaptations with high time-at-VO2 — good Tier A option, especially indoors.
- **Threshold / sweet spot (Tier A):** 2–4 × 10–20 min at 88–100% FTP or threshold pace. The bread of pyramidal phases; high adaptation-per-fatigue cost.
- **Neuromuscular/sprint & strides (Tier A for economy):** short sprints, hill strides 6–10 × 15–30 s. Cheap, maintains top-end, improves economy.
- **Brick sessions (triathlon):** bike-to-run pacing and gut practice; make key bricks race-specific in the build (race-effort bike final portion → race-pace run off).
- **"Norwegian" double-threshold days (Tier B):** two sub-threshold interval sessions in one day, lactate-controlled. Only for high-volume, well-monitored athletes with a big base; without lactate measurement, approximate with strict pace/power caps — and be honest that it's Tier B outside elite contexts.
- **Chronic train-low / fasted everything (Tier C as a blanket policy):** selective low-carb easy aerobic sessions are defensible (Tier B, see nutrition module); doing key sessions under-fueled blunts the sessions and raises REDs risk. Never on quality days.

## Strength training — foundational, not optional (Tier A)

Meta-analytic support for improved economy, threshold performance, and injury resistance in runners, cyclists, and triathletes:

- **Base:** 2×/week heavy, low-rep — 3–5 sets × 3–6 reps at high load (squat/split-squat, deadlift/RDL, calf raises, hip hinge, core), full recovery between sets, no training to failure. Expect 4–8+ weeks before economy gains show; early weeks may add fatigue — schedule accordingly.
- **Build/Peak:** maintain 1×/week (maintenance preserves gains at low cost). **Do not drop strength entirely in the race block** — detraining starts within ~2–3 weeks; last heavy session ~7–10 days out.
- **Runners:** add **plyometrics** (Tier A for running economy) — hops, bounds, drop jumps, 2×/week low dose, progressed gradually and only on healthy tendons.
- **Interference management:** separate strength from key endurance sessions by 6+ h where possible; same-day order = endurance quality first, strength after; put heavy lifting on easy/moderate days, never the day before a breakthrough session.

## Environmental physiology

- **Heat acclimation (Tier A for hot races; Tier B as a general ergogenic):** 10–14 days of 60–90 min elevated core temperature (training in heat, overdressing, post-session hot bath 20–30 min at ~40 °C, or sauna). Benefits: plasma volume expansion, lower HR/core temp at a given output, large performance protection in hot races; emerging evidence for hemoglobin-mass gains from ~5-week protocols (Tier B). Decays within ~2–4 weeks — time it to end near race day; re-top-up with brief exposures in race week. Mandatory planning item for any race likely >20 °C.
- **Altitude (Tier B, logistics-heavy):** live-high train-low, ≥12 h/day at ~2,000–2,500 m for 3–4 weeks, can raise hemoglobin mass ~2–4%. Requires adequate ferritin *before* the camp (check bloodwork), and responses vary. Only worth raising if the athlete has realistic access.
- **Racing in heat:** covered in race-execution (pace adjustments, pre-cooling, sodium).

## Testing battery

Retest every 4–8 weeks, or when peaks/decoupling suggest drift. Schedule tests at the start of blocks, fresh.

- **Bike:** ramp test or 20-min (×0.95) for FTP; optionally a **critical power test** (3-min + 12-min maximal efforts) for CP + W′ — better for short-course pacing and interval prescription.
- **Run:** threshold pace from a recent race (best) or 30-min field test; **critical speed** from two maximal efforts at different durations (~3–4 min and ~10–12 min) where pacing precision matters.
- **Swim:** CSS via 400 m + 200 m timed trial.
- **Durability test (each build block, long-course athletes):** compare a threshold effort fresh vs. the same effort after 2–3 h of Z2 (or after ~2,000 kJ of work on the bike). The fade percentage is the metric; shrinking it is the goal.
- **Sweat test** (nutrition module) before the first hot-weather build.
- Record every result in `metrics/` with test conditions (indoor/outdoor, temperature, fatigue state).

## Limiter analysis (the elite move)

Identify the athlete's specific limiter — weakest tri discipline, durability fade after N hours, top-end, run musculoskeletal tolerance, heat, fueling tolerance — and **allocate disproportionate volume/intensity there**, especially in base/build. Verify with the block-review test/retest; re-assign each block. The A-goal defines which limiters matter: a 70.3 athlete's VO2max is rarely the limiter; their durability and fueling usually are.

## Population specifics

- **Female athletes (Tier B, individualized):** meta-analytic evidence for phase-based performance effects is weak and heterogeneous — do **not** rigidly plan training by cycle phase. Instead: track cycle alongside training data, adapt to *this athlete's* documented symptom patterns, ensure iron status is checked (menstruating athletes are high-risk for deficiency), and treat any cycle disruption as a first-rank REDs red flag. Hormonal contraception changes the picture — track, don't assume.
- **Masters athletes (~45+):** recovery spacing matters more than volume — 48–72 h between hard sessions, recovery weeks every 3–4 (not 5), protein at the upper range (≥2.0 g/kg), strength training is *more* important (sarcopenia offset), longer warm-ups before intensity. Adaptation still happens; it just needs more recovery around it.

## Progression rules

- Increase volume OR intensity, not both aggressively. Respect ramp-rate caps (load-and-recovery module).
- Run volume progresses on musculoskeletal tolerance, not aerobic capability — the engine outgrows the chassis.
- Introduce race specificity progressively through the build; the last 6–8 weeks before an A-race should look increasingly like the race (intensity, terrain, heat, fueling, equipment).
- Every prescribed week must be executable within the athlete's stated hours and life constraints — a perfect plan they can't do is a bad plan.
