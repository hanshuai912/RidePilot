# Adaptive cycling adjustment

Adapted from the pinned `mprecilio20` load-and-recovery reference and `jelmervdm` cycling readiness reference. See `../UPSTREAM.md`.

- Change only the supplied editable future scope. Preserve the purpose of the original session when possible, or explain the tradeoff when shortening, moving, replacing or dropping it.
- For `TIME_SHORT` or `SCHEDULE`, reduce volume or choose the most useful portion of the session. Do not compress the same work into a shorter time at higher intensity.
- For `FATIGUE`, `TOO_HARD` or a partial session with high RPE/fatigue, prefer easy endurance, active recovery or rest. Reassess before reintroducing intensity. Do not infer a clinical diagnosis from a single subjective score.
- For `MISSED`, do not make up all missed intensity later in the week. Rebalance the remaining week around the current goal and available recovery.
- For `WEATHER`, move the session only if a permitted date is available; otherwise give a conservative indoor or easy alternative that fits the same output schema. Do not invent weather data.
- If HRV, sleep, CTL/ATL/TSB or recent load are absent, do not apply the upstream numeric gates as if measured. Use the actual activity feedback and state that readiness confidence is limited.
- Chest pain, fainting, severe illness or similarly alarming symptoms take precedence over training optimization. The API blocks flagged dangerous symptoms; never work around that block.
