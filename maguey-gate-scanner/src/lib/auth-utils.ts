import { NavigateFunction } from 'react-router-dom';
import { getUserRole } from '@/lib/auth';

/**
 * Route constants for authentication flows
 */
export const AUTH_ROUTES = {
  OWNER_LOGIN: '/auth/owner',
  EMPLOYEE_LOGIN: '/auth/employee',
  OWNER_REDIRECT: '/dashboard',
  EMPLOYEE_REDIRECT: '/scanner',
} as const;

/**
 * Navigate user to appropriate route based on their role
 * @param userData - User data from Supabase auth
 * @param navigate - React Router navigate function
 */
export const navigateByRole = (userData: any, navigate: NavigateFunction): void => {
  if (!userData) {
    navigate('/scanner');
    return;
  }
  const userRole = getUserRole(userData);
  if (userRole === 'owner' || userRole === 'promoter') {
    navigate('/dashboard');
  } else {
    navigate('/scanner');
  }
};

/**
 * Calculate password strength score
 * @param password - Password to evaluate
 * @returns Strength score from 0-5
 */
export const calculatePasswordStrength = (password: string): number => {
  if (!password) {
    return 0;
  }

  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z\d]/.test(password)) strength++;

  return Math.min(strength, 5);
};

/**
 * Get user-friendly label for password strength
 * @param strength - Strength score (0-5)
 * @returns Descriptive label
 */
export const getStrengthLabel = (strength: number): string => {
  if (strength <= 2) return 'Weak password';
  if (strength <= 3) return 'Medium strength';
  return 'Strong password';
};
