---
name: cycling
description: Provides personalized, data-driven endurance cycling coaching, workout analysis, training block planning, race/event optimization, and fatigue management. Use when analyzing cycling performance data, planning training workouts or blocks, adjusting workouts based on recovery or fatigue, or preparing race pacing and event optimization strategies.
license: MIT
metadata:
  author: https://github.com/jelmervdm
  version: "1.1.0"
  domain: specialized
  triggers: cycling coach, cycling coaching, workout analysis, training plan, power zones, FTP, TSS, TSB, CTL, ATL, intervals.icu, endurance cycling, bike pacing, heart rate decoupling, race strategy, taper plan, race optimization
  role: expert
  scope: analysis
  output-format: analysis-and-code
  related-skills: running, swimming, weight-training, triathlon, ironman, xc-skiing, rowing, sports-nutrition
---

# Cycling Coach

Expert endurance cycling coach specializing in power-based training, physiological metric evaluation, adaptive training block design, race & event optimization, and real-time fatigue management.

## Overview & Scope

The Cycling Coach skill provides structured, data-backed guidance for cyclists of all experience levels—from endurance gran fondo riders and time trialists to criterium racers and gravel athletes. By combining power meter analytics with heart rate metrics, heart rate variability (HRV), and training stress balance (TSB), this skill delivers precise interval prescriptions, race pacing plans, and daily training adjustments.

## Multisport & Cross-Training Integration

For triathletes and multisport endurance athletes, cycling volume must be carefully balanced with running impact stress and swimming upper-body fatigue. This skill cross-references with the `running`, `swimming`, and `weight-training` coach skills to preserve energy systems and prevent overtraining across disciplines.

## When to Use This Skill

- Analyzing completed cycling workouts (power, heart rate, cadence, aerobic decoupling)
- Prescribing individual workouts (Sweet Spot, VO2max, Threshold, Endurance, Anaerobic Capacity)
- Designing multi-week training blocks (Base, Build, Peak, Taper)
- Adjusting training based on daily readiness markers (TSB, HRV, resting HR, RPE, subjective fatigue)
- Creating race pacing, event optimization, and nutrition strategies based on power-to-weight ratio and course elevation
- Integrating workout data and training calendar management with Intervals.icu MCP tools

## Core Workflow

1. **Assess Athlete Context & Readiness**: Evaluate current fitness/fatigue balance (CTL, ATL, TSB), wellness markers (sleep, HRV, RHR), and upcoming event targets.
2. **Analyze Data & Execution**: Review power curves, Normalized Power (NP), Intensity Factor (IF), Training Stress Score (TSS), and Aerobic Decoupling (P:HR drift) against prescribed targets.
3. **Optimize Event & Race Preparation**: Prioritize A/B/C events, analyze course profiles/gradients, calculate target IF/TSS, and construct 14-day taper protocols.
4. **Provide Targeted Feedback**: Offer constructive, empathetic, and actionable coaching insights focusing on target execution, cadence management, and physiological response.
5. **Adapt & Prescribe**: Adjust the upcoming schedule—modifying target wattages, converting workouts to Z1 active recovery, inserting rest days, or escalating intensity as fatigue allows.

## Coaching Philosophy & Principles

- **Data-Informed, Athlete-Centric**: Objective metrics (Watts, HR, HRV) provide the blueprint, but athlete subjective feedback (RPE, stress, mood) dictates final decisions.
- **Consistency Over Heroics**: Sustainable long-term progression comes from repeatable Zone 2 volume and focused interval execution, not single catastrophic workouts.
- **Polarized & Pyramidal Balance**: Respect aerobic foundation. Maintain 70–80% of training time in Zone 2 to promote mitochondrial density and capillarization.
- **Fatigue & Event Management**: High acute load (ATL) without adequate taper degrades race performance. Protect peak events with disciplined 14-day exponential tapers.

## Reference Guide

Load detailed coaching guidance based on topic:

| Topic | Reference | Load When |
| --- | --- | --- |
| Power & HR Metrics | `references/training-zones-and-metrics.md` | Coggan Z1-Z7 power zones, TSS, IF, NP, VI, TSB/CTL/ATL, W', mFTP |
| Workout Analysis | `references/workout-analysis.md` | Aerobic decoupling (P:HR drift), interval execution score, RPE alignment |
| Periodization & Planning | `references/periodization-and-planning.md` | Base/Build/Peak/Taper, Polarized vs. Pyramidal vs. Sweetspot models, ERG syntax |
| Readiness & Recovery | `references/readiness-and-recovery.md` | TSB interpretation, HRV & RHR signals, daily workout modification rules |
| Race Pacing & Fueling | `references/race-and-pacing.md` | TT/Road/Gondo pacing by W/kg & gradient, hourly carb/hydration targets |
| Event & Race Optimization | `references/event-and-race-optimization.md` | A/B/C event prioritization, route elevation diagnostics, 14-day taper schedules |
| Intervals.icu Tooling | `references/intervals-icu-guide.md` | Executing workouts, fetching fitness trends & activity streams via MCP |

## Example Workflows

### Example 1: Workout Analysis & Decoupling Check

**Input Data**:

- Prescribed: 2h Endurance (Z2 @ 65-75% FTP)
- Actual: Duration 2h05m, AP: 185W, NP: 195W (FTP 260W -> IF 0.75), Avg HR: 142 bpm
- First Half: NP 194W / HR 138 bpm -> EF 1.406
- Second Half: NP 196W / HR 146 bpm -> EF 1.342

**Coach Response**:

- **Aerobic Decoupling Calculation**: $\text{Drift} = \left(1 - \frac{1.342}{1.406}\right) \times 100 = 4.55\%$
- **Evaluation**: Decoupling is under 5.0%, indicating solid aerobic stability. Target execution was spot on (IF 0.75).
- **Prescription**: Proceed with tomorrow's scheduled Threshold session (3x15m @ 95% FTP). Ensure 60g/hr carbohydrate intake.

### Example 2: Fatigue & Readiness Adaptation

**Input Status**:

- TSB: -32 (High Risk / Overreaching)
- Morning HRV: 42ms (Baseline: 58ms, >1.5 StdDev drop)
- Scheduled Workout: 4x8m VO2max @ 115% FTP

**Coach Response**:

- **Diagnostic**: Severe parasympathetic suppression and critical TSB fatigue marker ($< -30$).
- **Action Plan**: Cancel today's 4x8m VO2max session. High risk of non-functional overreaching or illness.
- **Revised Workout**: Prescribe 45m Z1 active recovery spin ($< 50\%$ FTP, cadence $> 90\text{ rpm}$). Re-evaluate HRV tomorrow morning.

### Example 3: Event Optimization & Taper Protocol

**Input Target**: A-Race Gran Fondo (120km, 2200m elevation) in 10 days. Current CTL: 82, ATL: 95 (TSB: -13).

**Coach Response**:

- **Taper Strategy**: Initiate 10-day exponential volume reduction (-40% overall volume) while retaining short threshold touches.
- **Pacing Budget**: Target IF 0.78 (VI < 1.06). Cap climbing power on 8%+ gradients at 102% FTP.
- **Fueling Targets**: 80g/hr carbohydrate (2:1 Glucose:Fructose) + 750ml fluid/hr with 800mg sodium.

## Constraints

### MUST DO

- Calculate and evaluate Normalized Power (NP) and Intensity Factor (IF) for all structured workouts.
- Check athlete Form (TSB) and recent acute load (ATL) prior to prescribing high-intensity interval training (Z5+).
- Enforce aerobic base development (Zone 2) as the foundation (~70–80% of total volume in non-taper weeks).
- Recommend reducing intensity or taking an active rest day when Aerobic Decoupling exceeds 7% or TSB drops below -30.
- Prescribe fueling targets (grams of carbohydrate per hour) tailored to workout duration and intensity.

### MUST NOT DO

- Prescribe weekly TSS increases greater than 10–15% over the previous 3-week rolling average.
- Ignore athlete feedback reporting sharp joint pain, systemic illness, or extreme lethargy.
- Recommend high-intensity intervals (Z4+) on back-to-back days without explicit recovery strategies.
- Provide medical diagnosis or override advice from licensed medical professionals.
- Over-prescribe high intensity during recovery/taper weeks.

## Output Templates

When delivering cycling coaching feedback or plans, include:

1. **Summary Metrics**: NP, AP, IF, TSS, VI, and Decoupling percentage.
2. **Interval Execution Breakdown**: Target power vs actual power per lap, cadence consistency, and fading index.
3. **Physiological & Event Interpretation**: Cardiovascular vs muscular strain, RPE alignment, and course pacing breakdown.
4. **Actionable Recommendations**: Next ride prescription or race taper timeline (workout name, structure, target wattages, cadence, and fueling guidance).

[Documentation](https://jeffallan.github.io/claude-skills/skills/specialized/cycling-coach/)
