/**
 * VIP Table Map Component
 * Visual map/floor plan showing VIP table locations and availability
 */

import { useState, useEffect } from 'react';
import { Crown, Users, MapPin, Check, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type VipTableWithAvailability } from '@/lib/vip-tables-service';

interface VIPTableMapProps {
  tables: VipTableWithAvailability[];
  selectedTableId?: string;
  onSelectTable: (table: VipTableWithAvailability) => void;
  eventId: string;
  eventName: string;
}

const tierColors: Record<string, { bg: string; border: string; text: string; selected: string }> = {
  premium: {
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/50',
    text: 'text-yellow-400',
    selected: 'bg-yellow-500/40 border-yellow-500',
  },
  front_row: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
    selected: 'bg-amber-500/40 border-amber-500',
  },
  standard: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/50',
    text: 'text-purple-400',
    selected: 'bg-purple-500/40 border-purple-500',
  },
  regular: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    selected: 'bg-blue-500/40 border-blue-500',
  },
};

// Default tier colors for unknown tiers
const defaultTierColor = {
  bg: 'bg-gray-500/20',
  border: 'border-gray-500/50',
  text: 'text-gray-400',
  selected: 'bg-gray-500/40 border-gray-500',
};

export function VIPTableMap({
  tables,
  selectedTableId,
  onSelectTable,
  eventId,
  eventName,
}: VIPTableMapProps) {
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);

  if (tables.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No VIP tables available for this event</p>
        </CardContent>
      </Card>
    );
  }

  // Group tables by floor section
  const tablesBySection = tables.reduce((acc, table) => {
    const section = table.floor_section || 'General';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(table);
    return acc;
  }, {} as Record<string, VipTableWithAvailability[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">VIP Table Map</h3>
          <p className="text-muted-foreground">Select a table to reserve</p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/50" />
            <span>Premium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-purple-500/20 border border-purple-500/50" />
            <span>Standard</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/50" />
            <span>Regular</span>
          </div>
        </div>
      </div>

      {Object.entries(tablesBySection).map(([section, sectionTables]) => (
        <Card key={section}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {section}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sectionTables.map((table) => {
                const isSelected = selectedTableId === table.id;
                const isHovered = hoveredTableId === table.id;
                const tierColor = tierColors[table.tier] || defaultTierColor;

                return (
                  <TooltipProvider key={table.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onSelectTable(table)}
                          onMouseEnter={() => setHoveredTableId(table.id)}
                          onMouseLeave={() => setHoveredTableId(null)}
                          disabled={!table.is_available}
                          className={cn(
                            'relative p-4 rounded-lg border-2 transition-all',
                            'hover:scale-105 hover:shadow-lg',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            isSelected
                              ? tierColor.selected
                              : tierColor.bg + ' ' + tierColor.border,
                            isHovered && !isSelected && 'ring-2 ring-primary'
                          )}
                        >
                          {/* Availability Badge */}
                          <div className="absolute top-2 right-2">
                            {table.is_available ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                                <Check className="w-3 h-3 mr-1" />
                                Available
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <X className="w-3 h-3 mr-1" />
                                Reserved
                              </Badge>
                            )}
                          </div>

                          {/* Table Info */}
                          <div className="text-left space-y-2">
                            <div className="flex items-center gap-2">
                              <Crown className={cn('w-5 h-5', tierColor.text)} />
                              <span className="font-bold">{table.table_name}</span>
                            </div>
                            {table.table_number && (
                              <p className="text-xs text-muted-foreground">
                                Table #{table.table_number}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="w-4 h-4" />
                              <span>{table.guest_capacity} guests</span>
                            </div>
                            <div className="pt-2 border-t border-border/50">
                              <p className="text-lg font-bold text-primary">
                                ${table.price.toLocaleString()}
                              </p>
                            </div>
                            {table.position_description && (
                              <p className="text-xs text-muted-foreground italic">
                                {table.position_description}
                              </p>
                            )}
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-semibold">{table.table_name}</p>
                          <p className="text-sm">{table.bottle_service_description}</p>
                          <p className="text-xs text-muted-foreground">
                            Capacity: {table.guest_capacity} guests
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}




