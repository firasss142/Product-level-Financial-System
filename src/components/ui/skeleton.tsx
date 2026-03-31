import { Card } from "./card";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "card" | "circle" | "rect";
}

const variantStyles = {
  text: "h-4 w-full rounded",
  card: "h-40 w-full rounded-xl",
  circle: "h-10 w-10 rounded-full",
  rect: "rounded",
} as const;

function Skeleton({
  variant = "rect",
  className,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-warm-gray-200 animate-pulse",
        variantStyles[variant],
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <Card className={cn("space-y-4", className)}>
      <Skeleton variant="text" className="w-1/3" />
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-2/3" />
    </Card>
  );
}

function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden="true">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} variant="text" className="h-3" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`r-${r}`} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`r-${r}-c-${c}`} variant="text" className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTable };
export type { SkeletonProps };
