# Periodization, Block Planning & Structured Workout Prescriptions

Architectural framework for periodized training plan development, training intensity distribution models, weekly progression rules, and structured workout syntax.

---

## 1. Periodization Hierarchy

```
Macrocycle (Annual / Multi-Month Season Goal)
 └── Mesocycle 1 (4-Week Block: Base 1)
      ├── Microcycle 1 (Week 1: Build TSS +5%)
      ├── Microcycle 2 (Week 2: Build TSS +5%)
      ├── Microcycle 3 (Week 3: Overload TSS +5%)
      └── Microcycle 4 (Week 4: Deload / Recovery TSS -40%)
```

### Training Block Cycles

- **3:1 Cycle (Standard)**: 3 loading weeks followed by 1 deload week. Recommended for athletes under 40 with good recovery capacity.
- **2:1 Cycle (Masters / High Stress)**: 2 loading weeks followed by 1 deload week. Ideal for athletes over 40, high life-stress athletes, or intense VO2max blocks.

---

## 2. Training Phases & Adaptations

| Phase | Duration | Core Objective | Primary Target Intensity | TSS Ramp Rate |
| ------- | ---------- | ---------------- | -------------------------- | --------------- |
| **Base 1-2** | 6-12 weeks | Aerobic foundation, mitochondrial density, lipid oxidation | Zone 2 Endurance ($60-75\% \text{ FTP}$) | $+3 - 5\text{ TSS/wk}$ |
| **Base 3 / Sweet Spot** | 4-6 weeks | Aerobic power, fatigue resistance, muscular endurance | Sweet Spot ($88-93\% \text{ FTP}$) & Tempo | $+5 - 7\text{ TSS/wk}$ |
| **Build 1-2** | 6-8 weeks | FTP elevation, lactate clearance, VO2max capacity | Threshold ($95-105\%$) & VO2max ($106-120\%$) | $+5 - 8\text{ TSS/wk}$ |
| **Peak / Specialty** | 3-4 weeks | Race-specific physiological demands, W' capacity | Race Pace, Neuromuscular (Z6-Z7) | Hold TSS steady |
| **Taper** | 1-2 weeks | Dissipate fatigue while maintaining acute fitness & neuromuscular sharpness | Low Volume, High Intensity touches ($Z1-Z2$ volume $-40\%$) | $-30\% - 50\text{ TSS/wk}$ |

---

## 3. Training Intensity Distribution Models

### A. Polarized Model (80/20 Rule)

- **Distribution**: $\sim 80\%$ Volume in Zone 1-2 (low intensity), $\sim 20\%$ Volume in Zone 5-7 (high intensity). $\sim 0\%$ in Zone 3/4.
- **Best Used For**: Mid-to-high volume endurance athletes ($> 10\text{ hours/week}$), grand fondos, ultra-endurance, and VO2max expansion blocks.

### B. Pyramidal Model

- **Distribution**: Largest volume in Zone 2, decreasing volume through Zone 3/4, smallest volume in Zone 5+.
- **Best Used For**: Traditional road racing, stage races, and general fitness progression across moderate volume ($7 - 12\text{ hours/week}$).

### C. Sweet Spot Model

- **Distribution**: High concentration of time at 88–93% FTP combined with Zone 2 volume.
- **Best Used For**: Time-crunched athletes ($5 - 8\text{ hours/week}$) seeking maximal threshold adaptations per unit of training time.

---

## 4. Weekly Microcycle Templates

### Example 10-Hour Mid-Volume Build Microcycle

```
Monday:    REST DAY (Total recovery, mobility, passive rest)
Tuesday:   VO2max Intervals (1.5h: Warmup, 5x4m @ 115% FTP w/ 4m Z1 rest, Cooldown) -> ~90 TSS
Wednesday: Zone 2 Aerobic Endurance (2h @ 65-70% FTP) -> ~85 TSS
Thursday:  Threshold / Sweet Spot (1.5h: Warmup, 3x15m @ 90-95% FTP w/ 5m rest, Cooldown) -> ~95 TSS
Friday:    Z1 Active Recovery or REST (1h @ 50% FTP) -> ~25 TSS
Saturday:  Long Aerobic Group / Solo Ride (3.5h @ Z2 w/ 15m Tempo efforts) -> ~200 TSS
Sunday:    Endurance / Cadence Drill Ride (1.5h @ Z2) -> ~70 TSS
─────────────────────────────────────────────────────────────────
Total Weekly Volume: 11.0 Hours | Total Weekly TSS: ~565 TSS
```

---

## 5. Structured Workout Prescriptions (ERG / Syntax Standard)

When prescribing workouts, provide both human-readable guidelines and structured interval syntax (compatible with Intervals.icu, Zwift, and Garmin Edge):

### Example: VO2max 5x4 Min Classic Interval Workout

```text
Title: VO2max 5x4m (115% FTP)
Description: 5 sets of 4 minutes at 115% FTP with 4 minutes active recovery. Focus on fast cadence (100-105 rpm).

Workout Structure:
- Warmup: 15m from 50% to 75% FTP
- 3x 30s High Cadence Openers @ 110% FTP, 30s rest @ 50% FTP
- Main Set:
  - 5x:
    - 4m @ 115% FTP (Cadence: 100-105 rpm)
    - 4m @ 50% FTP (Cadence: 85 rpm)
- Cooldown: 10m @ 50% FTP
```

---

## 6. Progressive Load & Ramp Rate Rules

1. **Volume Ramp Rate**: Do not increase total weekly riding time by more than $10\%$ week-over-week.
2. **TSS Ramp Rate**:
   - Safe build: $+3\text{ to }+5\text{ TSS/week}$ (CTL increase of $\sim 3-5$ points/month).
   - Aggressive build: $+5\text{ to }+8\text{ TSS/week}$ (Monitor TSB closely; keep $\text{TSB} > -30$).
3. **Deload Week Structure**:
   - Reduce weekly volume by $30 - 40\%$.
   - Maintain 1 light intensity session (e.g., 3x3m @ Threshold) mid-week to maintain neuromuscular priming without inducing fatigue.
