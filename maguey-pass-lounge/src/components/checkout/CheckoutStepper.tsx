import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Check } from "lucide-react";

const CHECKOUT_STEPS = [
  { id: 1, label: "Tickets" },
  { id: 2, label: "Details" },
  { id: 3, label: "Payment" },
] as const;

interface CheckoutStepperProps {
  currentStep: number; // 1, 2, or 3
  onStepClick?: (step: number) => void; // Optional: allow clicking completed steps
}

/**
 * Breadcrumb progress indicator for checkout flow.
 * Per context decision: "Breadcrumb trail progress indicator (Tickets > Details > Payment)"
 */
export function CheckoutStepper({ currentStep, onStepClick }: CheckoutStepperProps) {
  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        {CHECKOUT_STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <BreadcrumbItem key={step.id}>
              {isCompleted ? (
                <BreadcrumbLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onStepClick?.(step.id);
                  }}
                  className="flex items-center gap-1 text-green-600 hover:text-green-500"
                >
                  <Check className="h-4 w-4" />
                  {step.label}
                </BreadcrumbLink>
              ) : isCurrent ? (
                <BreadcrumbPage className="font-semibold">
                  {step.label}
                </BreadcrumbPage>
              ) : (
                <span className="text-muted-foreground">{step.label}</span>
              )}
              {index < CHECKOUT_STEPS.length - 1 && <BreadcrumbSeparator />}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export { CHECKOUT_STEPS };
