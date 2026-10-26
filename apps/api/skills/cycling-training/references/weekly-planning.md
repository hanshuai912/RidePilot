# Weekly cycling planning

Adapted from the pinned `estruyf` training model and workout library, plus the `jelmervdm` cycling periodization reference. See `../UPSTREAM.md`.

1. Work only within the requested seven local dates, the supplied available weekdays and the per-day and per-session minute limits. Keep rest days in the summary; they are not workout objects.
2. Let the stated goal set the direction, then choose a workload supported by actual history. With no recent completed training or recovery data, start conservatively: easy endurance rides, at most one controlled moderate workout, and no assumption that the athlete can tolerate a larger block. Do not apply a fixed 3-build/1-recovery cycle without a history.
3. The source workout library distinguishes genuinely easy endurance work from sweet spot, threshold and VO2 work. Use Z2 endurance around 55-75% FTP for easy volume. A sweet spot interval around 88-93% FTP or threshold work around 95-105% FTP is an optional quality session when the athlete's context supports it. High-intensity examples in the source are templates, not mandatory prescriptions.
4. At most two demanding sessions in a week, with easy or rest days between them. If another supplied activity was demanding, count it toward that limit. Never stack a missed hard workout onto a later day merely to preserve weekly volume.
5. Each returned workout needs ordered warmup, work, recovery when applicable, and cooldown segments with explicit duration and FTP-percent or watt ranges. Expand work/recovery repeats as ordered segments if the API structure cannot represent a repeat group unambiguously. Fit the whole session inside the available minutes.
6. Explain the selected workload and its uncertainty. FTP changes, power-to-weight progress and a later assessment are goals or suggestions, not guaranteed outcomes of this week.
