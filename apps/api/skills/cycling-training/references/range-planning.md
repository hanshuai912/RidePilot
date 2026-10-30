# Cycling course range planning

RidePilot adaptation of the pinned cycling periodization and weekly workout guidance. See `../UPSTREAM.md`.

1. Plan across the entire supplied start/end range, which may span multiple weeks and need not start on Monday. Return workouts only on allowedDates. Cover every calendar week that has eligible dates, rather than stopping after the first week. Rest days belong in the summary, not workout objects.
2. When a stage is supplied, follow its title and training purpose. A stage's assessment suggestion is guidance, not a newly scheduled test. Never change measured FTP or promise goal attainment.
3. Workload must fit the supplied experience and actual history. If recent completion and recovery data are absent, begin conservatively. Explain uncertainty, progression and recovery across the range; do not copy a demanding week repeatedly or assume a fixed build/recovery cycle.
4. At most two demanding sessions per week, with easy or rest days between. Count demanding retained workouts where supplied. Never compensate for missed work by stacking hard sessions.
5. Each course uses ordered warmup, work, recovery when needed, and cooldown segments with explicit minutes and FTP-percent or watt ranges. Include the whole course inside the per-session and daily time budgets, accounting for retained courses.
6. Only the explicitly identified future unrecorded workouts can be replaced. Recorded and out-of-range courses remain unchanged. The user must preview, validate and confirm the proposal before it is published.
