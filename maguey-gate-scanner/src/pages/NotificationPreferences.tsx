import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, MessageSquare, Smartphone, Globe, Save, TestTube } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type NotificationSeverity = 'low' | 'medium' | 'high' | 'critical';

interface UserPreferences {
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  browser_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  min_severity: NotificationSeverity;
  preferences: {
    slack_webhook?: string;
    discord_webhook?: string;
    webhook_url?: string;
    phone_number?: string;
  } | null;
}

const NotificationPreferences = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    email_enabled: true,
    sms_enabled: false,
    push_enabled: true,
    browser_enabled: true,
    quiet_hours_start: null,
    quiet_hours_end: null,
    min_severity: 'medium',
    preferences: {},
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    loadPreferences();
  }, [user, navigate]);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPreferences({
          email_enabled: data.email_enabled ?? true,
          sms_enabled: data.sms_enabled ?? false,
          push_enabled: data.push_enabled ?? true,
          browser_enabled: data.browser_enabled ?? true,
          quiet_hours_start: data.quiet_hours_start || null,
          quiet_hours_end: data.quiet_hours_end || null,
          min_severity: (data.min_severity as NotificationSeverity) || 'medium',
          preferences: (data.preferences as any) || {},
        });
      }
    } catch (error: any) {
      console.error('Error loading preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: user.id,
          email_enabled: preferences.email_enabled,
          sms_enabled: preferences.sms_enabled,
          push_enabled: preferences.push_enabled,
          browser_enabled: preferences.browser_enabled,
          quiet_hours_start: preferences.quiet_hours_start || null,
          quiet_hours_end: preferences.quiet_hours_end || null,
          min_severity: preferences.min_severity,
          preferences: preferences.preferences || {},
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Notification preferences saved",
      });
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save notification preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testNotification = async () => {
    if (!('Notification' in window)) {
      toast({
        title: "Not Supported",
        description: "Browser notifications are not supported in this browser",
        variant: "destructive",
      });
      return;
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast({
          title: "Permission Denied",
          description: "Please allow notifications in your browser settings",
          variant: "destructive",
        });
        return;
      }
    }

    if (Notification.permission === 'granted') {
      const notification = new Notification('Test Notification', {
        body: 'This is a test notification from Maguey Gate Scanner',
        icon: '/logo.png',
      });

      setTimeout(() => notification.close(), 3000);

      toast({
        title: "Test Sent",
        description: "Check your notifications",
      });
    }
  };

  if (loading) {
    return (
      <OwnerPortalLayout title="Notification Preferences">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading preferences...</div>
        </div>
      </OwnerPortalLayout>
    );
  }

  return (
    <OwnerPortalLayout
      title="Notification Preferences"
      description="Configure how and when you receive notifications"
    >

        <div className="space-y-6">
          {/* Channel Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Channels</CardTitle>
              <CardDescription>
                Choose which channels you want to receive notifications on
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="email-enabled">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                </div>
                <Switch
                  id="email-enabled"
                  checked={preferences.email_enabled}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, email_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="sms-enabled">SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via text message
                    </p>
                  </div>
                </div>
                <Switch
                  id="sms-enabled"
                  checked={preferences.sms_enabled}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, sms_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="push-enabled">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive push notifications on mobile devices
                    </p>
                  </div>
                </div>
                <Switch
                  id="push-enabled"
                  checked={preferences.push_enabled}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, push_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="browser-enabled">Browser Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications in your browser
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="browser-enabled"
                    checked={preferences.browser_enabled}
                    onCheckedChange={(checked) =>
                      setPreferences({ ...preferences, browser_enabled: checked })
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testNotification}
                  >
                    <TestTube className="h-4 w-4 mr-1" />
                    Test
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Severity Threshold */}
          <Card>
            <CardHeader>
              <CardTitle>Severity Threshold</CardTitle>
              <CardDescription>
                Only receive notifications at or above this severity level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={preferences.min_severity}
                onValueChange={(value: NotificationSeverity) =>
                  setPreferences({ ...preferences, min_severity: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - All notifications</SelectItem>
                  <SelectItem value="medium">Medium - Medium, High, Critical</SelectItem>
                  <SelectItem value="high">High - High and Critical only</SelectItem>
                  <SelectItem value="critical">Critical - Critical only</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Quiet Hours */}
          <Card>
            <CardHeader>
              <CardTitle>Quiet Hours</CardTitle>
              <CardDescription>
                During these hours, only critical notifications will be sent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quiet-start">Start Time</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={preferences.quiet_hours_start || ''}
                    onChange={(e) =>
                      setPreferences({ ...preferences, quiet_hours_start: e.target.value || null })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiet-end">End Time</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={preferences.quiet_hours_end || ''}
                    onChange={(e) =>
                      setPreferences({ ...preferences, quiet_hours_end: e.target.value || null })
                    }
                  />
                </div>
              </div>
              {preferences.quiet_hours_start && preferences.quiet_hours_end && (
                <Alert>
                  <AlertDescription>
                    Quiet hours enabled: {preferences.quiet_hours_start} - {preferences.quiet_hours_end}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Integration Webhooks */}
          <Card>
            <CardHeader>
              <CardTitle>Integration Webhooks</CardTitle>
              <CardDescription>
                Configure webhooks for Slack, Discord, or custom integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
                <Input
                  id="slack-webhook"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={preferences.preferences?.slack_webhook || ''}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      preferences: {
                        ...preferences.preferences,
                        slack_webhook: e.target.value || undefined,
                      },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discord-webhook">Discord Webhook URL</Label>
                <Input
                  id="discord-webhook"
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={preferences.preferences?.discord_webhook || ''}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      preferences: {
                        ...preferences.preferences,
                        discord_webhook: e.target.value || undefined,
                      },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-webhook">Custom Webhook URL</Label>
                <Input
                  id="custom-webhook"
                  type="url"
                  placeholder="https://your-api.com/webhook"
                  value={preferences.preferences?.webhook_url || ''}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      preferences: {
                        ...preferences.preferences,
                        webhook_url: e.target.value || undefined,
                      },
                    })
                  }
                />
              </div>

              {preferences.sms_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="phone-number">Phone Number (for SMS)</Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    placeholder="+1234567890"
                    value={preferences.preferences?.phone_number || ''}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        preferences: {
                          ...preferences.preferences,
                          phone_number: e.target.value || undefined,
                        },
                      })
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button onClick={savePreferences} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
    </OwnerPortalLayout>
  );
};

export default NotificationPreferences;

