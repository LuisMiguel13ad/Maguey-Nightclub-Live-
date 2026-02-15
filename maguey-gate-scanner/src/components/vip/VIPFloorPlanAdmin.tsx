/**
 * VIP Floor Plan Admin Component
 * Visual floor plan for managing VIP tables - drag-and-drop positioning
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, Wine } from 'lucide-react';
import { DndContext, DragEndEvent, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Types matching the database schema
export interface EventVIPTable {
  id: string;
  event_id: string;
  table_template_id: string;
  table_number: number;
  tier: 'premium' | 'front_row' | 'standard';
  capacity: number;
  price_cents: number;
  bottles_included: number;
  champagne_included: number;
  package_description: string | null;
  is_available: boolean;
  display_order: number;
  position_x?: number | null;
  position_y?: number | null;
}

export interface VIPReservation {
  id: string;
  table_number: number;
  purchaser_name: string;
  status: string;
}

interface VIPFloorPlanAdminProps {
  tables: EventVIPTable[];
  reservations?: VIPReservation[];
  selectedTableId?: string;
  onSelectTable: (table: EventVIPTable) => void;
  onUpdatePosition?: (tableId: string, x: number, y: number) => Promise<void>;
  readOnly?: boolean;
  compact?: boolean; // Use compact layout for event editor, full size for VIP Tables page
}

// Tier colors matching the customer-facing design
const TIER_COLORS = {
  premium: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
    selected: 'bg-amber-500 border-amber-400 ring-2 ring-amber-400/50',
    badge: 'bg-amber-500',
    glow: 'shadow-amber-500/30',
  },
  front_row: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/50',
    text: 'text-purple-400',
    selected: 'bg-purple-500 border-purple-400 ring-2 ring-purple-400/50',
    badge: 'bg-purple-500',
    glow: 'shadow-purple-500/30',
  },
  standard: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    selected: 'bg-blue-500 border-blue-400 ring-2 ring-blue-400/50',
    badge: 'bg-blue-500',
    glow: 'shadow-blue-500/30',
  },
};

const TIER_LABELS = {
  premium: 'Premium',
  front_row: 'Front Row',
  standard: 'Standard',
};

// Individual table button for admin - supports compact and full size modes
const AdminTableButton: React.FC<{
  table: EventVIPTable;
  isSelected: boolean;
  hasReservation: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  size?: 'sm' | 'md' | 'lg';
  isAbsolute?: boolean;
  readOnly?: boolean;
  compact?: boolean;
}> = ({ table, isSelected, hasReservation, onClick, style, size = 'md', isAbsolute = true, readOnly = false, compact = false }) => {
  const tierColor = TIER_COLORS[table.tier] || TIER_COLORS.standard;

  // Size classes - compact for event editor, full for VIP Tables page
  const sizeClasses = compact ? {
    sm: 'w-9 h-9',
    md: 'w-10 h-10',
    lg: 'w-10 h-10',
  } : {
    sm: 'w-12 h-12 sm:w-14 sm:h-14',
    md: 'w-14 h-14 sm:w-16 sm:h-16',
    lg: 'w-14 h-14 sm:w-16 sm:h-16',
  };

  return (
    <button
      onClick={onClick}
      disabled={readOnly}
      style={style}
      aria-label={`Table ${table.table_number}, ${table.tier}, $${table.price_cents / 100}, ${table.capacity} guests`}
      className={cn(
        'rounded-xl border-2 transition-all duration-200',
        'flex flex-col items-center justify-center gap-0.5',
        'hover:scale-105 hover:z-10 hover:shadow-xl',
        'disabled:hover:scale-100',
        isAbsolute && 'absolute',
        sizeClasses[size],
        tierColor.border,
        tierColor.bg,
        isSelected && `${tierColor.selected} text-white shadow-lg`,
        !table.is_available && !hasReservation && 'opacity-40 bg-zinc-900 border-zinc-700',
        hasReservation && 'ring-2 ring-green-500 ring-offset-1 ring-offset-zinc-900'
      )}
    >
      {/* Table number */}
      <span className={cn(
        compact ? 'text-xs font-bold leading-none' : 'text-base sm:text-lg font-bold',
        isSelected ? 'text-white' : 'text-white'
      )}>
        {table.table_number}
      </span>

      {/* Price */}
      <span className={cn(
        compact ? 'text-[8px] font-semibold leading-none' : 'text-[10px] sm:text-xs font-bold',
        isSelected ? 'text-white/90' : tierColor.text
      )}>
        ${(table.price_cents / 100).toFixed(0)}
      </span>
    </button>
  );
};

// Draggable table wrapper
function DraggableTable({ table, position, isSelected, hasReservation, onSelect, readOnly, compact }: {
  table: EventVIPTable;
  position: { x: number; y: number };
  isSelected: boolean;
  hasReservation: boolean;
  onSelect: () => void;
  readOnly?: boolean;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: table.id,
    data: { table, position },
    disabled: readOnly,
  });

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${(position.x / 1000) * 100}%`,
    top: `${(position.y / 700) * 100}%`,
    transform: CSS.Translate.toString(transform),
    touchAction: 'none',
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
    cursor: readOnly ? 'pointer' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <AdminTableButton
        table={table}
        isSelected={isSelected}
        hasReservation={hasReservation}
        onClick={onSelect}
        isAbsolute={false}
        readOnly={false}
        compact={compact}
      />
    </div>
  );
}

// Default tables matching the customer-facing layout
const DEFAULT_TABLES: EventVIPTable[] = [
  // Premium tables (1, 2, 3, 8) - $750
  { id: 'd1', event_id: '', table_template_id: '', table_number: 1, tier: 'premium', capacity: 6, price_cents: 75000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 1, position_x: 50, position_y: 100 },
  { id: 'd2', event_id: '', table_template_id: '', table_number: 2, tier: 'premium', capacity: 6, price_cents: 75000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 2, position_x: 50, position_y: 250 },
  { id: 'd3', event_id: '', table_template_id: '', table_number: 3, tier: 'premium', capacity: 6, price_cents: 75000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 3, position_x: 50, position_y: 400 },
  { id: 'd8', event_id: '', table_template_id: '', table_number: 8, tier: 'premium', capacity: 6, price_cents: 75000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 8, position_x: 900, position_y: 100 },
  // Front Row tables (4, 5, 6, 7) - $700
  { id: 'd4', event_id: '', table_template_id: '', table_number: 4, tier: 'front_row', capacity: 6, price_cents: 70000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 4, position_x: 250, position_y: 100 },
  { id: 'd5', event_id: '', table_template_id: '', table_number: 5, tier: 'front_row', capacity: 6, price_cents: 70000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 5, position_x: 400, position_y: 100 },
  { id: 'd6', event_id: '', table_template_id: '', table_number: 6, tier: 'front_row', capacity: 6, price_cents: 70000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 6, position_x: 550, position_y: 100 },
  { id: 'd7', event_id: '', table_template_id: '', table_number: 7, tier: 'front_row', capacity: 6, price_cents: 70000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 7, position_x: 700, position_y: 100 },
  // Standard tables (9-20) - $600
  { id: 'd9', event_id: '', table_template_id: '', table_number: 9, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 9, position_x: 200, position_y: 350 },
  { id: 'd10', event_id: '', table_template_id: '', table_number: 10, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 10, position_x: 350, position_y: 350 },
  { id: 'd11', event_id: '', table_template_id: '', table_number: 11, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 11, position_x: 500, position_y: 350 },
  { id: 'd12', event_id: '', table_template_id: '', table_number: 12, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 12, position_x: 650, position_y: 350 },
  { id: 'd13', event_id: '', table_template_id: '', table_number: 13, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 13, position_x: 800, position_y: 350 },
  { id: 'd14', event_id: '', table_template_id: '', table_number: 14, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 14, position_x: 950, position_y: 350 },
  { id: 'd15', event_id: '', table_template_id: '', table_number: 15, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 15, position_x: 200, position_y: 500 },
  { id: 'd16', event_id: '', table_template_id: '', table_number: 16, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 16, position_x: 350, position_y: 500 },
  { id: 'd17', event_id: '', table_template_id: '', table_number: 17, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 17, position_x: 500, position_y: 500 },
  { id: 'd18', event_id: '', table_template_id: '', table_number: 18, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 18, position_x: 650, position_y: 500 },
  { id: 'd19', event_id: '', table_template_id: '', table_number: 19, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 19, position_x: 800, position_y: 500 },
  { id: 'd20', event_id: '', table_template_id: '', table_number: 20, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 20, position_x: 950, position_y: 500 },
];

export function VIPFloorPlanAdmin({
  tables,
  reservations = [],
  selectedTableId,
  onSelectTable,
  onUpdatePosition,
  readOnly = false,
  compact = false,
}: VIPFloorPlanAdminProps) {
  // Use provided tables or default to show full layout
  const effectiveTables = tables.length > 0 ? tables : DEFAULT_TABLES;

  // Position state
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(
    new Map(effectiveTables.map(t => [
      t.id,
      { x: t.position_x ?? 0, y: t.position_y ?? 0 }
    ]))
  );

  // Sync positions when tables prop changes
  useEffect(() => {
    setPositions(new Map(effectiveTables.map(t => [
      t.id,
      { x: t.position_x ?? 0, y: t.position_y ?? 0 }
    ])));
  }, [effectiveTables]);

  // Check if a table has an active reservation
  const hasActiveReservation = (tableNumber: number) => {
    return reservations.some(
      r => r.table_number === tableNumber &&
           ['pending', 'confirmed', 'checked_in'].includes(r.status)
    );
  };

  // Drag handler
  const handleDragEnd = async (event: DragEndEvent) => {
    if (!onUpdatePosition) return;
    const { active, delta } = event;
    const tableId = active.id as string;
    const currentPos = positions.get(tableId);
    if (!currentPos) return;

    // Convert pixel delta to logical units (container is 100% wide, mapped to 1000 units)
    const container = document.querySelector('[data-floor-plan]') as HTMLElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const deltaX = (delta.x / rect.width) * 1000;
    const deltaY = (delta.y / rect.height) * 700;

    const newX = Math.max(0, Math.min(950, currentPos.x + deltaX));
    const newY = Math.max(0, Math.min(650, currentPos.y + deltaY));

    // Optimistic update
    setPositions(prev => new Map(prev).set(tableId, { x: newX, y: newY }));

    try {
      await onUpdatePosition(tableId, newX, newY);
    } catch {
      // Rollback on error
      setPositions(prev => new Map(prev).set(tableId, currentPos));
    }
  };

  // Stats
  const totalTables = effectiveTables.length;
  const availableTables = effectiveTables.filter(t => t.is_available && !hasActiveReservation(t.table_number)).length;
  const reservedTables = reservations.filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status)).length;
  const disabledTables = effectiveTables.filter(t => !t.is_available).length;

  return (
    <div className="space-y-4">
      {/* Legend and Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
        <div className="flex flex-wrap gap-4">
          {(['premium', 'front_row', 'standard'] as const).map((tier) => (
            <div key={tier} className="flex items-center gap-2">
              <span className={cn('w-3 h-3 rounded-full', TIER_COLORS[tier].badge)} />
              <span className="text-xs font-medium text-zinc-400">{TIER_LABELS[tier]}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full ring-2 ring-green-500 bg-transparent" />
            <span className="text-xs font-medium text-zinc-400">Reserved</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-zinc-700" />
            <span className="text-xs font-medium text-zinc-400">Disabled</span>
          </div>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="text-zinc-400">
            <strong className="text-emerald-400">{availableTables}</strong> available
          </span>
          <span className="text-zinc-400">
            <strong className="text-green-400">{reservedTables}</strong> reserved
          </span>
          <span className="text-zinc-400">
            <strong className="text-zinc-500">{disabledTables}</strong> disabled
          </span>
          <span className="text-zinc-400">
            <strong className="text-white">{totalTables}</strong> total
          </span>
        </div>
      </div>

      {/* Floor plan container with drag-and-drop */}
      <DndContext onDragEnd={handleDragEnd}>
        <div className={cn(
          "relative bg-zinc-950 rounded-xl border border-emerald-900/50 overflow-hidden",
          compact ? "h-[400px]" : "h-[600px] sm:h-[700px]"
        )} data-floor-plan>
          {/* Stage indicator at top center */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            <div className={cn(
              "bg-gradient-to-b from-emerald-950 to-zinc-950 border border-emerald-800/50 rounded-t-xl px-4 py-1.5",
              compact ? "w-24" : "w-36"
            )}>
              <h3 className={cn("text-white text-center font-bold tracking-[0.2em] uppercase", compact ? "text-[8px]" : "text-xs")}>Stage</h3>
            </div>
          </div>

          {/* All tables as draggable items */}
          {effectiveTables.map(table => {
            const pos = positions.get(table.id) || { x: 0, y: 0 };
            return (
              <DraggableTable
                key={table.id}
                table={table}
                position={pos}
                isSelected={selectedTableId === table.id}
                hasReservation={hasActiveReservation(table.table_number)}
                onSelect={() => onSelectTable(table)}
                readOnly={readOnly}
                compact={compact}
              />
            );
          })}
        </div>
      </DndContext>

      {/* Click hint */}
      {!readOnly && (
        <p className={cn("text-center text-zinc-500", compact ? "text-[8px]" : "text-xs")}>
          {onUpdatePosition ? 'Drag tables to reposition. Click to edit.' : 'Click on a table to edit'}
        </p>
      )}

      {/* Selected table quick info */}
      {selectedTableId && (
        <SelectedTableInfo
          table={effectiveTables.find(t => t.id === selectedTableId)}
          hasReservation={effectiveTables.find(t => t.id === selectedTableId) ?
            hasActiveReservation(effectiveTables.find(t => t.id === selectedTableId)!.table_number) : false}
        />
      )}
    </div>
  );
}

// Quick info panel for selected table
function SelectedTableInfo({ table, hasReservation }: { table?: EventVIPTable; hasReservation: boolean }) {
  if (!table) return null;

  const tierColor = TIER_COLORS[table.tier] || TIER_COLORS.standard;

  return (
    <div className={cn(
      'p-4 rounded-xl border-2 bg-zinc-900/50',
      tierColor.border,
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', tierColor.badge)}>
            <span className="text-white font-bold text-lg">{table.table_number}</span>
          </div>
          <div>
            <h4 className="font-semibold text-white">Table {table.table_number}</h4>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className={cn('text-xs', tierColor.text, tierColor.border)}>
                {TIER_LABELS[table.tier]}
              </Badge>
              {hasReservation && (
                <Badge className="bg-green-500 hover:bg-green-500 text-xs">Reserved</Badge>
              )}
              {!table.is_available && !hasReservation && (
                <Badge variant="destructive" className="text-xs">Disabled</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-lg">${(table.price_cents / 100).toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Users className="w-4 h-4 text-zinc-500" />
            <span>{table.capacity} guests</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Wine className="w-4 h-4 text-zinc-500" />
            <span>{table.bottles_included} bottle{table.bottles_included !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VIPFloorPlanAdmin;
