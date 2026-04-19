import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <div className="mx-auto max-w-md pb-28">
      <div className="px-5 pt-14 pb-4">
        <Skeleton className="mb-1.5 h-4 w-32 rounded" />
        <Skeleton className="h-9 w-44 rounded" />
      </div>
      <div className="mx-4">
        <Skeleton className="mb-4 h-12 w-full rounded-xl" />
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="mb-2.5 h-16 w-full rounded-2xl" />)}
      </div>
    </div>
  );
}
