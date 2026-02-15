import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/supabase-config';
import { getUserRole, type UserRole } from '@/lib/auth';
import { localStorageService } from '@/lib/localStorage';

interface AuthContextType {
  user: any;
  role: UserRole;
  loading: boolean;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useRole = () => {
  const { role } = useAuth();
  return role;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole>('employee');
  const [loading, setLoading] = useState(true);

  const refreshRole = async () => {
    if (!isSupabaseConfigured()) {
      // Development mode - use local storage
      if (import.meta.env.DEV) {
        const localUser = localStorageService.getUser();
        if (localUser) {
          const userRole = localUser.role === 'owner' ? 'owner' : 'employee';
          setUser(localUser);
          setRole(userRole);
        } else {
          setUser(null);
          setRole('employee');
        }
      } else {
        // Production: if Supabase not configured, user is not authenticated
        setUser(null);
        setRole('employee');
      }
      setLoading(false);
      return;
    }

    // Supabase mode - check session first
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      const userRole = getUserRole(session.user);
      setRole(userRole);
    } else {
      // Fallback to localStorage only in development mode
      if (import.meta.env.DEV) {
        const localUser = localStorageService.getUser();
        if (localUser) {
          const userRole = localUser.role === 'owner' ? 'owner' : 'employee';
          setUser(localUser);
          setRole(userRole);
        } else {
          setUser(null);
          setRole('employee');
        }
      } else {
        // Production: no session = not authenticated
        setUser(null);
        setRole('employee');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        await refreshRole();
        // Double-check localStorage if Supabase is configured but no session (DEV mode only)
        if (import.meta.env.DEV && isSupabaseConfigured() && mounted) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            const localUser = localStorageService.getUser();
            if (localUser) {
              const userRole = localUser.role === 'owner' ? 'owner' : 'employee';
              if (mounted) {
                setUser(localUser);
                setRole(userRole);
              }
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    if (isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;

        try {
          if (session?.user) {
            setUser(session.user);
            const userRole = getUserRole(session.user);
            setRole(userRole);
          } else {
            // Fallback to localStorage only in development mode
            if (import.meta.env.DEV) {
              const localUser = localStorageService.getUser();
              if (localUser) {
                const userRole = localUser.role === 'owner' ? 'owner' : 'employee';
                setUser(localUser);
                setRole(userRole);
              } else {
                setUser(null);
                setRole('employee');
              }
            } else {
              // Production: no session = not authenticated
              setUser(null);
              setRole('employee');
            }
          }
        } catch (error) {
          console.error('Auth state change error:', error);
        } finally {
          setLoading(false);
        }
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    } else {
      // Development mode - already handled in refreshRole
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
};

