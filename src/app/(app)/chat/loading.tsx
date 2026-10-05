import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="mx-auto max-w-md pb-28">
      <div className="px-5 pt-14 pb-4">
        <Skeleton className="mb-1.5 h-4 w-24 rounded" />
        <Skeleton className="h-9 w-48 rounded" />
      </div>
      <div className="space-y-3 px-4">
        <Skeleton className="h-16 w-3/4 rounded-2xl" />
        <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
        <Skeleton className="h-20 w-3/4 rounded-2xl" />
      </div>
    </div>
  );
}
