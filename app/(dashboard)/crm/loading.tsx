import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <Skeleton className="h-10 w-64" />

      {/* Content Skeleton - Kanban view */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-12 w-full" />
            {[1, 2, 3].map((card) => (
              <Skeleton key={card} className="h-32 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
