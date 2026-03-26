import { Button } from "@/components/ui/button";
import { AlertTriangle, XCircle, CheckCircle, Crown } from "lucide-react";

interface ScanResultOverlayProps {
  status: "valid" | "used" | "invalid" | "vip";
  message: string;
  ticket?: {
    guest_name?: string;
    attendee_name?: string;
    ticket_type?: string;
    event_name?: string;
    table_number?: string;
  };
  onReset: () => void;
  overrideUsed?: boolean;
}

export function ScanResultOverlay({
  status,
  message,
  ticket,
  onReset,
  overrideUsed,
}: ScanResultOverlayProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "valid":
        return {
          bg: "bg-green-600",
          icon: CheckCircle,
          title: "VALID",
        };
      case "vip":
        return {
          bg: "bg-gradient-to-br from-amber-500 to-yellow-600",
          icon: Crown,
          title: "VIP ENTRY",
        };
      case "used":
        return {
          bg: "bg-yellow-600",
          icon: AlertTriangle,
          title: "ALREADY USED",
        };
      case "invalid":
      default:
        return {
          bg: "bg-red-600",
          icon: XCircle,
          title: "INVALID",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const guestName = ticket?.guest_name || ticket?.attendee_name || "Guest";

  return (
    <div
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 ${config.bg}`}
    >
      <div className="text-center text-white max-w-sm">
        {/* Status Icon */}
        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
          <Icon className="w-14 h-14 text-white" />
        </div>

        {/* Status Title */}
        <h2 className="text-3xl font-bold mb-2">{config.title}</h2>

        {/* Override Badge */}
        {overrideUsed && (
          <div className="inline-block px-3 py-1 mb-3 rounded-full bg-white/20 text-sm">
            Override Used
          </div>
        )}

        {/* Message */}
        <p className="text-lg mb-4 opacity-90">{message}</p>

        {/* Ticket Info Card */}
        {ticket && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 text-left mb-6">
            <p className="font-semibold text-lg">{guestName}</p>
            {ticket.ticket_type && (
              <p className="text-sm opacity-80">{ticket.ticket_type}</p>
            )}
            {ticket.event_name && (
              <p className="text-sm opacity-80">{ticket.event_name}</p>
            )}
            {ticket.table_number && (
              <p className="text-sm opacity-80 mt-1">
                Table {ticket.table_number}
              </p>
            )}
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={onReset}
          className="bg-white text-black hover:bg-gray-100 rounded-full px-8 h-12 text-base font-semibold"
        >
          Scan Next
        </Button>
      </div>
    </div>
  );
}
