/**
 * VIP Floor Plan Admin Component
 * Visual floor plan for managing VIP tables - matches the customer-facing design
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Check, X, DollarSign, Users, Wine, Settings, Crown } from 'lucide-react';

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

// Default tables matching the customer-facing layout
const DEFAULT_TABLES: EventVIPTable[] = [
  // Premium tables (1, 2, 3, 8) - $750
  { id: 'd1', event_id: '', table_template_id: '', table_number: 1, tier: 'premium', capacity: 6, price_cents: 75000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 1 },
  { id: 'd2', event_id: '', table_template_id: '', table_number: 2, tier: 'premium', capacity: 6, price_cents: 75000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 2 },
  { id: 'd3', event_id: '', table_template_id: '', table_number: 3, tier: 'premium', capacity: 6, price_cents: 75000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 3 },
  { id: 'd8', event_id: '', table_template_id: '', table_number: 8, tier: 'premium', capacity: 6, price_cents: 75000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 8 },
  // Front Row tables (4, 5, 6, 7) - $700
  { id: 'd4', event_id: '', table_template_id: '', table_number: 4, tier: 'front_row', capacity: 6, price_cents: 70000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 4 },
  { id: 'd5', event_id: '', table_template_id: '', table_number: 5, tier: 'front_row', capacity: 6, price_cents: 70000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 5 },
  { id: 'd6', event_id: '', table_template_id: '', table_number: 6, tier: 'front_row', capacity: 6, price_cents: 70000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 6 },
  { id: 'd7', event_id: '', table_template_id: '', table_number: 7, tier: 'front_row', capacity: 6, price_cents: 70000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 7 },
  // Standard tables (9-20) - $600
  { id: 'd9', event_id: '', table_template_id: '', table_number: 9, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 9 },
  { id: 'd10', event_id: '', table_template_id: '', table_number: 10, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 10 },
  { id: 'd11', event_id: '', table_template_id: '', table_number: 11, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 11 },
  { id: 'd12', event_id: '', table_template_id: '', table_number: 12, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 12 },
  { id: 'd13', event_id: '', table_template_id: '', table_number: 13, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 13 },
  { id: 'd14', event_id: '', table_template_id: '', table_number: 14, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 14 },
  { id: 'd15', event_id: '', table_template_id: '', table_number: 15, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 15 },
  { id: 'd16', event_id: '', table_template_id: '', table_number: 16, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 16 },
  { id: 'd17', event_id: '', table_template_id: '', table_number: 17, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 17 },
  { id: 'd18', event_id: '', table_template_id: '', table_number: 18, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 18 },
  { id: 'd19', event_id: '', table_template_id: '', table_number: 19, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 19 },
  { id: 'd20', event_id: '', table_template_id: '', table_number: 20, tier: 'standard', capacity: 6, price_cents: 60000, bottles_included: 1, champagne_included: 0, package_description: null, is_available: true, display_order: 20 },
];

export function VIPFloorPlanAdmin({
  tables,
  reservations = [],
  selectedTableId,
  onSelectTable,
  readOnly = false,
  compact = false,
}: VIPFloorPlanAdminProps) {
  // Use provided tables or default to show full layout
  const effectiveTables = tables.length > 0 ? tables : DEFAULT_TABLES;
  
  // Create a map for quick lookup
  const tableMap = new Map(effectiveTables.map(t => [t.table_number.toString(), t]));
  
  // Check if a table has an active reservation
  const hasActiveReservation = (tableNumber: number) => {
    return reservations.some(
      r => r.table_number === tableNumber && 
           ['pending', 'confirmed', 'checked_in'].includes(r.status)
    );
  };

  // Helper to get table by number
  const getTable = (num: string) => tableMap.get(num);

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

      {/* Floor plan container */}
      <div className="relative bg-zinc-950 rounded-xl border border-emerald-900/50 overflow-hidden">
        <div className={cn("relative", compact ? "p-3" : "p-6 sm:p-8")}>
          
          {/* STAGE */}
          <div className={cn("flex justify-center", compact ? "mb-3" : "mb-6")}>
            <div className={cn(
              "bg-gradient-to-b from-emerald-950 to-zinc-950 border border-emerald-800/50 rounded-t-xl",
              compact ? "w-32 px-3 py-1.5" : "w-48 sm:w-64 px-6 py-3"
            )}>
              <div className={cn(
                "mx-auto border border-emerald-500/50 rounded-full flex items-center justify-center",
                compact ? "w-4 h-4 mb-1" : "w-8 h-8 mb-2"
              )}>
                <div className={cn("bg-emerald-500 rounded-full animate-pulse", compact ? "w-1.5 h-1.5" : "w-3 h-3")} />
              </div>
              <h3 className={cn(
                "text-white text-center font-bold tracking-[0.2em] uppercase",
                compact ? "text-[10px]" : "text-sm sm:text-lg"
              )}>
                Stage
              </h3>
            </div>
          </div>

          {/* Main floor layout */}
          <div className={cn("flex items-start justify-center", compact ? "gap-2" : "gap-4 sm:gap-6")}>
            {/* Left Wing - Tables 1, 2, 3 */}
            <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2 sm:gap-3")}>
              {['1', '2', '3'].map((num) => {
                const table = getTable(num);
                if (!table) return <div key={num} className={compact ? "w-10 h-10" : "w-14 h-14 sm:w-16 sm:h-16"} />;
                return (
                  <AdminTableButton
                    key={num}
                    table={table}
                    isSelected={selectedTableId === table.id}
                    hasReservation={hasActiveReservation(parseInt(num))}
                    onClick={() => onSelectTable(table)}
                    size="lg"
                    isAbsolute={false}
                    readOnly={readOnly}
                    compact={compact}
                  />
                );
              })}
            </div>

            {/* Center */}
            <div className={cn("flex flex-col", compact ? "gap-2" : "gap-4 sm:gap-5")}>
              {/* Front Row (4-7) */}
              <div className={cn("flex justify-center", compact ? "gap-1" : "gap-2 sm:gap-3")}>
                {['4', '5', '6', '7'].map((num) => {
                  const table = getTable(num);
                  if (!table) return <div key={num} className={compact ? "w-10 h-10" : "w-14 h-14 sm:w-16 sm:h-16"} />;
                  return (
                    <AdminTableButton
                      key={num}
                      table={table}
                      isSelected={selectedTableId === table.id}
                      hasReservation={hasActiveReservation(parseInt(num))}
                      onClick={() => onSelectTable(table)}
                      size="md"
                      isAbsolute={false}
                      readOnly={readOnly}
                      compact={compact}
                    />
                  );
                })}
              </div>

              {/* Standard Tables (9-20) */}
              <div className={cn(
                "bg-zinc-900/40 border border-zinc-800/50 rounded-lg",
                compact ? "p-1.5" : "p-3 sm:p-4"
              )}>
                <div className={cn("flex justify-center", compact ? "gap-1 mb-1" : "gap-2 sm:gap-3 mb-2 sm:mb-3")}>
                  {['9', '10', '11', '12', '13', '14'].map((num) => {
                    const table = getTable(num);
                    if (!table) return <div key={num} className={compact ? "w-9 h-9" : "w-12 h-12 sm:w-14 sm:h-14"} />;
                    return (
                      <AdminTableButton
                        key={num}
                        table={table}
                        isSelected={selectedTableId === table.id}
                        hasReservation={hasActiveReservation(parseInt(num))}
                        onClick={() => onSelectTable(table)}
                        size="sm"
                        isAbsolute={false}
                        readOnly={readOnly}
                        compact={compact}
                      />
                    );
                  })}
                </div>
                <div className={cn("flex justify-center", compact ? "gap-1" : "gap-2 sm:gap-3")}>
                  {['15', '16', '17', '18', '19', '20'].map((num) => {
                    const table = getTable(num);
                    if (!table) return <div key={num} className={compact ? "w-9 h-9" : "w-12 h-12 sm:w-14 sm:h-14"} />;
                    return (
                      <AdminTableButton
                        key={num}
                        table={table}
                        isSelected={selectedTableId === table.id}
                        hasReservation={hasActiveReservation(parseInt(num))}
                        onClick={() => onSelectTable(table)}
                        size="sm"
                        isAbsolute={false}
                        readOnly={readOnly}
                        compact={compact}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Wing - Table 8 + Bar */}
            <div className={cn("flex flex-col items-center", compact ? "gap-1" : "gap-2 sm:gap-3")}>
              {getTable('8') && (
                <AdminTableButton
                  table={getTable('8')!}
                  isSelected={selectedTableId === getTable('8')!.id}
                  hasReservation={hasActiveReservation(8)}
                  onClick={() => onSelectTable(getTable('8')!)}
                  size="lg"
                  isAbsolute={false}
                  readOnly={readOnly}
                  compact={compact}
                />
              )}
              <div className={cn(
                "bg-zinc-900/30 border border-dashed border-zinc-700 rounded-lg flex items-center justify-center",
                compact ? "w-10 h-16" : "w-14 h-24 sm:w-16 sm:h-28"
              )}>
                <span 
                  className={cn("font-bold text-zinc-600 uppercase", compact ? "text-[6px]" : "text-[8px] sm:text-[10px]")}
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  Bar Service
                </span>
              </div>
            </div>
          </div>

          {/* Click hint */}
          {!readOnly && (
            <p className={cn("text-center text-zinc-500", compact ? "text-[8px] mt-2" : "text-xs mt-4")}>
              Click on a table to edit
            </p>
          )}
        </div>
      </div>

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

