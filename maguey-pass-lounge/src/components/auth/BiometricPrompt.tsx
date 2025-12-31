import { useState, useEffect } from "react";
import { Fingerprint, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { isWebAuthnSupported, registerBiometric, authenticateBiometric, getBiometricDevices, removeBiometricCredential } from "@/lib/biometric-auth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BiometricPrompt() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsSupported(isWebAuthnSupported());
    checkBiometricStatus();
  }, [user]);

  const checkBiometricStatus = async () => {
    if (!user) return;
    const devices = await getBiometricDevices(user.id);
    setHasBiometric(devices.length > 0);
  };

  const handleEnroll = async () => {
    if (!user || !deviceName.trim()) {
      toast.error("Please enter a device name");
      return;
    }

    setIsEnrolling(true);
    try {
      const { credentialId, error } = await registerBiometric(user.id, deviceName.trim());
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Biometric authentication enabled!");
        setHasBiometric(true);
        setIsOpen(false);
        setDeviceName("");
      }
    } catch (err) {
      toast.error("Failed to enable biometric authentication");
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleAuthenticate = async () => {
    if (!user) return;

    setIsAuthenticating(true);
    try {
      const { success, error } = await authenticateBiometric(user.id);
      if (error) {
        toast.error(error.message);
      } else if (success) {
        toast.success("Biometric authentication successful!");
        // Redirect or perform login action
      }
    } catch (err) {
      toast.error("Biometric authentication failed");
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!isSupported) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Biometric authentication is not supported in this browser.
        </AlertDescription>
      </Alert>
    );
  }

  if (hasBiometric) {
    return (
      <div className="space-y-4">
        <Alert className="border-green-500 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-700 dark:text-green-400">
            Biometric authentication is enabled for this device.
          </AlertDescription>
        </Alert>
        <Button
          onClick={handleAuthenticate}
          disabled={isAuthenticating}
          variant="outline"
          className="w-full"
        >
          {isAuthenticating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              <Fingerprint className="w-4 h-4 mr-2" />
              Sign in with Biometric
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Fingerprint className="w-4 h-4 mr-2" />
          Enable Biometric Login
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable Biometric Authentication</DialogTitle>
          <DialogDescription>
            Use Face ID, Touch ID, or Windows Hello to sign in quickly and securely.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="device-name">Device Name</Label>
            <Input
              id="device-name"
              placeholder="e.g., John's iPhone"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              disabled={isEnrolling}
            />
          </div>
          <Button
            onClick={handleEnroll}
            disabled={isEnrolling || !deviceName.trim()}
            className="w-full"
          >
            {isEnrolling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Fingerprint className="w-4 h-4 mr-2" />
                Enable Biometric
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

