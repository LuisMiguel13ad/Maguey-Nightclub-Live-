// @ts-nocheck
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { Activity, CheckCircle2, XCircle, DollarSign, User, Clock, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: 'scan' | 'sale' | 'refund' | 'transfer' | 'override';
  title: string;
  description: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error';
  metadata?: Record<string, any>;
}

export const ActivityFeed = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    // Load recent activities
    loadRecentActivities();

    // Subscribe to real-time updates
    const scanLogsChannel = supabase
      .channel('activity-feed-scans')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scan_logs',
        },
        (payload) => {
          const log = payload.new as any;
          addActivity({
            id: log.id,
            type: 'scan',
            title: log.scan_result === 'valid' ? 'Ticket Scanned' : 'Invalid Scan Attempt',
            description: log.scan_result === 'valid' 
              ? `Ticket validated successfully`
              : `Failed to validate ticket`,
            timestamp: new Date(log.scanned_at),
            status: log.scan_result === 'valid' ? 'success' : 'error',
            metadata: log.metadata,
          });
        }
      )
      .subscribe();

    const ordersChannel = supabase
      .channel('activity-feed-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const order = payload.new as any;
          if (order.status === 'completed' || order.status === 'paid') {
            addActivity({
              id: order.id,
              type: 'sale',
              title: 'New Ticket Sale',
          description: `${order.ticket_count || 0} ticket(s) sold`,
          timestamp: new Date(order.created_at),
              status: 'success',
              metadata: { amount: order.total ? Number(order.total) / 100 : 0, event: 'Event' },
            });
          }
        }
      )
      .subscribe();

    return () => {
      scanLogsChannel.unsubscribe();
      ordersChannel.unsubscribe();
    };
  }, []);

  const loadRecentActivities = async () => {
    if (!isSupabaseConfigured()) return;

    try {
      // Get recent scans
      const { data: scans } = await supabase
        .from('scan_logs')
        .select('*')
        .order('scanned_at', { ascending: false })
        .limit(10);

      // Get recent orders
      const { data: orders } = await supabase
        .from<any>('orders')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10);

      const items: ActivityItem[] = [];

      scans?.forEach((scan: any) => {
        items.push({
          id: scan.id,
          type: 'scan',
          title: scan.scan_result === 'valid' ? 'Ticket Scanned' : 'Invalid Scan',
          description: scan.scan_result === 'valid' 
            ? 'Ticket validated successfully'
            : 'Failed to validate ticket',
          timestamp: new Date(scan.scanned_at),
          status: scan.scan_result === 'valid' ? 'success' : 'error',
          metadata: scan.metadata,
        });
      });

      orders?.forEach((order: any) => {
        items.push({
          id: order.id,
          type: 'sale',
          title: 'Ticket Sale',
          description: `${order.ticket_count || 0} ticket(s) sold`,
          timestamp: new Date(order.created_at),
          status: 'success',
          metadata: { amount: order.total ? Number(order.total) / 100 : 0, event: (order.events as any)?.name || 'Unknown Event' },
        });
      });

      // Sort by timestamp and take most recent 20
      items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setActivities(items.slice(0, 20));
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addActivity = (activity: ActivityItem) => {
    setActivities((prev) => {
      const updated = [activity, ...prev];
      return updated.slice(0, 50); // Keep last 50 activities
    });
  };

  const getActivityIcon = (type: ActivityItem['type'], status: ActivityItem['status']) => {
    switch (type) {
      case 'scan':
        return status === 'success' ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        );
      case 'sale':
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case 'refund':
        return <XCircle className="h-4 w-4 text-orange-500" />;
      case 'transfer':
        return <User className="h-4 w-4 text-blue-500" />;
      case 'override':
        return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: ActivityItem['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Live Activity Feed
        </CardTitle>
        <CardDescription>Real-time updates from your events</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading activities...
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent activity
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
              >
                <div className="mt-0.5">
                  {getActivityIcon(activity.type, activity.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    {getStatusBadge(activity.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {activity.description}
                  </p>
                  {activity.metadata?.amount && (
                    <p className="text-xs font-medium text-green-600">
                      ${parseFloat(activity.metadata.amount).toFixed(2)}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

