import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Skeleton className="h-8 w-24 mb-6" />
      <Skeleton className="h-28 w-full rounded-xl mb-4" />
      <Skeleton className="h-28 w-full rounded-xl mb-4" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}
