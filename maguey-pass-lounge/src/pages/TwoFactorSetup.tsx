import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Music, Shield, CheckCircle2, Copy, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { QRCodeSVG } from "qrcode.react";

const TwoFactorSetup = () => {
  const navigate = useNavigate();
  const { enable2FA, verify2FA } = useAuth();
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [secret, setSecret] = useState<string>("");
  const [qrCode, setQrCode] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initialize2FA();
  }, []);

  const initialize2FA = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await enable2FA();
      
      if (error) {
        setError(error.message);
        toast.error(error.message);
      } else if (data) {
        setSecret(data.secret);
        setQrCode(data.qrCode);
        setBackupCodes(data.backupCodes);
        setStep('verify');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize 2FA";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode.trim()) {
      setError("Please enter a verification code");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error } = await verify2FA(verificationCode);
      
      if (error) {
        setError(error.message);
        toast.error(error.message);
      } else {
        toast.success("2FA enabled successfully!");
        navigate("/account");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to verify 2FA";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="p-8 border-border/50 bg-card">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-3 mb-6">
              <Music className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                MAGUEY
              </h1>
            </Link>
            <div className="mb-4">
              <Shield className="w-16 h-16 text-primary mx-auto" />
            </div>
            <h2 className="text-3xl font-bold mb-2">Enable Two-Factor Authentication</h2>
            <p className="text-muted-foreground">
              Add an extra layer of security to your account
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'setup' && isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {step === 'verify' && secret && (
            <div className="space-y-6">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </AlertDescription>
              </Alert>

              <div className="flex flex-col items-center space-y-4">
                {qrCode ? (
                  <div className="p-4 bg-white rounded-lg">
                    <QRCodeSVG value={qrCode} size={200} />
                  </div>
                ) : (
                  <div className="w-[200px] h-[200px] bg-muted rounded-lg flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                )}

                <div className="w-full max-w-md space-y-2">
                  <Label>Or enter this code manually:</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={secret}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(secret, "Secret")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Enter verification code from your app:</Label>
                <Input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl font-mono tracking-widest"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleVerify}
                  className="w-full"
                  disabled={isLoading || verificationCode.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify and Enable 2FA"
                  )}
                </Button>
              </div>

              <Alert className="border-yellow-500 bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  <strong>Save your backup codes!</strong> These codes can be used to access your account if you lose your device.
                  <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-background rounded">
                        <span>{code}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(code, "Backup code")}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="mt-6 text-center">
            <Button variant="ghost" asChild>
              <Link to="/account">Cancel</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TwoFactorSetup;

