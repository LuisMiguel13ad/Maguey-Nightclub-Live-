import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Calendar, MapPin, Speaker, MoveDown, Users, Wine, Info, X, ChevronRight, Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvailableTablesForEvent, type VipTableWithAvailability } from '@/lib/vip-tables-service';
import { supabase } from '@/lib/supabase';
import { VipProgressIndicator } from '@/components/vip/VipProgressIndicator';
import { CustomCursor } from '@/components/CustomCursor';
import { TableCardSkeleton } from '@/components/ui/skeleton-card';
import { Skeleton } from '@/components/ui/skeleton';

// Serif font style for elegant typography
const serifFont = { fontFamily: "'Times New Roman', Georgia, serif" };


// Sample tables matching the new layout
const SAMPLE_TABLES: VipTableWithAvailability[] = [
  // Premium tables (left wing) - $750
  { id: 'sample-1', table_number: '1', table_name: 'Premium 1', tier: 'premium', price: 750, guest_capacity: 8, bottle_service_description: '2 premium bottles', floor_section: 'Left Wing', position_description: 'Stage left', is_active: true, sort_order: 1, is_available: true },
  { id: 'sample-2', table_number: '2', table_name: 'Premium 2', tier: 'premium', price: 750, guest_capacity: 8, bottle_service_description: '2 premium bottles', floor_section: 'Left Wing', position_description: 'Stage left corner', is_active: true, sort_order: 2, is_available: true },
  { id: 'sample-3', table_number: '3', table_name: 'Premium 3', tier: 'premium', price: 750, guest_capacity: 8, bottle_service_description: '2 premium bottles', floor_section: 'Left Wing', position_description: 'Stage left back', is_active: true, sort_order: 3, is_available: false }, // Reserved
  
  // Front Row tables - $700
  { id: 'sample-4', table_number: '4', table_name: 'Front Row 4', tier: 'front_row', price: 700, guest_capacity: 6, bottle_service_description: '1 premium bottle', floor_section: 'Front Row', position_description: 'Center front', is_active: true, sort_order: 4, is_available: true },
  { id: 'sample-5', table_number: '5', table_name: 'Front Row 5', tier: 'front_row', price: 700, guest_capacity: 6, bottle_service_description: '1 premium bottle', floor_section: 'Front Row', position_description: 'Center', is_active: true, sort_order: 5, is_available: true },
  { id: 'sample-6', table_number: '6', table_name: 'Front Row 6', tier: 'front_row', price: 700, guest_capacity: 6, bottle_service_description: '1 premium bottle', floor_section: 'Front Row', position_description: 'Center', is_active: true, sort_order: 6, is_available: true },
  { id: 'sample-7', table_number: '7', table_name: 'Front Row 7', tier: 'front_row', price: 700, guest_capacity: 6, bottle_service_description: '1 premium bottle', floor_section: 'Front Row', position_description: 'Center right', is_active: true, sort_order: 7, is_available: true },
  
  // Premium table (right wing) - $750
  { id: 'sample-8', table_number: '8', table_name: 'Premium 8', tier: 'premium', price: 750, guest_capacity: 8, bottle_service_description: '2 premium bottles', floor_section: 'Right Wing', position_description: 'Stage right', is_active: true, sort_order: 8, is_available: true },
  
  // Standard tables (back rows) - $600
  { id: 'sample-9', table_number: '9', table_name: 'Standard 9', tier: 'standard', price: 600, guest_capacity: 6, bottle_service_description: '1 bottle', floor_section: 'Standard', position_description: 'Row 1', is_active: true, sort_order: 9, is_available: true },
  { id: 'sample-10', table_number: '10', table_name: 'Standard 10', tier: 'standard', price: 600, guest_capacity: 6, bottle_service_description: '1 bottle', floor_section: 'Standard', position_description: 'Row 1', is_active: true, sort_order: 10, is_available: true },
  { id: 'sample-11', table_number: '11', table_name: 'Standard 11', tier: 'standard', price: 600, guest_capacity: 6, bottle_service_description: '1 bottle', floor_section: 'Standard', position_description: 'Row 1', is_active: true, sort_order: 11, is_available: true },
  { id: 'sample-12', table_number: '12', table_name: 'Standard 12', tier: 'standard', price: 600, guest_capacity: 6, bottle_service_description: '1 bottle', floor_section: 'Standard', position_description: 'Row 1', is_active: true, sort_order: 12, is_available: true },
  { id: 'sample-13', table_number: '13', table_name: 'Standard 13', tier: 'standard', price: 600, guest_capacity: 6, bottle_service_description: '1 bottle', floor_section: 'Standard', position_description: 'Row 1', is_active: true, sort_order: 13, is_available: true },
  { id: 'sample-14', table_number: '14', table_name: 'Standard 14', tier: 'standard', price: 600, guest_capacity: 6, bottle_service_description: '1 bottle', floor_section: 'Standard', position_description: 'Row 1', is_active: true, sort_order: 14, is_available: true },
  { id: 'sample-15', table_number: '15', table_name: 'Standard 15', tier: 'standard', price: 600, guest_capacity: 6, bottle_service_description: '1 bottle', floor_section: 'Standard', position_description: 'Row 2', is_active: true, sort_order: 15, is_available: true },
  { id: 'sample-16', table_number: '16', table_name: 'Standard 16', tier: 'standard', price: 600, guest_capacity: 6, bottle_service_description: '1 bottle', floor_section: 'Standard', position_description: 'Row 2', is_active: true, sort_order: 16, is_available: true },
  { id: 'sample-17', table_number: '17', table_name: 'Standard 17', tier: 'standard', price: 600, guest_capacity: 6, bottle_service_description: '1 bottle', floor_section: 'Standard', position_description: 'Row 2', is_active: true, sort_order: 17, is_available: true },
  { id: 'sample-18', table_number: '18', table_name: 'Standard 18', tier: 'standard', price: 600, guest_capacity: 6, bottle_service_description: '1 bottle', floor_section: 'Standard', position_description: 'Row 2', is_active: true, sort_order: 18, is_available: true },
  { id: 'sample-19', table_number: '19', table_name: 'Standard 19', tier: 'standard', price: 600, guest_capacity: 6, bottle_service_description: '1 bottle', floor_section: 'Standard', position_description: 'Row 2', is_active: true, sort_order: 19, is_available: true },
  { id: 'sample-20', table_number: '20', table_name: 'Standard 20', tier: 'standard', price: 600, guest_capacity: 6, bottle_service_description: '1 bottle', floor_section: 'Standard', position_description: 'Row 2', is_active: true, sort_order: 20, is_available: true },
];

// Table button component
interface TableButtonProps {
  table: VipTableWithAvailability;
  isSelected: boolean;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const TableButton: React.FC<TableButtonProps> = ({ table, isSelected, onClick, size = 'md' }) => {
  const tierStyles = {
    premium: {
      base: 'bg-amber-950/30 border-amber-500/30',
      hover: 'hover:bg-amber-500/15 hover:border-amber-500/50',
      selected: 'bg-gradient-to-br from-amber-500 to-amber-600 border-amber-400 text-white shadow-lg shadow-amber-500/30',
      price: 'text-amber-400',
      priceSelected: 'text-white/90',
      glow: 'shadow-amber-500/20',
    },
    front_row: {
      base: 'bg-purple-950/30 border-purple-500/30',
      hover: 'hover:bg-purple-500/15 hover:border-purple-500/50',
      selected: 'bg-gradient-to-br from-purple-500 to-purple-600 border-purple-400 text-white shadow-lg shadow-purple-500/30',
      price: 'text-purple-400',
      priceSelected: 'text-white/90',
      glow: 'shadow-purple-500/20',
    },
    standard: {
      base: 'bg-white/[0.02] border-white/10',
      hover: 'hover:bg-copper-400/10 hover:border-copper-400/30',
      selected: 'bg-copper-400 border-copper-400 text-forest-950 shadow-lg shadow-copper-400/30',
      price: 'text-copper-400',
      priceSelected: 'text-forest-950',
      glow: 'shadow-copper-400/20',
    },
    regular: {
      base: 'bg-white/[0.02] border-white/10',
      hover: 'hover:bg-copper-400/10 hover:border-copper-400/30',
      selected: 'bg-copper-400 border-copper-400 text-forest-950 shadow-lg shadow-copper-400/30',
      price: 'text-copper-400',
      priceSelected: 'text-forest-950',
      glow: 'shadow-copper-400/20',
    },
  };

  const sizeStyles = {
    sm: 'w-full h-16 rounded-sm',
    md: 'w-24 h-20 rounded-sm',
    lg: 'w-full max-w-[110px] h-24 rounded-sm',
  };

  const tier = (table.tier as keyof typeof tierStyles) || 'standard';
  const styles = tierStyles[tier] || tierStyles.standard;

  if (!table.is_available) {
    return (
      <div
        className={cn(
          sizeStyles[size],
          'bg-zinc-900/50 border border-zinc-700/30 flex flex-col items-center justify-center gap-0.5 cursor-not-allowed opacity-50 backdrop-blur-sm'
        )}
        title="This table has been reserved"
      >
        <span className="font-light text-lg text-zinc-500" style={serifFont}>{table.table_number}</span>
        <span className="text-[7px] font-medium text-zinc-600 tracking-[0.15em] uppercase">RESERVED</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        sizeStyles[size],
        'border flex flex-col items-center justify-center gap-0.5 relative overflow-hidden transition-all duration-300 backdrop-blur-sm',
        isSelected 
          ? cn(styles.selected, 'scale-[0.97]') 
          : cn(styles.base, styles.hover, 'hover:-translate-y-1 hover:shadow-lg', styles.glow)
      )}
    >
      <div className={cn(
        'absolute inset-0 transition-opacity',
        !isSelected && 'bg-gradient-to-b from-white/5 to-transparent'
      )} />
      <span className={cn(
        'font-light relative z-10 tracking-tight',
        size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl'
      )} style={serifFont}>
        {table.table_number}
      </span>
      <span className={cn(
        'font-medium relative z-10 tracking-wide',
        size === 'sm' ? 'text-[8px]' : 'text-[9px]',
        isSelected ? styles.priceSelected : styles.price
      )}>
        ${table.price}
      </span>
    </button>
  );
};

const VIPTablesPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>(undefined);
  const [tables, setTables] = useState<VipTableWithAvailability[]>([]);
  const [eventName, setEventName] = useState<string>('');
  const [eventDate, setEventDate] = useState<string>('');
  const [eventImageUrl, setEventImageUrl] = useState<string>('');
  const [venueAddress, setVenueAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [eventNotFound, setEventNotFound] = useState(false);
  const [vipNotEnabled, setVipNotEnabled] = useState(false);
  

  useEffect(() => {
    const loadEventData = async () => {
      if (!eventId) {
        setIsLoading(false);
        setEventNotFound(true);
        return;
      }

      try {
        const { data: event, error: eventError } = await supabase
          .from('events')
          .select('id, name, event_date, event_time, venue_address, image_url, vip_enabled')
          .eq('id', eventId)
          .maybeSingle();

        if (eventError || !event) {
          setEventNotFound(true);
          setIsLoading(false);
          return;
        }

        // Check if VIP is enabled for this event
        if (!event.vip_enabled) {
          setVipNotEnabled(true);
          setEventName(event.name);
          setIsLoading(false);
          return;
        }

        setEventName(event.name);
        setVenueAddress(event.venue_address || '3320 Old Capital Trail');
        setEventImageUrl(event.image_url || '');
        
        const date = new Date(event.event_date);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        setEventDate(`${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`);

        const vipTables = await getAvailableTablesForEvent(eventId);
        
        if (vipTables && vipTables.length > 0) {
          setTables(vipTables);
        } else {
          // No tables configured - treat as VIP not enabled
          console.warn('No VIP tables found in database for event:', eventId);
          setVipNotEnabled(true);
        }

      } catch (error) {
        console.error('Error loading event data:', error);
        // On error, show empty state instead of sample tables that can't be booked
        setTables([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadEventData();
  }, [eventId]);

  // Subscribe to realtime table availability changes
  useEffect(() => {
    if (!eventId || tables.length === 0) return;

    // Subscribe to changes on event_vip_tables for this event
    const subscription = supabase
      .channel(`vip-tables-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'event_vip_tables',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          // Update local state when table availability changes
          setTables(prev => prev.map(table =>
            table.id === payload.new.id
              ? { ...table, is_available: payload.new.is_available }
              : table
          ));

          // If the selected table became unavailable, deselect it
          if (payload.new.id === selectedTableId && !payload.new.is_available) {
            setSelectedTableId(undefined);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [eventId, tables.length, selectedTableId]);

  const handleSelectTable = (tableId: string) => {
    setSelectedTableId(selectedTableId === tableId ? undefined : tableId);
  };


  const selectedTable = tables.find(t => t.id === selectedTableId);

  const handleContinue = () => {
    if (!selectedTable || !eventId) return;
    // Navigate to booking form with table info
    navigate(`/events/${eventId}/vip-booking?${new URLSearchParams({
      tableId: selectedTable.id,
      tableNumber: selectedTable.table_number.toString(),
      price: selectedTable.price.toString(),
      tier: selectedTable.tier,
      capacity: selectedTable.guest_capacity.toString(),
      bottles: '1' // Default to 1 bottle
    }).toString()}`);
  };

  // Group tables by position
  // Convert table_number to string for comparison (DB returns number, SAMPLE_TABLES uses string)
  const getTableNum = (t: VipTableWithAvailability) => String(t.table_number);
  
  const leftWingTables = tables.filter(t => [1, 2, 3].includes(Number(getTableNum(t))));
  const frontRowTables = tables.filter(t => [4, 5, 6, 7].includes(Number(getTableNum(t))));
  const rightWingTable = tables.find(t => Number(getTableNum(t)) === 8);
  const standardRow1 = tables.filter(t => [9, 10, 11, 12, 13, 14].includes(Number(getTableNum(t))));
  const standardRow2 = tables.filter(t => [15, 16, 17, 18, 19, 20].includes(Number(getTableNum(t))));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forest-950 text-stone-300 font-sans flex flex-col overflow-x-hidden">
        <CustomCursor />
        <div className="noise-overlay" />

        {/* Header skeleton */}
        <header className="w-full bg-forest-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <Crown className="w-5 h-5 text-copper-400" />
              <span className="text-lg font-light tracking-wide" style={serifFont}>
                <span className="text-stone-100">VIP </span>
                <span className="italic text-copper-400">Tables</span>
              </span>
            </div>
          </div>
        </header>

        {/* Progress indicator skeleton */}
        <div className="w-full bg-forest-900/50 border-b border-white/5 py-4 px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-8 w-full bg-white/5" />
          </div>
        </div>

        {/* Main content skeleton */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col items-center gap-10 relative z-10">
          {/* Banner skeleton */}
          <section className="w-full max-w-5xl mx-auto">
            <Skeleton className="h-4 w-32 mb-3 bg-white/5" />
            <Skeleton className="w-full h-48 sm:h-64 md:h-80 rounded-sm bg-white/5" />
          </section>

          {/* Floor plan section skeleton */}
          <section className="w-full relative">
            <div className="text-center mb-6">
              <Skeleton className="h-4 w-32 mx-auto mb-3 bg-white/5" />
              <Skeleton className="h-10 w-64 mx-auto bg-white/5" />
            </div>

            {/* Table grid skeleton */}
            <div className="max-w-6xl mx-auto px-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <TableCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!eventId || eventNotFound) {
    return <Navigate to="/" replace />;
  }

  // VIP not enabled - show message and redirect option
  if (vipNotEnabled) {
    return (
      <div className="min-h-screen bg-forest-950 text-stone-300 font-sans flex flex-col items-center justify-center overflow-x-hidden px-4">
        <CustomCursor />
        
        {/* Noise Overlay */}
        <div className="fixed inset-0 opacity-[0.015] pointer-events-none z-0" 
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} 
        />
        
        <div className="relative z-10 text-center max-w-md">
          {/* Icon */}
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-amber-500/20">
            <Wine className="w-10 h-10 text-amber-400" />
          </div>
          
          {/* Message */}
          <h1 className="text-2xl sm:text-3xl text-stone-100 mb-3" style={serifFont}>
            VIP Section Not Available
          </h1>
          <p className="text-stone-400 mb-2">
            VIP table reservations are not available for this event at the moment.
          </p>
          {eventName && (
            <p className="text-copper-400 text-sm mb-8">
              {eventName}
            </p>
          )}
          
          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(`/events/${eventId}`)}
              className="px-6 py-3 bg-copper-400 text-forest-950 font-semibold rounded-sm hover:bg-copper-500 transition-colors flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4" />
              Get Event Tickets
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-white/5 border border-white/10 text-stone-300 rounded-sm hover:bg-white/10 transition-colors"
            >
              Browse Events
            </button>
          </div>
          
          {/* Footer note */}
          <p className="text-xs text-stone-600 mt-8">
            VIP sections are configured by event organizers. Check back later or contact us for availability.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest-950 text-stone-300 font-sans flex flex-col overflow-x-hidden">
      {/* Custom Cursor */}
      <CustomCursor />
      
      {/* Noise Overlay */}
      <div className="noise-overlay" />
      
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
        <svg width="100%" height="100%">
          <pattern
            id="vip-grid"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-copper-400"
            />
          </pattern>
          <rect width="100%" height="100%" fill="url(#vip-grid)" />
        </svg>
      </div>

      {/* Header */}
      <header className="w-full bg-forest-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Crown className="w-5 h-5 text-copper-400" />
              <span className="text-lg font-light tracking-wide" style={serifFont}>
                <span className="text-stone-100">VIP </span>
                <span className="italic text-copper-400">Tables</span>
              </span>
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
              <Calendar className="w-3.5 h-3.5 text-copper-400" />
              <span className="text-stone-300 text-xs font-medium">{eventDate}</span>
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
              <MapPin className="w-3.5 h-3.5 text-copper-400" />
              <span className="text-stone-300 text-xs font-medium">{venueAddress}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="w-full bg-forest-900/50 border-b border-white/5 py-4 px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <VipProgressIndicator currentStep="select" />
        </div>
      </div>

      <main className={cn(
        "flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col items-center gap-10 transition-all duration-300 relative z-10",
        selectedTableId ? "pb-48" : "pb-8"
      )}>
        
        {/* Artist Banner Section */}
        <section className="w-full max-w-5xl mx-auto">
          <p className="text-[10px] font-medium text-copper-400 uppercase tracking-[0.2em] mb-3 pl-1">Featured Event</p>
          
          <div className="relative w-full h-48 sm:h-64 md:h-80 rounded-sm overflow-hidden border border-white/5 bg-forest-900 group">
            {/* Event Image */}
            {eventImageUrl && (
              <img 
                src={eventImageUrl} 
                alt={eventName} 
                className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 group-hover:scale-105 transition-all duration-[2s]"
              />
            )}
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-forest-950/95 via-forest-950/70 to-transparent z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-transparent to-transparent z-10" />
            
            {/* Content */}
            <div className="absolute inset-0 p-6 sm:p-8 md:p-10 flex flex-col justify-end z-20">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-copper-400/10 border border-copper-400/30 text-copper-400 text-[9px] sm:text-[10px] font-medium tracking-widest uppercase rounded-full">
                  VIP Tables
                </span>
                <span className="text-stone-500 text-[9px] sm:text-[10px] font-medium tracking-widest uppercase">
                  {eventDate}
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl md:text-5xl font-light text-stone-100 tracking-tight" style={serifFont}>
                <span className="italic">{eventName}</span>
              </h3>
              <p className="text-stone-500 text-xs sm:text-sm mt-2 max-w-lg font-light tracking-wide">
                Experience the exclusive VIP treatment at Delaware's premier nightlife destination.
              </p>
            </div>
            
            {/* Live Performance Badge */}
            <div className="absolute top-4 right-4 z-30">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-forest-950/80 backdrop-blur-sm border border-white/10 rounded-full">
                <span className="w-1.5 h-1.5 bg-copper-400 rounded-full animate-pulse" />
                <span className="text-[9px] sm:text-[10px] font-medium text-stone-300 tracking-wider uppercase">
                  Reserve Now
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Floor Plan Interface */}
        <section className="w-full relative">
          
          {/* Section Header */}
          <div className="text-center mb-6">
            <p className="text-[10px] font-medium text-copper-400 uppercase tracking-[0.2em] mb-3">Select Your Table</p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight" style={serifFont}>
              <span className="text-stone-100">VIP </span>
              <span className="italic text-copper-400">Floor Plan.</span>
            </h2>
          </div>

          {/* STAGE AREA */}
          <div className="relative mb-8 text-center z-10 flex justify-center">
            <div className="inline-block relative">
              <div className="w-72 sm:w-80 h-28 sm:h-32 bg-gradient-to-b from-forest-900 to-forest-950 border border-white/10 rounded-t-3xl flex flex-col items-center justify-end pb-4 relative overflow-hidden group">
                {/* Stage lights effect */}
                <div className="absolute top-0 left-1/4 w-4 h-40 bg-copper-400/10 rotate-12 blur-md" />
                <div className="absolute top-0 right-1/4 w-4 h-40 bg-copper-400/10 -rotate-12 blur-md" />
                
                <div className="z-10 flex flex-col items-center justify-center h-full mt-2 gap-2">
                  <Sparkles className="w-4 h-4 text-copper-400/60" />
                  <h2 className="text-lg sm:text-xl font-light text-stone-200 tracking-[0.2em] uppercase" style={{ ...serifFont, textShadow: '0 0 20px rgba(94, 234, 212, 0.3)' }}>
                    MAGUEY STAGE
                  </h2>
                </div>
                
                <Speaker className="absolute bottom-4 left-6 text-stone-700 w-4 h-4" />
                <Speaker className="absolute bottom-4 right-6 text-stone-700 w-4 h-4" />
              </div>
              {/* Reflection */}
              <div className="w-full h-6 bg-gradient-to-b from-copper-400/10 to-transparent absolute top-full left-0 rounded-b-xl blur-sm" />
            </div>
          </div>

          {/* TABLE LEGEND */}
          <div className="flex flex-wrap justify-center gap-3 sm:gap-6 mb-8 relative z-10 px-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
              <span className="text-[9px] sm:text-[10px] font-medium text-stone-400 uppercase tracking-wider">Premium</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
              <span className="text-[9px] sm:text-[10px] font-medium text-stone-400 uppercase tracking-wider">Front Row</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <span className="w-2 h-2 rounded-full bg-copper-400 shadow-[0_0_6px_rgba(94,234,212,0.5)]" />
              <span className="text-[9px] sm:text-[10px] font-medium text-stone-400 uppercase tracking-wider">Standard</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-950/30 rounded-full border border-rose-800/20">
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
              <span className="text-[9px] sm:text-[10px] font-medium text-rose-400/80 uppercase tracking-wider">Reserved</span>
            </div>
          </div>

          {/* GRID LAYOUT */}
          {tables.length === 0 ? (
            /* Empty State - No tables available */
            <div className="max-w-md mx-auto text-center py-12 px-4">
              <div className="w-16 h-16 bg-copper-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wine className="w-8 h-8 text-copper-400" />
              </div>
              <h3 className="text-xl text-stone-100 mb-2" style={serifFont}>
                VIP Tables Coming Soon
              </h3>
              <p className="text-stone-400 text-sm mb-6">
                VIP table reservations for this event are being set up. Please check back soon or contact us for availability.
              </p>
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-2 bg-white/5 border border-white/10 text-stone-300 rounded-sm hover:bg-white/10 transition-colors"
              >
                Go Back
              </button>
            </div>
          ) : (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 px-2 sm:px-0 items-start">
            
            {/* LEFT WING (Cols 1-2) */}
            <div className="lg:col-span-2 flex flex-row lg:flex-col justify-center lg:items-end gap-3 order-1">
              {leftWingTables.map((table) => (
                <TableButton
                  key={table.id}
                  table={table}
                  isSelected={selectedTableId === table.id}
                  onClick={() => handleSelectTable(table.id)}
                  size="md"
                />
              ))}
            </div>

            {/* CENTER FLOOR (Cols 3-10) */}
            <div className="lg:col-span-8 flex flex-col gap-5 order-3 lg:order-2 lg:mt-20">
              
              {/* Front Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 justify-items-center">
                {frontRowTables.map((table) => (
                  <TableButton
                    key={table.id}
                    table={table}
                    isSelected={selectedTableId === table.id}
                    onClick={() => handleSelectTable(table.id)}
                    size="lg"
                  />
                ))}
              </div>

              {/* Standard Section Wrapper */}
              <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-sm p-5 flex flex-col gap-3">
                <p className="text-[9px] text-copper-400/60 uppercase tracking-[0.15em] text-center mb-1">Standard Section</p>
                
                {/* Standard Row 1 */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {standardRow1.map((table) => (
                    <TableButton
                      key={table.id}
                      table={table}
                      isSelected={selectedTableId === table.id}
                      onClick={() => handleSelectTable(table.id)}
                      size="sm"
                    />
                  ))}
                </div>

                {/* Standard Row 2 */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {standardRow2.map((table) => (
                    <TableButton
                      key={table.id}
                      table={table}
                      isSelected={selectedTableId === table.id}
                      onClick={() => handleSelectTable(table.id)}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT WING (Cols 11-12) */}
            <div className="lg:col-span-2 flex flex-row lg:flex-col justify-center lg:items-start gap-3 order-2 lg:order-3">
              {rightWingTable && (
                <TableButton
                  table={rightWingTable}
                  isSelected={selectedTableId === rightWingTable.id}
                  onClick={() => handleSelectTable(rightWingTable.id)}
                  size="md"
                />
              )}
              
              {/* Vertical Bar Service */}
              <div className="hidden lg:flex w-24 h-48 bg-white/[0.02] backdrop-blur-sm rounded-sm items-center justify-center border border-dashed border-white/10">
                <span className="text-[8px] font-medium tracking-[0.25em] text-copper-400/50 uppercase [writing-mode:vertical-rl] rotate-180">Bar Service</span>
              </div>
            </div>
          </div>
          )}

          {/* Entrance Indicators */}
          <div className="mt-12 flex justify-center">
            <div className="flex items-center gap-3 text-copper-400/50">
              <MoveDown className="w-3.5 h-3.5" />
              <span className="text-[9px] uppercase tracking-[0.2em] font-medium">Entrance</span>
              <MoveDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </section>
      </main>

      {/* Sticky Bottom Booking Panel */}
      <div 
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out',
          selectedTableId ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        )}
      >
        {selectedTable && (
          <div className="bg-forest-950/95 border-t border-white/10 shadow-2xl shadow-black/50 backdrop-blur-xl">
            {/* Gradient accent line */}
            <div className="h-0.5 bg-gradient-to-r from-copper-400 via-bronze-400 to-copper-400" />
            
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
              {/* Main content - Single row on desktop, stacked on mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                
                {/* Left: Table Summary */}
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  {/* Tier Badge */}
                  <span className={cn(
                    'px-3 py-1.5 text-[10px] sm:text-xs font-medium uppercase tracking-widest rounded-lg border',
                    selectedTable.tier === 'premium' && 'bg-amber-500/20 border-amber-500/30 text-amber-300',
                    selectedTable.tier === 'front_row' && 'bg-purple-500/20 border-purple-500/30 text-purple-300',
                    (selectedTable.tier === 'standard' || selectedTable.tier === 'regular') && 'bg-copper-400/20 border-copper-400/30 text-copper-400'
                  )}>
                    {selectedTable.tier === 'front_row' ? 'Front Row' : selectedTable.tier}
                  </span>
                  
                  {/* Table Name */}
                  <h3 className="text-lg sm:text-xl font-light text-stone-100" style={serifFont}>
                    Table {selectedTable.table_number}
                  </h3>
                  
                  {/* Divider - hidden on mobile */}
                  <div className="hidden sm:block w-px h-6 bg-white/10" />
                  
                  {/* Quick Stats */}
                  <div className="flex items-center gap-4 text-sm text-stone-500">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span className="text-stone-300 font-medium">{selectedTable.guest_capacity}</span> Guests
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Wine className="w-4 h-4" />
                      <span className="text-stone-300 font-medium">1</span> Bottle
                    </span>
                  </div>
                </div>
                
                {/* Right: Price & CTA */}
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                  {/* Price */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-light text-stone-100" style={serifFont}>${selectedTable.price}</span>
                  </div>
                  
                  {/* Continue Button */}
                  <button
                    onClick={handleContinue}
                    className="group flex items-center gap-2 bg-copper-400 hover:bg-copper-500 text-forest-950 font-medium px-6 sm:px-8 py-3 rounded-sm transition-all duration-200 hover:shadow-lg hover:shadow-copper-400/20 active:scale-[0.98]"
                  >
                    <span>Reserve This Table</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
              
              {/* Disclaimer - Collapsible info */}
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="flex items-center gap-2 text-[11px] sm:text-xs text-stone-600">
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    Bottle service reservation • GA tickets required for entry • Tax & gratuity paid at venue
                  </span>
                  {/* Close button */}
                  <button
                    onClick={() => setSelectedTableId(undefined)}
                    className="ml-auto p-1.5 rounded-full hover:bg-white/5 text-stone-600 hover:text-stone-400 transition-colors"
                    aria-label="Close panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default VIPTablesPage;
