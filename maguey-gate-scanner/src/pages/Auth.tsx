import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { setUserRole, getUserRole, type UserRole } from "@/lib/auth";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { validateInvitation, consumeInvitation } from "@/lib/invitation-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { TestTube, Shield, UserPlus, AlertCircle, Mail, Lock, CheckCircle2, User, Crown } from "lucide-react";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const resetToken = searchParams.get('token');
  const type = searchParams.get('type'); // 'recovery' or 'signup'
  
  const [isLogin, setIsLogin] = useState(!inviteToken && !resetToken);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [isResetConfirm, setIsResetConfirm] = useState(!!resetToken && type === 'recovery');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [validatingInvite, setValidatingInvite] = useState(!!inviteToken);
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, refreshRole } = useAuth();
  const role = useRole();

  // Helper function to navigate based on user role
  const navigateByRole = (userData: any) => {
    if (!userData) {
      navigate("/scanner");
      return;
    }
    const userRole = getUserRole(userData);
    if (userRole === 'owner') {
      navigate("/dashboard");
    } else {
      navigate("/scanner");
    }
  };

  // Calculate password strength
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    
    setPasswordStrength(Math.min(strength, 5));
  }, [password]);

  // Validate invitation token if present
  useEffect(() => {
    const checkInvitation = async () => {
      if (!inviteToken) {
        setValidatingInvite(false);
        return;
      }

      try {
        const validation = await validateInvitation(inviteToken);
        if (validation.valid) {
          setInviteValid(true);
          setInviteError(null);
          setIsLogin(false); // Show signup form
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
        setIsResetConfirm(true);
        setIsLogin(false);
        setIsPasswordReset(false);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
        redirectTo: `${window.location.origin}/auth`,
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

      // Clear reset state and show login
      setIsResetConfirm(false);
      setIsPasswordReset(false);
      setIsLogin(true);
      setPassword("");
      setConfirmPassword("");
      navigate("/auth");
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Ensure user has role in metadata, assign default if not
        if (data.user && isSupabaseConfigured()) {
          // Check if role exists in metadata (not just default)
          const hasRoleInMetadata = data.user.user_metadata?.role || data.user.app_metadata?.role;
          if (!hasRoleInMetadata) {
            // Set default role if not present in metadata
            try {
              await setUserRole('employee');
            } catch (err) {
              console.warn('Failed to set default role:', err);
            }
          }
          
          // Redirect based on role
          const userRole = getUserRole(data.user);
          if (userRole === 'owner') {
            navigate("/dashboard");
          } else {
            navigate("/scanner");
          }
        } else {
          // Default to scanner for non-Supabase mode
          navigate("/scanner");
        }

        toast({
          title: "Welcome back!",
          description: "Successfully logged in.",
        });
      } else {
        // Signup flow
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?type=signup`,
            data: {
              role: 'employee', // Default role for new users
              full_name: fullName || email.split('@')[0],
            },
          },
        });

        if (error) throw error;

        // Set role in user metadata after signup
        if (data.user && isSupabaseConfigured()) {
          try {
            await setUserRole('employee');
            
            // If signing up via invitation, consume the invitation
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
          setIsLogin(true);
        } else {
          toast({
            title: "Account created!",
            description: inviteToken ? "Your invitation has been accepted. You can now log in." : "You can now log in.",
          });
          
          // If invited, redirect based on role after successful signup
          if (inviteToken && data.user) {
            setTimeout(() => {
              const userRole = getUserRole(data.user);
              if (userRole === 'owner') {
                navigate("/dashboard");
              } else {
                navigate("/scanner");
              }
            }, 1500);
          } else {
            setIsLogin(true);
          }
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    
    // Check if Supabase is configured
    const url = import.meta.env.VITE_SUPABASE_URL;
    // Standardized: Use VITE_SUPABASE_ANON_KEY with backward compatibility
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const isConfigured = !!(url && key && url !== 'https://placeholder.supabase.co' && key !== 'placeholder-key');

    if (!isConfigured) {
      // Development mode - use local storage
      const { localStorageService } = await import("@/lib/localStorage");
      const demoUser = {
        id: 'demo-user-1',
        email: 'demo@maguey.club',
        name: 'Demo Staff',
        role: 'employee',
      };
      localStorageService.setUser(demoUser);
      await refreshRole();
      
      toast({
        title: "Development Mode",
        description: "Logged in with demo account (local storage mode)",
      });
      navigate("/scanner");
      setLoading(false);
      return;
    }

    // Try demo credentials first
    const demoCredentials = [
      { email: "demo@maguey.club", password: "demo123" },
      { email: "staff@maguey.club", password: "staff123" },
      { email: "admin@maguey.club", password: "admin123" },
    ];

    for (const creds of demoCredentials) {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: creds.email,
          password: creds.password,
        });

        if (!error) {
          // Ensure role is set for demo users
          const { data: { user } } = await supabase.auth.getUser();
          if (user && isSupabaseConfigured()) {
            try {
              const hasRoleInMetadata = user.user_metadata?.role || user.app_metadata?.role;
              if (!hasRoleInMetadata) {
                await setUserRole('employee');
              }
            } catch (err) {
              console.warn('Failed to set role for demo user:', err);
            }
            navigateByRole(user);
          } else {
            navigate("/scanner");
          }
          
          toast({
            title: "Demo Login Successful!",
            description: `Logged in as ${creds.email}`,
          });
          return;
        }
      } catch (err) {
        // Continue to next credential
        continue;
      }
    }

    // If demo credentials don't work, try to create a demo account
    try {
      const demoEmail = "demo@maguey.club";
      const demoPassword = "demo123";
      
      // Try to sign up (will work if account doesn't exist, or we can sign in if it does)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: demoEmail,
        password: demoPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/scanner`,
          data: {
            role: 'employee',
            full_name: 'Demo Staff',
          },
        },
      });

      // Handle different signup scenarios
      if (signUpError) {
        // If account already exists, try to sign in
        if (signUpError.message.includes("already registered") || signUpError.message.includes("User already registered")) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: demoEmail,
            password: demoPassword,
          });

          if (signInError) {
            // Check if it's an email confirmation error
            if (signInError.message.includes("Email not confirmed") || signInError.message.includes("not confirmed")) {
              toast({
                variant: "destructive",
                title: "Email Confirmation Required",
                description: "The demo account exists but needs email confirmation. Please check your Supabase Dashboard → Authentication → Users and manually confirm the demo@maguey.club account, or disable email confirmation in Auth settings.",
              });
              setLoading(false);
              return;
            }
            throw signInError;
          }

          // Successfully signed in
          if (signInData.user && isSupabaseConfigured()) {
            try {
              const hasRoleInMetadata = signInData.user.user_metadata?.role || signInData.user.app_metadata?.role;
              if (!hasRoleInMetadata) {
                await setUserRole('employee');
              }
            } catch (err) {
              console.warn('Failed to set role for demo user:', err);
            }
            navigateByRole(signInData.user);
          } else {
            navigate("/scanner");
          }

          toast({
            title: "Demo Login Successful!",
            description: `Logged in as ${demoEmail}`,
          });
          setLoading(false);
          return;
        } else {
          // Other signup errors
          throw signUpError;
        }
      }

      // Signup succeeded - check if user was created and confirmed
      if (signUpData.user) {
        // Check if email confirmation is required
        if (signUpData.user.confirmed_at || signUpData.session) {
          // User is confirmed and has a session - proceed
          if (isSupabaseConfigured()) {
            try {
              const hasRoleInMetadata = signUpData.user.user_metadata?.role || signUpData.user.app_metadata?.role;
              if (!hasRoleInMetadata) {
                await setUserRole('employee');
              }
            } catch (err) {
              console.warn('Failed to set role for demo account:', err);
            }
            navigateByRole(signUpData.user);
          } else {
            navigate("/scanner");
          }

          toast({
            title: "Demo Account Created!",
            description: "You can now use the scanner.",
          });
          setLoading(false);
          return;
        } else {
          // User created but needs email confirmation
          toast({
            variant: "destructive",
            title: "Email Confirmation Required",
            description: "Demo account created but needs email confirmation. Please check your Supabase Dashboard → Authentication → Users and manually confirm the demo@maguey.club account, or disable email confirmation in Auth settings.",
          });
          setLoading(false);
          return;
        }
      }

      // Fallback - try to sign in one more time
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (signInError) {
        if (signInError.message.includes("Email not confirmed") || signInError.message.includes("not confirmed")) {
          toast({
            variant: "destructive",
            title: "Email Confirmation Required",
            description: "The demo account exists but needs email confirmation. Please check your Supabase Dashboard → Authentication → Users and manually confirm the demo@maguey.club account, or disable email confirmation in Auth settings.",
          });
          setLoading(false);
          return;
        }
        throw signInError;
      }

      // Successfully signed in
      if (signInData.user && isSupabaseConfigured()) {
        try {
          const hasRoleInMetadata = signInData.user.user_metadata?.role || signInData.user.app_metadata?.role;
          if (!hasRoleInMetadata) {
            await setUserRole('employee');
          }
        } catch (err) {
          console.warn('Failed to set role for demo user:', err);
        }
        navigateByRole(signInData.user);
      } else {
        navigate("/scanner");
      }

      toast({
        title: "Demo Login Successful!",
        description: `Logged in as ${demoEmail}`,
      });
    } catch (error: any) {
      console.error('Demo login error:', error);
      toast({
        variant: "destructive",
        title: "Demo Login Failed",
        description: error.message || "Please create the demo account manually in Supabase Dashboard → Authentication → Users (demo@maguey.club / demo123) and ensure email confirmation is disabled or the account is confirmed.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteToOwner = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not Logged In",
        description: "Please log in first before promoting to owner.",
      });
      return;
    }

    setPromoting(true);
    try {
      await setUserRole('owner');
      await refreshRole();
      
      toast({
        title: "Promoted to Owner!",
        description: "You now have owner privileges. Redirecting...",
      });
      
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Promotion Failed",
        description: error.message || "Failed to promote to owner role.",
      });
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 bg-gradient-scan opacity-50" />
      
      <Card className="w-full max-w-md relative border-primary/20 shadow-glow-green">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src="/logo.png" 
              alt="Maguey Logo" 
              className="h-64 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-green bg-clip-text text-transparent">
            {inviteToken ? (
              <span className="flex items-center justify-center gap-2">
                <UserPlus className="h-8 w-8" />
                Join the Team
              </span>
            ) : isPasswordReset ? (
              <span className="flex items-center justify-center gap-2">
                <Lock className="h-8 w-8" />
                Reset Password
              </span>
            ) : isResetConfirm ? (
              <span className="flex items-center justify-center gap-2">
                <Lock className="h-8 w-8" />
                Set New Password
              </span>
            ) : (
              "Maguey Scanner"
            )}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {inviteToken ? "Complete your registration to join" : 
             isPasswordReset ? "Enter your email to receive reset instructions" :
             isResetConfirm ? "Enter your new password" :
             "Staff authentication portal"}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* Quick Access Selection - For Testing */}
          {!inviteToken && !isPasswordReset && !isResetConfirm && (
            <div className="mb-6 pb-6 border-b border-primary/20">
              <p className="text-sm font-semibold text-center mb-4 text-muted-foreground">Quick Access (Testing Mode)</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2 border-primary/30 hover:border-primary hover:bg-primary/10 transition-all"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      // Set up mock employee user for testing
                      const isConfigured = isSupabaseConfigured();
                      if (!isConfigured) {
                        // Development mode - use local storage
                        const { localStorageService } = await import("@/lib/localStorage");
                        const demoUser = {
                          id: 'test-employee-1',
                          email: 'employee@test.maguey',
                          name: 'Test Employee',
                          role: 'employee',
                        };
                        localStorageService.setUser(demoUser);
                        toast({
                          title: "Test Employee Session",
                          description: "Redirecting to scanner...",
                        });
                        // Use window.location for full page reload to ensure auth context updates
                        window.location.href = "/scanner";
                      } else {
                        // Supabase mode - try demo login, fallback to local storage
                        try {
                          const { error } = await supabase.auth.signInWithPassword({
                            email: "demo@maguey.club",
                            password: "demo123",
                          });
                          if (!error) {
                            toast({
                              title: "Demo Login Successful",
                              description: "Redirecting to scanner...",
                            });
                            // Use window.location for full page reload
                            window.location.href = "/scanner";
                            return;
                          }
                        } catch (err) {
                          // Fallback to local storage if Supabase login fails
                        }
                        const { localStorageService } = await import("@/lib/localStorage");
                        const demoUser = {
                          id: 'test-employee-1',
                          email: 'employee@test.maguey',
                          name: 'Test Employee',
                          role: 'employee',
                        };
                        localStorageService.setUser(demoUser);
                        toast({
                          title: "Test Employee Session",
                          description: "Redirecting to scanner...",
                        });
                        // Use window.location for full page reload to ensure auth context updates
                        window.location.href = "/scanner";
                      }
                    } catch (error: any) {
                      console.error('Quick access error:', error);
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to set up test session. Try demo login instead.",
                      });
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  <User className="h-6 w-6 text-primary" />
                  <span className="font-semibold">Employee</span>
                  <span className="text-xs text-muted-foreground">Ticket Scanner</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2 border-primary/30 hover:border-primary hover:bg-primary/10 transition-all"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      // Set up mock owner user for testing
                      const isConfigured = isSupabaseConfigured();
                      if (!isConfigured) {
                        // Development mode - use local storage
                        const { localStorageService } = await import("@/lib/localStorage");
                        const demoUser = {
                          id: 'test-owner-1',
                          email: 'owner@test.maguey',
                          name: 'Test Owner',
                          role: 'owner',
                        };
                        localStorageService.setUser(demoUser);
                        toast({
                          title: "Test Owner Session",
                          description: "Redirecting to dashboard...",
                        });
                        // Use window.location for full page reload to ensure auth context updates
                        window.location.href = "/dashboard";
                      } else {
                        // Supabase mode - try admin login, then promote to owner
                        try {
                          const { error } = await supabase.auth.signInWithPassword({
                            email: "admin@maguey.club",
                            password: "admin123",
                          });
                          if (!error) {
                            // Ensure role is set to owner
                            try {
                              await setUserRole('owner');
                            } catch (err) {
                              console.warn('Failed to set owner role:', err);
                            }
                            toast({
                              title: "Admin Login Successful",
                              description: "Redirecting to dashboard...",
                            });
                            // Use window.location for full page reload
                            window.location.href = "/dashboard";
                            return;
                          }
                        } catch (err) {
                          // Fallback to local storage if Supabase login fails
                        }
                        const { localStorageService } = await import("@/lib/localStorage");
                        const demoUser = {
                          id: 'test-owner-1',
                          email: 'owner@test.maguey',
                          name: 'Test Owner',
                          role: 'owner',
                        };
                        localStorageService.setUser(demoUser);
                        toast({
                          title: "Test Owner Session",
                          description: "Redirecting to dashboard...",
                        });
                        // Use window.location for full page reload to ensure auth context updates
                        window.location.href = "/dashboard";
                      }
                    } catch (error: any) {
                      console.error('Quick access error:', error);
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to set up test session. Try demo login instead.",
                      });
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  <Crown className="h-6 w-6 text-primary" />
                  <span className="font-semibold">Owner</span>
                  <span className="text-xs text-muted-foreground">Dashboard</span>
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground mt-3">
                ⚠️ Testing mode - creates mock user session
              </p>
            </div>
          )}

          {/* Invitation Validation Messages */}
          {validatingInvite && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Validating invitation...</AlertDescription>
            </Alert>
          )}
          
          {inviteToken && inviteError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {inviteError}
                <Button
                  variant="link"
                  className="ml-2 p-0 h-auto"
                  onClick={() => navigate("/auth")}
                >
                  Go to login
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          {inviteToken && inviteValid && (
            <Alert className="mb-4 border-primary/20 bg-primary/5">
              <UserPlus className="h-4 w-4" />
              <AlertDescription>
                You've been invited to join the team! Fill out the form below to create your account.
              </AlertDescription>
            </Alert>
          )}

          {resetEmailSent && (
            <Alert className="mb-4 border-primary/20 bg-primary/5">
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Password reset email sent! Check your inbox and follow the instructions to reset your password.
              </AlertDescription>
            </Alert>
          )}

          {isResetConfirm && (
            <Alert className="mb-4 border-primary/20 bg-primary/5">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                You can now set a new password. Make sure it's strong and secure.
              </AlertDescription>
            </Alert>
          )}

          {/* Password Reset Request Form */}
          {isPasswordReset && !resetEmailSent && (
            <form onSubmit={handlePasswordResetRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="staff@maguey.club"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-primary/20 focus:border-primary"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-green hover:shadow-glow-green transition-all"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setIsPasswordReset(false);
                  setIsLogin(true);
                  setEmail("");
                }}
              >
                Back to Login
              </Button>
            </form>
          )}

          {/* Password Reset Confirmation Form */}
          {isResetConfirm && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-primary/20 focus:border-primary"
                />
                {password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded ${
                            passwordStrength >= level
                              ? passwordStrength <= 2
                                ? "bg-red-500"
                                : passwordStrength <= 4
                                ? "bg-yellow-500"
                                : "bg-green-500"
                              : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {passwordStrength <= 2
                        ? "Weak password"
                        : passwordStrength <= 4
                        ? "Medium strength"
                        : "Strong password"}
                    </p>
                  </div>
                )}
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
                  className="border-primary/20 focus:border-primary"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords don't match</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-green hover:shadow-glow-green transition-all"
                disabled={loading || password !== confirmPassword || password.length < 8}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setIsResetConfirm(false);
                  setIsLogin(true);
                  setPassword("");
                  setConfirmPassword("");
                  navigate("/auth");
                }}
              >
                Back to Login
              </Button>
            </form>
          )}

          {/* Regular Login/Signup Form */}
          {!isPasswordReset && !isResetConfirm && (
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="border-primary/20 focus:border-primary"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="staff@maguey.club"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-primary/20 focus:border-primary"
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
                className="border-primary/20 focus:border-primary"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-green hover:shadow-glow-green transition-all"
              disabled={loading || validatingInvite || (inviteToken && !inviteValid)}
            >
              {loading ? "Loading..." : isLogin ? "Sign In" : inviteToken ? "Complete Registration" : "Sign Up"}
            </Button>

            {!inviteToken && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setIsLogin(!isLogin)}
                  disabled={validatingInvite}
                >
                  {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
                </Button>
                {isLogin && (
                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm"
                    onClick={() => {
                      setIsPasswordReset(true);
                      setIsLogin(false);
                    }}
                  >
                    Forgot your password?
                  </Button>
                )}
              </>
            )}
          </form>
          )}

          {/* Demo Login Section - Hide when using invitation */}
          {!inviteToken && (
            <div className="mt-6 pt-6 border-t border-primary/10">
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">Quick Access</p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-accent/20 bg-accent/5 hover:bg-accent/10"
                  onClick={handleDemoLogin}
                  disabled={loading}
                >
                  <TestTube className="mr-2 h-4 w-4 text-accent" />
                  Demo Login (Auto)
                </Button>
                <p className="text-xs text-muted-foreground">
                  Creates or logs into demo account automatically
                </p>
              </div>
            </div>
          )}

          {/* Promote to Owner Section - For Testing/Development */}
          {user && role === 'employee' && (
            <div className="mt-6 pt-6 border-t border-destructive/10">
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">Development Access</p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-primary/20 bg-primary/5 hover:bg-primary/10"
                  onClick={handlePromoteToOwner}
                  disabled={promoting}
                >
                  <Shield className="mr-2 h-4 w-4 text-primary" />
                  {promoting ? "Promoting..." : "Promote to Owner"}
                </Button>
                <p className="text-xs text-destructive">
                  ⚠️ This promotes your current account to owner role with full access
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
