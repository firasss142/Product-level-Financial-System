import { Card } from "./card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  value: string | number;
  label: string;
  trend?: {
    direction: "up" | "down" | "neutral";
    value: string;
  };
  prefix?: string;
  suffix?: string;
  valueClassName?: string;
  className?: string;
}

const trendConfig = {
  up: { icon: "\u2191", color: "text-emerald" },
  down: { icon: "\u2193", color: "text-terracotta" },
  neutral: { icon: "\u2192", color: "text-warm-gray-500" },
} as const;

function StatCard({
  value,
  label,
  trend,
  prefix,
  suffix,
  valueClassName,
  className,
}: StatCardProps) {
  return (
    <Card className={cn(className)}>
      <div className="flex items-baseline gap-1">
        {prefix && (
          <span className="text-xl font-medium text-navy">{prefix}</span>
        )}
        <span className={cn("text-3xl font-semibold tabular-nums", valueClassName ?? "text-navy")}>
          {value}
        </span>
        {suffix && (
          <span className="text-sm font-medium text-warm-gray-500 ml-1">
            {suffix}
          </span>
        )}
        {trend && (
          <span
            className={cn(
              "ml-2 text-sm font-medium",
              trendConfig[trend.direction].color
            )}
          >
            {trendConfig[trend.direction].icon} {trend.value}
          </span>
        )}
      </div>
      <p className="text-sm text-warm-gray-500 mt-1">{label}</p>
    </Card>
  );
}

export { StatCard };
export type { StatCardProps };
