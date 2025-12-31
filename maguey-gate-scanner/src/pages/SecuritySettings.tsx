import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useRole } from "@/contexts/AuthContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save, Plus, Trash2 } from "lucide-react";
import {
  getSecuritySettings,
  updateSecuritySettings,
  type SecuritySettings,
} from "@/lib/security-service";

const SecuritySettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();

  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newIP, setNewIP] = useState("");

  // Redirect employees
  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Security settings are only available to owners.",
      });
      navigate("/scanner");
    }
  }, [role, navigate, toast]);

  useEffect(() => {
    if (role === 'owner') {
      loadSettings();
    }
  }, [role]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const securitySettings = await getSecuritySettings();
      setSettings(securitySettings);
    } catch (error: any) {
      console.error("Error loading security settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load security settings",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      await updateSecuritySettings(settings);
      toast({
        title: "Settings Saved",
        description: "Security settings have been updated successfully.",
      });
    } catch (error: any) {
      console.error("Error saving security settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save security settings",
      });
    } finally {
      setSaving(false);
    }
  };

  const addIP = () => {
    if (!newIP.trim() || !settings) return;
    
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIP.trim())) {
      toast({
        variant: "destructive",
        title: "Invalid IP",
        description: "Please enter a valid IP address (e.g., 192.168.1.1)",
      });
      return;
    }

    if (settings.ip_whitelist.includes(newIP.trim())) {
      toast({
        variant: "destructive",
        title: "Duplicate IP",
        description: "This IP address is already in the whitelist",
      });
      return;
    }

    setSettings({
      ...settings,
      ip_whitelist: [...settings.ip_whitelist, newIP.trim()],
    });
    setNewIP("");
  };

  const removeIP = (ip: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      ip_whitelist: settings.ip_whitelist.filter(i => i !== ip),
    });
  };

  if (role !== 'owner') {
    return null;
  }

  if (isLoading) {
    return (
      <OwnerPortalLayout title="Security Settings">
          <div className="text-center py-12 text-muted-foreground">
            Loading security settings...
        </div>
      </OwnerPortalLayout>
    );
  }

  if (!settings) {
    return (
      <OwnerPortalLayout title="Security Settings">
          <div className="text-center py-12 text-muted-foreground">
            Failed to load security settings
        </div>
      </OwnerPortalLayout>
    );
  }

  const headerActions = (
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
  );

  return (
    <OwnerPortalLayout
      title="Security Settings"
      description="Configure security policies and access controls"
      actions={headerActions}
    >

        {/* IP Whitelisting */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>IP Whitelisting</CardTitle>
            <CardDescription>
              Restrict admin access to specific IP addresses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable IP Whitelist</Label>
                <p className="text-sm text-muted-foreground">
                  Only allow admin access from whitelisted IPs
                </p>
              </div>
              <Switch
                checked={settings.ip_whitelist_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, ip_whitelist_enabled: checked })
                }
              />
            </div>

            {settings.ip_whitelist_enabled && (
              <div className="space-y-2">
                <Label>Whitelisted IP Addresses</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="192.168.1.1"
                    value={newIP}
                    onChange={(e) => setNewIP(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addIP()}
                  />
                  <Button onClick={addIP} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {settings.ip_whitelist.map((ip) => (
                    <div key={ip} className="flex items-center justify-between p-2 border rounded">
                      <span className="font-mono text-sm">{ip}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeIP(ip)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Management */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Session Management</CardTitle>
            <CardDescription>
              Configure session timeout and security
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
              <Input
                id="session-timeout"
                type="number"
                min="5"
                max="1440"
                value={settings.session_timeout_minutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    session_timeout_minutes: parseInt(e.target.value) || 60,
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Password Policy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Password Policy</CardTitle>
            <CardDescription>
              Configure password requirements for user accounts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password-min-length">Minimum Length</Label>
              <Input
                id="password-min-length"
                type="number"
                min="6"
                max="128"
                value={settings.password_min_length}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    password_min_length: parseInt(e.target.value) || 8,
                  })
                }
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Require Uppercase Letters</Label>
                <Switch
                  checked={settings.password_require_uppercase}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, password_require_uppercase: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Require Lowercase Letters</Label>
                <Switch
                  checked={settings.password_require_lowercase}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, password_require_lowercase: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Require Numbers</Label>
                <Switch
                  checked={settings.password_require_numbers}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, password_require_numbers: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Require Special Characters</Label>
                <Switch
                  checked={settings.password_require_special}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, password_require_special: checked })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Login Security */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Login Security</CardTitle>
            <CardDescription>
              Configure login attempt limits and lockout policies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max-attempts">Max Login Attempts</Label>
              <Input
                id="max-attempts"
                type="number"
                min="3"
                max="10"
                value={settings.max_login_attempts}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_login_attempts: parseInt(e.target.value) || 5,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lockout-duration">Lockout Duration (minutes)</Label>
              <Input
                id="lockout-duration"
                type="number"
                min="5"
                max="1440"
                value={settings.lockout_duration_minutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    lockout_duration_minutes: parseInt(e.target.value) || 15,
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <CardTitle>Two-Factor Authentication</CardTitle>
            <CardDescription>
              Enable 2FA for enhanced security (coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable 2FA</Label>
                <p className="text-sm text-muted-foreground">
                  Require two-factor authentication for admin accounts
                </p>
              </div>
              <Switch
                checked={settings.two_factor_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, two_factor_enabled: checked })
                }
                disabled
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Note: 2FA implementation is planned for a future update
            </p>
          </CardContent>
        </Card>
    </OwnerPortalLayout>
  );
};

export default SecuritySettings;


