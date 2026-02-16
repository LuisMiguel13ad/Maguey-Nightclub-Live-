// VIP Guest Dashboard - Shows guest list for VIP table bookers
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, Crown, Calendar, MapPin, Check, Copy, Wine, Loader2, UserCheck, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CustomCursor } from '@/components/CustomCursor';
import { toast } from 'sonner';

interface LinkedTicket {
  id: string;
  purchased_by_email: string;
  purchased_by_name: string | null;
  is_booker_purchase: boolean;
  created_at: string;
  tickets: {
    id: string;
    status: string;
    ticket_id: string;
  };
}

interface VIPReservation {
  id: string;
  event_id: string;
  table_number: number;
  purchaser_name: string;
  purchaser_email: string;
  status: string;
  invite_code: string | null;
  created_at: string;
  event_vip_tables: {
    capacity: number;
    tier: string;
    bottles_included: number;
  };
}

interface Event {
  id: string;
  name: string;
  event_date: string;
  venue_name: string | null;
  image_url: string | null;
}

export default function VIPGuestDashboard() {
  const { reservationId } = useParams();
  const [loading, setLoading] = useState(true);
  const [reservation, setReservation] = useState<VIPReservation | null>(null);
  const [linkedTickets, setLinkedTickets] = useState<LinkedTicket[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, [reservationId]);

  const loadData = async () => {
    if (!reservationId) return;

    try {
      // Fetch reservation with table details
      const { data: res, error: resError } = await supabase
        .from('vip_reservations')
        .select('*, event_vip_tables(capacity, tier, bottles_included)')
        .eq('id', reservationId)
        .single();

      if (resError) {
        console.error('Error fetching reservation:', resError);
        return;
      }

      setReservation(res);

      // Fetch event details
      if (res?.event_id) {
        const { data: eventData } = await supabase
          .from('events')
          .select('id, name, event_date, venue_name, image_url')
          .eq('id', res.event_id)
          .single();

        if (eventData) {
          setEvent(eventData);
        }
      }

      // Fetch linked tickets
      const { data: tickets, error: ticketsError } = await supabase
        .from('vip_linked_tickets')
        .select('*, tickets(id, status, ticket_id)')
        .eq('vip_reservation_id', reservationId)
        .order('created_at', { ascending: true });

      if (!ticketsError && tickets) {
        setLinkedTickets(tickets);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (!reservation?.invite_code || !event?.id) return;

    const link = `${window.location.origin}/checkout?event=${event.id}&vip=${reservation.invite_code}`;
    navigator.clipboard.writeText(link);
    setInviteLinkCopied(true);
    toast.success('Invite link copied to clipboard!');
    setTimeout(() => setInviteLinkCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTier = (tier: string) => {
    return tier?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Standard';
  };

  const capacity = reservation?.event_vip_tables?.capacity || 6;
  const linkedCount = linkedTickets.length;
  const remainingSpots = capacity - linkedCount;

  if (loading) {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-copper-400" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Loading Guest List...
        </p>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center gap-4 text-stone-300">
        <Crown className="w-16 h-16 text-copper-400/50" />
        <h1 className="text-xl font-light">Reservation Not Found</h1>
        <Link to="/" className="text-copper-400 hover:underline">Back to Events</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest-950 text-stone-300">
      <CustomCursor />

      {/* Noise Overlay */}
      <div className="noise-overlay" />

      {/* Header */}
      <header className="bg-forest-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-copper-400/70 hover:text-copper-400 p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-light text-stone-100 tracking-wide" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                VIP <span className="italic text-copper-400">Guest List</span>
              </h1>
              <p className="text-sm text-stone-500">Table {reservation.table_number} • {formatTier(reservation.event_vip_tables?.tier)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Event & Table Info Card */}
        <div className="bg-white/[0.02] backdrop-blur-sm rounded-sm border border-white/5 overflow-hidden mb-6">
          {/* Event Banner */}
          {event?.image_url && (
            <div className="relative h-32">
              <img
                src={event.image_url}
                alt={event?.name}
                className="absolute inset-0 w-full h-full object-cover opacity-40"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-forest-950 to-transparent" />
            </div>
          )}

          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-14 h-14 rounded-sm flex items-center justify-center font-bold text-xl ${reservation.event_vip_tables?.tier === 'premium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                reservation.event_vip_tables?.tier === 'front_row' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                  'bg-copper-400/20 text-copper-400 border border-copper-400/30'
                }`}>
                {reservation.table_number}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-light text-stone-100" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                  {`Table ${reservation.table_number}`}
                </h2>
                <p className={`text-sm ${reservation.event_vip_tables?.tier === 'premium' ? 'text-amber-400' :
                  reservation.event_vip_tables?.tier === 'front_row' ? 'text-purple-400' :
                    'text-copper-400'
                  }`}>
                  {formatTier(reservation.event_vip_tables?.tier)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-stone-500">Reserved by</p>
                <p className="text-stone-200">{reservation.purchaser_name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2 text-stone-500">
                <Calendar className="w-4 h-4 text-copper-400" />
                <span>{event ? formatDate(event.event_date) : '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-stone-500">
                <MapPin className="w-4 h-4 text-copper-400" />
                <span>{event?.venue_name || 'Maguey Nightclub'}</span>
              </div>
              <div className="flex items-center gap-2 text-stone-500">
                <Users className="w-4 h-4 text-copper-400" />
                <span>Capacity: {capacity} guests</span>
              </div>
              <div className="flex items-center gap-2 text-stone-500">
                <Wine className="w-4 h-4 text-copper-400" />
                <span>{reservation.event_vip_tables?.bottles_included || 1} bottle(s)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Guest Progress Bar */}
        <div className="bg-white/[0.02] backdrop-blur-sm rounded-sm border border-white/5 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-stone-200 font-medium flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-copper-400" />
              Guest Status
            </h3>
            <span className="text-sm text-stone-400">
              {linkedCount} / {capacity} confirmed
            </span>
          </div>
          <div className="h-3 bg-forest-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-copper-400 to-copper-500 rounded-full transition-all duration-500"
              style={{ width: `${(linkedCount / capacity) * 100}%` }}
            />
          </div>
          {remainingSpots > 0 && (
            <p className="text-xs text-stone-500 mt-2">
              {remainingSpots} spot{remainingSpots !== 1 ? 's' : ''} remaining. Share your invite link to fill your table!
            </p>
          )}
        </div>

        {/* Invite Link */}
        {reservation.invite_code && (
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-sm p-6 mb-6">
            <h3 className="font-semibold text-stone-200 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              Invite Link
            </h3>
            <p className="text-sm text-stone-400 mb-3">
              Share this link with your guests to purchase their GA tickets and be linked to your VIP table.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/checkout?event=${event?.id}&vip=${reservation.invite_code}`}
                className="flex-1 bg-forest-900 border border-white/10 rounded-sm px-4 py-3 text-stone-300 text-sm font-mono"
              />
              <button
                onClick={copyInviteLink}
                className="px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-sm transition-colors flex items-center gap-2"
              >
                {inviteLinkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {inviteLinkCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Guest List */}
        <div className="bg-white/[0.02] backdrop-blur-sm rounded-sm border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-stone-200 font-medium">Guest List</h3>
          </div>

          {linkedTickets.length === 0 ? (
            <div className="p-8 text-center text-stone-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No guests have purchased tickets yet.</p>
              <p className="text-sm mt-1">Share your invite link to start filling your table!</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {linkedTickets.map((ticket, index) => (
                <div key={ticket.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${ticket.is_booker_purchase
                      ? 'bg-copper-400/20 text-copper-400 border border-copper-400/30'
                      : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-stone-200 font-medium">
                        {ticket.purchased_by_name || 'Guest'}
                        {ticket.is_booker_purchase && (
                          <span className="ml-2 text-xs text-copper-400">(Booker)</span>
                        )}
                      </p>
                      <p className="text-sm text-stone-500">{ticket.purchased_by_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {ticket.tickets?.status === 'checked_in' ? (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Checked In
                      </span>
                    ) : ticket.tickets?.status === 'issued' ? (
                      <span className="px-2 py-1 bg-copper-400/20 text-copper-400 rounded-full text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Confirmed
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-stone-500/20 text-stone-400 rounded-full text-xs">
                        {ticket.tickets?.status || 'Pending'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link
            to={event ? `/checkout?event=${event.id}${reservation.invite_code ? `&vip=${reservation.invite_code}` : ''}` : '/'}
            className="flex-1 bg-copper-400 hover:bg-copper-500 text-forest-950 font-semibold py-3 rounded-sm transition-all flex items-center justify-center gap-2"
          >
            Buy More Tickets
          </Link>
          <Link
            to="/"
            className="flex-1 bg-white/5 hover:bg-white/10 text-stone-300 font-medium py-3 rounded-sm transition-all flex items-center justify-center gap-2 border border-white/10"
          >
            Back to Events
          </Link>
        </div>
      </main>
    </div>
  );
}
