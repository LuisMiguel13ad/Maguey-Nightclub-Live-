import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/**
 * Legacy /auth route — redirects to the appropriate login page.
 *
 * Routing logic:
 * - /auth → /auth/employee (default, per 15-CONTEXT.md decision)
 * - /auth?invite=TOKEN → /auth/owner?invite=TOKEN
 * - /auth?token=X&type=recovery → /auth/owner?token=X&type=recovery
 * - /auth?role=owner → /auth/owner
 * - /auth?role=staff → /auth/employee
 * - Hash fragments with access_token + type=recovery → /auth/owner
 */
const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const invite = searchParams.get('invite');
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const role = searchParams.get('role');
    const hash = window.location.hash;

    // Invitations go to owner page
    if (invite) {
      navigate(`/auth/owner?${searchParams.toString()}`, { replace: true });
      return;
    }

    // Password reset tokens go to owner page
    if ((token && type === 'recovery') || (hash && hash.includes('access_token') && hash.includes('type=recovery'))) {
      const hashPart = hash ? hash : '';
      navigate(`/auth/owner?${searchParams.toString()}${hashPart}`, { replace: true });
      return;
    }

    // Explicit role parameter
    if (role === 'owner') {
      navigate('/auth/owner', { replace: true });
      return;
    }

    // Default: employee login
    navigate('/auth/employee', { replace: true });
  }, [navigate, searchParams]);

  return null;
};

export default Auth;
