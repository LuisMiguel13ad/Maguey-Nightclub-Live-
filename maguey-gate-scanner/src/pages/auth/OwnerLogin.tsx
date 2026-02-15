import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/supabase-config";
import { getUserRole, setUserRole } from "@/lib/auth";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { validateInvitation, consumeInvitation } from "@/lib/invitation-service";
import { logAuditEvent } from "@/lib/audit-service";
import { navigateByRole, calculatePasswordStrength, getStrengthLabel, AUTH_ROUTES } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Crown, Lock, UserPlus, AlertCircle, Mail, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Mode = 'login' | 'resetRequest' | 'resetConfirm' | 'signup';

const OwnerLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();

  // Derive the redirect target from state.from or default to dashboard
  const from = (location.state as any)?.from?.pathname || AUTH_ROUTES.OWNER_REDIRECT;

  // Form state
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Invitation state
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<{ role?: 'employee' | 'owner' | 'promoter' } | null>(null);
  const [validatingInvite, setValidatingInvite] = useState(false);

  // Password strength
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Already authenticated redirect
  useEffect(() => {
    // If user is authenticated with owner/promoter role and not in a special flow, redirect to dashboard
    if (user && (role === 'owner' || role === 'promoter') && mode === 'login' && !inviteToken) {
      navigate(from, { replace: true });
    }
  }, [user, role, mode, inviteToken, navigate, from]);

  // Validate invitation token if present
  useEffect(() => {
    const token = searchParams.get('invite');
    if (token) {
      setInviteToken(token);
      setValidatingInvite(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const checkInvitation = async () => {
      if (!inviteToken) {
        setValidatingInvite(false);
        return;
      }

      try {
        const validation = await validateInvitation(inviteToken);
        if (validation.valid && validation.invitation) {
          setInviteValid(true);
          setInviteError(null);
          setMode('signup');
          // Store invitation metadata (including role)
          setInvitationData(validation.invitation.metadata as { role?: 'employee' | 'owner' | 'promoter' } | null);
        } else {
          setInviteValid(false);
          setInviteError(validation.error || "Invalid invitation");
        }
      } catch (error: any) {
        setInviteValid(false);
        setInviteError("Failed to validate invitation");
      } finally {
        setValidatingInvite(false);
      }
    };

    checkInvitation();
  }, [inviteToken]);

  // Handle password reset token from URL hash (Supabase uses hash fragments)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('access_token') && hash.includes('type=recovery')) {
        setMode('resetConfirm');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Calculate password strength
  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(password));
  }, [password]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if user has owner/promoter role
      if (data.user && isSupabaseConfigured()) {
        const userRole = getUserRole(data.user);
        if (userRole !== 'owner' && userRole !== 'promoter') {
          // Not authorized - sign them out
          await supabase.auth.signOut();
          toast({
            variant: "destructive",
            title: "Access Denied",
            description: "This account does not have owner access. Please use the staff login.",
          });
          setLoading(false);
          return;
        }

        // Redirect to intended destination or dashboard
        navigate(from, { replace: true });

        toast({
          title: "Welcome back!",
          description: "Successfully logged in.",
        });

        // Audit log: successful login
        logAuditEvent('login', 'user', 'Owner logged in', {
          userId: data.user?.id,
          severity: 'info',
          metadata: { email: data.user?.email },
        }).catch(() => { });
      } else {
        // Default to dashboard for non-Supabase mode
        navigate(from, { replace: true });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: error.message || "Failed to sign in.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Password reset request handler
  const handlePasswordResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter your email address.",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${AUTH_ROUTES.OWNER_LOGIN}`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for password reset instructions.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send password reset email.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Password reset confirmation handler
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords Don't Match",
        description: "Please make sure both passwords match.",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast({
        title: "Password Reset Successful",
        description: "Your password has been updated. Please log in.",
      });

      // Audit log: password reset
      logAuditEvent('password_changed', 'user', 'Password reset completed', {
        severity: 'info',
      }).catch(() => { });

      // Clear reset state and show login
      setMode('login');
      setPassword("");
      setConfirmPassword("");
      navigate(AUTH_ROUTES.OWNER_LOGIN);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to reset password.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Signup handler (invitation only)
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${AUTH_ROUTES.OWNER_LOGIN}?type=signup`,
          data: {
            role: invitationData?.role || 'employee',
            full_name: fullName || email.split('@')[0],
          },
        },
      });

      if (error) throw error;

      // Set role in user metadata after signup
      if (data.user && isSupabaseConfigured()) {
        try {
          // Use role from invitation if available, otherwise default to employee
          const assignedRole = (inviteToken && inviteValid && invitationData?.role)
            ? invitationData.role
            : 'employee';
          await setUserRole(assignedRole);

          // Consume the invitation
          if (inviteToken && inviteValid) {
            await consumeInvitation(inviteToken, data.user.id);
          }
        } catch (err) {
          console.warn('Failed to set default role or consume invitation:', err);
        }
      }

      // Check if email confirmation is required
      if (data.user && !data.user.confirmed_at && !data.session) {
        toast({
          title: "Account Created!",
          description: "Please check your email to verify your account before logging in.",
        });

        // Audit log: user signup (pending email verification)
        logAuditEvent('user_created', 'user', 'New user signed up (pending email verification)', {
          userId: data.user?.id,
          severity: 'info',
          metadata: {
            email: data.user?.email,
            viaInvite: !!inviteToken,
            assignedRole: invitationData?.role || 'employee'
          },
        }).catch(() => { });

        setMode('login');
      } else {
        toast({
          title: "Account created!",
          description: "Your invitation has been accepted. You can now log in.",
        });

        // Audit log: user signup successful
        logAuditEvent('user_created', 'user', 'New user signed up successfully', {
          userId: data.user?.id,
          severity: 'info',
          metadata: {
            email: data.user?.email,
            viaInvite: !!inviteToken,
            assignedRole: invitationData?.role || 'employee'
          },
        }).catch(() => { });

        // Redirect based on role after successful signup
        if (inviteToken && data.user) {
          setTimeout(() => {
            navigateByRole(data.user, navigate);
          }, 1500);
        } else {
          setMode('login');
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: error.message || "Failed to create account.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Password strength indicator
  const renderPasswordStrength = () => {
    if (!password) return null;

    return (
      <div className="mt-2">
        <div className="flex gap-1 mb-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <div
              key={level}
              className={`h-1 flex-1 rounded ${
                level <= passwordStrength
                  ? passwordStrength <= 2
                    ? 'bg-red-500'
                    : passwordStrength <= 3
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-600">{getStrengthLabel(passwordStrength)}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-green-900 to-slate-900 p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="bg-gradient-to-br from-green-600 to-green-700 p-3 rounded-full">
              <Crown className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Owner Portal
          </CardTitle>
          <CardDescription className="text-gray-600">
            Business management & dashboard access
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Invitation validation loading */}
          {validatingInvite && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Validating invitation...</AlertDescription>
            </Alert>
          )}

          {/* Invitation error */}
          {inviteError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{inviteError}</AlertDescription>
            </Alert>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="owner@magueynightclub.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Lock className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('resetRequest')}
                  className="text-sm text-green-600 hover:text-green-700 hover:underline"
                >
                  Forgot your password?
                </button>
              </div>
            </form>
          )}

          {/* Password Reset Request Form */}
          {mode === 'resetRequest' && (
            <form onSubmit={handlePasswordResetRequest} className="space-y-4">
              {resetEmailSent ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Password reset email sent. Please check your inbox.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert>
                    <Mail className="h-4 w-4" />
                    <AlertDescription>
                      Enter your email address and we'll send you a password reset link.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="owner@magueynightclub.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                    disabled={loading}
                  >
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </>
              )}

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setResetEmailSent(false);
                  }}
                  className="text-sm text-green-600 hover:text-green-700 hover:underline"
                >
                  Back to login
                </button>
              </div>
            </form>
          )}

          {/* Password Reset Confirmation Form */}
          {mode === 'resetConfirm' && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  Create a new password for your account.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                {renderPasswordStrength()}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}

          {/* Invitation Signup Form */}
          {mode === 'signup' && inviteValid && (
            <form onSubmit={handleSignup} className="space-y-4">
              <Alert>
                <UserPlus className="h-4 w-4" />
                <AlertDescription>
                  You've been invited to join the team. Create your account below.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                {renderPasswordStrength()}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          )}

          {/* Footer link to staff login */}
          {mode === 'login' && (
            <div className="text-center text-sm text-gray-600">
              <a
                href={AUTH_ROUTES.EMPLOYEE_LOGIN}
                className="text-green-600 hover:text-green-700 hover:underline"
              >
                Staff login →
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OwnerLogin;
