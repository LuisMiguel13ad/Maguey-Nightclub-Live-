import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/supabase-config";
import { getUserRole } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { logAuditEvent } from "@/lib/audit-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EmployeeLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  // Extract intended destination from state.from if present
  const from = (location.state as any)?.from?.pathname;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // Already-authenticated redirect
  useEffect(() => {
    if (user) {
      if (from) {
        navigate(from, { replace: true });
      } else {
        const userRole = getUserRole(user);
        if (userRole === 'owner' || userRole === 'promoter') {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/scanner", { replace: true });
        }
      }
    }
  }, [user, navigate, from]);

  // Remember me - load saved email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('maguey_employee_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Store/clear email for remember me
      if (rememberMe) {
        localStorage.setItem('maguey_employee_email', email);
      } else {
        localStorage.removeItem('maguey_employee_email');
      }

      // Audit log
      logAuditEvent('login', 'user', 'Employee logged in', {
        userId: data.user?.id,
        severity: 'info',
        metadata: { email: data.user?.email },
      }).catch(() => {});

      // After successful login, redirect based on state.from or role
      const userRole = getUserRole(data.user);
      if (from) {
        toast({ title: "Welcome!", description: "Redirecting..." });
        navigate(from, { replace: true });
      } else if (userRole === 'owner' || userRole === 'promoter') {
        toast({ title: "Welcome!", description: "Redirecting to dashboard." });
        navigate("/dashboard", { replace: true });
      } else {
        toast({ title: "Welcome!", description: "Ready to scan." });
        navigate("/scanner", { replace: true });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message === 'Invalid login credentials'
          ? "Incorrect email or password."
          : error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-glow-lime">
        <CardHeader className="space-y-4 flex flex-col items-center">
          <img
            src="/logo.png"
            alt="Maguey"
            className="h-16 w-auto"
          />
          <CardTitle className="text-2xl font-bold text-center flex items-center gap-2 justify-center">
            <Shield className="h-6 w-6" />
            Staff Scanner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-12"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label
                htmlFor="remember"
                className="text-sm font-normal cursor-pointer"
              >
                Remember me
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-green"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeLogin;
