import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * EventCardSkeleton
 *
 * Matches the exact dimensions of EventCard for zero layout shift.
 * Used while loading event listings.
 */
export function EventCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      {/* Image placeholder */}
      <Skeleton className="h-48 w-full rounded-none" />
      <CardHeader className="space-y-2">
        {/* Title */}
        <Skeleton className="h-6 w-3/4" />
        {/* Date badge */}
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Description lines */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

/**
 * TicketCardSkeleton
 *
 * Matches the exact dimensions of TicketTypeCard for zero layout shift.
 * Used while loading ticket type selection.
 */
export function TicketCardSkeleton() {
  return (
    <Card className="p-4 space-y-3">
      {/* Title */}
      <Skeleton className="h-5 w-1/2" />
      {/* Price */}
      <Skeleton className="h-6 w-20" />
      {/* Description */}
      <Skeleton className="h-4 w-full" />
      {/* Button area */}
      <Skeleton className="h-10 w-full" />
    </Card>
  );
}

/**
 * TableCardSkeleton
 *
 * Matches the exact dimensions of VIP table cards for zero layout shift.
 * Used while loading VIP table selection.
 */
export function TableCardSkeleton() {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        {/* Table number */}
        <Skeleton className="h-8 w-16" />
        {/* Status badge */}
        <Skeleton className="h-6 w-20" />
      </div>
      {/* Capacity */}
      <Skeleton className="h-4 w-24" />
      {/* Price */}
      <Skeleton className="h-6 w-28" />
    </Card>
  );
}
