# Power & Heart Rate Training Zones and Physiological Metrics

Comprehensive guide for interpreting power and heart rate training zones, impulse-response training load models, and power-duration curve metrics in endurance cycling.

---

## 1. Coggan 7-Zone Power Architecture

Power output provides an objective, immediate measure of mechanical work. Training zones are calculated as percentages of **Functional Threshold Power (FTP)**—the maximum power an athlete can sustain in a quasi-steady state for approximately 60 minutes (or as derived from mFTP / 20-minute test * 0.95).

| Zone | Name | % of FTP | Physiological Target / Adaptation | Primary Fuel |
| ------ | ------ | ---------- | ----------------------------------- | -------------- |
| **Z1** | Active Recovery | $< 55\%$ | Metabolic waste flushing, light blood flow | Plasma free fatty acids |
| **Z2** | Endurance | $55\% - 75\%$ | Mitochondrial biogenesis, capillarization, fat oxidation | Fat oxidation (FatMax zone) |
| **Z3** | Tempo | $76\% - 90\%$ | Aerobic glycogen store expansion, muscular endurance | Mixed Fat & Carbohydrate |
| **Z3.5** | Sweet Spot | $88\% - 93\%$ | Maximum FTP stimulus with manageable fatigue accumulation | Carbohydrate dominant |
| **Z4** | Threshold | $91\% - 105\%$ | Lactate clearance rate improvement, motor unit recruitment | Carbohydrate |
| **Z5** | VO2max | $106\% - 120\%$ | Maximal oxygen uptake expansion, cardiac output limits | Carbohydrate (Glycolytic) |
| **Z6** | Anaerobic Capacity | $121\% - 150\%$ | Anaerobic glycolysis capacity, buffering capacity | Muscle glycogen & phosphagens |
| **Z7** | Neuromuscular | $> 150\%$ | Maximal neuromuscular recruitment, ATP-PC system | ATP-CP (Creatine Phosphate) |

### Cadence & Torque Nuances

- **Low Cadence ($60 - 75\text{ rpm}$)**: Increases muscular torque and motor unit recruitment. Useful for threshold strength climbing.
- **Self-Selected Cadence ($85 - 95\text{ rpm}$)**: Optimal for general endurance and efficiency.
- **High Cadence ($100 - 110+\text{ rpm}$)**: Shifts burden from skeletal muscle to cardiovascular system, preserving muscular endurance during high power efforts.

---

## 2. Heart Rate Training Zones

Heart rate reflects physiological strain and autonomic response. Unlike power, heart rate exhibits a lag (15–60 seconds to stabilize) and is influenced by fatigue, temperature, caffeine, and dehydration.

Heart rate zones are calculated relative to **Lactate Threshold Heart Rate (LTHR)** or **Max Heart Rate ($\text{HR}_{\max}$)**:

| Zone | % of LTHR | Description & Application |
| ------ | ----------- | --------------------------- |
| **Z1** | $< 81\%$ | Recovery: Minimal cardiac strain |
| **Z2** | $81\% - 89\%$ | Aerobic: Sustained long rides; minimal cardiac drift |
| **Z3** | $90\% - 93\%$ | Tempo: Moderate elevation in cardiac output |
| **Z4** | $94\% - 99\%$ | Threshold: Near LTHR steady state |
| **Z5a** | $100\% - 102\%$ | Super-Threshold: LTHR onset |
| **Z5b** | $103\% - 106\%$ | Aerobic Capacity (VO2max): High cardiac drift |
| **Z5c** | $> 106\%$ | Anaerobic: Heart rate approaches $\text{HR}_{\max}$ |

---

## 3. Work & Intensity Calculations

### Normalized Power (NP)

Normalized Power accounts for the physiological cost of non-steady power output (surges, hills, coasting) using a 30-second rolling average algorithm raised to the 4th power:

$$\text{NP} = \sqrt[4]{\frac{1}{N} \sum_{i=1}^{N} (\text{Power}_{30s,\text{rolling}})^4}$$

*Coaching Context*: A ride with high variability (crit, surgey group ride) will have a significantly higher NP than average power (AP).

### Variability Index (VI)

$$\text{VI} = \frac{\text{NP}}{\text{AP}}$$

- **Steady TT / Tri**: $\text{VI} = 1.00 - 1.05$
- **Rolling Endurance**: $\text{VI} = 1.06 - 1.12$
- **Criterium / MTB / Road Race**: $\text{VI} = 1.15 - 1.30+$

### Intensity Factor (IF)

$$\text{IF} = \frac{\text{NP}}{\text{FTP}}$$

- $< 0.75$: Easy endurance / recovery
- $0.75 - 0.85$: Moderate endurance / tempo
- $0.85 - 0.95$: Sweet spot / hard threshold effort
- $0.95 - 1.05$: 1-hour race effort or high intensity intervals
- $> 1.05$: Short criterium or track event ($< 45\text{ mins}$)

### Training Stress Score (TSS)

Quantifies total physiological load of a ride combining duration and intensity:

$$\text{TSS} = \frac{\text{Duration (seconds)} \times \text{NP} \times \text{IF}}{\text{FTP} \times 3600} \times 100$$

---

## 4. Impulse-Response Fatigue & Fitness Model (Banister Model)

Training load history dictates current adaptation and performance capability through three rolling exponential metrics:

```
                  ┌────────────────────────┐
                  │    Daily Work (TSS)    │
                  └───────────┬────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
   ┌──────────────────────┐      ┌──────────────────────┐
   │ Chronic Training Load│      │ Acute Training Load  │
   │    (CTL - Fitness)   │      │    (ATL - Fatigue)   │
   │   42-Day Exp Decay   │      │    7-Day Exp Decay   │
   └───────────┬──────────┘      └───────────┬──────────┘
               │                             │
               └──────────────┬──────────────┘
                              ▼
                  ┌────────────────────────┐
                  │   Training Stress Balance│
                  │     (TSB - Form)       │
                  │     TSB = CTL - ATL    │
                  └────────────────────────┘
```

1. **CTL (Chronic Training Load - "Fitness")**: 42-day exponentially weighted moving average of daily TSS. Represents long-term aerobic conditioning.
2. **ATL (Acute Training Load - "Fatigue")**: 7-day exponentially weighted moving average of daily TSS. Represents short-term physiological strain.
3. **TSB (Training Stress Balance - "Form")**:
   $$\text{TSB} = \text{CTL} - \text{ATL}$$

### TSB Coaching Ranges

- **Optimal Training Zone (Building)**: $-10 > \text{TSB} > -30$. Productive fatigue accumulation.
- **High Risk / Over-reaching**: $\text{TSB} < -30$. High risk of non-functional overreaching, illness, or injury.
- **Fresh / Race Ready (Peak)**: $+5 < \text{TSB} < +25$. Taper phase target for key events.
- **Detraining**: $\text{TSB} > +25$. Excess loss of acute fitness.

---

## 5. Advanced Power Duration Curve Metrics

- **mFTP (Modeled FTP)**: Mathematical fit of the power duration curve to identify true physiological threshold.
- **W' (W-Prime - Anaerobic Work Capacity)**: The finite amount of energy available above FTP, measured in Joules (typically $10,000 - 35,000\text{ J}$). When W' depletes to 0, power output drops below FTP.
- **Pmax**: Absolute maximal power over a 1-second interval (sprint capacity).
- **Power-to-Weight Ratio ($\text{W/kg}$)**:
  $$\text{W/kg} = \frac{\text{Power (Watts)}}{\text{Body Weight (kg)}}$$
  Key metric for climbing performance and competitive categorization.
