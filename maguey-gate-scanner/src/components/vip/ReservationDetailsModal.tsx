/**
 * Reservation Details Modal
 * Shows detailed information about a VIP table reservation
 */

import { X, User, Phone, Mail, Users, Wine, PartyPopper, Clock, MessageSquare, Calendar, CreditCard, CheckCircle2, XCircle, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReservationDetailsModalProps {
  reservation: {
    id: string;
    customer_first_name: string;
    customer_last_name: string;
    customer_phone?: string;
    customer_email?: string;
    guest_count: number;
    celebration?: string;
    celebrant_name?: string;
    bottle_preferences?: string;
    special_requests?: string;
    estimated_arrival?: string;
    notes?: string;
    status: string;
    payment_status?: string;
    amount_cents?: number;
    created_at: string;
    bottle_service_choice?: string;
  };
  table: {
    table_number: number;
    tier: 'premium' | 'front_row' | 'standard';
    capacity: number;
    price_cents: number;
    bottles_included: number;
  };
  onClose: () => void;
  onCheckIn: () => void;
  onCancel: () => void;
  onMarkComplete?: () => void;
  isLoading?: boolean;
}

export function ReservationDetailsModal({ 
  reservation, 
  table, 
  onClose, 
  onCheckIn, 
  onCancel,
  onMarkComplete,
  isLoading = false,
}: ReservationDetailsModalProps) {
  
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      confirmed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      arrived: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      checked_in: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return styles[status] || styles.pending;
  };

  const getTierStyles = (tier: string) => {
    const styles: Record<string, string> = {
      premium: 'bg-amber-500/20 text-amber-400 border-2 border-amber-500/50',
      front_row: 'bg-purple-500/20 text-purple-400 border-2 border-purple-500/50',
      standard: 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50',
    };
    return styles[tier] || styles.standard;
  };

  const formatCelebration = (celebration?: string) => {
    if (!celebration) return null;
    const labels: Record<string, string> = {
      birthday: '🎂 Birthday',
      bachelor: '🎉 Bachelor Party',
      bachelorette: '👰 Bachelorette Party',
      anniversary: '💕 Anniversary',
      corporate: '💼 Corporate Event',
      girls_night: '👯 Girls Night Out',
      guys_night: '🍻 Guys Night Out',
      promotion: '🎊 Promotion/Celebration',
      other: '✨ Other',
    };
    return labels[celebration] || celebration;
  };

  const customerName = `${reservation.customer_first_name} ${reservation.customer_last_name}`;
  const amountPaid = reservation.amount_cents ? reservation.amount_cents / 100 : table.price_cents / 100;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-zinc-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-14 h-14 rounded-xl flex items-center justify-center font-bold text-2xl',
              getTierStyles(table.tier)
            )}>
              {table.table_number}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Table {table.table_number} Reservation</h2>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full border inline-block mt-1',
                getStatusBadge(reservation.status)
              )}>
                {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1).replace('_', ' ')}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-400">Name</p>
                  <p className="font-semibold text-white truncate">{customerName}</p>
                </div>
              </div>
              {reservation.customer_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-400">Phone</p>
                    <a 
                      href={`tel:${reservation.customer_phone}`} 
                      className="font-semibold text-white hover:text-amber-400 transition-colors truncate block"
                    >
                      {reservation.customer_phone}
                    </a>
                  </div>
                </div>
              )}
              {reservation.customer_email && (
                <div className="flex items-center gap-3 sm:col-span-2">
                  <Mail className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-400">Email</p>
                    <a 
                      href={`mailto:${reservation.customer_email}`} 
                      className="font-semibold text-white hover:text-amber-400 transition-colors truncate block"
                    >
                      {reservation.customer_email}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Party Details */}
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Party Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-400">Guests</p>
                  <p className="font-semibold text-white">{reservation.guest_count} people</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-400">Est. Arrival</p>
                  <p className="font-semibold text-white">{reservation.estimated_arrival || 'Not specified'}</p>
                </div>
              </div>
              {reservation.celebration && (
                <div className="flex items-center gap-3">
                  <PartyPopper className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-400">Occasion</p>
                    <p className="font-semibold text-white">{formatCelebration(reservation.celebration)}</p>
                  </div>
                </div>
              )}
              {reservation.celebrant_name && (
                <div className="flex items-center gap-3">
                  <PartyPopper className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-400">Celebrating</p>
                    <p className="font-semibold text-amber-400">{reservation.celebrant_name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottle & Special Requests */}
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Service Details</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Wine className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-400">Bottle Preferences</p>
                  <p className="text-white">
                    {reservation.bottle_preferences || reservation.bottle_service_choice || 'No preference specified'}
                  </p>
                </div>
              </div>
              {(reservation.special_requests || reservation.notes) && (
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-400">Special Requests</p>
                    <p className="text-white whitespace-pre-wrap">{reservation.special_requests || reservation.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Payment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-400">Amount Paid</p>
                  <p className="font-bold text-xl text-amber-400">${amountPaid.toFixed(0)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-400">Booked On</p>
                  <p className="font-semibold text-white">{formatDate(reservation.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-zinc-800">
            {reservation.status === 'confirmed' && (
              <button
                onClick={onCheckIn}
                disabled={isLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-colors"
              >
                <UserCheck className="w-5 h-5" />
                Check In Guest
              </button>
            )}
            {(reservation.status === 'arrived' || reservation.status === 'checked_in') && onMarkComplete && (
              <button
                onClick={onMarkComplete}
                disabled={isLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-colors"
              >
                <CheckCircle2 className="w-5 h-5" />
                Mark as Completed
              </button>
            )}
            {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-6 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-red-400 font-bold py-3 rounded-xl transition-colors border border-red-500/30"
              >
                <XCircle className="w-5 h-5" />
                Cancel Reservation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReservationDetailsModal;

