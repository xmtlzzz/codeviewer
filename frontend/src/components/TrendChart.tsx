import { useMemo } from "react";
import type { DailyStat } from "../types";

export type TrendChartVariant = "line" | "bar" | "pie";

interface TrendChartLabels {
  insertions: string;
  deletions: string;
  lines: string;
}

interface TrendChartProps {
  days: DailyStat[];
  variant?: TrendChartVariant;
  labels?: TrendChartLabels;
}

interface ChartData {
  labels: string[];
  insertions: number[];
  deletions: number[];
  maxVal: number;
}

const W = 560;
const H = 120;
const padL = 30;
const padR = 10;
const padT = 10;
const padB = 20;
const chartW = W - padL - padR;
const chartH = H - padT - padB;
const fallbackLabels: TrendChartLabels = {
  insertions: "Insertions",
  deletions: "Deletions",
  lines: "lines",
};

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
  const startPoint = polarToCartesian(cx, cy, r, end);
  const endPoint = polarToCartesian(cx, cy, r, start);
  const largeArcFlag = end - start <= 180 ? "0" : "1";

  return [
    `M ${cx} ${cy}`,
    `L ${startPoint.x} ${startPoint.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 0 ${endPoint.x} ${endPoint.y}`,
    "Z",
  ].join(" ");
}

function formatCompact(n: number): string {
  return n.toLocaleString();
}

/** Renders recent insertions/deletions as an inline SVG. */
export function TrendChart({
  days,
  variant = "line",
  labels = fallbackLabels,
}: TrendChartProps) {
  const chart = useMemo<ChartData | null>(() => {
    const byDate = new Map<string, { insertions: number; deletions: number }>();
    for (const d of days) {
      const cur = byDate.get(d.date) ?? { insertions: 0, deletions: 0 };
      cur.insertions += d.insertions;
      cur.deletions += d.deletions;
      byDate.set(d.date, cur);
    }

    const last7 = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7);
    const dateLabels = last7.map(([date]) => {
      const parts = date.split("-");
      return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : date;
    });

    if (dateLabels.length === 0) return null;

    const insertions = last7.map(([, v]) => v.insertions);
    const deletions = last7.map(([, v]) => v.deletions);

    return {
      labels: dateLabels,
      insertions,
      deletions,
      maxVal: Math.max(...insertions, ...deletions, 1),
    };
  }, [days]);

  if (!chart) {
    return <svg className="chart-svg" viewBox="0 0 560 120" preserveAspectRatio="none" />;
  }

  if (variant === "bar") {
    const groupW = chartW / chart.labels.length;
    const barW = Math.min(18, Math.max(8, groupW * 0.24));
    const baseY = padT + chartH;

    return (
      <svg
        className="chart-svg chart-svg-bars"
        viewBox="0 0 560 120"
        preserveAspectRatio="none"
      >
        {[0, 1, 2].map((i) => {
          const y = padT + (chartH / 2) * i;
          return (
            <line
              key={`grid-${i}`}
              x1={padL}
              y1={y}
              x2={W - padR}
              y2={y}
              stroke="var(--divider)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          );
        })}
        {chart.labels.flatMap((label, i) => {
          const center = padL + groupW * i + groupW / 2;
          const insertionH = (chart.insertions[i] / chart.maxVal) * chartH;
          const deletionH = (chart.deletions[i] / chart.maxVal) * chartH;

          return [
            <rect
              key={`ins-${label}`}
              className="chart-bar positive"
              x={center - barW - 2}
              y={baseY - insertionH}
              width={barW}
              height={insertionH}
              rx={2}
            />,
            <rect
              key={`del-${label}`}
              className="chart-bar negative"
              x={center + 2}
              y={baseY - deletionH}
              width={barW}
              height={deletionH}
              rx={2}
            />,
          ];
        })}
        {chart.labels.map((label, i) => (
          <text
            key={`xlabel-${label}`}
            x={padL + groupW * i + groupW / 2}
            y={H - 4}
            fontSize={9}
            fill="var(--text-tertiary)"
            textAnchor="middle"
            fontFamily="inherit"
          >
            {label}
          </text>
        ))}
      </svg>
    );
  }

  if (variant === "pie") {
    const totalInsertions = chart.insertions.reduce((sum, value) => sum + value, 0);
    const totalDeletions = chart.deletions.reduce((sum, value) => sum + value, 0);
    const total = totalInsertions + totalDeletions;
    const insertionPercent = total === 0 ? 0 : Math.round((totalInsertions / total) * 100);
    const deletionPercent = total === 0 ? 0 : 100 - insertionPercent;
    const insertionAngle = total === 0 ? 0 : (totalInsertions / total) * 360;

    return (
      <svg className="chart-svg chart-svg-pie" viewBox="0 0 560 120">
        {total === 0 ? (
          <circle cx={120} cy={60} r={44} fill="var(--bg-inset)" />
        ) : (
          <>
            <path d={describeArc(120, 60, 44, 0, insertionAngle)} fill="var(--positive)" />
            <path d={describeArc(120, 60, 44, insertionAngle, 360)} fill="var(--negative)" />
            <circle cx={120} cy={60} r={24} fill="var(--bg-card)" />
          </>
        )}
        <circle cx={196} cy={39} r={4} fill="var(--positive)" />
        <text x={210} y={44} className="pie-label" fill="var(--text-secondary)">
          {labels.insertions} {insertionPercent}%
        </text>
        <circle cx={196} cy={63} r={4} fill="var(--negative)" />
        <text x={210} y={68} className="pie-label" fill="var(--text-secondary)">
          {labels.deletions} {deletionPercent}%
        </text>
        <text x={210} y={92} className="pie-total mono" fill="var(--text-primary)">
          {formatCompact(total)} {labels.lines}
        </text>
      </svg>
    );
  }

  const step = chart.labels.length > 1 ? chartW / (chart.labels.length - 1) : 0;
  const getXY = (value: number, i: number) => ({
    x: padL + i * step,
    y: padT + chartH - (value / chart.maxVal) * chartH,
  });
  const buildPath = (values: number[]) =>
    values
      .map((value, i) => {
        const p = getXY(value, i);
        return `${i === 0 ? "M" : "L"}${p.x} ${p.y}`;
      })
      .join(" ");
  const buildArea = (values: number[]) => {
    const path = buildPath(values);
    const last = getXY(values[values.length - 1], values.length - 1);
    const first = getXY(values[0], 0);
    return `${path} L${last.x} ${padT + chartH} L${first.x} ${padT + chartH} Z`;
  };

  const insPath = buildPath(chart.insertions);
  const delPath = buildPath(chart.deletions);
  const insArea = buildArea(chart.insertions);

  return (
    <svg className="chart-svg" viewBox="0 0 560 120" preserveAspectRatio="none">
      {[0, 1, 2].map((i) => {
        const y = padT + (chartH / 2) * i;
        return (
          <line
            key={`grid-${i}`}
            x1={padL}
            y1={y}
            x2={W - padR}
            y2={y}
            stroke="var(--divider)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        );
      })}
      <path d={insArea} fill="var(--positive)" opacity={0.08} />
      <path
        d={insPath}
        fill="none"
        stroke="var(--positive)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={delPath}
        fill="none"
        stroke="var(--negative)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {chart.insertions.map((value, i) => {
        const p = getXY(value, i);
        return <circle key={`ins-${i}`} cx={p.x} cy={p.y} r={2.5} fill="var(--positive)" />;
      })}
      {chart.deletions.map((value, i) => {
        const p = getXY(value, i);
        return <circle key={`del-${i}`} cx={p.x} cy={p.y} r={2.5} fill="var(--negative)" />;
      })}
      {chart.labels.map((label, i) => (
        <text
          key={`xlabel-${label}`}
          x={padL + i * step}
          y={H - 4}
          fontSize={9}
          fill="var(--text-tertiary)"
          textAnchor="middle"
          fontFamily="inherit"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
