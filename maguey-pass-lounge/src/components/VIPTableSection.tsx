import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Wine } from 'lucide-react';

interface VIPTableSectionProps {
  eventId: string;
}

export function VIPTableSection({ eventId }: VIPTableSectionProps) {
  const [hasVipTables, setHasVipTables] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkVipTables = async () => {
      if (!eventId) {
        setLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('event_vip_tables')
          .select('id')
          .eq('event_id', eventId)
          .eq('is_available', true)
          .limit(1);

        if (!error && data && data.length > 0) {
          setHasVipTables(true);
        }
      } catch (err) {
        console.error('Error checking VIP tables:', err);
      } finally {
        setLoading(false);
      }
    };
    
    checkVipTables();
  }, [eventId]);

  if (loading || !hasVipTables) {
    return null;
  }

  return (
    <div className="mt-8 p-6 bg-gradient-to-r from-amber-900/40 to-yellow-900/40 border border-amber-500/30 rounded-xl">
      <div className="flex items-center gap-3 mb-3">
        <Wine className="w-6 h-6 text-amber-400" />
        <h3 className="text-xl font-bold text-amber-400">VIP Bottle Service</h3>
      </div>
      <p className="text-gray-300 mb-2">
        Reserve a premium table with bottle service for your group
      </p>
      <p className="text-amber-400/80 text-sm mb-4">
        Starting at $600 • Groups of 6-8 guests
      </p>
      <p className="text-gray-400 text-xs mb-4">
        ⚠️ Table reservation is for bottle service only. All guests must purchase separate General Admission tickets for entry.
      </p>
      <Link 
        to={`/events/${eventId}/vip-tables`}
        className="inline-block px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-lg hover:from-amber-400 hover:to-yellow-400 transition-all"
      >
        Reserve VIP Table
      </Link>
    </div>
  );
}

export default VIPTableSection;

