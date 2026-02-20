import { Skeleton } from '@/shared/components/ui/skeleton';

export default function TemplateEditLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[500px]" />
      </div>
    </div>
  );
}
