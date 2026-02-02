/**
 * Rate Limits Monitoring Page
 *
 * Displays rate limiting statistics and violations.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { RateLimitDashboard } from "@/components/admin/RateLimitDashboard";

const RateLimitsPage = () => {
  const navigate = useNavigate();
  const role = useRole();
  const { toast } = useToast();

  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Rate limit monitoring is only available to owners.",
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
      title="Rate Limits"
      description="Monitor rate limiting policies and violations"
    >
      <RateLimitDashboard />
    </OwnerPortalLayout>
  );
};

export default RateLimitsPage;
