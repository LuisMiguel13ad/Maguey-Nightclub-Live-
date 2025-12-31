/**
 * Settings Page
 * Combined settings for Branding, Security, and General configuration
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Settings as SettingsIcon,
  Palette,
  Shield,
  ArrowRight,
  Save,
  RefreshCw,
  Globe,
  Bell,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSecuritySettings,
  updateSecuritySettings,
  type SecuritySettings,
} from "@/lib/security-service";

interface GeneralSettings {
  venueName: string;
  venueAddress: string;
  venueCity: string;
  timezone: string;
  defaultEventCapacity: number;
  requireIdVerification: boolean;
  allowReEntry: boolean;
  scannerTimeout: number;
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();
  const { branding, refreshBranding } = useBranding();

  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  // General settings state
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    venueName: "Maguey Delaware",
    venueAddress: "3320 Old Capitol Trl",
    venueCity: "Wilmington",
    timezone: "America/New_York",
    defaultEventCapacity: 800,
    requireIdVerification: true,
    allowReEntry: true,
    scannerTimeout: 30,
  });

  // Security settings state
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null);

  // Quick branding colors
  const [primaryColor, setPrimaryColor] = useState("#8B5CF6");
  const [accentColor, setAccentColor] = useState("#10B981");

  // Redirect employees
  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Settings are only available to owners.",
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
      // Load security settings
      const security = await getSecuritySettings();
      setSecuritySettings(security);

      // Load branding if available
      if (branding) {
        setPrimaryColor(branding.primary_color || "#8B5CF6");
        setAccentColor(branding.accent_color || "#10B981");
      }

      // Load general settings from localStorage (or could be from a settings table)
      const storedSettings = localStorage.getItem("maguey_general_settings");
      if (storedSettings) {
        setGeneralSettings(JSON.parse(storedSettings));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGeneral = () => {
    localStorage.setItem("maguey_general_settings", JSON.stringify(generalSettings));
    toast({
      title: "Settings Saved",
      description: "General settings have been updated.",
    });
  };

  const handleSaveSecurity = async () => {
    if (!securitySettings) return;

    setSaving(true);
    try {
      await updateSecuritySettings(securitySettings);
      toast({
        title: "Security Settings Saved",
        description: "Security configuration has been updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save security settings",
      });
    } finally {
      setSaving(false);
    }
  };

  if (role !== 'owner') {
    return null;
  }

  return (
    <OwnerPortalLayout
      title="Settings"
      subtitle="SETTINGS"
      description="Configure venue settings, security, and branding"
      actions={
        <Button variant="outline" onClick={loadSettings} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general" className="gap-2">
              <SettingsIcon className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-2">
              <Palette className="h-4 w-4" />
              Branding
            </TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Venue Information
                </CardTitle>
                <CardDescription>
                  Basic venue settings and configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="venueName">Venue Name</Label>
                    <Input
                      id="venueName"
                      value={generalSettings.venueName}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, venueName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venueCity">City</Label>
                    <Input
                      id="venueCity"
                      value={generalSettings.venueCity}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, venueCity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="venueAddress">Address</Label>
                    <Input
                      id="venueAddress"
                      value={generalSettings.venueAddress}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, venueAddress: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={generalSettings.timezone}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, timezone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Default Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      value={generalSettings.defaultEventCapacity}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, defaultEventCapacity: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Scanner Settings
                </CardTitle>
                <CardDescription>
                  Configure ticket scanning behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>ID Verification Required</Label>
                    <p className="text-xs text-muted-foreground">Require ID check for age-restricted events</p>
                  </div>
                  <Switch
                    checked={generalSettings.requireIdVerification}
                    onCheckedChange={(checked) => setGeneralSettings({ ...generalSettings, requireIdVerification: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Re-Entry</Label>
                    <p className="text-xs text-muted-foreground">Let guests re-enter after leaving</p>
                  </div>
                  <Switch
                    checked={generalSettings.allowReEntry}
                    onCheckedChange={(checked) => setGeneralSettings({ ...generalSettings, allowReEntry: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Scanner Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min={5}
                    max={120}
                    value={generalSettings.scannerTimeout}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, scannerTimeout: parseInt(e.target.value) || 30 })}
                  />
                </div>
                <Button onClick={handleSaveGeneral}>
                  <Save className="h-4 w-4 mr-2" />
                  Save General Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Configuration
                </CardTitle>
                <CardDescription>
                  Configure security policies and access controls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {securitySettings ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Two-Factor Authentication</Label>
                        <p className="text-xs text-muted-foreground">Require 2FA for owner accounts</p>
                      </div>
                      <Switch
                        checked={securitySettings.require_2fa}
                        onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, require_2fa: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>IP Whitelist Enabled</Label>
                        <p className="text-xs text-muted-foreground">Only allow access from approved IPs</p>
                      </div>
                      <Switch
                        checked={securitySettings.ip_whitelist_enabled}
                        onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, ip_whitelist_enabled: checked })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sessionTimeout">Session Timeout (hours)</Label>
                      <Input
                        id="sessionTimeout"
                        type="number"
                        min={1}
                        max={168}
                        value={securitySettings.session_timeout_hours}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, session_timeout_hours: parseInt(e.target.value) || 24 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxAttempts">Max Login Attempts</Label>
                      <Input
                        id="maxAttempts"
                        type="number"
                        min={3}
                        max={10}
                        value={securitySettings.max_login_attempts}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, max_login_attempts: parseInt(e.target.value) || 5 })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveSecurity} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save Security Settings"}
                      </Button>
                      <Button variant="outline" onClick={() => navigate("/security")}>
                        Advanced Settings
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Failed to load security settings</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Active Sessions
                </CardTitle>
                <CardDescription>
                  View and manage active user sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div>
                      <p className="text-sm font-medium">Current Session</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-500 border-green-500/50">
                    Active
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Settings Tab */}
          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Quick Branding
                </CardTitle>
                <CardDescription>
                  Customize your venue's visual identity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  <Button variant="outline" onClick={() => navigate("/branding")}>
                    <Palette className="h-4 w-4 mr-2" />
                    Full Branding Editor
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Brand Preview</CardTitle>
                <CardDescription>See how your branding looks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-6 rounded-lg border" style={{ backgroundColor: `${primaryColor}10` }}>
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: primaryColor }}
                    >
                      M
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: primaryColor }}>
                        {generalSettings.venueName}
                      </p>
                      <p className="text-sm text-muted-foreground">{generalSettings.venueCity}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" style={{ backgroundColor: primaryColor }}>
                      Primary Button
                    </Button>
                    <Button size="sm" variant="outline" style={{ borderColor: accentColor, color: accentColor }}>
                      Secondary
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </OwnerPortalLayout>
  );
};

export default Settings;
