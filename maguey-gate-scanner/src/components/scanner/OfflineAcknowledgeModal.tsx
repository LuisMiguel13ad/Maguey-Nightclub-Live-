import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OfflineAcknowledgeModalProps {
  onAcknowledge: () => void;
}

/**
 * Full-screen offline acknowledgment modal.
 * Per context decision: Staff must acknowledge before continuing to scan.
 * Uses orange background for visibility in dark environment.
 */
export function OfflineAcknowledgeModal({ onAcknowledge }: OfflineAcknowledgeModalProps) {
  return (
    <div className="fixed inset-0 z-[200] bg-orange-500 flex flex-col items-center justify-center p-6">
      <WifiOff className="h-24 w-24 text-white mb-8" />
      <h2 className="text-3xl font-black text-white mb-4 text-center">
        OFFLINE MODE
      </h2>
      <p className="text-white/90 text-lg text-center mb-8 max-w-md">
        Network connection lost. Scans will be queued and synced when connection is restored.
      </p>
      <Button
        onClick={onAcknowledge}
        className="bg-white text-orange-600 hover:bg-white/90 text-lg font-bold px-8 py-6 h-auto min-h-[56px]"
      >
        I Understand - Continue Scanning
      </Button>
    </div>
  );
}
