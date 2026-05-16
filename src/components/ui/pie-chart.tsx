import * as React from "react";

import { cn } from "@/lib/utils";

export type PieSegment = {
  label: string;
  value: number;
  color: string;
};

type PieChartProps = {
  segments: PieSegment[];
  size?: number;
  className?: string;
  emptyLabel?: string;
};

// Polar-to-cartesian helper. The pie starts at 12 o'clock (-90 degrees) and
// grows clockwise.
function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

export function PieChart({
  segments,
  size = 96,
  className,
  emptyLabel = "No data",
}: PieChartProps) {
  const nonZero = segments.filter((segment) => segment.value > 0);
  const total = nonZero.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full border border-dashed text-xs text-muted-foreground",
          className,
        )}
        style={{ width: size, height: size }}
        aria-label={emptyLabel}
      >
        {emptyLabel}
      </div>
    );
  }

  const radius = size / 2;
  const cx = radius;
  const cy = radius;

  // Single non-zero segment can't be drawn as an arc (start === end produces a
  // degenerate path), so fall back to a full circle in that case.
  if (nonZero.length === 1) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={className}
        role="img"
        aria-label={`${nonZero[0].label}: 100%`}
      >
        <circle cx={cx} cy={cy} r={radius} style={{ fill: nonZero[0].color }} />
      </svg>
    );
  }

  const { paths } = segments
    .filter((segment) => segment.value > 0)
    .reduce(
      (acc, segment) => {
        const angle = (segment.value / total) * 2 * Math.PI;
        const start = polar(cx, cy, radius, acc.cursor);
        const end = polar(cx, cy, radius, acc.cursor + angle);
        const largeArc = angle > Math.PI ? 1 : 0;
        const d = [
          `M ${cx} ${cy}`,
          `L ${start.x} ${start.y}`,
          `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
          "Z",
        ].join(" ");
        acc.paths.push(
          <path
            key={segment.label}
            d={d}
            style={{ fill: segment.color }}
          >
            <title>{`${segment.label}: ${segment.value}`}</title>
          </path>,
        );
        return { cursor: acc.cursor + angle, paths: acc.paths };
      },
      { cursor: -Math.PI / 2, paths: [] as React.ReactElement[] },
    );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={nonZero
        .map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`)
        .join(", ")}
    >
      {paths}
    </svg>
  );
}

type PieLegendProps = {
  segments: PieSegment[];
  className?: string;
};

export function PieLegend({ segments, className }: PieLegendProps) {
  const visible = segments.filter((segment) => segment.value > 0);
  if (visible.length === 0) {
    return null;
  }
  return (
    <ul className={cn("flex flex-col gap-1 text-xs", className)}>
      {visible.map((segment) => (
        <li
          key={segment.label}
          className="flex items-center gap-1.5"
        >
          <span
            aria-hidden="true"
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: segment.color }}
          />
          <span className="capitalize">{segment.label}</span>
          <span className="text-muted-foreground">{segment.value}</span>
        </li>
      ))}
    </ul>
  );
}
