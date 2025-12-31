import { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { uploadPhoto, checkPhotoQuality, type PhotoQualityCheck } from '@/lib/photo-capture-service';
import { useToast } from '@/hooks/use-toast';

interface PhotoCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (photoUrl: string, thumbnailUrl: string, photoId?: string) => void;
  ticketId: string;
  userId?: string;
  requireConsent?: boolean;
  requirePhoto?: boolean; // If true, photo is required before closing
}

export const PhotoCaptureModal = ({
  open,
  onClose,
  onCapture,
  ticketId,
  userId,
  requireConsent = false,
  requirePhoto = false,
}: PhotoCaptureModalProps) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [qualityCheck, setQualityCheck] = useState<PhotoQualityCheck | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Start camera when modal opens
  useEffect(() => {
    if (open && !capturedPhoto) {
      startCamera();
    } else if (!open) {
      stopCamera();
      setCapturedPhoto(null);
      setConsent(false);
      setQualityCheck(null);
    }

    return () => {
      stopCamera();
    };
  }, [open, capturedPhoto]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      toast({
        variant: 'destructive',
        title: 'Camera Error',
        description: error.message || 'Failed to access camera. Please check permissions.',
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhoto(photoDataUrl);

    // Check photo quality
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        const quality = await checkPhotoQuality(file);
        setQualityCheck(quality);
      }
    }, 'image/jpeg', 0.9);
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setQualityCheck(null);
    startCamera();
  };

  const switchCamera = () => {
    stopCamera();
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  const handleAccept = async () => {
    if (!capturedPhoto) return;
    if (requireConsent && !consent) {
      toast({
        variant: 'destructive',
        title: 'Consent Required',
        description: 'Please confirm photo consent before proceeding.',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Convert data URL to File
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });

      const result = await uploadPhoto(file, ticketId, userId, consent);

      if (result.success && result.photoUrl && result.thumbnailUrl) {
        onCapture(result.photoUrl, result.thumbnailUrl, result.photoId);
        toast({
          title: 'Photo Captured',
          description: 'Photo has been saved successfully.',
        });
        stopCamera();
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: result.error || 'Failed to upload photo. Please try again.',
        });
      }
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to process photo.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (requirePhoto && !capturedPhoto) {
      toast({
        variant: 'destructive',
        title: 'Photo Required',
        description: 'A photo must be captured before closing.',
      });
      return;
    }
    stopCamera();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Capture Photo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!capturedPhoto ? (
            <>
              {/* Camera Preview */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!stream && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={switchCamera}
                  disabled={!stream}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Switch Camera
                </Button>
                <Button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!stream}
                  className="bg-gradient-purple hover:shadow-glow-purple"
                  size="lg"
                >
                  <Camera className="h-5 w-5 mr-2" />
                  Capture Photo
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Captured Photo Preview */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <img
                  src={capturedPhoto}
                  alt="Captured photo"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Quality Warnings */}
              {qualityCheck && !qualityCheck.isValid && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-1">Photo Quality Issues:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {qualityCheck.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                    <div className="mt-2 text-sm">
                      You can retake the photo or proceed anyway.
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Consent Checkbox */}
              {requireConsent && (
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="photo-consent"
                    checked={consent}
                    onCheckedChange={(checked) => setConsent(checked === true)}
                  />
                  <Label
                    htmlFor="photo-consent"
                    className="text-sm cursor-pointer leading-relaxed"
                  >
                    I confirm that the attendee has consented to having their photo taken
                    for verification and fraud prevention purposes.
                  </Label>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={retakePhoto}
                  disabled={isUploading}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retake
                </Button>
                <Button
                  type="button"
                  onClick={handleAccept}
                  disabled={isUploading || (requireConsent && !consent)}
                  className="bg-gradient-purple hover:shadow-glow-purple"
                  size="lg"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Accept Photo
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
};

