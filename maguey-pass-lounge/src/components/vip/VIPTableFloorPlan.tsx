import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type VipTableWithAvailability, useRealtimeFloorPlan } from '@/lib/vip-tables-service';

interface VIPTableFloorPlanProps {
  eventId: string;
  eventName: string;
  selectedTableId?: string;
  onSelectTable: (table: VipTableWithAvailability) => void;
}

// Tier colors matching the reference
const tierStyles = {
  front_row: {
    border: 'border-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    selected: 'bg-amber-500/30 border-amber-400 shadow-lg shadow-amber-500/20',
  },
  premium: {
    border: 'border-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    selected: 'bg-amber-500/30 border-amber-400 shadow-lg shadow-amber-500/20',
  },
  standard: {
    border: 'border-purple-500',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    selected: 'bg-purple-500/30 border-purple-400 shadow-lg shadow-purple-500/20',
  },
  regular: {
    border: 'border-blue-500',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    selected: 'bg-blue-500/30 border-blue-400 shadow-lg shadow-blue-500/20',
  },
};

const defaultStyle = tierStyles.regular;

// Capacity dots component
const CapacityDots: React.FC<{ capacity: number; color: string }> = ({ capacity, color }) => {
  const dots = Math.min(capacity, 8);
  return (
    <div className="flex gap-0.5 justify-center mt-1">
      {Array.from({ length: dots }).map((_, i) => (
        <div 
          key={i} 
          className={cn('w-1 h-1 rounded-full', color === 'amber' ? 'bg-amber-400' : color === 'purple' ? 'bg-purple-400' : 'bg-blue-400')} 
        />
      ))}
    </div>
  );
};

// Individual table component
const TableButton: React.FC<{
  table: VipTableWithAvailability;
  isSelected: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  size?: 'sm' | 'md' | 'lg';
  isAbsolute?: boolean;
}> = ({ table, isSelected, onClick, style, size = 'md', isAbsolute = true }) => {
  const tierStyle = tierStyles[table.tier as keyof typeof tierStyles] || defaultStyle;
  const tierColor = table.tier === 'premium' || table.tier === 'front_row' ? 'amber' : table.tier === 'standard' ? 'purple' : 'blue';
  
  const sizeClasses = {
    sm: 'w-14 h-14 sm:w-16 sm:h-16',
    md: 'w-16 h-16 sm:w-20 sm:h-20',
    lg: 'w-20 h-20 sm:w-24 sm:h-24',
  };

  return (
    <button
      onClick={onClick}
      disabled={!table.is_available}
      style={style}
      aria-label={`Table ${table.table_number}, ${table.tier}, $${table.price}, ${table.guest_capacity} guests${!table.is_available ? ', reserved' : ''}`}
      className={cn(
        'rounded-xl border-2 transition-all duration-200',
        'flex flex-col items-center justify-center',
        'hover:scale-105 hover:z-10',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100',
        isAbsolute && 'absolute',
        sizeClasses[size],
        tierStyle.border,
        tierStyle.bg,
        isSelected && tierStyle.selected
      )}
    >
      <span className="text-white text-base sm:text-lg font-bold">{table.table_number}</span>
      <span className={cn('text-[10px] sm:text-xs font-semibold', tierStyle.text)}>${table.price}</span>
      <CapacityDots capacity={table.guest_capacity} color={tierColor} />
    </button>
  );
};

export function VIPTableFloorPlan({
  eventId,
  eventName,
  selectedTableId,
  onSelectTable,
}: VIPTableFloorPlanProps) {
  // Use realtime hook to fetch and subscribe to table updates
  const { tables, isLoading, error } = useRealtimeFloorPlan(eventId);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading floor plan...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <p>Failed to load floor plan: {error.message}</p>
      </div>
    );
  }

  // Create a map for quick lookup
  const tableMap = new Map(tables.map(t => [t.table_number, t]));

  // Helper to get table by number
  const getTable = (num: string) => tableMap.get(num);

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Floor plan container */}
      <div
        className="relative bg-deepteal rounded-xl border border-white/5 p-4 sm:p-8"
        style={{ aspectRatio: '4/3', minHeight: '600px' }}
      >
        {/* Live indicator */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs text-muted-foreground">Live</span>
        </div>

        {/* Expand icon in corner */}
        <div className="absolute top-4 right-4 opacity-20">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-white">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </div>

        {/* STAGE */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-64 sm:w-80">
          <div className="bg-gradient-to-b from-gray-800/50 to-gray-900/50 border border-gray-600/30 rounded-lg p-4 sm:p-6">
            {/* DJ Booth circle */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto border-2 border-emerald-500/50 rounded-full mb-2 flex items-center justify-center">
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            </div>
            <h3 className="text-white text-center font-bold tracking-widest text-lg sm:text-xl">STAGE</h3>
            {/* Speaker icons */}
            <div className="flex justify-between mt-2">
              <div className="w-6 h-6 border border-gray-500/50 rounded flex items-center justify-center">
                <div className="w-3 h-3 border border-gray-500 rounded-sm" />
              </div>
              <div className="w-6 h-6 border border-gray-500/50 rounded flex items-center justify-center">
                <div className="w-3 h-3 border border-gray-500 rounded-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Left side tables (Premium - 1, 2, 3) */}
        {getTable('2') && (
          <TableButton
            table={getTable('2')!}
            isSelected={selectedTableId === getTable('2')!.id}
            onClick={() => onSelectTable(getTable('2')!)}
            style={{ top: '25%', left: '5%' }}
            size="lg"
          />
        )}
        {getTable('1') && (
          <TableButton
            table={getTable('1')!}
            isSelected={selectedTableId === getTable('1')!.id}
            onClick={() => onSelectTable(getTable('1')!)}
            style={{ top: '42%', left: '5%' }}
            size="lg"
          />
        )}
        {getTable('3') && (
          <TableButton
            table={getTable('3')!}
            isSelected={selectedTableId === getTable('3')!.id}
            onClick={() => onSelectTable(getTable('3')!)}
            style={{ top: '60%', left: '5%' }}
            size="lg"
          />
        )}

        {/* Right side table (Premium - 8) */}
        {getTable('8') && (
          <TableButton
            table={getTable('8')!}
            isSelected={selectedTableId === getTable('8')!.id}
            onClick={() => onSelectTable(getTable('8')!)}
            style={{ top: '25%', right: '5%' }}
            size="lg"
          />
        )}

        {/* Bar Lounge label (right side) */}
        <div 
          className="absolute text-gray-500/40 text-xs tracking-widest font-light"
          style={{ 
            top: '45%', 
            right: '2%', 
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)'
          }}
        >
          BAR LOUNGE
        </div>

        {/* Middle row tables (Standard - 4, 5, 6, 7) */}
        <div className="absolute" style={{ top: '35%', left: '22%', right: '22%' }}>
          <div className="flex justify-between gap-2 sm:gap-4">
            {['4', '5', '6', '7'].map((num) => {
              const table = getTable(num);
              if (!table) return null;
              return (
                <TableButton
                  key={num}
                  table={table}
                  isSelected={selectedTableId === table.id}
                  onClick={() => onSelectTable(table)}
                  size="md"
                  isAbsolute={false}
                />
              );
            })}
          </div>
        </div>

        {/* Bottom rows tables (Regular - 9-20) */}
        <div className="absolute" style={{ top: '55%', left: '22%', right: '22%' }}>
          <div className="flex justify-between gap-1 sm:gap-2 mb-2 sm:mb-4">
            {['9', '10', '11', '12', '13', '14'].map((num) => {
              const table = getTable(num);
              if (!table) return null;
              return (
                <TableButton
                  key={num}
                  table={table}
                  isSelected={selectedTableId === table.id}
                  onClick={() => onSelectTable(table)}
                  size="sm"
                  isAbsolute={false}
                />
              );
            })}
          </div>
          <div className="flex justify-between gap-1 sm:gap-2">
            {['15', '16', '17', '18', '19', '20'].map((num) => {
              const table = getTable(num);
              if (!table) return null;
              return (
                <TableButton
                  key={num}
                  table={table}
                  isSelected={selectedTableId === table.id}
                  onClick={() => onSelectTable(table)}
                  size="sm"
                  isAbsolute={false}
                />
              );
            })}
          </div>
        </div>

        {/* Additional tables (21-26) - Below main floor */}
        <div className="absolute" style={{ bottom: '5%', left: '22%', right: '22%' }}>
          <div className="flex justify-center gap-1 sm:gap-2">
            {['21', '22', '23', '24', '25', '26'].map((num) => {
              const table = getTable(num);
              if (!table) return null;
              return (
                <TableButton
                  key={num}
                  table={table}
                  isSelected={selectedTableId === table.id}
                  onClick={() => onSelectTable(table)}
                  size="sm"
                  isAbsolute={false}
                />
              );
            })}
          </div>
        </div>

        {/* Dance Floor label */}
        <div 
          className="absolute text-gray-600/30 text-xs sm:text-sm tracking-widest font-light text-center"
          style={{ 
            top: '48%', 
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          DANCE FLOOR
        </div>
      </div>
    </div>
  );
}

export default VIPTableFloorPlan;

