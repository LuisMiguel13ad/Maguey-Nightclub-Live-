import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VIPTable } from './types';
import { Users, Wine, Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BookingPanelProps {
  selectedTable: VIPTable | undefined;
  onContinue: () => void;
  onClear?: () => void;
  eventId?: string;
}

// Tier badge styles
const tierBadgeStyles: Record<string, string> = {
  premium: 'bg-amber-500 text-black',
  front_row: 'bg-amber-500 text-black',
  standard: 'bg-purple-500 text-white',
  regular: 'bg-blue-500 text-white',
};

const BookingPanel: React.FC<BookingPanelProps> = ({ 
  selectedTable, 
  onContinue,
  onClear,
  eventId 
}) => {
  if (!selectedTable) {
    return null;
  }

  const tierLabel = selectedTable.tier === 'front_row' ? 'FRONT ROW' : selectedTable.tier.toUpperCase();
  const tierBadgeClass = tierBadgeStyles[selectedTable.tier] || tierBadgeStyles.regular;

  // Get bottle info from description or default
  const bottleInfo = selectedTable.bottle_service_description || '1 Bottle';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Blue accent line at top */}
      <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500" />
      
      {/* Main panel */}
      <div className="bg-[#0d1a1a] border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          {/* Main content row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left side - Table info */}
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Tier badge and table name */}
              <div className="flex items-center gap-3">
                <Badge className={cn('text-xs font-bold px-2.5 py-1', tierBadgeClass)}>
                  {tierLabel}
                </Badge>
                <h3 className="text-white text-lg sm:text-xl font-semibold">
                  Table {selectedTable.tableNumber}
                </h3>
              </div>
              
              {/* Capacity */}
              <div className="flex items-center gap-2 text-gray-300">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm">Capacity: <span className="font-medium">{selectedTable.guest_capacity} Guests</span></span>
              </div>
              
              {/* Bottle service */}
              <div className="hidden sm:flex items-center gap-2 text-gray-300">
                <Wine className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{bottleInfo}</span>
              </div>
            </div>

            {/* Right side - Price and button */}
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Price */}
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total Price</p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  ${selectedTable.price.toLocaleString()}
                </p>
              </div>
              
              {/* Continue button */}
              <Button
                onClick={onContinue}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg rounded-lg flex items-center gap-2"
              >
                Continue
                <Check className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-4 pt-4 border-t border-white/10 flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-500">
              Table reservation is for bottle service only. All guests must purchase separate General Admission tickets for entry. Price does not include tax and gratuity (paid at venue).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingPanel;
