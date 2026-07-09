export function AnimeCardSkeleton() {
  return (
    <div className="group relative">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-xan-card border border-xan-border">
        <div className="absolute inset-0 animate-shimmer" />
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="h-3 w-full bg-xan-card rounded animate-shimmer" />
        <div className="h-3 w-2/3 bg-xan-card rounded animate-shimmer" />
      </div>
    </div>
  );
}
