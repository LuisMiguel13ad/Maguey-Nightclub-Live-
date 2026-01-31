# Phase 7: UX Polish - Research

**Researched:** 2026-01-31
**Domain:** User Experience - Loading States, Error Handling, Mobile Scanner UX, Checkout Optimization
**Confidence:** HIGH

## Summary

This research covers four key UX improvement areas for the Maguey nightclub system: skeleton loading states, error message experience, mobile scanner interface optimization, and checkout flow speed. The existing codebase already has strong foundations -- shadcn/ui skeleton and toast components, Web Audio API for scanner feedback, and the Radix UI component library with Tailwind CSS animations.

The project uses Sonner toast library (via shadcn/ui) for notifications, an existing audio-feedback-service.ts with Web Audio API for scanner sounds, and the standard shadcn/ui Skeleton component with `animate-pulse`. The tailwind config already includes `tailwindcss-animate` plugin with keyframes for fade, slide, and reveal animations.

**Primary recommendation:** Use existing shadcn/ui primitives (Skeleton, Sonner toast, Breadcrumb) with custom composite components for loading states, add Web APIs (Screen Wake Lock, Vibration) for scanner optimization, and implement localStorage-persisted form state for returning visitors.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui | current | UI components (Skeleton, Toast, Breadcrumb) | Project already uses this |
| sonner | 1.x | Toast notifications | Integrated via shadcn/ui sonner component |
| tailwindcss-animate | current | CSS animations | Already in tailwind.config.ts |
| lucide-react | current | Icons (Loader2 for spinners) | Project already uses this |

### Supporting (To Add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-screen-wake-lock | 3.1.x | Prevent screen sleep | Scanner interface only |

### Browser APIs (No Install Needed)
| API | Purpose | Support |
|-----|---------|---------|
| Navigator.vibrate() | Haptic feedback | All modern Android, limited iOS |
| Screen Wake Lock API | Prevent screen dimming | Chrome, Edge, Safari (HTTPS only) |
| Web Audio API | Audio feedback | Already implemented in audio-feedback-service.ts |
| localStorage | Form persistence | Universal |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sonner | react-hot-toast | Sonner already integrated, no benefit to switch |
| Custom wake lock | expo-keep-awake | Only for React Native, not web |
| CSS animations | framer-motion | Overkill for simple fades, larger bundle |

**Installation:**
```bash
npm install react-screen-wake-lock
```

## Architecture Patterns

### Recommended Component Structure
```
src/
├── components/
│   ├── ui/
│   │   ├── skeleton.tsx          # Already exists
│   │   ├── loading-button.tsx    # NEW: Button with loading state
│   │   └── skeleton-card.tsx     # NEW: Composite skeleton patterns
│   ├── feedback/
│   │   ├── error-toast.tsx       # NEW: Error toast with actions
│   │   └── offline-modal.tsx     # NEW: Full-screen offline acknowledgment
│   └── checkout/
│       ├── checkout-stepper.tsx  # NEW: Breadcrumb progress indicator
│       └── checkout-form.tsx     # NEW: Form with localStorage persistence
├── hooks/
│   ├── use-loading-state.ts      # NEW: Centralized loading management
│   ├── use-wake-lock.ts          # NEW: Screen wake lock hook
│   ├── use-persisted-form.ts     # NEW: localStorage form persistence
│   └── use-toast.ts              # Already exists
└── lib/
    └── audio-feedback-service.ts # Already exists - extend for new patterns
```

### Pattern 1: Skeleton Loading with Content Matching
**What:** Skeleton components that match the exact dimensions of loaded content to prevent layout shift
**When to use:** Any async data fetch (events, tickets, reservations)
**Example:**
```typescript
// Source: shadcn/ui patterns
import { Skeleton } from "@/components/ui/skeleton"

export function EventCardSkeleton() {
  return (
    <div className="flex flex-col space-y-3">
      <Skeleton className="h-[200px] w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}
```

### Pattern 2: Loading Button with Size Preservation
**What:** Button that shows spinner during async operations while maintaining its size
**When to use:** Form submissions, payment processing, any async button action
**Example:**
```typescript
// Source: shadcn/ui + best practices
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean
  children: React.ReactNode
}

export function LoadingButton({ isLoading, children, disabled, ...props }: LoadingButtonProps) {
  return (
    <Button disabled={isLoading || disabled} {...props}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        children
      )}
    </Button>
  )
}
```

### Pattern 3: Error Toast with Recovery Actions
**What:** Toast notifications that persist until dismissed and include action buttons
**When to use:** All user-facing errors
**Example:**
```typescript
// Source: Sonner API
import { toast } from "sonner"

export function showErrorToast(message: string, onRetry?: () => void) {
  toast.error(message, {
    duration: Infinity, // Persist until dismissed
    action: onRetry ? {
      label: "Try Again",
      onClick: onRetry,
    } : undefined,
    closeButton: true,
  })
}
```

### Pattern 4: Screen Wake Lock for Scanner
**What:** Prevent screen from dimming during active scanning
**When to use:** Scanner page when camera is active
**Example:**
```typescript
// Source: MDN Screen Wake Lock API
import { useWakeLock } from 'react-screen-wake-lock';

export function ScannerPage() {
  const { isSupported, released, request, release } = useWakeLock({
    onRelease: () => console.log('Wake lock released'),
  });

  useEffect(() => {
    if (isSupported) {
      request(); // Keep screen awake
    }
    return () => {
      if (!released) release();
    };
  }, [isSupported, request, release, released]);

  // Re-acquire on visibility change (tab switch back)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isSupported) {
        request();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isSupported, request]);
}
```

### Pattern 5: Persisted Form State
**What:** Save form data to localStorage for returning visitors
**When to use:** Checkout forms (name, email)
**Example:**
```typescript
// Source: localStorage best practices
function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setPersistedState = useCallback((value: T) => {
    setState(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to persist state:', e);
    }
  }, [key]);

  return [state, setPersistedState];
}
```

### Anti-Patterns to Avoid
- **Full-page spinners for partial updates:** Use skeleton screens that match content layout instead
- **Technical error messages:** "PGRST116" means nothing to users - show friendly messages
- **Auto-dismiss error toasts:** Users may miss important error information
- **Inline form validation while typing:** Per context decision, validate on submit only
- **Pure black (#000000) in dark mode:** Use dark gray (#121212) to reduce eye strain

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading spinners | Custom CSS animation | Loader2 from lucide-react with animate-spin | Consistent sizing, easy to style |
| Toast notifications | Custom notification system | Sonner (already integrated) | Handles stacking, animations, accessibility |
| Haptic feedback | Manual vibration patterns | Extend existing audio-feedback-service.ts | Already has pattern infrastructure |
| Form persistence | Custom storage logic | usePersistedState hook pattern | Handles SSR, JSON serialization, errors |
| Wake lock management | Direct API calls | react-screen-wake-lock | Handles re-acquisition on visibility change |
| Skeleton animations | Custom keyframes | shadcn/ui Skeleton with animate-pulse | Already themed to project colors |
| Breadcrumb navigation | Custom step indicator | shadcn/ui Breadcrumb | Accessible, consistent styling |

**Key insight:** The project already has a mature UI component library. Extend it rather than replacing it.

## Common Pitfalls

### Pitfall 1: Layout Shift During Loading
**What goes wrong:** Content jumps when skeletons are replaced with actual content
**Why it happens:** Skeleton dimensions don't match loaded content
**How to avoid:** Create skeleton components that exactly mirror the structure and dimensions of the loaded content
**Warning signs:** CLS (Cumulative Layout Shift) > 0.1 in Lighthouse

### Pitfall 2: Haptic Feedback on iOS
**What goes wrong:** navigator.vibrate() doesn't work on iOS Safari
**Why it happens:** Apple restricts the Vibration API on iOS
**How to avoid:** Feature-detect before using; don't rely solely on haptic feedback - always pair with visual/audio
**Warning signs:** Testing only on Android devices

### Pitfall 3: Wake Lock Released on Tab Switch
**What goes wrong:** Screen dims when user switches apps and returns
**Why it happens:** Wake lock is automatically released when page visibility changes
**How to avoid:** Listen to visibilitychange event and re-acquire wake lock when page becomes visible
**Warning signs:** Staff complaints about scanner screen dimming

### Pitfall 4: localStorage Quota Exceeded
**What goes wrong:** Form data fails to save silently
**Why it happens:** ~5MB limit per domain; accumulation of old data
**How to avoid:** Wrap localStorage calls in try-catch; only persist essential fields (name, email)
**Warning signs:** Returning users report data not remembered

### Pitfall 5: Spinner Button Size Change
**What goes wrong:** Button shrinks/grows when showing spinner, causing layout jank
**Why it happens:** Spinner icon has different dimensions than button text
**How to avoid:** Set fixed min-width on button, or use inline-flex with consistent gap
**Warning signs:** Buttons "jumping" during form submission

### Pitfall 6: Dark Mode Contrast Issues
**What goes wrong:** Text becomes unreadable in nightclub lighting conditions
**Why it happens:** Insufficient contrast between text and background
**How to avoid:** Maintain WCAG 4.5:1 contrast ratio; use #E0E0E0 text on #121212 background
**Warning signs:** Staff reports difficulty reading scanner UI

### Pitfall 7: Touch Targets Too Small for Gloves
**What goes wrong:** Gate staff wearing gloves can't tap buttons accurately
**Why it happens:** Buttons sized for bare fingers (44px) are difficult with gloves
**How to avoid:** Use 48px minimum touch targets for scanner interface; 56px+ recommended
**Warning signs:** Multiple mis-taps, accidental dismissals

## Code Examples

Verified patterns from official sources:

### Skeleton Card Pattern
```typescript
// Source: shadcn/ui patterns + project conventions
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function EventCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      {/* Image placeholder - match EventCard image height */}
      <Skeleton className="h-48 w-full rounded-none" />
      <CardHeader className="space-y-2">
        {/* Title */}
        <Skeleton className="h-6 w-3/4" />
        {/* Date badge */}
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        {/* Description lines */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardContent>
    </Card>
  )
}
```

### Error Toast with Recovery Action
```typescript
// Source: Sonner API + project context decisions
import { toast } from "sonner"

// Professional/formal tone per context decision
const ERROR_MESSAGES = {
  payment_failed: "Payment could not be processed. Please check your card details and try again.",
  network_error: "Unable to connect. Please check your internet connection.",
  validation_error: "Please review the form for errors.",
  generic: "An error occurred. Please contact support if this persists.",
}

export function showError(
  type: keyof typeof ERROR_MESSAGES,
  onRetry?: () => void
) {
  toast.error(ERROR_MESSAGES[type], {
    duration: Infinity, // Persist until dismissed per context decision
    closeButton: true,
    action: onRetry ? {
      label: "Try Again",
      onClick: onRetry,
    } : {
      label: "Contact Support",
      onClick: () => window.location.href = "mailto:support@maguey.com",
    },
  })
}
```

### Haptic Feedback Patterns
```typescript
// Source: Existing audio-feedback-service.ts + context decisions
// Extend the existing service with distinct patterns

// Quick buzz for success (50ms)
export const hapticSuccess = () => {
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }
};

// Longer pattern for rejection (200ms, 100ms pause, 200ms)
export const hapticRejection = () => {
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
};

// Triple pulse for VIP
export const hapticVIP = () => {
  if (navigator.vibrate) {
    navigator.vibrate([50, 30, 50, 30, 50]);
  }
};
```

### Checkout Breadcrumb Progress
```typescript
// Source: shadcn/ui Breadcrumb + context decisions
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const CHECKOUT_STEPS = ["Tickets", "Details", "Payment"] as const

interface CheckoutStepperProps {
  currentStep: number
}

export function CheckoutStepper({ currentStep }: CheckoutStepperProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {CHECKOUT_STEPS.map((step, index) => (
          <BreadcrumbItem key={step}>
            {index < currentStep ? (
              <BreadcrumbLink className="text-copper-400">{step}</BreadcrumbLink>
            ) : index === currentStep ? (
              <BreadcrumbPage>{step}</BreadcrumbPage>
            ) : (
              <span className="text-muted-foreground">{step}</span>
            )}
            {index < CHECKOUT_STEPS.length - 1 && <BreadcrumbSeparator />}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
```

### Crossfade Step Transitions
```typescript
// Source: Tailwind CSS animate + context decisions (fade in/out transitions)
// Use existing tailwindcss-animate classes

interface FadeTransitionProps {
  show: boolean
  children: React.ReactNode
}

export function FadeTransition({ show, children }: FadeTransitionProps) {
  return (
    <div
      className={cn(
        "transition-opacity duration-300 ease-in-out",
        show ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {children}
    </div>
  )
}

// Or use animate-in/animate-out from tailwindcss-animate
<div className="animate-in fade-in duration-300">
  {/* Content */}
</div>
```

### Large Touch Targets for Gloves
```typescript
// Source: WCAG 2.5.8 + context decision for glove use
// Minimum 48px, recommended 56px+ for glove use

// Scanner-specific button with large touch target
export function ScannerButton({ children, ...props }: ButtonProps) {
  return (
    <Button
      className={cn(
        "min-h-[56px] min-w-[56px] text-lg",
        // High contrast for nightclub environment
        "bg-white text-black hover:bg-white/90",
        props.className
      )}
      {...props}
    >
      {children}
    </Button>
  )
}
```

### Offline Acknowledgment Modal
```typescript
// Source: Context decision - full overlay when going offline
import { WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface OfflineModalProps {
  onAcknowledge: () => void
}

export function OfflineModal({ onAcknowledge }: OfflineModalProps) {
  return (
    <div className="fixed inset-0 z-[200] bg-orange-500 flex flex-col items-center justify-center p-6">
      <WifiOff className="h-24 w-24 text-white mb-8" />
      <h2 className="text-3xl font-black text-white mb-4 text-center">
        OFFLINE MODE
      </h2>
      <p className="text-white/90 text-lg text-center mb-8 max-w-md">
        Network connection lost. Scans will be queued and synced when connection is restored.
      </p>
      <Button
        onClick={onAcknowledge}
        className="bg-white text-orange-600 hover:bg-white/90 text-lg font-bold px-8 py-6 h-auto min-h-[56px]"
      >
        I Understand - Continue Scanning
      </Button>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Loading spinners | Skeleton screens | 2020+ | Better perceived performance, reduced layout shift |
| Auto-dismiss all toasts | Persist errors until dismissed | 2023+ | Users don't miss important error information |
| 44px touch targets | 48px+ minimum | WCAG 2.2 (2023) | Better accessibility for motor impairments |
| requestAnimationFrame for transitions | CSS transitions with will-change | 2022+ | GPU-accelerated, smoother animations |
| sessionStorage for temp data | localStorage with explicit clear | Current | Survives browser restarts for returning visitors |

**Deprecated/outdated:**
- Multi-page checkout flows: Single-page with steps is now standard
- Spinner-only loading states: Research shows skeletons improve perceived speed
- Technical error codes in UI: Always translate to human-readable messages

## Open Questions

Things that couldn't be fully resolved:

1. **Exact shimmer animation timing**
   - What we know: `animate-pulse` uses 2s ease-in-out by default
   - What's unclear: Whether pulse or shimmer (linear gradient sweep) is preferred
   - Recommendation: Start with pulse (already in Tailwind), test with users

2. **iOS haptic feedback workaround**
   - What we know: navigator.vibrate() doesn't work on iOS Safari
   - What's unclear: Whether the react-haptic "hidden switch trick" works reliably
   - Recommendation: Don't rely on haptic alone; audio + visual is primary feedback

3. **Screen Wake Lock battery impact**
   - What we know: Wake lock increases battery usage
   - What's unclear: Exact battery drain rate on various devices
   - Recommendation: Only enable during active scanning, release when idle

## Sources

### Primary (HIGH confidence)
- [MDN Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) - Full API documentation
- [shadcn/ui Skeleton](https://ui.shadcn.com/docs/components/skeleton) - Component API and patterns
- [shadcn/ui Sonner](https://ui.shadcn.com/docs/components/sonner) - Toast integration
- [WCAG 2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) - Touch target guidelines

### Secondary (MEDIUM confidence)
- [Baymard Institute Checkout UX](https://baymard.com/blog/current-state-of-checkout-ux) - Checkout optimization research
- [react-screen-wake-lock](https://github.com/jorisre/react-screen-wake-lock) - Wake lock React library
- [Sonner GitHub](https://github.com/emilkowalski/sonner) - Toast library API
- [Dark Mode UI Best Practices 2026](https://www.designstudiouiux.com/blog/dark-mode-ui-design-best-practices/) - Dark UI patterns

### Tertiary (LOW confidence)
- Community patterns for checkout flow optimization (needs validation during implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project or well-documented
- Architecture: HIGH - Extending existing patterns from codebase
- Pitfalls: MEDIUM - Based on common issues, will validate during implementation
- Browser APIs: HIGH - MDN documentation verified

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (60 days - stable domain, APIs mature)
