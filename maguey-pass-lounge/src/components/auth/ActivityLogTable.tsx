import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface LoginActivity {
  id: string;
  login_at: string;
  method: string;
  success: boolean;
  ip_address: string;
  user_agent: string;
  location: string;
  failure_reason: string | null;
}

export function ActivityLogTable() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<LoginActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchActivities();
    }
  }, [user]);

  const fetchActivities = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('login_activity')
        .select('*')
        .eq('user_id', user.id)
        .order('login_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching activities:', error);
      } else {
        setActivities(data || []);
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      email: 'Email',
      magic_link: 'Magic Link',
      google: 'Google',
      facebook: 'Facebook',
      apple: 'Apple',
      github: 'GitHub',
      biometric: 'Biometric',
    };
    return labels[method] || method;
  };

  const getDeviceInfo = (userAgent: string) => {
    if (!userAgent) return 'Unknown';
    
    if (userAgent.includes('Mobile')) {
      if (userAgent.includes('iPhone')) return 'iPhone';
      if (userAgent.includes('Android')) return 'Android';
      return 'Mobile';
    }
    
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Linux')) return 'Linux';
    
    return 'Desktop';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No login activity found.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date & Time</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Device</TableHead>
            <TableHead>IP Address</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map((activity) => (
            <TableRow key={activity.id}>
              <TableCell>
                {format(new Date(activity.login_at), 'MMM d, yyyy h:mm a')}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{getMethodLabel(activity.method)}</Badge>
              </TableCell>
              <TableCell>{getDeviceInfo(activity.user_agent)}</TableCell>
              <TableCell className="font-mono text-xs">{activity.ip_address}</TableCell>
              <TableCell>
                {activity.success ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Success
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Failed
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

