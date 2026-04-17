import { Skeleton } from "@/components/ui/skeleton";

export default function SalesLoading() {
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Skeleton className="h-10 w-full rounded-lg mb-4" />
      <Skeleton className="h-8 w-full rounded-lg mb-4" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
