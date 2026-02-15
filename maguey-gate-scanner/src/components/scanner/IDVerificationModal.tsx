import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { createIDVerification, skipIDVerification, type VerificationType } from "@/lib/id-verification-service";
import { Camera, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface IDVerificationModalProps {
  open: boolean;
  onClose: () => void;
  ticketId: string;
  ticketTypeName?: string;
  attendeeName?: string;
  onVerified: () => void;
}

export const IDVerificationModal = ({
  open,
  onClose,
  ticketId,
  ticketTypeName,
  attendeeName,
  onVerified,
}: IDVerificationModalProps) => {
  const { toast } = useToast();
  const [verificationType, setVerificationType] = useState<VerificationType>('21+');
  const [idNumber, setIdNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!ticketId) {
      toast({
        title: "Error",
        description: "Ticket ID is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await createIDVerification({
        ticketId,
        verificationType,
        idNumber: idNumber || undefined,
        photoUrl: photoUrl || undefined,
        notes: notes || undefined,
        isVerified: true,
      });

      toast({
        title: "ID Verified",
        description: "ID verification recorded successfully",
      });

      onVerified();
      handleClose();
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to record ID verification",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!notes.trim()) {
      toast({
        title: "Notes Required",
        description: "Please provide a reason for skipping ID verification",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await skipIDVerification(ticketId, notes);

      toast({
        title: "Verification Skipped",
        description: "ID verification skipped with notes",
        variant: "default",
      });

      onVerified();
      handleClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to skip verification",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIdNumber('');
    setNotes('');
    setPhotoUrl(null);
    setVerificationType('21+');
    onClose();
  };

  const handleCameraCapture = () => {
    // Future: Implement camera capture
    toast({
      title: "Camera Feature",
      description: "Camera capture coming soon. Please enter ID number manually.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            ID Verification Required
          </DialogTitle>
          <DialogDescription>
            {attendeeName && (
              <span className="block mb-2">
                Verifying ID for: <strong>{attendeeName}</strong>
              </span>
            )}
            {ticketTypeName && (
              <Badge variant="outline" className="mb-2">
                {ticketTypeName}
              </Badge>
            )}
            Please verify the attendee's identification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Verification Type */}
          <div className="space-y-2">
            <Label htmlFor="verification-type">Verification Type</Label>
            <Select
              value={verificationType}
              onValueChange={(value) => setVerificationType(value as VerificationType)}
            >
              <SelectTrigger id="verification-type">
                <SelectValue placeholder="Select verification type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="18+">18+ (Age Verification)</SelectItem>
                <SelectItem value="21+">21+ (Alcohol Age Verification)</SelectItem>
                <SelectItem value="custom">Custom Verification</SelectItem>
                <SelectItem value="none">No Verification Required</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ID Number */}
          <div className="space-y-2">
            <Label htmlFor="id-number">ID Number (Optional)</Label>
            <Input
              id="id-number"
              placeholder="Enter ID number or last 4 digits"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
            />
          </div>

          {/* Camera Capture (Future Feature) */}
          <div className="space-y-2">
            <Label>ID Photo (Optional)</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleCameraCapture}
              disabled
            >
              <Camera className="h-4 w-4 mr-2" />
              Capture ID Photo (Coming Soon)
            </Button>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Required for Skip)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about the verification..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSkip}
            disabled={isSubmitting || !notes.trim()}
            className="w-full sm:w-auto"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Skip Verification
          </Button>
          <Button
            type="button"
            onClick={handleVerify}
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isSubmitting ? "Verifying..." : "Verify ID"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

