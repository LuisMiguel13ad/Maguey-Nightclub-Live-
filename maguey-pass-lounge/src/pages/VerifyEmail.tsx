import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Music, Mail, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const { user, resendVerification } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get("token") || searchParams.get("access_token");

  useEffect(() => {
    // Check if user is already verified
    if (user?.email_confirmed_at) {
      setVerified(true);
    }
  }, [user]);

  const handleResend = async () => {
    setIsResending(true);
    setError(null);

    try {
      const { error } = await resendVerification();
      
      if (error) {
        setError(error.message);
        toast.error(error.message);
      } else {
        toast.success("Verification email sent! Please check your inbox.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to resend verification email";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  if (verified) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="p-8 border-border/50 bg-card">
            <div className="text-center mb-8">
              <Link to="/" className="inline-flex items-center gap-3 mb-6">
                <Music className="w-8 h-8 text-primary" />
                <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  MAGUEY
                </h1>
              </Link>
              <div className="mb-4">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Email Verified!</h2>
              <p className="text-muted-foreground">
                Your email has been successfully verified.
              </p>
            </div>

            <Alert className="mb-6 border-green-500 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                You can now access all features of your account.
              </AlertDescription>
            </Alert>

            <Button asChild className="w-full bg-gradient-primary hover:shadow-glow-primary transition-all" size="lg">
              <Link to="/account">Go to My Account</Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-8 border-border/50 bg-card">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-3 mb-6">
              <Music className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                MAGUEY
              </h1>
            </Link>
            <div className="mb-4">
              <Mail className="w-16 h-16 text-primary mx-auto" />
            </div>
            <h2 className="text-3xl font-bold mb-2">Verify Your Email</h2>
            <p className="text-muted-foreground">
              We've sent a verification link to {user?.email || "your email address"}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert className="mb-6">
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Please check your inbox and click the verification link to activate your account.
              If you don't see the email, check your spam folder.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <Button
              onClick={handleResend}
              className="w-full"
              variant="outline"
              disabled={isResending}
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Resend Verification Email"
              )}
            </Button>

            <Button asChild className="w-full bg-gradient-primary hover:shadow-glow-primary transition-all" size="lg">
              <Link to="/login">Back to Login</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default VerifyEmail;

