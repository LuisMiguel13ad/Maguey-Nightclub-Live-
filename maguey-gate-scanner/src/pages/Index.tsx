import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, User, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Small delay before redirect to show the selection screen briefly
    const timer = setTimeout(() => {
      navigate("/auth/employee", { replace: true });
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#000000', minHeight: '100vh' }}>
      <div className="absolute inset-0 opacity-50" style={{ background: 'linear-gradient(180deg, hsla(142 60% 45% / 0.2) 0%, hsla(240 10% 3.9% / 0) 100%)' }} />
      
      <Card className="w-full max-w-2xl relative border-primary/20 shadow-glow-green">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src="/logo.png" 
              alt="Maguey Logo" 
              className="h-64 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-green bg-clip-text text-transparent">
            Maguey Scanner Portal
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Select your login type to continue
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => navigate("/auth/owner")}
              className="h-24 flex flex-col items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, hsl(271 91% 65%) 0%, hsl(280 80% 50%) 100%)' }}
              variant="default"
            >
              <Building2 className="h-8 w-8" />
              <span className="text-lg font-semibold">Owner Login</span>
              <span className="text-sm opacity-90">Full access to dashboard & events</span>
            </Button>
            
            <Button
              onClick={() => navigate("/auth/employee")}
              className="h-24 flex flex-col items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, hsl(142 60% 45%) 0%, hsl(142 70% 40%) 100%)' }}
              variant="default"
            >
              <Shield className="h-8 w-8" />
              <span className="text-lg font-semibold">Staff Login</span>
              <span className="text-sm opacity-90">Access to scanner & ticket validation</span>
            </Button>
          </div>
          
          <div className="pt-4 border-t border-primary/10">
            <p className="text-sm text-center text-muted-foreground">
              Redirecting to staff login...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
