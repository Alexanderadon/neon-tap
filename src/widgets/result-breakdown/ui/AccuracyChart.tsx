import { useMemo } from 'react';
import { dict } from '@/shared/i18n';
import { accuracyCurve, comboCurve, type ResultTimeline } from '@/entities/score';

interface Props {
  timeline: ResultTimeline;
  duration: number;
}

const W = 400;
const H = 120;
const PAD_R = 44;
const PAD_B = 16;
const SAMPLES = 160;

/** Running-accuracy line over a combo area, inline SVG (no libs). */
export function AccuracyChart({ timeline, duration }: Props) {
  const plotW = W - PAD_R;
  const plotH = H - PAD_B;
  const { comboPath, accPath, minAcc, maxCombo, lastAcc } = useMemo(() => {
    const combo = comboCurve(timeline, duration, SAMPLES);
    const acc = accuracyCurve(timeline, duration, SAMPLES);
    let maxCombo = 1;
    let lo = 1;
    for (let i = 0; i < SAMPLES; i++) {
      if (combo[i] > maxCombo) maxCombo = combo[i];
      if (acc[i] < lo) lo = acc[i];
    }
    const minAcc = Math.max(0, Math.floor((lo - 0.02) * 20) / 20);
    const xs = (i: number) => ((i / (SAMPLES - 1)) * plotW).toFixed(1);
    const yc = (v: number) => (plotH - (v / maxCombo) * (plotH - 6)).toFixed(1);
    const ya = (v: number) => (plotH - ((v - minAcc) / (1 - minAcc || 1)) * (plotH - 6)).toFixed(1);
    let cp = `M0,${plotH}`;
    let ap = '';
    for (let i = 0; i < SAMPLES; i++) {
      cp += ` L${xs(i)},${yc(combo[i])}`;
      ap += `${i ? ' L' : 'M'}${xs(i)},${ya(acc[i])}`;
    }
    cp += ` L${plotW},${plotH} Z`;
    return { comboPath: cp, accPath: ap, minAcc, maxCombo, lastAcc: acc[SAMPLES - 1] };
  }, [timeline, duration, plotW, plotH]);

  return (
    <svg className="result-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={dict.resultChartTitle}>
      <defs>
        <linearGradient id="result-combo-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#00f0ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#00f0ff" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <line x1="0" y1={plotH} x2={plotW} y2={plotH} stroke="rgba(255,255,255,0.15)" />
      <line x1="0" y1="6" x2={plotW} y2="6" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 4" />
      <path d={comboPath} fill="url(#result-combo-fill)" />
      <path d={accPath} fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinejoin="round" />
      <text x={W - PAD_R + 5} y="9" className="result-chart-axis">
        100%
      </text>
      <text x={W - PAD_R + 5} y={plotH} className="result-chart-axis">
        {Math.round(minAcc * 100)}%
      </text>
      <text x="0" y={H - 3} className="result-chart-legend result-chart-legend-combo">
        ▲ {dict.resultComboArea} · {maxCombo}
      </text>
      <text x={plotW} y={H - 3} textAnchor="end" className="result-chart-legend">
        — {dict.resultAccuracyLine} · {(lastAcc * 100).toFixed(1)}%
      </text>
    </svg>
  );
}
