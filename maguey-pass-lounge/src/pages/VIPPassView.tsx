import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Wine, Calendar, MapPin, Users, Clock, Crown, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';

interface PassData {
  id: string;
  pass_number: number;
  guest_name: string | null;
  guest_email: string | null;
  pass_type: 'host' | 'guest';
  qr_token: string;
  status: string;
  scanned_at: string | null;
}

interface ReservationData {
  id: string;
  table_number: number;
  purchaser_name: string;
  package_snapshot: {
    guestCount?: number;
    estimatedArrival?: string;
    tier?: string;
  } | null;
  event_vip_tables: {
    table_number: number;
    tier: string;
    guest_capacity: number;
  } | null;
  events: {
    id: string;
    name: string;
    event_date: string;
    venue_name: string;
    image_url: string;
  } | null;
}

export default function VIPPassView() {
  const { token } = useParams();
  const [pass, setPass] = useState<PassData | null>(null);
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPass();
  }, [token]);

  const loadPass = async () => {
    if (!token) {
      setError('Invalid pass');
      setLoading(false);
      return;
    }

    // Fetch pass with related data via RPC (bypasses RLS with token-based lookup)
    const { data: passData, error: passError } = await supabase
      .rpc('get_vip_pass_by_token', { p_qr_token: token });

    if (passError || !passData) {
      setError('Pass not found');
      setLoading(false);
      return;
    }

    setPass(passData);
    setReservation(passData.vip_reservations);
    setLoading(false);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTier = (tier: string) => {
    return tier?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Standard';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-amber-950/20 to-zinc-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-red-950/20 to-zinc-950 flex items-center justify-center p-6">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Pass</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-zinc-800 text-white px-6 py-3 rounded-xl hover:bg-zinc-700 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (pass?.scanned_at) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-emerald-950/20 to-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <CheckCircle className="w-20 h-20 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Already Checked In</h1>
          <p className="text-gray-400 mb-2">This pass was used at:</p>
          <p className="text-emerald-400 font-semibold text-lg">
            {new Date(pass.scanned_at).toLocaleString()}
          </p>
          
          <div className="mt-8 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
            <p className="text-gray-400 text-sm">
              If you believe this is an error, please contact the venue staff.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tier = reservation?.event_vip_tables?.tier || reservation?.package_snapshot?.tier || 'standard';
  const tableNumber = reservation?.event_vip_tables?.table_number || reservation?.table_number;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-amber-950/20 to-zinc-950 p-4 sm:p-6">
      {/* Decorative elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-1/4 w-2 h-2 bg-amber-400/30 rounded-full blur-[1px] animate-pulse" />
        <div className="absolute top-40 right-1/3 w-1.5 h-1.5 bg-amber-300/20 rounded-full blur-[1px]" />
        <div className="absolute bottom-40 left-1/3 w-2 h-2 bg-yellow-500/20 rounded-full blur-[1px] animate-pulse" />
      </div>

      <div className="max-w-md mx-auto relative">
        {/* Pass Card */}
        <div className="bg-gradient-to-br from-amber-900/30 to-zinc-900 rounded-3xl border border-amber-500/30 overflow-hidden shadow-2xl shadow-amber-500/10">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-6 text-center relative overflow-hidden">
            {/* Simple gradient overlay instead of SVG pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <div className="relative">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Crown className="w-6 h-6 text-black" />
                <span className="text-black font-bold text-lg uppercase tracking-wider">VIP Guest Pass</span>
              </div>
              <p className="text-black/70 text-sm font-medium">
                {pass?.pass_type === 'host' ? '★ Host Pass ★' : `Guest #${pass?.pass_number}`}
              </p>
            </div>
          </div>

          {/* QR Code */}
          <div className="p-8 flex justify-center bg-white">
            <div className="relative">
              <QRCodeSVG 
                value={`${window.location.origin}/vip-pass/${token}`}
                size={200}
                level="H"
                includeMargin={false}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                  <Crown className="w-6 h-6 text-amber-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Event Details */}
          <div className="p-6 space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-1">{reservation?.events?.name || 'VIP Event'}</h2>
              <p className={`font-semibold ${
                tier === 'premium' 
                  ? 'text-amber-400' 
                  : tier === 'front_row'
                  ? 'text-purple-400'
                  : 'text-blue-400'
              }`}>
                Table {tableNumber} • {formatTier(tier)}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Date</p>
                  <p className="text-white font-medium">{reservation?.events?.event_date ? formatDate(reservation.events.event_date) : 'TBD'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Venue</p>
                  <p className="text-white font-medium">{reservation?.events?.venue_name || 'Maguey Delaware'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Arrival</p>
                  <p className="text-white font-medium">{reservation?.package_snapshot?.estimatedArrival || '10:00 PM'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Party Size</p>
                  <p className="text-white font-medium">{reservation?.package_snapshot?.guestCount || 6} Guests</p>
                </div>
              </div>
            </div>

            {/* Guest Name */}
            {pass?.guest_name && (
              <div className="mt-6 pt-4 border-t border-zinc-700/50 text-center">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Guest Name</p>
                <p className="text-white font-bold text-xl">{pass.guest_name}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-zinc-900/80 border-t border-zinc-800">
            <p className="text-xs text-center text-gray-500">
              Present this QR code at the VIP entrance.<br />
              This pass is valid for <span className="text-amber-400 font-semibold">one-time entry only</span>.
            </p>
          </div>
        </div>

        {/* Important Notice */}
        <div className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 font-semibold text-sm mb-2">Important Information</p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• This is a VIP table access pass only</li>
                <li>• You still need a GA ticket for event entry</li>
                <li>• Valid ID required at entrance</li>
                <li>• Pass is non-transferable once scanned</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Add to Wallet / Save CTA */}
        <div className="mt-4 text-center">
          <p className="text-gray-500 text-xs">
            Screenshot this pass for offline access
          </p>
        </div>
      </div>
    </div>
  );
}

