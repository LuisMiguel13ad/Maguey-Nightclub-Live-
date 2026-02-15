import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, X, AlertCircle, Info, AlertTriangle, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getUserNotifications, acknowledgeNotification } from "@/lib/notification-service";
import { useToast } from "@/hooks/use-toast";

type NotificationSeverity = 'low' | 'medium' | 'high' | 'critical';

interface Notification {
  id: string;
  rule_id: string | null;
  trigger_event_id: string | null;
  severity: NotificationSeverity;
  title: string;
  message: string;
  channels_used: string[];
  recipients: string[];
  metadata: Record<string, any> | null;
  status: string;
  sent_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
}

const severityIcons = {
  low: Info,
  medium: AlertCircle,
  high: AlertTriangle,
  critical: Zap,
};

const severityColors = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export const NotificationFeed = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    loadNotifications();

    // Set up real-time subscription
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipients=cs.{${user.id}}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      const data = await getUserNotifications(user.id, 50);
      setNotifications(data as any);
      setUnreadCount(data.filter(n => n.status !== 'acknowledged').length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (notificationId: string) => {
    if (!user) return;

    try {
      await acknowledgeNotification(notificationId, user.id);
      await loadNotifications();
      toast({
        title: "Notification acknowledged",
      });
    } catch (error) {
      console.error('Error acknowledging notification:', error);
      toast({
        title: "Error",
        description: "Failed to acknowledge notification",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Loading notifications...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
        </div>
        <CardDescription>
          Recent notifications and alerts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No notifications yet
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const Icon = severityIcons[notification.severity] || Bell;
                const isAcknowledged = notification.status === 'acknowledged';

                return (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border ${
                      isAcknowledged
                        ? 'bg-muted/50 opacity-75'
                        : 'bg-background'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-full ${severityColors[notification.severity]} text-white`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-sm">
                                {notification.title}
                              </h4>
                              <Badge variant="outline" className="text-xs">
                                {notification.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>
                                {formatDistanceToNow(new Date(notification.created_at), {
                                  addSuffix: true,
                                })}
                              </span>
                              <span>
                                {notification.channels_used.join(', ')}
                              </span>
                            </div>
                          </div>
                          {!isAcknowledged && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAcknowledge(notification.id)}
                              className="shrink-0"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

