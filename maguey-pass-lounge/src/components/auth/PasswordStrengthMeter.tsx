import { Eye } from "lucide-react";

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const getPasswordStrength = () => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    const labels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
    const colors = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-green-600"];
    
    return { strength, label: labels[strength], color: colors[strength] };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <div className={`flex-1 h-1.5 rounded-full ${
          passwordStrength.strength >= 1 ? passwordStrength.color : 'bg-muted'
        }`} />
        <div className={`flex-1 h-1.5 rounded-full ${
          passwordStrength.strength >= 2 ? passwordStrength.color : 'bg-muted'
        }`} />
        <div className={`flex-1 h-1.5 rounded-full ${
          passwordStrength.strength >= 3 ? passwordStrength.color : 'bg-muted'
        }`} />
        <div className={`flex-1 h-1.5 rounded-full ${
          passwordStrength.strength >= 4 ? passwordStrength.color : 'bg-muted'
        }`} />
        <span className="text-muted-foreground min-w-[80px]">{passwordStrength.label}</span>
      </div>
    </div>
  );
}

