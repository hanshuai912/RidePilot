# Sports Nutrition Skill upstream

- Repository: https://github.com/jelmervdm/skills
- Path: `coach/sports-nutrition/`
- Pinned commit: `c8bfca7943c14a06f7f3c9a0a1df9664ac3419df`
- License: MIT (upstream metadata)
- Imported references: macronutrient periodization, intra-workout fueling and hydration, ergogenic aids and supplements, energy availability and RED-S, race day and event fueling.

## RidePilot adaptation

`SKILL.md` is an adaptation of the upstream skill. RidePilot does not allow the model to invent missing age, body composition, exercise energy expenditure, sweat rate, sodium loss, medical status or food composition. The model only returns a structured draft. Deterministic safety, allergen, unit, version and ownership checks run in the API before a proposal can be applied.

The V1 scope excludes clinical diet therapy, supplement prescriptions, RED-S diagnosis and aggressive weight-loss prescriptions. Those situations produce a conservative blocker or professional-review warning.
