import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const magicLinkSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type MagicLinkFormData = z.infer<typeof magicLinkSchema>;

export function MagicLinkButton() {
  const { signInWithMagicLink } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
  });

  const onSubmit = async (data: MagicLinkFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signInWithMagicLink(data.email);
      if (error) {
        toast.error(error.message);
      } else {
        setSent(true);
        toast.success("Magic link sent! Check your email.");
      }
    } catch (err) {
      toast.error("Failed to send magic link");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full"
        >
          <Mail className="w-4 h-4 mr-2" />
          Email me a login link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Passwordless Login</DialogTitle>
          <DialogDescription>
            Enter your email address and we'll send you a magic link to sign in.
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Mail className="w-12 h-12 text-primary mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Check your email for the magic link. Click it to sign in instantly!
              </p>
            </div>
            <Button
              onClick={() => {
                setSent(false);
                setIsOpen(false);
              }}
              className="w-full"
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="magic-email">Email</Label>
              <Input
                id="magic-email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Magic Link"
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

