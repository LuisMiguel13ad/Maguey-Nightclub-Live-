import { useState, useEffect } from "react";
import { Shield, Trash2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ActivityLogTable } from "@/components/auth/ActivityLogTable";
import { BiometricPrompt } from "@/components/auth/BiometricPrompt";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AccountSettings = () => {
  const { user, disable2FA } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      check2FAStatus();
    }
  }, [user]);

  const check2FAStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('two_factor_enabled')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setTwoFactorEnabled(data.two_factor_enabled || false);
      }
    } catch (err) {
      console.error('Error checking 2FA status:', err);
    }
  };

  const handleDisable2FA = async () => {
    setIsLoading(true);
    try {
      const { error } = await disable2FA();
      if (error) {
        toast.error(error.message);
      } else {
        setTwoFactorEnabled(false);
        toast.success("2FA disabled successfully");
      }
    } catch (err) {
      toast.error("Failed to disable 2FA");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    // TODO: Implement account deletion
    toast.error("Account deletion is not yet implemented");
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-dark py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

          <div className="space-y-6">
            {/* Security Settings */}
            <Card className="p-6 border-border/50 bg-card">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Security</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Two-Factor Authentication</h3>
                  {twoFactorEnabled ? (
                    <div className="space-y-2">
                      <Alert className="border-green-500 bg-green-500/10">
                        <AlertCircle className="h-4 w-4 text-green-500" />
                        <AlertDescription className="text-green-700 dark:text-green-400">
                          2FA is enabled on your account.
                        </AlertDescription>
                      </Alert>
                      <Button
                        variant="outline"
                        onClick={handleDisable2FA}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Disabling...
                          </>
                        ) : (
                          "Disable 2FA"
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security to your account.
                      </p>
                      <Button asChild variant="outline">
                        <a href="/2fa-setup">Enable 2FA</a>
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-medium mb-2">Biometric Authentication</h3>
                  <BiometricPrompt />
                </div>
              </div>
            </Card>

            {/* Activity Log */}
            <Card className="p-6 border-border/50 bg-card">
              <h2 className="text-xl font-semibold mb-4">Recent Login Activity</h2>
              <ActivityLogTable />
            </Card>

            {/* Danger Zone */}
            <Card className="p-6 border-border/50 bg-card border-destructive/50">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <h2 className="text-xl font-semibold text-destructive">Danger Zone</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Delete Account</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your
                          account and remove all your data from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default AccountSettings;

