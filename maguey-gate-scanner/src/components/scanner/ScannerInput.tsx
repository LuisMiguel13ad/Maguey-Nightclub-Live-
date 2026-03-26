import { useEffect, useRef, useState } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scan, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScannerInputProps {
  onScanSuccess: (decodedText: string) => void;
  disabled?: boolean;
}

export const ScannerInput = ({ onScanSuccess, disabled = false }: ScannerInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scannerInput, setScannerInput] = useState("");

  // Auto-focus input field when component mounts or becomes enabled
  useEffect(() => {
    if (inputRef.current && !disabled) {
      // Small delay to ensure component is fully rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [disabled]);

  // Handle Enter key to submit scanner input
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process Enter key when input field is focused
      if (e.key === "Enter" && document.activeElement === inputRef.current) {
        const currentValue = scannerInput.trim();
        if (currentValue) {
          e.preventDefault();
          onScanSuccess(currentValue);
          setScannerInput("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [scannerInput, disabled, onScanSuccess]);

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScannerInput(e.target.value);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scannerInput.trim()) {
      onScanSuccess(scannerInput.trim());
      setScannerInput("");
    }
  };

  const handleFocus = () => {
    // Keep input focused for scanner input
  };

  return (
    <>
      <CardHeader className="text-center bg-gradient-scan">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Keyboard className="h-8 w-8 text-primary animate-pulse" />
          </div>
        </div>
        <CardTitle className="text-2xl">Scan Ticket with USB Scanner</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Point scanner at QR code or barcode, or type ticket ID manually
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scanner-input" className="text-base font-semibold">
              Ticket ID
            </Label>
            <Input
              ref={inputRef}
              id="scanner-input"
              type="text"
              placeholder="Scan QR code or type ticket ID"
              value={scannerInput}
              onChange={handleManualInput}
              onFocus={handleFocus}
              disabled={disabled}
              autoFocus
              className="text-lg font-mono border-primary/30 focus:border-primary h-14"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              ✓ Ready to scan - Point USB scanner at QR code or type ticket ID manually
            </p>
          </div>
          <Button
            type="submit"
            className="w-full bg-gradient-purple hover:shadow-glow-purple transition-all"
            disabled={disabled || !scannerInput.trim()}
            size="lg"
          >
            <Scan className="mr-2 h-5 w-5" />
            Validate Ticket
          </Button>
        </form>
      </CardContent>
    </>
  );
};

