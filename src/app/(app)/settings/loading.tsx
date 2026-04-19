import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-md pb-28">
      <div className="px-5 pt-14 pb-4">
        <Skeleton className="mb-1.5 h-4 w-16 rounded" />
        <Skeleton className="h-9 w-48 rounded" />
      </div>
      <div className="mx-4">
        <Skeleton className="mb-4 h-20 w-full rounded-2xl" />
        <Skeleton className="mb-2 h-4 w-20 rounded" />
        <Skeleton className="mb-4 h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}
