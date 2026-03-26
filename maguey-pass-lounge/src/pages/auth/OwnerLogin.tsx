import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Music, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, ArrowLeft, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { RememberMeCheckbox } from "@/components/auth/RememberMeCheckbox";

const loginSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const OwnerLogin = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { signIn } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const from = (location.state as any)?.from?.pathname || "/admin";

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        setError(null);

        try {
            const { error } = await signIn(data.email, data.password, rememberMe);

            if (error) {
                setError(error.message);
                toast.error(error.message);
            } else {
                toast.success("Welcome back, Organizer!");
                navigate(from, { replace: true });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to sign in";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <Card className="p-8 border-primary/20 bg-card/80 backdrop-blur-sm shadow-glow-primary">
                    {/* Back Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/')}
                        className="mb-4 -mt-2 -ml-2 text-muted-foreground hover:text-primary"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Home
                    </Button>

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6 border border-primary/20">
                            <Crown className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                            Organizer Portal
                        </h1>
                        <p className="text-muted-foreground">Manage your events and dashboard</p>
                    </div>

                    {error && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Email/Password Form */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="organizer@maguey.com"
                                    className="pl-10 bg-background/50 border-primary/10 focus:border-primary/50"
                                    {...register("email")}
                                    disabled={isLoading}
                                />
                            </div>
                            {errors.email && (
                                <p className="text-sm text-destructive">{errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className="pl-10 pr-10 bg-background/50 border-primary/10 focus:border-primary/50"
                                    {...register("password")}
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-sm text-destructive">{errors.password.message}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between">
                            <RememberMeCheckbox
                                checked={rememberMe}
                                onCheckedChange={setRememberMe}
                                disabled={isLoading}
                            />
                            <Link
                                to="/forgot-password"
                                className="text-sm text-primary hover:underline hover:text-primary-light transition-colors"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-gradient-primary hover:shadow-glow-primary transition-all duration-300 h-12"
                            size="lg"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign In to Dashboard"
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 text-center text-sm">
                        <p className="text-muted-foreground">
                            Not an organizer?{" "}
                            <Link to="/login" className="text-primary hover:underline">
                                Customer Login
                            </Link>
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default OwnerLogin;
