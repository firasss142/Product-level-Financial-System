import { SkeletonCard, SkeletonTable } from "@/components/ui";

export default function AdminLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="h-8 w-48 bg-warm-gray-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonTable rows={8} cols={5} />
    </div>
  );
}
