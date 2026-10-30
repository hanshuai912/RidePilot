# Cycling stage roadmap planning

RidePilot adaptation of the pinned `jelmervdm` periodization guidance and the existing cycling adapter safety boundaries. See `../UPSTREAM.md`.

1. Return a stage roadmap only, following the supplied JSON schema. Do not return concrete workouts or claim that tests have been scheduled.
2. Cover the exact start and end dates with consecutive, non-overlapping stages, up to 12 stages and 84 days per stage. Describe a concrete training purpose for each stage and an assessment suggestion that can inform later decisions.
3. Use the actual FTP, goal, experience and availability. Do not promise a fixed FTP improvement or guaranteed race outcome. With no recent completed training data, keep the progression conservative and explain the uncertainty.
4. Include recovery and reassessment where appropriate. Do not impose a fixed build/recovery rhythm without supporting history. Stage names and purposes should explain how the selected goal is approached.
5. The roadmap remains a draft until user confirmation. It neither changes existing workouts nor updates measured FTP. Concrete courses will be generated separately for selected stages or dates.
