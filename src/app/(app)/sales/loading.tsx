import { Skeleton } from "@/components/ui/skeleton";

export default function SalesLoading() {
  return (
    <div className="mx-auto max-w-md pb-28">
      <div className="px-5 pt-14 pb-4">
        <Skeleton className="h-4 w-40 rounded mb-1.5" />
        <Skeleton className="h-8 w-56 rounded" />
      </div>
      <div className="mx-4">
        <Skeleton className="h-10 w-full rounded-xl mb-4" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}
