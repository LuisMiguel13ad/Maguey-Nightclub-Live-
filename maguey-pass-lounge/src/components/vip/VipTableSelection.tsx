/**
 * VIP Table Selection Component
 * Displays available VIP tables for an event with pricing and capacity info
 */

import { useState, useEffect } from 'react';
import { 
  Crown, 
  Users, 
  Wine, 
  MapPin, 
  Check, 
  X,
  Loader2,
  Info,
  Star,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  getAvailableTablesForEvent, 
  type VipTableWithAvailability 
} from '@/lib/vip-tables-service';

interface VipTableSelectionProps {
  eventId: string;
  eventName: string;
  eventDate: string;
  onSelectTable: (table: VipTableWithAvailability) => void;
  selectedTableId?: string;
}

const tierConfig = {
  premium: {
    icon: Crown,
    label: 'Premium',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    badgeClass: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  },
  standard: {
    icon: Star,
    label: 'Standard',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  },
  regular: {
    icon: Sparkles,
    label: 'Regular',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  },
};

export const VipTableSelection = ({
  eventId,
  eventName,
  eventDate,
  onSelectTable,
  selectedTableId,
}: VipTableSelectionProps) => {
  const [tables, setTables] = useState<VipTableWithAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);

  useEffect(() => {
    loadTables();
  }, [eventId]);

  const loadTables = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const availableTables = await getAvailableTablesForEvent(eventId);
      setTables(availableTables);
    } catch (err) {
      console.error('Error loading tables:', err);
      setError('Failed to load available tables. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Group tables by tier
  const tablesByTier = tables.reduce((acc, table) => {
    if (!acc[table.tier]) {
      acc[table.tier] = [];
    }
    acc[table.tier].push(table);
    return acc;
  }, {} as Record<string, VipTableWithAvailability[]>);

  // Stats
  const totalTables = tables.length;
  const availableTables = tables.filter(t => t.is_available).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading tables...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with floor plan reference */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Select Your VIP Table</h2>
          <p className="text-muted-foreground mt-1">
            {eventName} • {new Date(eventDate).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Available ({availableTables})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Reserved ({totalTables - availableTables})</span>
          </div>
        </div>
      </div>

      {/* Floor Plan Reference Image */}
      <Card className="border-primary/20 bg-black/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <MapPin className="w-5 h-5 text-primary" />
            <span>
              View our <Button variant="link" className="p-0 h-auto text-primary">floor plan</Button> for table locations. 
              Premium tables are in the VIP section near the DJ booth.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* No Refund Policy Banner */}
      <Alert className="border-amber-500/50 bg-amber-500/10">
        <Info className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-amber-200">
          <strong>No Refund Policy:</strong> All VIP table reservations are final. 
          Payments are non-refundable. Please confirm your date and guest count before booking.
        </AlertDescription>
      </Alert>

      {/* Tables by Tier */}
      {['premium', 'standard', 'regular'].map((tier) => {
        const tierTables = tablesByTier[tier];
        if (!tierTables || tierTables.length === 0) return null;

        const config = tierConfig[tier as keyof typeof tierConfig];
        const TierIcon = config.icon;

        return (
          <div key={tier} className="space-y-4">
            {/* Tier Header */}
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', config.bgColor)}>
                <TierIcon className={cn('w-5 h-5', config.color)} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  {config.label} Tables
                  <Badge className={config.badgeClass}>
                    ${tierTables[0]?.price}
                  </Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tierTables[0]?.bottle_service_description} • Up to {tierTables[0]?.guest_capacity} guests
                </p>
              </div>
            </div>

            {/* Tables Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tierTables.map((table) => {
                const isSelected = selectedTableId === table.id;
                const isHovered = hoveredTableId === table.id;

                return (
                  <TooltipProvider key={table.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card
                          className={cn(
                            'relative cursor-pointer transition-all duration-200 overflow-hidden',
                            table.is_available
                              ? cn(
                                  'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20',
                                  isSelected && 'border-primary bg-primary/10 shadow-lg shadow-primary/30',
                                  !isSelected && config.borderColor
                                )
                              : 'opacity-60 cursor-not-allowed bg-gray-900/50 border-gray-700'
                          )}
                          onClick={() => table.is_available && onSelectTable(table)}
                          onMouseEnter={() => setHoveredTableId(table.id)}
                          onMouseLeave={() => setHoveredTableId(null)}
                        >
                          {/* Selection Indicator */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 z-10">
                              <div className="bg-primary rounded-full p-1">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          )}

                          {/* Reserved Overlay */}
                          {!table.is_available && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                              <Badge variant="destructive" className="text-sm">
                                <X className="w-3 h-3 mr-1" />
                                Reserved
                              </Badge>
                            </div>
                          )}

                          <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-base flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <TierIcon className={cn('w-4 h-4', config.color)} />
                                {table.table_name}
                              </span>
                              <span className="text-lg font-bold text-white">
                                ${table.price}
                              </span>
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="p-4 pt-0 space-y-3">
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                <span>{table.guest_capacity} guests</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Wine className="w-4 h-4" />
                                <span>Bottle</span>
                              </div>
                            </div>

                            {table.floor_section && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span>{table.floor_section}</span>
                              </div>
                            )}

                            {table.is_available && (
                              <Button
                                variant={isSelected ? 'default' : 'outline'}
                                size="sm"
                                className={cn(
                                  'w-full mt-2',
                                  isSelected && 'bg-primary hover:bg-primary/90'
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectTable(table);
                                }}
                              >
                                {isSelected ? 'Selected' : 'Select Table'}
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-semibold">{table.table_name}</p>
                          {table.position_description && (
                            <p className="text-sm text-muted-foreground">
                              {table.position_description}
                            </p>
                          )}
                          <p className="text-sm">
                            {table.bottle_service_description}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <Card className="border-primary/20 bg-black/40">
        <CardContent className="p-4">
          <h4 className="font-semibold text-white mb-3">Table Packages Include:</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <Crown className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-400">Premium ($700)</p>
                <p className="text-muted-foreground">1 bottle of your choice + champagne, 10 guests</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-400">Standard ($600)</p>
                <p className="text-muted-foreground">1 bottle + champagne, 8 guests</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-purple-400">Regular ($500)</p>
                <p className="text-muted-foreground">1 bottle included, 6 guests</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VipTableSelection;
