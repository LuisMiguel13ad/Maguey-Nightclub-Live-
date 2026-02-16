import { useState } from "react";
import { AlertCircle, X, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function EmailVerificationBanner() {
  const { user, resendVerification } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if email is verified or dismissed
  if (!user || user.email_confirmed_at || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setIsResending(true);
    try {
      const { error } = await resendVerification();
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Verification email sent! Check your inbox.");
      }
    } catch (err) {
      toast.error("Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Alert className="mb-6 border-yellow-500 bg-yellow-500/10">
      <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          <span className="text-yellow-700 dark:text-yellow-300">
            Please verify your email address. Check your inbox for a verification link.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={isResending}
            className="text-yellow-700 dark:text-yellow-300 hover:text-yellow-800 dark:hover:text-yellow-200"
          >
            {isResending ? "Sending..." : "Resend"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            className="text-yellow-700 dark:text-yellow-300 hover:text-yellow-800 dark:hover:text-yellow-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

