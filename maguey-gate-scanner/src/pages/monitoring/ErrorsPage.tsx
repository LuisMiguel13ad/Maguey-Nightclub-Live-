/**
 * Errors Monitoring Page
 *
 * Displays error tracking and management dashboard.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { ErrorDashboard } from "@/components/admin/ErrorDashboard";

const ErrorsPage = () => {
  const navigate = useNavigate();
  const role = useRole();
  const { toast } = useToast();

  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Error tracking is only available to owners.",
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
      title="Error Tracking"
      description="Monitor and manage application errors"
    >
      <ErrorDashboard />
    </OwnerPortalLayout>
  );
};

export default ErrorsPage;
