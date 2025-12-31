import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Wine, Users, Calendar, MapPin, Clock, QrCode, 
  Share2, Copy, Check, 
  ChevronDown, ChevronUp, Crown,
  User, Send, ExternalLink
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';

interface VIPReservation {
  id: string;
  event_id: string;
  event_vip_table_id: string;
  table_number: number;
  purchaser_name: string;
  purchaser_email: string;
  purchaser_phone: string;
  amount_paid_cents: number;
  status: string;
  package_snapshot: {
    tier?: string;
    guestCount?: number;
    celebration?: string;
    estimatedArrival?: string;
    bottlesIncluded?: number;
  } | null;
  special_requests: string | null;
  created_at: string;
  events: {
    id: string;
    name: string;
    event_date: string;
    venue_name: string;
    image_url: string;
  } | null;
  event_vip_tables: {
    table_number: number;
    tier: string;
    guest_capacity: number;
    bottle_service_description: string;
  } | null;
}

interface GuestPass {
  id: string;
  pass_number: number;
  guest_name: string | null;
  guest_email: string | null;
  pass_type: 'host' | 'guest';
  qr_token: string;
  status: string;
  shared_at: string | null;
  scanned_at: string | null;
}

export function VIPReservationsSection() {
  const [reservations, setReservations] = useState<VIPReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReservation, setExpandedReservation] = useState<string | null>(null);
  const [guestPasses, setGuestPasses] = useState<Record<string, GuestPass[]>>({});
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState<GuestPass | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareName, setShareName] = useState('');
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadReservations();
  }, []);

  const loadReservations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('vip_reservations')
      .select(`
        *,
        events (*),
        event_vip_tables (*)
      `)
      .eq('purchaser_email', user.email)
      .in('status', ['confirmed', 'checked_in', 'completed'])
      .order('created_at', { ascending: false });

    if (data) {
      setReservations(data);
      // Load guest passes for each reservation
      for (const res of data) {
        loadGuestPasses(res.id);
      }
    }
    setLoading(false);
  };

  const loadGuestPasses = async (reservationId: string) => {
    const { data } = await supabase
      .from('vip_guest_passes')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('pass_number');

    if (data) {
      setGuestPasses(prev => ({ ...prev, [reservationId]: data }));
    }
  };

  const handleSharePass = async () => {
    if (!selectedPass || !shareEmail) return;
    
    setSharing(true);
    
    try {
      // Update the pass with guest info
      const { error } = await supabase
        .from('vip_guest_passes')
        .update({
          guest_name: shareName || null,
          guest_email: shareEmail,
          status: 'shared',
          shared_at: new Date().toISOString(),
          shared_via: 'email'
        })
        .eq('id', selectedPass.id);

      if (error) throw error;

      // Reload passes for the reservation
      const reservation = reservations.find(r => 
        guestPasses[r.id]?.some(p => p.id === selectedPass.id)
      );
      if (reservation) {
        loadGuestPasses(reservation.id);
      }

      setShareModalOpen(false);
      setSelectedPass(null);
      setShareEmail('');
      setShareName('');
    } catch (err) {
      console.error('Error sharing pass:', err);
    } finally {
      setSharing(false);
    }
  };

  const copyPassLink = (pass: GuestPass) => {
    const link = `${window.location.origin}/vip-pass/${pass.qr_token}`;
    navigator.clipboard.writeText(link);
    setCopied(pass.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTier = (tier: string) => {
    return tier?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Standard';
  };

  const getPassStatusBadge = (pass: GuestPass) => {
    if (pass.scanned_at) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Checked In</span>;
    }
    if (pass.status === 'shared') {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Shared</span>;
    }
    if (pass.status === 'assigned') {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Assigned</span>;
    }
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Available</span>;
  };

  if (loading) {
    return (
      <div className="bg-zinc-900/50 rounded-2xl p-8 border border-zinc-800">
        <div className="flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <div className="bg-gradient-to-br from-amber-900/20 to-zinc-900/50 rounded-2xl p-8 border border-amber-500/20">
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wine className="w-8 h-8 text-amber-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No VIP Reservations</h3>
          <p className="text-gray-400 mb-6">
            Reserve a VIP table for bottle service at your next event
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold px-6 py-3 rounded-xl hover:from-amber-400 hover:to-yellow-400 transition-all"
          >
            <Crown className="w-5 h-5" />
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
          <Crown className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">VIP Reservations</h2>
          <p className="text-sm text-gray-400">Your bottle service reservations and guest passes</p>
        </div>
      </div>

      {reservations.map((reservation) => {
        const guestCount = reservation.package_snapshot?.guestCount || 6;
        const tier = reservation.event_vip_tables?.tier || reservation.package_snapshot?.tier || 'standard';
        const tableNumber = reservation.event_vip_tables?.table_number || reservation.table_number;
        
        return (
          <div 
            key={reservation.id}
            className="bg-gradient-to-br from-amber-900/10 to-zinc-900/50 rounded-2xl border border-amber-500/20 overflow-hidden"
          >
            {/* Reservation Header */}
            <div 
              className="p-6 cursor-pointer hover:bg-amber-500/5 transition-colors"
              onClick={() => setExpandedReservation(
                expandedReservation === reservation.id ? null : reservation.id
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  {/* Event Image */}
                  {reservation.events?.image_url ? (
                    <img 
                      src={reservation.events.image_url}
                      alt={reservation.events.name}
                      className="w-20 h-20 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-amber-500/20 rounded-xl flex items-center justify-center">
                      <Wine className="w-8 h-8 text-amber-400" />
                    </div>
                  )}
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        tier === 'premium' 
                          ? 'bg-amber-500/20 text-amber-400' 
                          : tier === 'front_row'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        Table {tableNumber}
                      </span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-400">
                        {formatTier(tier)}
                      </span>
                    </div>
                    
                    <h3 className="font-bold text-white text-lg">{reservation.events?.name || 'VIP Reservation'}</h3>
                    
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {reservation.events?.event_date ? formatDate(reservation.events.event_date) : 'TBD'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {guestCount} guests
                      </span>
                      <span className="flex items-center gap-1">
                        <Wine className="w-4 h-4" />
                        {reservation.package_snapshot?.bottlesIncluded || 1} bottle{(reservation.package_snapshot?.bottlesIncluded || 1) > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-400">${(reservation.amount_paid_cents / 100).toFixed(0)}</p>
                    <p className="text-xs text-gray-500">paid</p>
                  </div>
                  {expandedReservation === reservation.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedReservation === reservation.id && (
              <div className="border-t border-amber-500/20">
                {/* Reservation Details */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Arrival Time</span>
                        <span className="text-white">{reservation.package_snapshot?.estimatedArrival || '10:00 PM'}</span>
                      </div>
                      {reservation.package_snapshot?.celebration && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Occasion</span>
                          <span className="text-white capitalize">{reservation.package_snapshot.celebration.replace('_', ' ')}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Capacity</span>
                        <span className="text-white">{reservation.event_vip_tables?.guest_capacity || guestCount} guests max</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Location</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-white">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        {reservation.events?.venue_name || 'Maguey Delaware'}
                      </div>
                      <p className="text-gray-500">3320 Old Capitol Trail, Wilmington, DE</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Important</h4>
                    <ul className="text-xs text-gray-400 space-y-1">
                      <li>• Table held for 30 min past arrival</li>
                      <li>• GA tickets required for entry</li>
                      <li>• Tax & gratuity paid at venue</li>
                    </ul>
                  </div>
                </div>

                {/* Guest Passes Section */}
                <div className="p-6 bg-zinc-900/50 border-t border-zinc-800">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-white flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-amber-400" />
                      Guest Passes
                    </h4>
                    <p className="text-sm text-gray-400">
                      {guestPasses[reservation.id]?.filter(p => p.status === 'assigned' || p.status === 'shared' || p.scanned_at).length || 0} / {guestCount} assigned
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {guestPasses[reservation.id]?.map((pass) => (
                      <div 
                        key={pass.id}
                        className={`rounded-xl p-4 border ${
                          pass.pass_type === 'host' 
                            ? 'bg-amber-500/10 border-amber-500/30' 
                            : pass.scanned_at
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : pass.status === 'shared'
                            ? 'bg-blue-500/10 border-blue-500/30'
                            : 'bg-zinc-800/50 border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {pass.pass_type === 'host' ? (
                              <Crown className="w-4 h-4 text-amber-400" />
                            ) : (
                              <User className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="font-semibold text-white">
                              {pass.pass_type === 'host' ? 'Host Pass' : `Guest ${pass.pass_number}`}
                            </span>
                          </div>
                          {getPassStatusBadge(pass)}
                        </div>

                        {pass.guest_name || pass.guest_email ? (
                          <div className="mb-3">
                            <p className="text-white text-sm font-medium">{pass.guest_name || 'Guest'}</p>
                            {pass.guest_email && (
                              <p className="text-gray-400 text-xs truncate">{pass.guest_email}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm mb-3">Not yet assigned</p>
                        )}

                        {/* QR Code (small) */}
                        {!pass.scanned_at && (
                          <div className="flex items-center justify-between">
                            <div className="bg-white p-2 rounded-lg">
                              <QRCodeSVG 
                                value={`${window.location.origin}/vip-pass/${pass.qr_token}`}
                                size={48}
                              />
                            </div>
                            
                            <div className="flex gap-2">
                              {pass.pass_type !== 'host' && pass.status === 'available' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPass(pass);
                                    setShareModalOpen(true);
                                  }}
                                  className="p-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
                                  title="Share Pass"
                                >
                                  <Share2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyPassLink(pass);
                                }}
                                className="p-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
                                title="Copy Link"
                              >
                                {copied === pass.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        )}

                        {pass.scanned_at && (
                          <p className="text-xs text-emerald-400 mt-2">
                            ✓ Checked in at {new Date(pass.scanned_at).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Buy GA Tickets CTA */}
                  <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <p className="text-emerald-400 font-semibold">Don't forget GA tickets!</p>
                        <p className="text-sm text-gray-400">All guests need General Admission tickets for entry</p>
                      </div>
                      <Link
                        to={`/events/${reservation.event_id}`}
                        className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg transition-colors"
                      >
                        Buy Tickets
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Share Modal */}
      {shareModalOpen && selectedPass && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShareModalOpen(false)}>
          <div className="bg-zinc-900 rounded-2xl w-full max-w-md border border-zinc-700" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-white">Share Guest Pass</h3>
              <p className="text-sm text-gray-400">Send this pass to a friend</p>
            </div>

            <div className="p-6 space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG 
                    value={`${window.location.origin}/vip-pass/${selectedPass.qr_token}`}
                    size={150}
                  />
                </div>
              </div>

              {/* Share via Email */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Friend's Name (optional)</label>
                <input
                  type="text"
                  value={shareName}
                  onChange={(e) => setShareName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Friend's Email</label>
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Copy Link */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Or share this link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/vip-pass/${selectedPass.qr_token}`}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-gray-400 text-sm"
                  />
                  <button
                    onClick={() => copyPassLink(selectedPass)}
                    className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
                  >
                    {copied === selectedPass.id ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-800 flex gap-3">
              <button
                onClick={() => {
                  setShareModalOpen(false);
                  setSelectedPass(null);
                  setShareEmail('');
                  setShareName('');
                }}
                className="flex-1 bg-zinc-800 text-white py-3 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSharePass}
                disabled={!shareEmail || sharing}
                className="flex-1 bg-amber-500 text-black font-bold py-3 rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sharing ? (
                  <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Pass
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

