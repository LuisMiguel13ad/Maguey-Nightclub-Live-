/**
 * Risk Indicator Badge Component
 * 
 * Displays risk score badge on scan results
 */

import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, CheckCircle2 } from 'lucide-react';

interface RiskIndicatorBadgeProps {
  riskScore: number | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const RiskIndicatorBadge = ({ 
  riskScore, 
  size = 'md',
  showIcon = true 
}: RiskIndicatorBadgeProps) => {
  if (riskScore === null || riskScore === undefined) {
    return null;
  }

  const getRiskLevel = (score: number): {
    label: string;
    color: string;
    bgColor: string;
    icon: typeof AlertTriangle;
  } => {
    if (score >= 90) {
      return {
        label: 'Critical',
        color: 'text-red-600',
        bgColor: 'bg-red-500/10 border-red-500/30',
        icon: AlertTriangle,
      };
    }
    if (score >= 80) {
      return {
        label: 'High',
        color: 'text-orange-600',
        bgColor: 'bg-orange-500/10 border-orange-500/30',
        icon: AlertTriangle,
      };
    }
    if (score >= 50) {
      return {
        label: 'Medium',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-500/10 border-yellow-500/30',
        icon: Shield,
      };
    }
    return {
      label: 'Low',
      color: 'text-green-600',
      bgColor: 'bg-green-500/10 border-green-500/30',
      icon: CheckCircle2,
    };
  };

  const risk = getRiskLevel(riskScore);
  const Icon = risk.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <Badge
      variant="outline"
      className={`${risk.bgColor} ${risk.color} ${sizeClasses[size]} border font-medium flex items-center gap-1`}
    >
      {showIcon && <Icon className={`h-${size === 'sm' ? '3' : size === 'md' ? '4' : '5'} w-${size === 'sm' ? '3' : size === 'md' ? '4' : '5'}`} />}
      <span>{risk.label}</span>
      <span className="opacity-70">({riskScore})</span>
    </Badge>
  );
};

