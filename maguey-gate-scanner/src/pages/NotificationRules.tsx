import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRole } from "@/contexts/AuthContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, Plus, Trash2, Edit, Save, X, TestTube } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

type TriggerType = 
  | 'entry_rate_drop'
  | 'capacity_threshold'
  | 'battery_low'
  | 'device_offline'
  | 'wait_time_unusual'
  | 'fraud_alert'
  | 'revenue_milestone'
  | 'vip_ticket'
  | 'emergency';

type NotificationSeverity = 'low' | 'medium' | 'high' | 'critical';
type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook' | 'slack' | 'discord' | 'browser';

interface NotificationRule {
  id?: string;
  name: string;
  trigger_type: TriggerType;
  conditions: Record<string, any>;
  channels: NotificationChannel[];
  recipients: string[];
  severity: NotificationSeverity;
  is_active: boolean;
  throttle_minutes: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  template_title: string | null;
  template_message: string | null;
}

const NotificationRules = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; email: string }>>([]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if user is admin or manager
    if (role !== 'admin' && role !== 'manager') {
      toast({
        title: "Access Denied",
        description: "You don't have permission to manage notification rules",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    loadRules();
    loadUsers();
  }, [user, navigate, role, toast]);

  const loadRules = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRules(data || []);
    } catch (error: any) {
      console.error('Error loading rules:', error);
      toast({
        title: "Error",
        description: "Failed to load notification rules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.auth.admin?.listUsers();
      if (error) {
        // Fallback: try to get users from a public view if admin API not available
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, email')
          .limit(100);
        
        if (profileData) {
          setAvailableUsers(profileData.map(u => ({ id: u.id, email: u.email || 'Unknown' })));
        }
        return;
      }

      if (data?.users) {
        setAvailableUsers(
          data.users.map(u => ({
            id: u.id,
            email: u.email || 'Unknown',
          }))
        );
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const saveRule = async (rule: NotificationRule) => {
    try {
      if (rule.id) {
        // Update existing rule
        const { error } = await supabase
          .from('notification_rules')
          .update({
            ...rule,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rule.id);

        if (error) throw error;
      } else {
        // Create new rule
        const { error } = await supabase
          .from('notification_rules')
          .insert({
            ...rule,
            created_by: user?.id,
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Notification rule ${rule.id ? 'updated' : 'created'}`,
      });

      setIsDialogOpen(false);
      setEditingRule(null);
      loadRules();
    } catch (error: any) {
      console.error('Error saving rule:', error);
      toast({
        title: "Error",
        description: `Failed to ${rule.id ? 'update' : 'create'} notification rule`,
        variant: "destructive",
      });
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this notification rule?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('notification_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Notification rule deleted",
      });

      loadRules();
    } catch (error: any) {
      console.error('Error deleting rule:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification rule",
        variant: "destructive",
      });
    }
  };

  const toggleRuleActive = async (rule: NotificationRule) => {
    try {
      const { error } = await supabase
        .from('notification_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;

      loadRules();
    } catch (error: any) {
      console.error('Error toggling rule:', error);
      toast({
        title: "Error",
        description: "Failed to update notification rule",
        variant: "destructive",
      });
    }
  };

  const testRule = async (rule: NotificationRule) => {
    // TODO: Implement test notification
    toast({
      title: "Test Notification",
      description: `Test notification sent for rule: ${rule.name}`,
    });
  };

  const createNewRule = () => {
    setEditingRule({
      name: '',
      trigger_type: 'capacity_threshold',
      conditions: {},
      channels: ['email', 'browser'],
      recipients: [],
      severity: 'medium',
      is_active: true,
      throttle_minutes: 0,
      quiet_hours_start: null,
      quiet_hours_end: null,
      template_title: null,
      template_message: null,
    });
    setIsDialogOpen(true);
  };

  const editRule = (rule: NotificationRule) => {
    setEditingRule({ ...rule });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <OwnerPortalLayout title="Notification Rules" subtitle="SETTINGS">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading rules...</div>
        </div>
      </OwnerPortalLayout>
    );
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      {import.meta.env.DEV && (
        <Button onClick={createNewRule}>
          <Plus className="h-4 w-4 mr-2" />
          New Rule
        </Button>
      )}
    </div>
  );

  return (
    <OwnerPortalLayout
      title="Notification Rules"
      subtitle="SETTINGS"
      actions={headerActions}
    >
      <div className="space-y-6">

        <div className="space-y-4">
          {rules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No notification rules configured</p>
                {import.meta.env.DEV && (
                  <Button onClick={createNewRule}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Rule
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            rules.map((rule) => (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle>{rule.name}</CardTitle>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">{rule.trigger_type}</Badge>
                      <Badge variant="outline">{rule.severity}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {import.meta.env.DEV && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testRule(rule)}
                          >
                            <TestTube className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleRuleActive(rule)}
                      />
                      {import.meta.env.DEV && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => editRule(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteRule(rule.id!)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <CardDescription>
                    Channels: {rule.channels.join(', ')} |
                    Recipients: {rule.recipients.length} |
                    Throttle: {rule.throttle_minutes} min
                  </CardDescription>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        {/* Edit/Create Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule?.id ? 'Edit Rule' : 'Create New Rule'}
              </DialogTitle>
              <DialogDescription>
                Configure when and how notifications should be sent
              </DialogDescription>
            </DialogHeader>

            {editingRule && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-name">Rule Name</Label>
                  <Input
                    id="rule-name"
                    value={editingRule.name}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, name: e.target.value })
                    }
                    placeholder="e.g., Capacity Warning at 90%"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trigger-type">Trigger Type</Label>
                  <Select
                    value={editingRule.trigger_type}
                    onValueChange={(value: TriggerType) =>
                      setEditingRule({ ...editingRule, trigger_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry_rate_drop">Entry Rate Drop</SelectItem>
                      <SelectItem value="capacity_threshold">Capacity Threshold</SelectItem>
                      <SelectItem value="battery_low">Battery Low</SelectItem>
                      <SelectItem value="device_offline">Device Offline</SelectItem>
                      <SelectItem value="wait_time_unusual">Unusual Wait Time</SelectItem>
                      <SelectItem value="fraud_alert">Fraud Alert</SelectItem>
                      <SelectItem value="revenue_milestone">Revenue Milestone</SelectItem>
                      <SelectItem value="vip_ticket">VIP Ticket Scanned</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="severity">Severity</Label>
                  <Select
                    value={editingRule.severity}
                    onValueChange={(value: NotificationSeverity) =>
                      setEditingRule({ ...editingRule, severity: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Channels</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['email', 'sms', 'push', 'webhook', 'slack', 'discord', 'browser'] as NotificationChannel[]).map((channel) => (
                      <div key={channel} className="flex items-center space-x-2">
                        <Checkbox
                          id={`channel-${channel}`}
                          checked={editingRule.channels.includes(channel)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditingRule({
                                ...editingRule,
                                channels: [...editingRule.channels, channel],
                              });
                            } else {
                              setEditingRule({
                                ...editingRule,
                                channels: editingRule.channels.filter(c => c !== channel),
                              });
                            }
                          }}
                        />
                        <Label htmlFor={`channel-${channel}`} className="font-normal">
                          {channel.charAt(0).toUpperCase() + channel.slice(1)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Recipients</Label>
                  <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                    {availableUsers.map((u) => (
                      <div key={u.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`user-${u.id}`}
                          checked={editingRule.recipients.includes(u.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditingRule({
                                ...editingRule,
                                recipients: [...editingRule.recipients, u.id],
                              });
                            } else {
                              setEditingRule({
                                ...editingRule,
                                recipients: editingRule.recipients.filter(r => r !== u.id),
                              });
                            }
                          }}
                        />
                        <Label htmlFor={`user-${u.id}`} className="font-normal">
                          {u.email}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="throttle">Throttle (minutes)</Label>
                    <Input
                      id="throttle"
                      type="number"
                      min="0"
                      value={editingRule.throttle_minutes}
                      onChange={(e) =>
                        setEditingRule({
                          ...editingRule,
                          throttle_minutes: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-title">Template Title (optional)</Label>
                    <Input
                      id="template-title"
                      value={editingRule.template_title || ''}
                      onChange={(e) =>
                        setEditingRule({
                          ...editingRule,
                          template_title: e.target.value || null,
                        })
                      }
                      placeholder="e.g., Capacity Alert: {{capacity}}%"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-message">Template Message (optional)</Label>
                  <Textarea
                    id="template-message"
                    value={editingRule.template_message || ''}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        template_message: e.target.value || null,
                      })
                    }
                    placeholder="e.g., Event capacity is at {{capacity}}%"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={() => saveRule(editingRule)}>
                    <Save className="h-4 w-4 mr-2" />
                    {editingRule.id ? 'Update' : 'Create'} Rule
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </OwnerPortalLayout>
  );
};

export default NotificationRules;

