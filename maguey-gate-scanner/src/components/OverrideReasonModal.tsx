/**
 * Override Reason Modal
 * Modal for selecting override reason when using override during scan
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import type { OverrideType } from "@/lib/emergency-override-service";

interface OverrideReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, notes: string, overrideType: OverrideType) => void;
  overrideType: OverrideType;
}

const PREDEFINED_REASONS = [
  "Venue Capacity Issue",
  "System Malfunction",
  "VIP Guest",
  "Media/Staff",
  "Emergency Situation",
];

export const OverrideReasonModal = ({
  open,
  onClose,
  onConfirm,
  overrideType,
}: OverrideReasonModalProps) => {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) {
      return;
    }

    onConfirm(reason, notes, overrideType);
    setReason("");
    setNotes("");
    onClose();
  };

  const handleClose = () => {
    setReason("");
    setNotes("");
    onClose();
  };

  const getOverrideTypeLabel = (type: OverrideType): string => {
    const labels: Record<OverrideType, string> = {
      capacity: "Capacity Limit",
      refund: "Refund Check",
      transfer: "Transfer Restriction",
      id_verification: "ID Verification",
      duplicate: "Duplicate Scan",
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Override Reason Required
          </DialogTitle>
          <DialogDescription>
            Please provide a reason for overriding {getOverrideTypeLabel(overrideType)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {PREDEFINED_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!reason.trim()}
            className="bg-red-600 hover:bg-red-700"
          >
            Confirm Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

