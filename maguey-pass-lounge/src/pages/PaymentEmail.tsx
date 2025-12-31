import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  X, Loader2, Mail, CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

// Form validation schema
const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type EmailFormData = z.infer<typeof emailSchema>;

const PaymentEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const onSubmit = async (data: EmailFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get order/payment info from URL params
      const orderId = searchParams.get("orderId");
      const paymentId = searchParams.get("paymentId");
      
      // TODO: Send email to backend to associate with order
      // await sendEmailToOrder(orderId, paymentId, data.email);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess(true);
      toast.success("Email saved successfully!");
      
      // Redirect to success page after a moment
      setTimeout(() => {
        navigate(`/checkout/success?orderId=${orderId}&email=${encodeURIComponent(data.email)}`);
      }, 2000);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save email";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      {/* Close Button */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          onClick={() => navigate("/")}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="w-full max-w-md mx-4">
        <div className="bg-white rounded-lg shadow-xl p-8 space-y-6">
          {success ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">Email Saved!</h2>
              <p className="text-gray-600">Redirecting to your tickets...</p>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Mail className="w-10 h-10 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold">Almost Done!</h2>
                <p className="text-gray-600">
                  Please enter your email to receive your tickets
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    {...register("email")}
                    disabled={isLoading}
                    className="bg-white border-gray-300"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email.message}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Your tickets will be sent to this email address
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Send My Tickets"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentEmail;

