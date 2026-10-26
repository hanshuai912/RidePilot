# Athlete Readiness & Recovery Management

Operational guidelines for interpreting subjective fatigue, objective physiological markers (TSB, HRV, RHR), and making real-time workout modifications.

---

## 1. Primary Readiness Indicators

Prior to prescribing or confirming a scheduled high-intensity session, evaluate the following metrics:

```
                          ┌───────────────────────────┐
                          │   Daily Readiness Inputs  │
                          └─────────────┬─────────────┘
                                        │
      ┌──────────────────┬──────────────┴──────────────┬──────────────────┐
      ▼                  ▼                             ▼                  ▼
┌──────────┐      ┌─────────────┐             ┌─────────────────┐  ┌──────────────┐
│ Form/TSB │      │ HRV (rMSSD) │             │ Resting HR (RHR)│  │ Sleep Score  │
│ (Target) │      │ (% Baseline)│             │ (bpm Delta)     │  │ & Soreness   │
└──────────┘      └─────────────┘             └─────────────────┘  └──────────────┘
```

| Indicator | Baseline / Normal Range | Moderate Fatigue Warning | High Risk / Rest Indication |
|-----------|─────────────────────────|--------------------------|-----------------------------|
| **TSB (Form)** | $-10\text{ to }-25$ | $-25\text{ to }-30$ | $< -30$ |
| **HRV (rMSSD)** | Within 7-day rolling baseline | $0.5 - 1.5$ StdDev below baseline | $> 1.5$ StdDev drop or persistent baseline suppression |
| **Resting HR** | Normal baseline | $+3 - 5\text{ bpm}$ elevation | $> +7\text{ bpm}$ elevation |
| **Sleep Quality** | $\ge 7.5\text{ hours}$, high deep/REM | $6 - 7\text{ hours}$ fragmented | $< 6\text{ hours}$ or severe disruption |
| **Muscle Soreness** | Mild ($1-3 / 10$) | Moderate ($4-6 / 10$) | Severe / Sharp Pain ($7-10 / 10$) |

---

## 2. Daily Workout Modification Decision Matrix

Use this rule engine when an athlete checks in before a scheduled workout or when wellness metrics are retrieved via Intervals.icu:

```
                            ┌────────────────────────┐
                            │ Evaluate Overall Status│
                            └───────────┬────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
  Green Signal                    Yellow Signal                    Red Signal
 (All Metrics Normal)           (1-2 Warning Markers)            (TSB < -30 OR High HR/HRV drop)
        │                               │                               │
        ▼                               ▼                               ▼
Execute As Prescribed            Downgrade Intensity              Rest / Active Recovery
 • Proceed with key               • Swap Z4/Z5 to Z2              • Convert to 45m Z1 spin
   intervals                       Endurance                      • Or 100% Passive Rest
 • Maintain planned volume        • Reduce duration -20%          • Focus on sleep/nutrition
```

### Action Protocols

#### Protocol GREEN (High Readiness)

- **Status**: TSB between $-10$ and $-25$, HRV normal, RHR normal.
- **Action**: Execute prescribed workout as scheduled. If feeling exceptional during warmup, target upper range of power targets.

#### Protocol YELLOW (Moderate Strain)

- **Status**: TSB between $-25$ and $-30$, OR Resting HR $+4\text{ bpm}$, OR HRV slightly suppressed.
- **Action**: Modify scheduled workout:
  - If a VO2max session is scheduled: Convert to Sweetspot or Steady Zone 2.
  - If a Threshold session is scheduled: Reduce interval volume by 1 rep or lower target by $3\%$.
  - If an Endurance ride is scheduled: Keep intensity locked strictly in Zone 1 / Low Zone 2 ($55-65\% \text{ FTP}$).

#### Protocol RED (High Overreaching Risk / Illness Warning)

- **Status**: TSB $< -30$, OR Resting HR $> +7\text{ bpm}$, OR HRV suppressed $> 1.5\text{ StdDev}$, OR athlete reports acute joint/muscle pain or flu-like symptoms.
- **Action**: Cancel high-intensity and endurance work:
  - Prescribe 45-minute Zone 1 spins ($< 50\% \text{ FTP}$, cadence $> 90\text{ rpm}$) OR complete passive rest day.
  - Require 24-48 hours of recovery monitoring before resuming threshold/VO2max work.

---

## 3. Overtraining Syndromes: Sympathetic vs. Parasympathetic

### Sympathetic Overreaching (Early Stage)

- **Characteristics**: Elevated resting HR, insomnia, irritability, inability to lower HR quickly after exertion, high anxiety.
- **Remedy**: 3–5 days of low-intensity volume drop ($50\%$ volume reduction, no Z3+ intensity).

### Parasympathetic Overreaching (Late / Severe Stage)

- **Characteristics**: Very low resting HR, inability to elevate heart rate during intervals, extreme lethargy, suppressed RPE response (feels impossible to generate power).
- **Remedy**: 7–14 days of complete rest or light recreational activity. Full re-evaluation of macrocycle plan.

---

## 4. Recovery Acceleration Principles

1. **Post-Workout Refueling**: Consuming $1.0 - 1.2\text{ g/kg}$ carbohydrate and $0.3 - 0.4\text{ g/kg}$ high-quality protein within 60 minutes of finishing rides $> 90\text{ minutes}$.
2. **Rehydration**: Consuming $1.5\text{ L}$ fluid per $1\text{ kg}$ body weight lost during hot rides, with electrolytes ($500 - 1000\text{ mg/L}$ sodium).
3. **Sleep Priming**: Consistent sleep schedule, cool room temperature ($18-20^\circ\text{C}$ / $65-68^\circ\text{F}$), avoiding high carbohydrate/heavy meals within 2 hours of bedtime.
