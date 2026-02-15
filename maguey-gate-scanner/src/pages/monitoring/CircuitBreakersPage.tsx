/**
 * Circuit Breakers Monitoring Page
 *
 * Displays circuit breaker status and controls.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { CircuitBreakerDashboard } from "@/components/admin/CircuitBreakerDashboard";

const CircuitBreakersPage = () => {
  const navigate = useNavigate();
  const role = useRole();
  const { toast } = useToast();

  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Circuit breaker controls are only available to owners.",
      });
      navigate("/scanner");
    }
  }, [role, navigate, toast]);

  if (role !== 'owner') {
    return null;
  }

  return (
    <OwnerPortalLayout
      subtitle="MONITORING"
      title="Circuit Breakers"
      description="Monitor and control service circuit breakers"
    >
      <CircuitBreakerDashboard />
    </OwnerPortalLayout>
  );
};

export default CircuitBreakersPage;
