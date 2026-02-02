/**
 * Query Performance Monitoring Page
 *
 * Displays slow queries, index suggestions, and optimization hints.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { QueryPerformanceDashboard } from "@/components/admin/QueryPerformanceDashboard";

const QueryPerformancePage = () => {
  const navigate = useNavigate();
  const role = useRole();
  const { toast } = useToast();

  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Query performance monitoring is only available to owners.",
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
      title="Query Performance"
      description="Monitor slow queries and optimization suggestions"
    >
      <QueryPerformanceDashboard />
    </OwnerPortalLayout>
  );
};

export default QueryPerformancePage;
