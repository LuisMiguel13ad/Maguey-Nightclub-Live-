import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Check, X, DollarSign, Users, Wine } from 'lucide-react';

// Types matching the VIPTableManager
interface EventVIPTable {
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

interface VIPReservation {
  id: string;
  table_number: number;
  purchaser_name: string;
  purchaser_email: string;
  amount_paid_cents: number;
  status: string;
  created_at: string;
}

interface AdminVIPFloorPlanProps {
  tables: EventVIPTable[];
  reservations: VIPReservation[];
  selectedTableId?: string;
  onSelectTable: (table: EventVIPTable) => void;
  readOnly?: boolean;
}

// Tier colors for admin view
const TIER_COLORS = {
  premium: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
    selected: 'bg-amber-500/40 border-amber-400 ring-2 ring-amber-400/50',
    badge: 'bg-amber-500',
  },
  front_row: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/50',
    text: 'text-purple-400',
    selected: 'bg-purple-500/40 border-purple-400 ring-2 ring-purple-400/50',
    badge: 'bg-purple-500',
  },
  standard: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    selected: 'bg-blue-500/40 border-blue-400 ring-2 ring-blue-400/50',
    badge: 'bg-blue-500',
  },
};

const TIER_LABELS = {
  premium: 'Premium',
  front_row: 'Front Row',
  standard: 'Standard',
};

// Individual table button for admin
const AdminTableButton: React.FC<{
  table: EventVIPTable;
  isSelected: boolean;
  hasReservation: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  size?: 'sm' | 'md' | 'lg';
  isAbsolute?: boolean;
  readOnly?: boolean;
}> = ({ table, isSelected, hasReservation, onClick, style, size = 'md', isAbsolute = true, readOnly = false }) => {
  const tierColor = TIER_COLORS[table.tier] || TIER_COLORS.standard;
  
  const sizeClasses = {
    sm: 'w-12 h-12 sm:w-14 sm:h-14',
    md: 'w-14 h-14 sm:w-18 sm:h-18',
    lg: 'w-18 h-18 sm:w-22 sm:h-22',
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
        'hover:scale-105 hover:z-10',
        'disabled:hover:scale-100',
        isAbsolute && 'absolute',
        sizeClasses[size],
        tierColor.border,
        tierColor.bg,
        isSelected && tierColor.selected,
        !table.is_available && !hasReservation && 'opacity-40',
        hasReservation && 'ring-2 ring-green-500'
      )}
    >
      {/* Table number */}
      <span className="text-white text-sm sm:text-base font-bold">{table.table_number}</span>
      
      {/* Price */}
      <span className={cn('text-[9px] sm:text-[10px] font-semibold', tierColor.text)}>
        ${(table.price_cents / 100).toFixed(0)}
      </span>
      
      {/* Status indicators */}
      <div className="flex items-center gap-0.5 mt-0.5">
        {hasReservation ? (
          <Badge className="h-3 px-1 text-[8px] bg-green-500 hover:bg-green-500">
            RSVD
          </Badge>
        ) : !table.is_available ? (
          <X className="w-3 h-3 text-red-400" />
        ) : (
          <Check className="w-3 h-3 text-green-400" />
        )}
      </div>
    </button>
  );
};

export function AdminVIPFloorPlan({
  tables,
  reservations,
  selectedTableId,
  onSelectTable,
  readOnly = false,
}: AdminVIPFloorPlanProps) {
  // Create a map for quick lookup
  const tableMap = new Map(tables.map(t => [t.table_number.toString(), t]));
  
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
  const totalTables = tables.length;
  const availableTables = tables.filter(t => t.is_available && !hasActiveReservation(t.table_number)).length;
  const reservedTables = reservations.filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status)).length;

  return (
    <div className="space-y-4">
      {/* Legend and Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex flex-wrap gap-4">
          {(['premium', 'front_row', 'standard'] as const).map((tier) => (
            <div key={tier} className="flex items-center gap-2">
              <span className={cn('w-3 h-3 rounded-full', TIER_COLORS[tier].badge)} />
              <span className="text-xs font-medium text-muted-foreground">{TIER_LABELS[tier]}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full ring-2 ring-green-500 bg-transparent" />
            <span className="text-xs font-medium text-muted-foreground">Reserved</span>
          </div>
          <div className="flex items-center gap-2">
            <X className="w-3 h-3 text-red-400" />
            <span className="text-xs font-medium text-muted-foreground">Disabled</span>
          </div>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{availableTables}</strong> available
          </span>
          <span className="text-muted-foreground">
            <strong className="text-green-500">{reservedTables}</strong> reserved
          </span>
          <span className="text-muted-foreground">
            <strong className="text-foreground">{totalTables}</strong> total
          </span>
        </div>
      </div>

      {/* Floor plan container */}
      <div 
        className="relative bg-zinc-900 rounded-xl border border-zinc-800 p-4 sm:p-6"
        style={{ aspectRatio: '16/10', minHeight: '500px' }}
      >
        {/* STAGE */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-48 sm:w-64">
          <div className="bg-gradient-to-b from-emerald-900/30 to-emerald-950/30 border border-emerald-700/30 rounded-lg p-3 sm:p-4">
            <div className="w-8 h-8 mx-auto border-2 border-emerald-500/50 rounded-full mb-1 flex items-center justify-center">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <h3 className="text-white text-center font-bold tracking-widest text-sm sm:text-base">STAGE</h3>
          </div>
        </div>

        {/* Left side tables (Premium - 1, 2, 3) */}
        {getTable('2') && (
          <AdminTableButton
            table={getTable('2')!}
            isSelected={selectedTableId === getTable('2')!.id}
            hasReservation={hasActiveReservation(2)}
            onClick={() => onSelectTable(getTable('2')!)}
            style={{ top: '22%', left: '3%' }}
            size="lg"
            readOnly={readOnly}
          />
        )}
        {getTable('1') && (
          <AdminTableButton
            table={getTable('1')!}
            isSelected={selectedTableId === getTable('1')!.id}
            hasReservation={hasActiveReservation(1)}
            onClick={() => onSelectTable(getTable('1')!)}
            style={{ top: '40%', left: '3%' }}
            size="lg"
            readOnly={readOnly}
          />
        )}
        {getTable('3') && (
          <AdminTableButton
            table={getTable('3')!}
            isSelected={selectedTableId === getTable('3')!.id}
            hasReservation={hasActiveReservation(3)}
            onClick={() => onSelectTable(getTable('3')!)}
            style={{ top: '58%', left: '3%' }}
            size="lg"
            readOnly={readOnly}
          />
        )}

        {/* Right side table (Premium - 8) */}
        {getTable('8') && (
          <AdminTableButton
            table={getTable('8')!}
            isSelected={selectedTableId === getTable('8')!.id}
            hasReservation={hasActiveReservation(8)}
            onClick={() => onSelectTable(getTable('8')!)}
            style={{ top: '22%', right: '3%' }}
            size="lg"
            readOnly={readOnly}
          />
        )}

        {/* Bar Lounge label (right side) */}
        <div 
          className="absolute text-zinc-600 text-[10px] tracking-widest font-medium"
          style={{ 
            top: '50%', 
            right: '1%', 
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg) translateY(50%)'
          }}
        >
          BAR LOUNGE
        </div>

        {/* Middle row tables (Front Row - 4, 5, 6, 7) */}
        <div className="absolute" style={{ top: '32%', left: '18%', right: '18%' }}>
          <div className="flex justify-between gap-2">
            {['4', '5', '6', '7'].map((num) => {
              const table = getTable(num);
              if (!table) return <div key={num} className="w-14 h-14 sm:w-18 sm:h-18" />;
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
                />
              );
            })}
          </div>
        </div>

        {/* Standard rows (9-14, 15-20) */}
        <div className="absolute" style={{ top: '52%', left: '18%', right: '18%' }}>
          <div className="flex justify-between gap-1 mb-2">
            {['9', '10', '11', '12', '13', '14'].map((num) => {
              const table = getTable(num);
              if (!table) return <div key={num} className="w-12 h-12 sm:w-14 sm:h-14" />;
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
                />
              );
            })}
          </div>
          <div className="flex justify-between gap-1">
            {['15', '16', '17', '18', '19', '20'].map((num) => {
              const table = getTable(num);
              if (!table) return <div key={num} className="w-12 h-12 sm:w-14 sm:h-14" />;
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
                />
              );
            })}
          </div>
        </div>

        {/* Additional tables (21-26) */}
        <div className="absolute" style={{ bottom: '5%', left: '18%', right: '18%' }}>
          <div className="flex justify-center gap-1">
            {['21', '22', '23', '24', '25', '26'].map((num) => {
              const table = getTable(num);
              if (!table) return null;
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
                />
              );
            })}
          </div>
        </div>

        {/* Dance Floor label */}
        <div 
          className="absolute text-zinc-700 text-sm tracking-widest font-medium text-center pointer-events-none"
          style={{ 
            top: '45%', 
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          DANCE FLOOR
        </div>

        {/* Click hint */}
        {!readOnly && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-zinc-500 text-[10px]">
            Click a table to edit
          </div>
        )}
      </div>

      {/* Selected table quick info */}
      {selectedTableId && (
        <SelectedTableInfo 
          table={tables.find(t => t.id === selectedTableId)} 
          hasReservation={tables.find(t => t.id === selectedTableId) ? 
            hasActiveReservation(tables.find(t => t.id === selectedTableId)!.table_number) : false}
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
      'p-4 rounded-lg border-2',
      tierColor.border,
      tierColor.bg
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', tierColor.badge)}>
            <span className="text-white font-bold">{table.table_number}</span>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Table {table.table_number}</h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold">${(table.price_cents / 100).toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span>{table.capacity} guests</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wine className="w-4 h-4 text-muted-foreground" />
            <span>{table.bottles_included} bottle{table.bottles_included !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminVIPFloorPlan;

