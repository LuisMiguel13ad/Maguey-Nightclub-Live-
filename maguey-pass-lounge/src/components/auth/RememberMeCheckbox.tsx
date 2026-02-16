import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface RememberMeCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function RememberMeCheckbox({ checked, onCheckedChange, disabled }: RememberMeCheckboxProps) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id="remember-me"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
      <Label
        htmlFor="remember-me"
        className="text-sm font-normal cursor-pointer"
      >
        Remember me
      </Label>
    </div>
  );
}

