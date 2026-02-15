/**
 * Tier Management Component
 * Allows admins to create and edit custom ticket tiers
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAllTiers, clearTierCache, type TicketTier } from "@/lib/tier-service";
import { Trash2, Plus, Edit2, Save, X } from "lucide-react";

export const TierManagement = () => {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#6b7280",
    sound_profile: "general",
    perks_description: "",
    priority_level: 0,
  });

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    setIsLoading(true);
    try {
      const allTiers = await getAllTiers();
      setTiers(allTiers);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading tiers",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (tier: TicketTier) => {
    setEditingId(tier.id);
    setFormData({
      name: tier.name,
      color: tier.color,
      sound_profile: tier.sound_profile,
      perks_description: tier.perks_description || "",
      priority_level: tier.priority_level,
    });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormData({
      name: "",
      color: "#6b7280",
      sound_profile: "general",
      perks_description: "",
      priority_level: 0,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData({
      name: "",
      color: "#6b7280",
      sound_profile: "general",
      perks_description: "",
      priority_level: 0,
    });
  };

  const handleSave = async () => {
    if (!isSupabaseConfigured()) {
      toast({
        variant: "destructive",
        title: "Not Available",
        description: "Tier management requires Supabase connection.",
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Tier name is required.",
      });
      return;
    }

    try {
      if (isCreating) {
        // Create new tier
        const { error } = await supabase.from("ticket_tiers").insert({
          name: formData.name.toLowerCase(),
          color: formData.color,
          sound_profile: formData.sound_profile,
          perks_description: formData.perks_description || null,
          priority_level: formData.priority_level,
          is_active: true,
        });

        if (error) throw error;

        toast({
          title: "Tier Created",
          description: `Tier "${formData.name}" has been created successfully.`,
        });
      } else if (editingId) {
        // Update existing tier
        const { error } = await supabase
          .from("ticket_tiers")
          .update({
            name: formData.name.toLowerCase(),
            color: formData.color,
            sound_profile: formData.sound_profile,
            perks_description: formData.perks_description || null,
            priority_level: formData.priority_level,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Tier Updated",
          description: `Tier "${formData.name}" has been updated successfully.`,
        });
      }

      clearTierCache();
      await loadTiers();
      handleCancel();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save tier.",
      });
    }
  };

  const handleDelete = async (tier: TicketTier) => {
    if (!isSupabaseConfigured()) {
      toast({
        variant: "destructive",
        title: "Not Available",
        description: "Tier management requires Supabase connection.",
      });
      return;
    }

    // Don't allow deleting default tiers
    const defaultTiers = ["general", "vip", "premium", "backstage"];
    if (defaultTiers.includes(tier.name.toLowerCase())) {
      toast({
        variant: "destructive",
        title: "Cannot Delete",
        description: "Default tiers cannot be deleted. You can deactivate them instead.",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("ticket_tiers")
        .update({ is_active: false })
        .eq("id", tier.id);

      if (error) throw error;

      clearTierCache();
      await loadTiers();
      toast({
        title: "Tier Deactivated",
        description: `Tier "${tier.name}" has been deactivated.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete tier.",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading tiers...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ticket Tiers</CardTitle>
              <CardDescription>
                Manage ticket tiers with custom colors, sounds, and perks
              </CardDescription>
            </div>
            <Button onClick={handleCreate} disabled={isCreating || editingId !== null}>
              <Plus className="h-4 w-4 mr-2" />
              Create Tier
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="p-4 border rounded-lg flex items-center justify-between"
                style={{ borderColor: `${tier.color}40` }}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: tier.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold capitalize">{tier.name}</h3>
                      <Badge
                        style={{
                          backgroundColor: tier.color,
                          color: "white",
                        }}
                      >
                        Priority: {tier.priority_level}
                      </Badge>
                    </div>
                    {tier.perks_description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {tier.perks_description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Sound: {tier.sound_profile} | Color: {tier.color}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(tier)}
                    disabled={editingId !== null || isCreating}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  {!["general", "vip", "premium", "backstage"].includes(tier.name.toLowerCase()) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(tier)}
                      disabled={editingId !== null || isCreating}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {(isCreating || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle>{isCreating ? "Create New Tier" : "Edit Tier"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Tier Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., platinum"
                />
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-20"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#6b7280"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sound_profile">Sound Profile</Label>
                <Input
                  id="sound_profile"
                  value={formData.sound_profile}
                  onChange={(e) => setFormData({ ...formData, sound_profile: e.target.value })}
                  placeholder="general, vip, premium, backstage, custom"
                />
              </div>
              <div>
                <Label htmlFor="priority_level">Priority Level</Label>
                <Input
                  id="priority_level"
                  type="number"
                  value={formData.priority_level}
                  onChange={(e) =>
                    setFormData({ ...formData, priority_level: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="perks_description">Perks Description</Label>
              <Textarea
                id="perks_description"
                value={formData.perks_description}
                onChange={(e) => setFormData({ ...formData, perks_description: e.target.value })}
                placeholder="e.g., VIP access with priority entry and free drink voucher"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

