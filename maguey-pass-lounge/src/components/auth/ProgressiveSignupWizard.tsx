import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Music, Mail, Lock, User, Loader2, ArrowRight, ArrowLeft, CheckCircle2, Zap, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { AvatarUpload } from "./AvatarUpload";
import { ReferralCodeInput } from "./ReferralCodeInput";
import { useNavigate } from "react-router-dom";
import { ensureOrganizerProfile } from "@/lib/organizer-service";

const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  accountType: z.enum(["attendee", "organizer"]),
  companyName: z.string().optional(),
  companyPhone: z.string().optional(),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions",
  }),
})
.refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})
.superRefine((data, ctx) => {
  if (data.accountType === "organizer" && (!data.companyName || data.companyName.trim().length < 2)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["companyName"],
      message: "Company or brand name is required for organizer accounts",
    });
  }
});

type SignupFormData = z.infer<typeof signupSchema>;

const steps = [
  { id: 1, title: "Account", description: "Email & Password" },
  { id: 2, title: "Personal", description: "Name & Info" },
  { id: 3, title: "Profile", description: "Avatar (Optional)" },
  { id: 4, title: "Complete", description: "Referral & Terms" },
];

export function ProgressiveSignupWizard() {
  const navigate = useNavigate();
  const { signUp, checkPasswordBreach } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [breachWarning, setBreachWarning] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      accountType: "attendee",
      companyName: "",
      companyPhone: "",
      acceptTerms: false,
    },
  });

  const password = watch("password");
  const accountType = watch("accountType");
  const progress = (currentStep / steps.length) * 100;

  // Check password breach
  useEffect(() => {
    const checkBreach = async () => {
      if (password && password.length >= 8) {
        const result = await checkPasswordBreach(password);
        if (result.breached) {
          if (result.count > 100000) {
            setBreachWarning("This password has been found in over 100,000 data breaches.");
          } else if (result.count > 10000) {
            setBreachWarning("This password has been found in over 10,000 data breaches.");
          } else {
            setBreachWarning(`This password has been found in ${result.count} data breach${result.count > 1 ? 'es' : ''}.`);
          }
        } else {
          setBreachWarning("");
        }
      } else {
        setBreachWarning("");
      }
    };
    checkBreach();
  }, [password, checkPasswordBreach]);

  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1:
        return await trigger(["email", "password", "confirmPassword"]);
      case 2:
        return await trigger(["firstName", "lastName"]);
      case 3:
        return true; // Optional step
      case 4:
        return await trigger(["acceptTerms"]);
      default:
        return true;
    }
  };

  const nextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
      setCurrentStep(Math.min(currentStep + 1, steps.length));
      setError(null);
    }
  };

  const prevStep = () => {
    setCurrentStep(Math.max(currentStep - 1, 1));
    setError(null);
  };

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await signUp(data.email, data.password, {
        firstName: data.firstName,
        lastName: data.lastName,
        accountType: data.accountType,
      });

      if (error) {
        setError(error.message);
        toast.error(error.message);
      } else {
        if (data.accountType === "organizer") {
          try {
            await ensureOrganizerProfile({
              companyName: data.companyName?.trim() || `${data.firstName} Events`,
              contactPhone: data.companyPhone,
            });
            toast.success("Organizer profile submitted! Please verify your email to finalize access.");
          } catch (profileError) {
            console.error("Organizer profile error:", profileError);
            toast.error(
              profileError instanceof Error
                ? profileError.message
                : "Organizer profile setup failed. Contact support."
            );
          }
        } else {
          toast.success("Account created! Please check your email to verify your account.");
        }
        navigate("/login");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create account";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="p-8 border-border/50 bg-card">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-6">
              <Music className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                MAGUEY
              </h1>
            </div>
            <h2 className="text-3xl font-bold mb-2">Create Account</h2>
            <p className="text-muted-foreground mb-6">Sign up to get started with Maguey</p>

            {/* Progress Indicator */}
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={`flex flex-col items-center flex-1 ${
                      step.id <= currentStep ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                        step.id < currentStep
                          ? "bg-primary border-primary text-primary-foreground"
                          : step.id === currentStep
                          ? "border-primary text-primary"
                          : "border-muted"
                      }`}
                    >
                      {step.id < currentStep ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        step.id
                      )}
                    </div>
                    <span className="text-xs mt-1 hidden sm:block">{step.title}</span>
                  </div>
                ))}
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {breachWarning && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{breachWarning}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Email & Password */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
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
                      className="pl-10 pr-10"
                      {...register("password")}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                  {password && <PasswordStrengthMeter password={password} />}
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      {...register("confirmPassword")}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Personal Info */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="firstName"
                        placeholder="John"
                        className="pl-10"
                        {...register("firstName")}
                        disabled={isLoading}
                      />
                    </div>
                    {errors.firstName && (
                      <p className="text-sm text-destructive">{errors.firstName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      {...register("lastName")}
                      disabled={isLoading}
                    />
                    {errors.lastName && (
                      <p className="text-sm text-destructive">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={accountType === "attendee" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setValue("accountType", "attendee")}
                      disabled={isLoading}
                    >
                      <User className="w-4 h-4 mr-2" />
                      Attendee
                    </Button>
                    <Button
                      type="button"
                      variant={accountType === "organizer" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setValue("accountType", "organizer")}
                      disabled={isLoading}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Organizer
                    </Button>
                  </div>
                </div>

                {accountType === "organizer" && (
                  <div className="space-y-4 border border-border/40 rounded-lg p-4 bg-muted/20">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company / Brand Name</Label>
                      <Input
                        id="companyName"
                        placeholder="Maguey Entertainment"
                        {...register("companyName")}
                        disabled={isLoading}
                      />
                      {errors.companyName && (
                        <p className="text-sm text-destructive">{errors.companyName.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyPhone">Contact Phone</Label>
                      <Input
                        id="companyPhone"
                        placeholder="(555) 123-4567"
                        {...register("companyPhone")}
                        disabled={isLoading}
                      />
                    </div>

                    <Alert className="border-primary/30 bg-primary/5">
                      <AlertDescription className="text-sm">
                        Organizer accounts unlock event publishing, ticket tier management, and attendee tools.
                        Our team will review and verify your profile before events go live.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Avatar (Optional) */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add a profile picture (optional). You can skip this step.
                </p>
                <AvatarUpload
                  currentAvatarUrl={avatarUrl}
                  onUploadComplete={(url) => setAvatarUrl(url)}
                />
              </div>
            )}

            {/* Step 4: Referral & Terms */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <ReferralCodeInput />

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="acceptTerms"
                    checked={watch("acceptTerms")}
                    onCheckedChange={(checked) => {
                      setValue("acceptTerms", checked === true);
                    }}
                    disabled={isLoading}
                  />
                  <Label htmlFor="acceptTerms" className="text-sm leading-none">
                    I agree to the{" "}
                    <a href="/terms" className="text-primary hover:underline">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="/privacy" className="text-primary hover:underline">
                      Privacy Policy
                    </a>
                  </Label>
                </div>
                {errors.acceptTerms && (
                  <p className="text-sm text-destructive">{errors.acceptTerms.message}</p>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={prevStep} disabled={isLoading}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
              )}
              <div className="ml-auto">
                {currentStep < steps.length ? (
                  <Button type="button" onClick={nextStep} disabled={isLoading}>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="bg-gradient-primary hover:shadow-glow-primary transition-all"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>

          {/* Quick Login Link */}
          <div className="mt-6 pt-6 border-t border-primary/10">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Already have an account?</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Zap className="h-4 w-4" />
                Quick Login (Demo Account)
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

