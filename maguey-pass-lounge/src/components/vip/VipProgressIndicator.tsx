/**
 * VIP Progress Indicator Component
 * Shows the current step in the VIP reservation flow:
 * Select Table → Your Details → Payment → Confirmation
 */

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type VipStep = 'select' | 'details' | 'payment' | 'confirmation';

interface Step {
  id: VipStep;
  label: string;
}

const steps: Step[] = [
  { id: 'select', label: 'Select Table' },
  { id: 'details', label: 'Your Details' },
  { id: 'payment', label: 'Payment' },
  { id: 'confirmation', label: 'Confirmation' },
];

interface VipProgressIndicatorProps {
  currentStep: VipStep;
  className?: string;
}

export function VipProgressIndicator({ currentStep, className }: VipProgressIndicatorProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className={cn('w-full', className)}>
      {/* Desktop Progress */}
      <div className="hidden md:flex items-center justify-center gap-0">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <div key={step.id} className="flex items-center">
              {/* Step */}
              <div className="flex items-center gap-3">
                {/* Circle */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                    isCompleted && 'bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-md shadow-teal-500/30',
                    isCurrent && 'bg-teal-100 text-teal-900 ring-4 ring-teal-400/20',
                    isUpcoming && 'bg-[#0a1616] text-teal-600/50 border border-teal-800/40'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                {/* Label */}
                <span
                  className={cn(
                    'text-sm font-medium whitespace-nowrap transition-colors',
                    isCompleted && 'text-teal-400',
                    isCurrent && 'text-teal-100',
                    isUpcoming && 'text-teal-600/50'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector */}
              {index < steps.length - 1 && (
                <div className="mx-4 flex items-center">
                  <div
                    className={cn(
                      'w-12 h-0.5 transition-colors duration-300',
                      index < currentIndex ? 'bg-gradient-to-r from-teal-400 to-emerald-500' : 'bg-teal-800/40'
                    )}
                  />
                  <svg
                    className={cn(
                      'w-3 h-3 -ml-1 transition-colors',
                      index < currentIndex ? 'text-emerald-500' : 'text-teal-800/40'
                    )}
                    fill="currentColor"
                    viewBox="0 0 12 12"
                  >
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Progress - Compact */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-teal-100">
            {steps[currentIndex]?.label}
          </span>
          <span className="text-xs text-teal-500/60">
            Step {currentIndex + 1} of {steps.length}
          </span>
        </div>
        <div className="flex gap-1.5">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                index < currentIndex && 'bg-gradient-to-r from-teal-400 to-emerald-500',
                index === currentIndex && 'bg-teal-300',
                index > currentIndex && 'bg-teal-800/40'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default VipProgressIndicator;

