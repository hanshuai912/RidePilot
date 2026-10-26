# Race Planning, Taper & Execution

Every A and B race gets a **written race plan** in `~/.training/race_plans/YYYY-MM-DD_racename.md`. Draft it ~3 weeks out for an A-race (2 weeks for B), review it with the athlete, and finalize in race week. Register races in TP (`tp_create_event`); put the taper and race-week sessions on the calendar, and run the nutrition calendar sync over the taper (needs change — see nutrition module).

## Taper science (Tier A — one of the best-evidenced interventions in sport)

Meta-analytic consensus (Bosquet et al.): expect ~1–3% performance gain from a proper taper. The proven shape:

- **Reduce volume 40–60%** (from the last normal training week), following an **exponential/progressive decay** — not a step cut.
- **Maintain intensity** — this is the classic error. Quality sessions stay in the taper at race-relevant intensity; they just get shorter with fewer reps.
- **Maintain frequency** (drop at most ~20% of sessions) — keeps skill, routine, and feel.
- **Duration ~2 weeks** as the default (range 1–3): longer for Ironman/marathon, high-CTL athletes, and masters; shorter (7–10 days) for short-course, low-volume, or athletes who historically go stale. **Individualize from history:** check `progress_reviews/` and `metrics/` for how past tapers went (length, TSB achieved, race outcome, subjective freshness) and adjust. Log every taper's outcome to sharpen the next one.
- **TSB targets on race day:** A-race ~+15 to +25 (upper end for long-course, lower for short-course where a bit more sharpness helps); B-race ~+5 to +10; C-race ~0 (train through).
- Expect the "taper crazies": athletes feel flat/anxious mid-taper. Warn them in advance; feeling sluggish in week 1 of a taper is normal and not a reason to add training.
- Strength: last heavy session 7–10 days out; movement/activation only after that.

## Race plan document (template)

```
# Race Plan — <race>, <date>
## Goal & context
A/B/C · outcome goal · process goals (2–3, controllable) · fitness snapshot (CTL/TSB, key test results, durability)
## Course & conditions
profile, surface, expected temp/humidity/wind, key segments; heat plan if >20 °C (acclimation status, pre-cooling, sodium)
## Taper timeline
week-by-week volume/sessions; TSB trajectory to target
## Pacing plan
per discipline — targets + caps (below)
## Fueling & hydration plan
pre-race meal (what/when) · during: g CHO/hr, which products, per-segment schedule · fluids/sodium per hour by expected conditions · caffeine dose/timing
## Gear & logistics
equipment choices, kit, spares; travel, check-in, warm-up plan (incl. openers timing)
## Contingencies
if power/pace feels wrong early · GI distress protocol · mechanical/flat · weather shift · goal falls apart mid-race (fallback goal)
## Mental plan
process cues per segment; the "it's getting hard" script; why this race matters
## Post-race (fill in after)
result vs plan · what worked/didn't · lessons → next race
```

## Pacing (Tier A principles)

- **Even or slightly negative pacing wins endurance races.** Nearly all blowups are front-loading. Set explicit **early caps**, not just targets.
- **Bike (power):** 70.3 ≈ IF 0.83–0.87; Ironman ≈ IF 0.70–0.78 (fitter/faster athletes ride the upper end; durability data decides). Variability Index <1.05 on flat courses; cap surges on climbs (~FTP for short climbs in a 70.3, lower for IM). Bank *time* on descents/tailwinds by staying aero, not by pushing watts uphill.
- **Run (open racing):** target from critical speed/threshold and recent race equivalents; first 10–15 min deliberately conservative (RPE will lie early). Use GAP on hilly courses. **Triathlon run:** first 1–2 km off the bike materially slower than goal pace — every plan states this number.
- **Short course:** CP/W′ logic — know how deep the athlete can go and where to spend W′ (starts, surges, finish).
- **Heat:** adjust *pace expectations*, not effort caps — hold target HR/RPE and accept slower output; expect meaningful slowdown above ~15–18 °C, escalating with humidity. Pre-cooling (cold fluids/ice slurry pre-race, ice in kit during) has Tier A support in hot conditions.
- **Swim (tri):** controlled first 200 m, then settle; draft legally (feet/hip) — free speed; sight efficiently. Seed honestly.

## Race week protocol

- **Sleep banking:** extend sleep all week; the night two nights before matters more than the night before.
- **Carb load (events >~90 min):** 8–12 g/kg/day for the final 36–48 h — an evidence-based intervention, not "a big pasta dinner." Reduce fiber the last ~24 h. Expect +1–2 kg water weight; tell the athlete it's glycogen, not fat.
- **Sodium preload** if hot (nutrition module). Practice nothing new — no new food, kit, or pacing ideas in race week.
- **Openers:** day before — short session with a few race-pace accelerations (e.g. 20–30 min + 3–4 × 60–90 s at race effort). Keeps the system primed without cost.
- Final check: race plan reviewed together, fueling purchased/tested, gear checked, warm-up written down with times.

## Post-race

- **Debrief within a few days:** result vs. plan, pacing/fueling execution vs. the written numbers, what the race proved about fitness and limiters. Fill in the plan's post-race section; copy lessons to `progress_reviews/` and the decision log.
- **Recovery ("reverse taper"):** easy days scale with race duration — roughly one easy/off day per hour of hard racing for long-course (an IM warrants ~2 weeks minimal structure); no intensity until sleep, HRV, appetite, and motivation are all normal.
- **After the season's final A-race:** 1–2+ weeks genuine transition (unstructured, other sports, life) before rebuilding. Fitness lost is small; the motivation and tissue reset is the point.
