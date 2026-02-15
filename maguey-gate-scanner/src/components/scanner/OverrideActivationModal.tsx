/**
 * Override Activation Modal
 * Modal for activating emergency override mode with PIN entry
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Lock, Clock } from "lucide-react";
import { activateOverride, verifyOverridePIN, setOverridePIN } from "@/lib/emergency-override-service";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OverrideActivationModalProps {
  open: boolean;
  onClose: () => void;
  onActivated: () => void;
  userId: string | null;
}

const PREDEFINED_REASONS = [
  "Venue Capacity Issue",
  "System Malfunction",
  "VIP Guest",
  "Media/Staff",
  "Emergency Situation",
];

const OVERRIDE_DURATIONS = [
  { label: "5 minutes", value: 5 * 60 * 1000 },
  { label: "10 minutes", value: 10 * 60 * 1000 },
  { label: "15 minutes", value: 15 * 60 * 1000 },
  { label: "30 minutes", value: 30 * 60 * 1000 },
  { label: "1 hour", value: 60 * 60 * 1000 },
];

export const OverrideActivationModal = ({
  open,
  onClose,
  onActivated,
  userId,
}: OverrideActivationModalProps) => {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [duration, setDuration] = useState(15 * 60 * 1000);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Check if PIN is already set
  const hasExistingPIN = typeof window !== 'undefined' && localStorage.getItem('emergency_override_pin_hash') !== null;

  const handleSetupPIN = () => {
    if (pin.length < 4) {
      toast({
        variant: "destructive",
        title: "PIN Too Short",
        description: "PIN must be at least 4 characters",
      });
      return;
    }

    if (pin !== confirmPin) {
      toast({
        variant: "destructive",
        title: "PINs Don't Match",
        description: "Please ensure both PIN fields match",
      });
      return;
    }

    setIsSettingUp(true);
    setOverridePIN(pin);
    setIsSettingUp(false);
    setPin("");
    setConfirmPin("");

    toast({
      title: "PIN Set",
      description: "Emergency override PIN has been set successfully",
    });
  };

  const handleActivate = () => {
    if (!pin) {
      toast({
        variant: "destructive",
        title: "PIN Required",
        description: "Please enter your override PIN",
      });
      return;
    }

    if (!hasExistingPIN && pin.length < 4) {
      toast({
        variant: "destructive",
        title: "PIN Too Short",
        description: "PIN must be at least 4 characters",
      });
      return;
    }

    setIsActivating(true);

    // If no existing PIN, set it first
    if (!hasExistingPIN) {
      setOverridePIN(pin);
    }

    const success = activateOverride(pin, userId, duration);

    setIsActivating(false);

    if (success) {
      toast({
        title: "Override Mode Activated",
        description: `Emergency override mode is now active for ${duration / 60000} minutes`,
      });
      setPin("");
      setConfirmPin("");
      onActivated();
      onClose();
    } else {
      toast({
        variant: "destructive",
        title: "Activation Failed",
        description: "Invalid PIN. Please try again.",
      });
    }
  };

  const handleClose = () => {
    setPin("");
    setConfirmPin("");
    setIsSettingUp(false);
    setIsActivating(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Activate Emergency Override Mode
          </DialogTitle>
          <DialogDescription>
            Override mode bypasses normal validation checks. Use only in emergency situations.
          </DialogDescription>
        </DialogHeader>

        <Alert className="mb-4 border-red-500/50 bg-red-500/10">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-sm">
            All override actions will be logged and audited. This mode will automatically expire.
          </AlertDescription>
        </Alert>

        <div className="space-y-4 py-4">
          {!hasExistingPIN && (
            <div className="space-y-2">
              <Label htmlFor="setup-pin">Set Override PIN (First Time)</Label>
              <Input
                id="setup-pin"
                type="password"
                placeholder="Enter PIN (min 4 characters)"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={20}
              />
              <Input
                type="password"
                placeholder="Confirm PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                maxLength={20}
              />
              <Button
                onClick={handleSetupPIN}
                disabled={isSettingUp || !pin || !confirmPin}
                variant="outline"
                className="w-full"
              >
                <Lock className="h-4 w-4 mr-2" />
                Set PIN
              </Button>
            </div>
          )}

          {hasExistingPIN && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pin">Enter Override PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  placeholder="Enter your override PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={20}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Override Duration</Label>
                <Select
                  value={duration.toString()}
                  onValueChange={(value) => setDuration(parseInt(value))}
                >
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OVERRIDE_DURATIONS.map((dur) => (
                      <SelectItem key={dur.value} value={dur.value.toString()}>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {dur.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isActivating || isSettingUp}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          {hasExistingPIN && (
            <Button
              onClick={handleActivate}
              disabled={isActivating || !pin}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {isActivating ? "Activating..." : "Activate Override Mode"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

