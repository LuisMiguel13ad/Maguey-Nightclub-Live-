/**
 * Traces Monitoring Page
 *
 * Displays distributed traces for debugging and performance analysis.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { TraceDashboard } from "@/components/admin/TraceDashboard";

const TracesPage = () => {
  const navigate = useNavigate();
  const role = useRole();
  const { toast } = useToast();

  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Traces are only available to owners.",
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
      title="Distributed Traces"
      description="Track request flows and debug performance issues"
    >
      <TraceDashboard />
    </OwnerPortalLayout>
  );
};

export default TracesPage;
