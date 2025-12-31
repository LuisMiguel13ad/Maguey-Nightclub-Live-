import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useRole } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import OwnerPortalLayout from '@/components/layout/OwnerPortalLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  getCurrentVenue,
  getCurrentVenueBranding,
  upsertVenueBranding,
  exportBrandingConfig,
  importBrandingConfig,
  getPublicTemplates,
  createBrandingTemplate,
  type BrandingConfig,
  type BrandingTemplate,
} from '@/lib/branding-service';
import {
  uploadAsset,
  getVenueAssets,
  deleteAsset,
  type AssetType,
} from '@/lib/asset-service';
import { ColorPicker } from '@/components/ColorPicker';
import { FontSelector } from '@/components/FontSelector';
import { AssetUpload } from '@/components/AssetUpload';
import {
  Palette,
  Upload as UploadIcon,
  Download,
  FileText,
  Sparkles,
  Save,
  RefreshCw,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const THEME_PRESETS = [
  { value: 'default', label: 'Default', description: 'Professional and clean' },
  { value: 'vibrant', label: 'Vibrant', description: 'Bold and energetic' },
  { value: 'minimal', label: 'Minimal', description: 'Simple and elegant' },
];

const Branding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = useRole();
  const { branding, refreshBranding, applyBranding } = useBranding();
  const { toast } = useToast();
  const isOwner = role === 'owner';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Branding state
  const [config, setConfig] = useState<BrandingConfig>({
    primary_color: '#8B5CF6',
    secondary_color: '#EC4899',
    accent_color: '#10B981',
    font_family: 'Inter',
    theme_preset: 'default',
  });

  const [customCss, setCustomCss] = useState('');
  const [templates, setTemplates] = useState<BrandingTemplate[]>([]);

  useEffect(() => {
    if (!isOwner) {
      navigate('/dashboard');
      return;
    }

    const loadBranding = async () => {
      try {
        setLoading(true);
        const venue = await getCurrentVenue();
        if (venue) {
          setVenueId(venue.id);
        }

        const currentBranding = await getCurrentVenueBranding();
        if (currentBranding) {
          setConfig({
            primary_color: currentBranding.primary_color,
            secondary_color: currentBranding.secondary_color,
            accent_color: currentBranding.accent_color,
            font_family: currentBranding.font_family,
            theme_preset: currentBranding.theme_preset,
            logo_url: currentBranding.logo_url || undefined,
            logo_square_url: currentBranding.logo_square_url || undefined,
            favicon_url: currentBranding.favicon_url || undefined,
          });
          setCustomCss(currentBranding.custom_css || '');
        }

        // Load templates
        const publicTemplates = await getPublicTemplates();
        setTemplates(publicTemplates);
      } catch (error) {
        console.error('Error loading branding:', error);
        toast({
          title: 'Error',
          description: 'Failed to load branding configuration',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadBranding();
  }, [isOwner, navigate, toast]);

  // Apply branding changes in real-time
  useEffect(() => {
    applyBranding({
      ...config,
      custom_css: customCss || undefined,
    });
  }, [config, customCss, applyBranding]);

  const handleSave = async () => {
    if (!venueId) {
      toast({
        title: 'Error',
        description: 'Venue not found',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await upsertVenueBranding(venueId, {
        ...config,
        custom_css: customCss || undefined,
      });
      await refreshBranding();
      toast({
        title: 'Success',
        description: 'Branding configuration saved',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save branding',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAssetUpload = async (assetType: AssetType, file: File) => {
    if (!venueId) return;

    try {
      const asset = await uploadAsset(venueId, file, assetType);
      if (asset && asset.cdn_url) {
        setConfig((prev) => ({
          ...prev,
          [assetType === 'logo' ? 'logo_url' : assetType === 'logo_square' ? 'logo_square_url' : 'favicon_url']: asset.cdn_url,
        }));
        toast({
          title: 'Success',
          description: 'Asset uploaded successfully',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload asset',
        variant: 'destructive',
      });
    }
  };

  const handleExport = async () => {
    if (!venueId) return;

    try {
      const exported = await exportBrandingConfig(venueId);
      if (exported) {
        const blob = new Blob([exported], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `branding-config-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast({
          title: 'Success',
          description: 'Branding configuration exported',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to export configuration',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async (file: File) => {
    if (!venueId) return;

    try {
      const text = await file.text();
      const imported = await importBrandingConfig(venueId, text);
      if (imported) {
        setConfig({
          primary_color: imported.primary_color,
          secondary_color: imported.secondary_color,
          accent_color: imported.accent_color,
          font_family: imported.font_family,
          theme_preset: imported.theme_preset,
          logo_url: imported.logo_url || undefined,
          logo_square_url: imported.logo_square_url || undefined,
          favicon_url: imported.favicon_url || undefined,
        });
        setCustomCss(imported.custom_css || '');
        await refreshBranding();
        toast({
          title: 'Success',
          description: 'Branding configuration imported',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import configuration',
        variant: 'destructive',
      });
    }
  };

  const handleApplyTemplate = async (template: BrandingTemplate) => {
    if (!venueId) return;

    try {
      const templateConfig = template.configuration as BrandingConfig;
      setConfig((prev) => ({
        ...prev,
        ...templateConfig,
      }));
      if (templateConfig.custom_css) {
        setCustomCss(templateConfig.custom_css);
      }
      toast({
        title: 'Success',
        description: 'Template applied',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to apply template',
        variant: 'destructive',
      });
    }
  };

  if (!isOwner) {
    return null;
  }

  if (loading) {
    return (
      <OwnerPortalLayout title="Branding & Theming">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </OwnerPortalLayout>
    );
  }

  return (
    <OwnerPortalLayout
      title="Branding & Theming"
      description="Customize your venue's appearance, colors, fonts, and assets"
    >

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="colors" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="colors">
                  <Palette className="h-4 w-4 mr-2" />
                  Colors
                </TabsTrigger>
                <TabsTrigger value="assets">
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Assets
                </TabsTrigger>
                <TabsTrigger value="typography">
                  <FileText className="h-4 w-4 mr-2" />
                  Typography
                </TabsTrigger>
                <TabsTrigger value="advanced">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Advanced
                </TabsTrigger>
              </TabsList>

              <TabsContent value="colors" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Color Scheme</CardTitle>
                    <CardDescription>Customize your brand colors</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ColorPicker
                      label="Primary Color"
                      value={config.primary_color}
                      onChange={(color) => setConfig({ ...config, primary_color: color })}
                      description="Main brand color used for primary actions and accents"
                    />
                    <ColorPicker
                      label="Secondary Color"
                      value={config.secondary_color}
                      onChange={(color) => setConfig({ ...config, secondary_color: color })}
                      description="Secondary brand color for complementary elements"
                    />
                    <ColorPicker
                      label="Accent Color"
                      value={config.accent_color}
                      onChange={(color) => setConfig({ ...config, accent_color: color })}
                      description="Accent color for highlights and success states"
                    />
                    <div className="space-y-2">
                      <Label>Theme Preset</Label>
                      <Select
                        value={config.theme_preset}
                        onValueChange={(value) => setConfig({ ...config, theme_preset: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {THEME_PRESETS.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>
                              <div>
                                <div className="font-medium">{preset.label}</div>
                                <div className="text-xs text-muted-foreground">{preset.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="assets" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Brand Assets</CardTitle>
                    <CardDescription>Upload logos, favicons, and other brand assets</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <AssetUpload
                      assetType="logo"
                      label="Logo"
                      description="Main logo (recommended: PNG or SVG, max 500px height)"
                      currentUrl={config.logo_url}
                      onUpload={(file) => handleAssetUpload('logo', file)}
                    />
                    <AssetUpload
                      assetType="logo_square"
                      label="Square Logo"
                      description="Square logo variant (recommended: 512x512px)"
                      currentUrl={config.logo_square_url}
                      onUpload={(file) => handleAssetUpload('logo_square', file)}
                    />
                    <AssetUpload
                      assetType="favicon"
                      label="Favicon"
                      description="Site favicon (recommended: 32x32px or 64x64px)"
                      currentUrl={config.favicon_url}
                      onUpload={(file) => handleAssetUpload('favicon', file)}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="typography" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Typography</CardTitle>
                    <CardDescription>Choose your brand font</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FontSelector
                      label="Font Family"
                      value={config.font_family}
                      onChange={(font) => setConfig({ ...config, font_family: font })}
                      description="Select the primary font for your brand"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Custom CSS</CardTitle>
                    <CardDescription>Add custom CSS for advanced styling</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label>Custom CSS</Label>
                      <Textarea
                        value={customCss}
                        onChange={(e) => setCustomCss(e.target.value)}
                        placeholder="/* Add your custom CSS here */"
                        className="font-mono text-sm min-h-[300px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Custom CSS will be applied globally. Use with caution.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <label>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImport(file);
                  }}
                />
                <Button variant="outline" asChild>
                  <span>
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Import
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {/* Live Preview Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Live Preview</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                      size="icon"
                      onClick={() => setPreviewMode('desktop')}
                    >
                      <Monitor className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={previewMode === 'tablet' ? 'default' : 'ghost'}
                      size="icon"
                      onClick={() => setPreviewMode('tablet')}
                    >
                      <Tablet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                      size="icon"
                      onClick={() => setPreviewMode('mobile')}
                    >
                      <Smartphone className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>See your changes in real-time</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`
                    border rounded-lg overflow-hidden bg-card
                    ${previewMode === 'desktop' ? 'w-full' : ''}
                    ${previewMode === 'tablet' ? 'w-full max-w-md mx-auto' : ''}
                    ${previewMode === 'mobile' ? 'w-full max-w-xs mx-auto' : ''}
                  `}
                >
                  <div className="p-4 border-b bg-muted/50">
                    <div className="flex items-center gap-2">
                      {config.logo_url ? (
                        <img src={config.logo_url} alt="Logo" className="h-6" />
                      ) : (
                        <div className="h-6 w-20 bg-muted rounded" />
                      )}
                      <span className="text-sm font-medium">Brand Preview</span>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Sample Heading</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        This is a preview of how your branding will look throughout the application.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm">Primary Button</Button>
                      <Button variant="secondary" size="sm">Secondary</Button>
                      <Button variant="outline" size="sm">Outline</Button>
                    </div>
                    <div className="p-4 rounded-md bg-muted/50">
                      <p className="text-sm">
                        <span className="font-semibold">Colors:</span> Your brand colors are applied
                        to buttons, links, and accents throughout the interface.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Templates */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Templates</CardTitle>
                <CardDescription>Apply pre-made branding templates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No templates available
                    </p>
                  ) : (
                    templates.map((template) => (
                      <Button
                        key={template.id}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleApplyTemplate(template)}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {template.name}
                      </Button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
    </OwnerPortalLayout>
  );
};

export default Branding;

