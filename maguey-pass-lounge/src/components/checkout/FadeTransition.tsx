import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FadeTransitionProps {
  show: boolean;
  children: ReactNode;
  className?: string;
  duration?: number; // in ms, default 300
}

/**
 * Fade transition wrapper for checkout step changes.
 * Per context decision: "Fade in/out transitions between checkout steps"
 *
 * Uses CSS transitions for smooth, GPU-accelerated animations.
 * The transition uses opacity + pointer-events for accessibility.
 */
export function FadeTransition({
  show,
  children,
  className,
  duration = 300,
}: FadeTransitionProps) {
  return (
    <div
      className={cn(
        "transition-opacity ease-in-out",
        show ? "opacity-100" : "opacity-0 pointer-events-none absolute inset-0",
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
      aria-hidden={!show}
    >
      {children}
    </div>
  );
}

/**
 * Alternative: Use tailwindcss-animate classes directly
 * This is a convenience wrapper that matches the project's existing animation patterns.
 */
export function AnimatedStep({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in duration-300",
        className
      )}
    >
      {children}
    </div>
  );
}
