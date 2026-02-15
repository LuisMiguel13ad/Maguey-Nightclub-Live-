/**
 * Metrics Monitoring Page
 *
 * Displays real-time system metrics for the Owner Suite.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { MetricsDashboard } from "@/components/admin/MetricsDashboard";

const MetricsPage = () => {
  const navigate = useNavigate();
  const role = useRole();
  const { toast } = useToast();

  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "System metrics are only available to owners.",
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
      title="System Metrics"
      description="Real-time performance metrics and system health"
    >
      <MetricsDashboard />
    </OwnerPortalLayout>
  );
};

export default MetricsPage;
