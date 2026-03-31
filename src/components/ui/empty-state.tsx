import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

function DefaultIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      className="text-warm-gray-300"
      aria-hidden="true"
    >
      <rect
        x="12"
        y="16"
        width="40"
        height="32"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      <path
        d="M24 36h16M28 30h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EmptyState({
  title = "Aucune donn\u00e9e",
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="mb-4">{icon || <DefaultIcon />}</div>
      <h3 className="text-lg font-medium text-navy">{title}</h3>
      {description && (
        <p className="text-sm text-warm-gray-500 mt-1 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
