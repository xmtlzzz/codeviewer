import { useMemo } from "react";
import type { DailyStat } from "../types";

interface TrendChartProps {
  days: DailyStat[];
}

/**
 * Renders the 7-day insertions/deletions trend as an inline SVG.
 * Ports the renderTrendChart() logic from the prototype.
 */
export function TrendChart({ days }: TrendChartProps) {
  const chart = useMemo(() => {
    // Aggregate by date across all repos
    const byDate = new Map<string, { insertions: number; deletions: number }>();
    for (const d of days) {
      const key = d.date;
      const cur = byDate.get(key) ?? { insertions: 0, deletions: 0 };
      cur.insertions += d.insertions;
      cur.deletions += d.deletions;
      byDate.set(key, cur);
    }

    // Sort ascending by date, take last 7
    const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const last7 = sorted.slice(-7);

    const labels = last7.map(([date]) => {
      // date is "YYYY-MM-DD" -> "MM-DD"
      const parts = date.split("-");
      return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : date;
    });
    const insertions = last7.map(([, v]) => v.insertions);
    const deletions = last7.map(([, v]) => v.deletions);

    if (labels.length === 0) {
      return null;
    }

    const maxVal = Math.max(...insertions, ...deletions, 1);
    const W = 560,
      H = 120;
    const padL = 30,
      padR = 10,
      padT = 10,
      padB = 20;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const step = labels.length > 1 ? chartW / (labels.length - 1) : 0;

    const getXY = (val: number, i: number) => ({
      x: padL + i * step,
      y: padT + chartH - (val / maxVal) * chartH,
    });

    const buildPath = (arr: number[]) =>
      arr
        .map((v, i) => {
          const p = getXY(v, i);
          return (i === 0 ? "M" : "L") + p.x + " " + p.y;
        })
        .join(" ");

    const buildArea = (arr: number[]) => {
      const path = arr
        .map((v, i) => {
          const p = getXY(v, i);
          return (i === 0 ? "M" : "L") + p.x + " " + p.y;
        })
        .join(" ");
      const last = getXY(arr[arr.length - 1], arr.length - 1);
      const first = getXY(arr[0], 0);
      return path + ` L${last.x} ${padT + chartH} L${first.x} ${padT + chartH} Z`;
    };

    const insPath = buildPath(insertions);
    const delPath = buildPath(deletions);
    const insArea = buildArea(insertions);

    // Grid lines (horizontal, 3 lines)
    const gridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i <= 2; i++) {
      const y = padT + (chartH / 2) * i;
      gridLines.push({ x1: padL, y1: y, x2: W - padR, y2: y });
    }

    // X labels
    const xLabels = labels.map((label, i) => ({
      x: padL + i * step,
      y: H - 4,
      label,
    }));

    // Data points
    const insPoints = insertions.map((v, i) => getXY(v, i));
    const delPoints = deletions.map((v, i) => getXY(v, i));

    return {
      insArea,
      insPath,
      delPath,
      gridLines,
      xLabels,
      insPoints,
      delPoints,
    };
  }, [days]);

  if (!chart) {
    return (
      <svg className="chart-svg" viewBox="0 0 560 120" preserveAspectRatio="none" />
    );
  }

  return (
    <svg
      className="chart-svg"
      viewBox="0 0 560 120"
      preserveAspectRatio="none"
    >
      {chart.gridLines.map((l, i) => (
        <line
          key={`grid-${i}`}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="var(--divider)"
          strokeWidth={1}
          strokeDasharray="2 4"
        />
      ))}
      <path d={chart.insArea} fill="var(--positive)" opacity={0.08} />
      <path
        d={chart.insPath}
        fill="none"
        stroke="var(--positive)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={chart.delPath}
        fill="none"
        stroke="var(--negative)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {chart.insPoints.map((p, i) => (
        <circle key={`ins-${i}`} cx={p.x} cy={p.y} r={2.5} fill="var(--positive)" />
      ))}
      {chart.delPoints.map((p, i) => (
        <circle key={`del-${i}`} cx={p.x} cy={p.y} r={2.5} fill="var(--negative)" />
      ))}
      {chart.xLabels.map((xl, i) => (
        <text
          key={`xlabel-${i}`}
          x={xl.x}
          y={xl.y}
          fontSize={9}
          fill="var(--text-tertiary)"
          textAnchor="middle"
          fontFamily="inherit"
        >
          {xl.label}
        </text>
      ))}
    </svg>
  );
}
