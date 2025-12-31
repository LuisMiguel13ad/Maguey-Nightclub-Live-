import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function ReferralCodeInput() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [rewardInfo, setRewardInfo] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!code.trim() || !user) return;

    setIsValidating(true);
    setIsValid(null);
    setRewardInfo(null);

    try {
      // Check if referral code exists
      const { data, error } = await supabase
        .from('profiles')
        .select('id, referral_code')
        .eq('referral_code', code.toUpperCase())
        .single();

      if (error || !data) {
        setIsValid(false);
        toast.error("Invalid referral code");
        return;
      }

      // Check if user is trying to use their own code
      if (data.id === user.id) {
        setIsValid(false);
        toast.error("You cannot use your own referral code");
        return;
      }

      // Check if already used
      const { data: existing } = await supabase
        .from('referrals')
        .select('id')
        .eq('referee_id', user.id)
        .single();

      if (existing) {
        setIsValid(false);
        toast.error("You have already used a referral code");
        return;
      }

      setIsValid(true);
      setRewardInfo("You'll receive a 10% discount on your first ticket purchase!");
      toast.success("Referral code applied!");
    } catch (err) {
      setIsValid(false);
      toast.error("Failed to validate referral code");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="referral-code">Referral Code (Optional)</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Gift className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="referral-code"
            placeholder="Enter referral code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="pl-10"
            disabled={isValidating || isValid === true}
          />
        </div>
        <Button
          type="button"
          onClick={handleValidate}
          disabled={isValidating || !code.trim() || isValid === true}
          variant="outline"
        >
          {isValidating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isValid ? (
            "Applied"
          ) : (
            "Apply"
          )}
        </Button>
      </div>
      {isValid === true && rewardInfo && (
        <Alert className="border-green-500 bg-green-500/10">
          <AlertDescription className="text-green-700 dark:text-green-400">
            {rewardInfo}
          </AlertDescription>
        </Alert>
      )}
      {isValid === false && (
        <Alert variant="destructive">
          <AlertDescription>
            Invalid referral code. Please check and try again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

