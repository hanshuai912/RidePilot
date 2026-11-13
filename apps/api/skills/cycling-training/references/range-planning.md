# Cycling course range planning

RidePilot adaptation of the pinned cycling periodization and weekly workout guidance. See `../UPSTREAM.md`.

1. Plan across the entire supplied start/end range, which may span multiple weeks and need not start on Monday. Return workouts only on allowedDates. Cover every calendar week that has eligible dates, rather than stopping after the first week. Rest days belong in the summary, not workout objects.
2. When a stage is supplied, follow its title and training purpose. A stage's assessment suggestion is guidance, not a newly scheduled test. Never change measured FTP or promise goal attainment.
3. Workload must fit the supplied experience and actual history. If recent completion and recovery data are absent, begin conservatively. Explain uncertainty, progression and recovery across the range; do not copy a demanding week repeatedly or assume a fixed build/recovery cycle.
4. At most two demanding sessions per week, with easy or rest days between. Count demanding retained workouts where supplied. Never compensate for missed work by stacking hard sessions.
5. Each course uses ordered warmup, work, recovery when needed, and cooldown segments with explicit minutes and FTP-percent or watt ranges. Include the whole course inside the per-session and daily time budgets, accounting for retained courses.
6. Only the explicitly identified future unrecorded workouts can be replaced. Recorded and out-of-range courses remain unchanged. The user must preview, validate and confirm the proposal before it is published.

7. When relatedEvent contains assessment evidence, base the stageSummary on its actual status, protocol, source, actualDate and reviewEvidence. State whether evidence is a baseline, comparable change, or insufficient; never invent a previous result or mark a target achieved from an FTP ratio. Explain whether to retain the training focus, reduce/extend the workload, or propose progressing within the selected scope, with a reason and what changed from replacedWorkouts. Only propose roadmap changes within the supplied stagePlanning action for explicit user confirmation; do not automatically advance stages or infer achievement. Incomplete, invalid and skipped tests do not establish a lower FTP. A confirmed current FTP remains the only power prescription baseline; sustained average watts and route time never become FTP.
