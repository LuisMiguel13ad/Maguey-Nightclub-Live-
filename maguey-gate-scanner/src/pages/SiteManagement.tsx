import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth, useRole } from "@/contexts/AuthContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Globe,
  ShoppingCart,
  Scan,
  ExternalLink,
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit,
  Save,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Site {
  id: string;
  site_type: string;
  name: string;
  url: string;
  environment: string;
  is_active: boolean;
  description: string | null;
  metadata: any;
}

const SiteManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [siteEnvironment, setSiteEnvironment] = useState("production");
  const [isActive, setIsActive] = useState(true);

  // Redirect employees
  useEffect(() => {
    if (role !== "owner") {
      navigate("/scanner");
    }
  }, [role, navigate]);

  useEffect(() => {
    if (role === "owner") {
      loadSites();
    }
  }, [role]);

  const loadSites = async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .order("site_type", { ascending: true });

      if (error) throw error;
      setSites(data || []);
    } catch (error: any) {
      console.error("Error loading sites:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSite = (site: Site) => {
    setEditingSite(site);
    setSiteUrl(site.url);
    setSiteName(site.name);
    setSiteDescription(site.description || "");
    setSiteEnvironment(site.environment);
    setIsActive(site.is_active);
    setEditDialogOpen(true);
  };

  const handleSaveSite = async () => {
    if (!editingSite) return;

    try {
      const { error } = await supabase
        .from("sites")
        .update({
          url: siteUrl,
          name: siteName,
          description: siteDescription,
          environment: siteEnvironment,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingSite.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Site updated successfully",
      });

      setEditDialogOpen(false);
      loadSites();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const getSiteIcon = (siteType: string) => {
    switch (siteType) {
      case "main":
        return Globe;
      case "purchase":
        return ShoppingCart;
      case "scanner":
        return Scan;
      default:
        return Globe;
    }
  };

  const getSiteColor = (siteType: string) => {
    switch (siteType) {
      case "main":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200";
      case "purchase":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200";
      case "scanner":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200";
    }
  };

  const checkSiteStatus = async (site: Site) => {
    try {
      // Simple fetch to check if site is reachable
      const response = await fetch(site.url, { method: "HEAD", mode: "no-cors" });
      return true; // If no error, assume site is up
    } catch (error) {
      return false;
    }
  };

  if (isLoading) {
    return (
      <OwnerPortalLayout title="Site Management">
        <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading sites...</p>
        </div>
      </div>
      </OwnerPortalLayout>
    );
  }

  if (role !== "owner") {
    return null;
  }

  return (
    <OwnerPortalLayout
      title="Site Management"
      description="Manage and monitor all three websites from one central location"
    >

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {sites.map((site) => {
            const Icon = getSiteIcon(site.site_type);
            const colorClass = getSiteColor(site.site_type);

            return (
              <Card key={site.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{site.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {site.description || `${site.site_type} site`}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditSite(site)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={site.is_active ? "default" : "secondary"}>
                      {site.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Environment</span>
                    <Badge variant="outline">{site.environment}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">URL</span>
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      Visit <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/sites/${site.site_type}`)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Settings
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>


        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common operations across all sites
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => navigate("/content")}
                className="justify-start"
              >
                <Edit className="h-4 w-4 mr-2" />
                Manage Content
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/branding")}
                className="justify-start"
              >
                <Settings className="h-4 w-4 mr-2" />
                Sync Branding
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/integrations")}
                className="justify-start"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Integration Status
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/settings")}
                className="justify-start"
              >
                <Settings className="h-4 w-4 mr-2" />
                Environment Config
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Edit Site Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Site Configuration</DialogTitle>
              <DialogDescription>
                Update site URL, name, and settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="site-name">Site Name</Label>
                <Input
                  id="site-name"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-url">Site URL</Label>
                <Input
                  id="site-url"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-description">Description</Label>
                <Input
                  id="site-description"
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-environment">Environment</Label>
                <select
                  id="site-environment"
                  value={siteEnvironment}
                  onChange={(e) => setSiteEnvironment(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="site-active">Active</Label>
                <Switch
                  id="site-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSite}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </OwnerPortalLayout>
  );
};

export default SiteManagement;

