import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, User, Phone, Ticket, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { addToWaitlist, isOnWaitlist, getWaitlistPosition, type WaitlistFormData } from "@/lib/waitlist-service";

const waitlistSchema = z.object({
  ticketType: z.string().min(1, "Please select a ticket type"),
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email address"),
  customerPhone: z.string().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1").max(10, "Maximum 10 tickets"),
});

interface WaitlistFormProps {
  eventName: string;
  ticketTypes?: Array<{ id: string; name: string; isSoldOut: boolean }>;
  onSuccess?: () => void;
}

export function WaitlistForm({ eventName, ticketTypes, onSuccess }: WaitlistFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<WaitlistFormData & { quantity: number; ticketType: string }>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      quantity: 1,
      ticketType: ticketTypes?.[0]?.name || "",
    },
  });

  // Filter to only sold-out ticket types, or use all if none specified
  const availableTicketTypes = ticketTypes?.filter(tt => tt.isSoldOut) || 
    (ticketTypes || [{ name: "General Admission", id: "general" }]);

  useEffect(() => {
    // If there's only one sold-out ticket type, pre-select it
    if (availableTicketTypes.length === 1 && availableTicketTypes[0]?.name) {
      setValue("ticketType", availableTicketTypes[0].name);
    }
  }, [availableTicketTypes, setValue]);

  const onSubmit = async (data: WaitlistFormData & { quantity: number; ticketType: string }) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Check if already on waitlist
      const alreadyOnList = await isOnWaitlist(eventName, data.customerEmail);
      if (alreadyOnList) {
        setError("You're already on the waitlist for this event!");
        setIsSubmitting(false);
        return;
      }

      // Add to waitlist
      const entry = await addToWaitlist({
        eventName,
        ticketType: data.ticketType,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        quantity: data.quantity,
      });

      // Get queue position
      const position = await getWaitlistPosition(eventName, data.ticketType, data.customerEmail);
      setQueuePosition(position);

      setIsSuccess(true);
      const positionMessage = position 
        ? `You're #${position} in line for ${data.ticketType} tickets.`
        : "We'll notify you if tickets become available.";
      
      toast.success("Added to waitlist!", {
        description: positionMessage,
      });
      
      reset();
      
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to add to waitlist. Please try again.";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <div>
              <h3 className="text-lg font-semibold text-green-500">You're on the waitlist!</h3>
              {queuePosition ? (
                <p className="text-sm text-muted-foreground mt-2">
                  You're <span className="font-bold text-green-600">#{queuePosition}</span> in line. 
                  We'll notify you via email if tickets become available for {eventName}.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  We'll notify you via email if tickets become available for {eventName}.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="w-5 h-5" />
          Join Waitlist
        </CardTitle>
        <CardDescription>
          This event is sold out. Join the waitlist and we'll notify you if tickets become available.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {availableTicketTypes.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="ticketType">Ticket Type *</Label>
              <select
                id="ticketType"
                {...register("ticketType")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
              >
                {availableTicketTypes.map((tt) => (
                  <option key={tt.id} value={tt.name}>
                    {tt.name}
                  </option>
                ))}
              </select>
              {errors.ticketType && (
                <p className="text-sm text-destructive">{errors.ticketType.message}</p>
              )}
            </div>
          ) : (
            <input type="hidden" {...register("ticketType")} value={availableTicketTypes[0]?.name || ""} />
          )}

          <div className="space-y-2">
            <Label htmlFor="customerName">Full Name *</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="customerName"
                {...register("customerName")}
                placeholder="John Doe"
                className="pl-10"
                disabled={isSubmitting}
              />
            </div>
            {errors.customerName && (
              <p className="text-sm text-destructive">{errors.customerName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerEmail">Email Address *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="customerEmail"
                type="email"
                {...register("customerEmail")}
                placeholder="john@example.com"
                className="pl-10"
                disabled={isSubmitting}
              />
            </div>
            {errors.customerEmail && (
              <p className="text-sm text-destructive">{errors.customerEmail.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerPhone">Phone Number (Optional)</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="customerPhone"
                type="tel"
                {...register("customerPhone")}
                placeholder="(555) 123-4567"
                className="pl-10"
                disabled={isSubmitting}
              />
            </div>
            {errors.customerPhone && (
              <p className="text-sm text-destructive">{errors.customerPhone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Number of Tickets *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max="10"
              {...register("quantity", { valueAsNumber: true })}
              disabled={isSubmitting}
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding to waitlist...
              </>
            ) : (
              "Join Waitlist"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By joining the waitlist, you agree to be notified if tickets become available.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

