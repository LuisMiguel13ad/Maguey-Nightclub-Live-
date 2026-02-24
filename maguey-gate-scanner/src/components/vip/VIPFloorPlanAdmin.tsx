/**
 * VIP Floor Plan Admin Component
 * Dashboard-sized grid floor plan for the owner portal.
 * Organized sections: Stage, Left Wing, Front Row, Standard Section, Right Wing + Bar Service.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, Wine, Sparkles, Speaker, MoveDown } from 'lucide-react';

const serifFont = { fontFamily: "'Times New Roman', Georgia, serif" };

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
  compact?: boolean;
}

// Tier styling
const TIER_STYLES = {
  premium: {
    base: 'bg-amber-950/30 border-amber-500/30',
    hover: 'hover:bg-amber-500/15 hover:border-amber-500/50',
    selected: 'bg-gradient-to-br from-amber-500 to-amber-600 border-amber-400 text-white shadow-lg shadow-amber-500/30',
    price: 'text-amber-400',
    priceSelected: 'text-white/90',
    glow: 'shadow-amber-500/20',
    badge: 'bg-amber-500',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
  },
  front_row: {
    base: 'bg-purple-950/30 border-purple-500/30',
    hover: 'hover:bg-purple-500/15 hover:border-purple-500/50',
    selected: 'bg-gradient-to-br from-purple-500 to-purple-600 border-purple-400 text-white shadow-lg shadow-purple-500/30',
    price: 'text-purple-400',
    priceSelected: 'text-white/90',
    glow: 'shadow-purple-500/20',
    badge: 'bg-purple-500',
    border: 'border-purple-500/50',
    text: 'text-purple-400',
  },
  standard: {
    base: 'bg-white/[0.02] border-white/10',
    hover: 'hover:bg-teal-300/10 hover:border-teal-300/30',
    selected: 'bg-teal-300 border-teal-300 text-zinc-950 shadow-lg shadow-teal-300/30',
    price: 'text-teal-300',
    priceSelected: 'text-zinc-950',
    glow: 'shadow-teal-300/20',
    badge: 'bg-teal-300',
    border: 'border-teal-300/50',
    text: 'text-teal-300',
  },
};

const TIER_LABELS = {
  premium: 'Premium',
  front_row: 'Front Row',
  standard: 'Standard',
};

// Default tables for fallback when no tables passed
const DEFAULT_TABLES: EventVIPTable[] = [
  { id: 'd1', event_id: '', table_template_id: '', table_number: 1, tier: 'premium', capacity: 8, price_cents: 75000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 1 },
  { id: 'd2', event_id: '', table_template_id: '', table_number: 2, tier: 'premium', capacity: 8, price_cents: 75000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 2 },
  { id: 'd3', event_id: '', table_template_id: '', table_number: 3, tier: 'premium', capacity: 8, price_cents: 75000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 3 },
  { id: 'd4', event_id: '', table_template_id: '', table_number: 4, tier: 'front_row', capacity: 6, price_cents: 70000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 4 },
  { id: 'd5', event_id: '', table_template_id: '', table_number: 5, tier: 'front_row', capacity: 6, price_cents: 70000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 5 },
  { id: 'd6', event_id: '', table_template_id: '', table_number: 6, tier: 'front_row', capacity: 6, price_cents: 70000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 6 },
  { id: 'd7', event_id: '', table_template_id: '', table_number: 7, tier: 'front_row', capacity: 6, price_cents: 70000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 7 },
  { id: 'd8', event_id: '', table_template_id: '', table_number: 8, tier: 'premium', capacity: 8, price_cents: 75000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 8 },
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `d${i + 9}`, event_id: '', table_template_id: '', table_number: i + 9, tier: 'standard' as const,
    capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0,
    package_description: null, is_available: true, display_order: i + 9,
  })),
];

// Table button — dashboard-sized
const AdminTableButton: React.FC<{
  table: EventVIPTable;
  isSelected: boolean;
  hasReservation: boolean;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}> = ({ table, isSelected, hasReservation, onClick, size = 'md', compact = false }) => {
  const styles = TIER_STYLES[table.tier] || TIER_STYLES.standard;
  const price = (table.price_cents / 100).toFixed(0);

  // Compact sizes for event editor, dashboard sizes for VIP Tables page
  const sizeStyles = compact
    ? { sm: 'w-full h-8', md: 'w-12 h-10', lg: 'w-full max-w-[56px] h-11' }
    : { sm: 'w-full h-12', md: 'w-16 h-14', lg: 'w-full max-w-[72px] h-16' };

  // Reserved state
  if (!table.is_available && hasReservation) {
    return (
      <button
        onClick={onClick}
        className={cn(
          sizeStyles[size],
          'bg-zinc-900/50 border border-zinc-700/30 flex flex-col items-center justify-center gap-0.5',
          'backdrop-blur-sm rounded-sm ring-2 ring-green-500/50',
          'hover:bg-zinc-800/50 transition-all duration-200'
        )}
        title={`Table ${table.table_number} - Reserved`}
      >
        <span className={cn("font-light text-zinc-400", compact ? "text-xs" : "text-sm")} style={serifFont}>
          {table.table_number}
        </span>
        <span className={cn("font-medium text-green-400 uppercase tracking-wider", compact ? "text-[5px]" : "text-[6px]")}>
          Reserved
        </span>
      </button>
    );
  }

  // Disabled state
  if (!table.is_available) {
    return (
      <div
        className={cn(
          sizeStyles[size],
          'bg-zinc-900/50 border border-zinc-700/30 flex flex-col items-center justify-center gap-0.5 cursor-not-allowed opacity-50 backdrop-blur-sm rounded-sm'
        )}
        title={`Table ${table.table_number} - Disabled`}
      >
        <span className={cn("font-light text-zinc-500", compact ? "text-xs" : "text-sm")} style={serifFont}>
          {table.table_number}
        </span>
        <span className={cn("font-medium text-zinc-600 uppercase tracking-wider", compact ? "text-[5px]" : "text-[6px]")}>
          Disabled
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label={`Table ${table.table_number}, ${table.tier}, $${price}, ${table.capacity} guests`}
      className={cn(
        sizeStyles[size],
        'border flex flex-col items-center justify-center gap-0.5 relative overflow-hidden transition-all duration-200 backdrop-blur-sm rounded-sm',
        isSelected
          ? cn(styles.selected, 'scale-[0.97]')
          : cn(styles.base, styles.hover, 'hover:-translate-y-0.5 hover:shadow-md', styles.glow)
      )}
    >
      <div className={cn(
        'absolute inset-0 transition-opacity',
        !isSelected && 'bg-gradient-to-b from-white/5 to-transparent'
      )} />
      <span className={cn(
        'font-light relative z-10 tracking-tight',
        compact
          ? (size === 'sm' ? 'text-xs' : 'text-sm')
          : (size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base')
      )} style={serifFont}>
        {table.table_number}
      </span>
      <span className={cn(
        'font-medium relative z-10 tracking-wide',
        compact ? 'text-[6px]' : 'text-[7px]',
        isSelected ? styles.priceSelected : styles.price
      )}>
        ${price}
      </span>
    </button>
  );
};

export function VIPFloorPlanAdmin({
  tables,
  reservations = [],
  selectedTableId,
  onSelectTable,
  readOnly = false,
  compact = false,
}: VIPFloorPlanAdminProps) {
  const effectiveTables = tables.length > 0 ? tables : DEFAULT_TABLES;

  const hasActiveReservation = (tableNumber: number) => {
    return reservations.some(
      r => r.table_number === tableNumber &&
           ['pending', 'confirmed', 'checked_in'].includes(r.status)
    );
  };

  // Group tables by section
  const leftWingTables = effectiveTables.filter(t => [1, 2, 3].includes(t.table_number));
  const frontRowTables = effectiveTables.filter(t => [4, 5, 6, 7].includes(t.table_number));
  const rightWingTable = effectiveTables.find(t => t.table_number === 8);
  const standardRow1 = effectiveTables.filter(t => [9, 10, 11, 12, 13, 14].includes(t.table_number));
  const standardRow2 = effectiveTables.filter(t => [15, 16, 17, 18, 19, 20].includes(t.table_number));

  // Stats
  const totalTables = effectiveTables.length;
  const availableTables = effectiveTables.filter(t => t.is_available && !hasActiveReservation(t.table_number)).length;
  const reservedCount = reservations.filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status)).length;
  const disabledTables = effectiveTables.filter(t => !t.is_available).length;

  const handleSelect = (table: EventVIPTable) => {
    if (!readOnly) onSelectTable(table);
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-1.5")}>
      {/* Stats bar — only in compact mode (VIPSetupManager). Dashboard shows stats in toolbar. */}
      {compact && (
        <div className="flex flex-wrap items-center justify-between bg-zinc-900/50 rounded-lg border border-zinc-800 p-1.5 gap-2">
          <div className="flex text-xs gap-2">
            <span className="text-zinc-400">
              <strong className="text-emerald-400">{availableTables}</strong> available
            </span>
            <span className="text-zinc-400">
              <strong className="text-green-400">{reservedCount}</strong> reserved
            </span>
            {disabledTables > 0 && (
              <span className="text-zinc-400">
                <strong className="text-zinc-500">{disabledTables}</strong> disabled
              </span>
            )}
            <span className="text-zinc-400">
              <strong className="text-white">{totalTables}</strong> total
            </span>
          </div>
        </div>
      )}

      {/* Floor plan container */}
      <div className={cn(
        "bg-zinc-950 rounded-xl border border-emerald-900/30 overflow-hidden",
        compact ? "p-2" : "px-4 py-4"
      )}>

        {/* MAGUEY STAGE — compact dashboard size */}
        <div className={cn("relative text-center z-10 flex justify-center", compact ? "mb-2" : "mb-4")}>
          <div className="inline-block relative">
            <div className={cn(
              "bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-t-2xl flex flex-col items-center justify-end relative overflow-hidden",
              compact ? "w-36 h-12 pb-1.5" : "w-56 h-20 pb-3"
            )}>
              {/* Stage lights */}
              <div className="absolute top-0 left-1/4 w-3 h-24 bg-teal-300/10 rotate-12 blur-md" />
              <div className="absolute top-0 right-1/4 w-3 h-24 bg-teal-300/10 -rotate-12 blur-md" />

              <div className={cn("z-10 flex flex-col items-center justify-center h-full", compact ? "gap-0.5" : "gap-1")}>
                <Sparkles className={cn("text-teal-300/60", compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
                <h2
                  className={cn(
                    "font-light text-stone-200 tracking-[0.15em] uppercase",
                    compact ? "text-[8px]" : "text-xs"
                  )}
                  style={{ ...serifFont, textShadow: '0 0 15px rgba(94, 234, 212, 0.3)' }}
                >
                  MAGUEY STAGE
                </h2>
              </div>

              <Speaker className={cn("absolute text-stone-700", compact ? "bottom-1.5 left-3 w-2 h-2" : "bottom-2.5 left-4 w-3 h-3")} />
              <Speaker className={cn("absolute text-stone-700", compact ? "bottom-1.5 right-3 w-2 h-2" : "bottom-2.5 right-4 w-3 h-3")} />
            </div>
            {/* Reflection */}
            <div className="w-full h-2 bg-gradient-to-b from-teal-300/10 to-transparent absolute top-full left-0 blur-sm" />
          </div>
        </div>

        {/* LEGEND */}
        <div className={cn(
          "flex flex-wrap justify-center relative z-10",
          compact ? "gap-1.5 mb-2" : "gap-2 mb-4"
        )}>
          <div className={cn("flex items-center gap-1.5 bg-white/5 rounded-full border border-white/10", compact ? "px-1.5 py-0.5" : "px-2 py-1")}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
            <span className={cn("font-medium text-stone-400 uppercase tracking-wider", compact ? "text-[6px]" : "text-[8px]")}>Premium</span>
          </div>
          <div className={cn("flex items-center gap-1.5 bg-white/5 rounded-full border border-white/10", compact ? "px-1.5 py-0.5" : "px-2 py-1")}>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_4px_rgba(168,85,247,0.5)]" />
            <span className={cn("font-medium text-stone-400 uppercase tracking-wider", compact ? "text-[6px]" : "text-[8px]")}>Front Row</span>
          </div>
          <div className={cn("flex items-center gap-1.5 bg-white/5 rounded-full border border-white/10", compact ? "px-1.5 py-0.5" : "px-2 py-1")}>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-300 shadow-[0_0_4px_rgba(94,234,212,0.5)]" />
            <span className={cn("font-medium text-stone-400 uppercase tracking-wider", compact ? "text-[6px]" : "text-[8px]")}>Standard</span>
          </div>
          <div className={cn("flex items-center gap-1.5 bg-rose-950/30 rounded-full border border-rose-800/20", compact ? "px-1.5 py-0.5" : "px-2 py-1")}>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
            <span className={cn("font-medium text-rose-400/80 uppercase tracking-wider", compact ? "text-[6px]" : "text-[8px]")}>Reserved</span>
          </div>
        </div>

        {/* GRID LAYOUT */}
        <div className={cn(
          "grid grid-cols-1 lg:grid-cols-12 relative z-10 items-start",
          compact ? "gap-1.5 px-0.5" : "gap-3 px-1"
        )}>

          {/* LEFT WING (cols 1-2): Tables 1, 2, 3 */}
          <div className={cn("lg:col-span-2 flex flex-row lg:flex-col justify-center lg:items-end", compact ? "gap-1" : "gap-2")}>
            {leftWingTables.map((table) => (
              <AdminTableButton
                key={table.id}
                table={table}
                isSelected={selectedTableId === table.id}
                hasReservation={hasActiveReservation(table.table_number)}
                onClick={() => handleSelect(table)}
                size="md"
                compact={compact}
              />
            ))}
          </div>

          {/* CENTER FLOOR (cols 3-10) */}
          <div className={cn("lg:col-span-8 flex flex-col order-3 lg:order-2", compact ? "gap-1.5 lg:mt-4" : "gap-3 lg:mt-10")}>

            {/* Front Row */}
            <div className={cn("grid grid-cols-2 sm:grid-cols-4 justify-items-center", compact ? "gap-1" : "gap-2")}>
              {frontRowTables.map((table) => (
                <AdminTableButton
                  key={table.id}
                  table={table}
                  isSelected={selectedTableId === table.id}
                  hasReservation={hasActiveReservation(table.table_number)}
                  onClick={() => handleSelect(table)}
                  size="lg"
                  compact={compact}
                />
              ))}
            </div>

            {/* Standard Section Wrapper */}
            <div className={cn(
              "bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-sm flex flex-col",
              compact ? "p-1.5 gap-1" : "p-3 gap-2"
            )}>
              <p className={cn(
                "text-teal-300/60 uppercase tracking-[0.15em] text-center",
                compact ? "text-[6px]" : "text-[8px]"
              )}>Standard Section</p>

              {/* Row 1: Tables 9-14 */}
              <div className={cn("grid grid-cols-3 sm:grid-cols-6", compact ? "gap-0.5" : "gap-1.5")}>
                {standardRow1.map((table) => (
                  <AdminTableButton
                    key={table.id}
                    table={table}
                    isSelected={selectedTableId === table.id}
                    hasReservation={hasActiveReservation(table.table_number)}
                    onClick={() => handleSelect(table)}
                    size="sm"
                    compact={compact}
                  />
                ))}
              </div>

              {/* Row 2: Tables 15-20 */}
              <div className={cn("grid grid-cols-3 sm:grid-cols-6", compact ? "gap-0.5" : "gap-1.5")}>
                {standardRow2.map((table) => (
                  <AdminTableButton
                    key={table.id}
                    table={table}
                    isSelected={selectedTableId === table.id}
                    hasReservation={hasActiveReservation(table.table_number)}
                    onClick={() => handleSelect(table)}
                    size="sm"
                    compact={compact}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT WING (cols 11-12): Table 8 + Bar Service */}
          <div className={cn("lg:col-span-2 flex flex-row lg:flex-col justify-center lg:items-start order-2 lg:order-3", compact ? "gap-1" : "gap-2")}>
            {rightWingTable && (
              <AdminTableButton
                table={rightWingTable}
                isSelected={selectedTableId === rightWingTable.id}
                hasReservation={hasActiveReservation(rightWingTable.table_number)}
                onClick={() => handleSelect(rightWingTable)}
                size="md"
                compact={compact}
              />
            )}

            {/* Bar Service */}
            {!compact && (
              <div className="hidden lg:flex w-16 h-28 bg-white/[0.02] backdrop-blur-sm rounded-sm items-center justify-center border border-dashed border-white/10">
                <span className="text-[7px] font-medium tracking-[0.2em] text-teal-300/50 uppercase [writing-mode:vertical-rl] rotate-180">Bar Service</span>
              </div>
            )}
          </div>
        </div>

        {/* Entrance */}
        {!compact && (
          <div className="mt-5 flex justify-center">
            <div className="flex items-center gap-2 text-teal-300/40">
              <MoveDown className="w-3 h-3" />
              <span className="text-[8px] uppercase tracking-[0.15em] font-medium">Entrance</span>
              <MoveDown className="w-3 h-3" />
            </div>
          </div>
        )}
      </div>

      {/* Click hint */}
      {!readOnly && (
        <p className={cn("text-center text-zinc-500", compact ? "text-[7px]" : "text-[10px]")}>
          Click on a table to view details or edit
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

  const styles = TIER_STYLES[table.tier] || TIER_STYLES.standard;

  return (
    <div className={cn(
      'p-3 rounded-lg border bg-zinc-900/50',
      styles.border,
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', styles.badge)}>
            <span className="text-white font-bold text-sm">{table.table_number}</span>
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm">Table {table.table_number}</h4>
            <div className="flex items-center gap-1.5 text-xs">
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', styles.text, styles.border)}>
                {TIER_LABELS[table.tier]}
              </Badge>
              {hasReservation && (
                <Badge className="bg-green-500 hover:bg-green-500 text-[10px] px-1.5 py-0">Reserved</Badge>
              )}
              {!table.is_available && !hasReservation && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Disabled</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1 text-zinc-300">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-bold text-base">${(table.price_cents / 100).toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-300">
            <Users className="w-3.5 h-3.5 text-zinc-500" />
            <span>{table.capacity}</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-300">
            <Wine className="w-3.5 h-3.5 text-zinc-500" />
            <span>{table.bottles_included}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VIPFloorPlanAdmin;
