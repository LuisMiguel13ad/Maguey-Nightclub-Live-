/**
 * VIP Setup Manager Component
 * Admin interface for setting up and managing VIP tables
 */

import { useState, useEffect } from 'react';
import { Crown, Plus, Edit, Trash2, Save, X, Loader2, AlertCircle, Zap, Map, List, DollarSign, Users, Wine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { VIPFloorPlanAdmin, type EventVIPTable } from './VIPFloorPlanAdmin';

interface VIPSetupManagerProps {
  eventId?: string;
  eventName?: string;
}

// Tier configuration
const TIER_CONFIG = {
  premium: {
    price: 750,
    capacity: 8,
    package: '1 Bottle + 1 Champagne',
  },
  front_row: {
    price: 700,
    capacity: 6,
    package: '1 Bottle',
  },
  standard: {
    price: 600,
    capacity: 6,
    package: '1 Bottle',
  },
};

export function VIPSetupManager({ eventId, eventName }: VIPSetupManagerProps) {
  const { toast } = useToast();
  const [tables, setTables] = useState<EventVIPTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTable, setEditingTable] = useState<EventVIPTable | null>(null);
  const [selectedFloorPlanTableId, setSelectedFloorPlanTableId] = useState<string | undefined>(undefined);
  
  // VIP enabled state
  const [vipEnabled, setVipEnabled] = useState(false);
  const [isTogglingVip, setIsTogglingVip] = useState(false);
  
  const [formData, setFormData] = useState({
    table_number: '',
    tier: 'standard' as 'premium' | 'front_row' | 'standard',
    price: 0,
    capacity: 6,
    package_description: '',
  });

  useEffect(() => {
    if (eventId) {
      loadEventVipStatus();
      loadTables();
    } else {
      console.warn('VIPSetupManager: No eventId provided');
      setIsLoading(false);
      setTables([]);
    }
  }, [eventId]);

  // Load event VIP enabled status
  const loadEventVipStatus = async () => {
    if (!eventId) return;
    
    try {
      const { data, error } = await supabase
        .from('events')
        .select('vip_enabled')
        .eq('id', eventId)
        .single();
      
      if (error) {
        console.error('Error loading VIP status:', error);
        return;
      }
      
      setVipEnabled(data?.vip_enabled || false);
    } catch (err) {
      console.error('Error loading VIP status:', err);
    }
  };

  // Toggle VIP enabled for event - auto-creates tables when enabling
  const handleToggleVip = async (enabled: boolean) => {
    if (!eventId) return;

    setIsTogglingVip(true);

    try {
      // If enabling VIP and no tables exist, auto-create all tables
      if (enabled && tables.length === 0) {
        // Get all table templates
        const { data: templates, error: templatesError } = await supabase
          .from('vip_table_templates')
          .select('id, table_number, default_tier')
          .order('table_number', { ascending: true });

        if (templatesError || !templates) {
          throw new Error('Failed to load table templates');
        }

        // Define tier mapping based on table position
        const getTierForTable = (tableNumber: number): 'premium' | 'front_row' | 'standard' => {
          if ([1, 2, 3, 8].includes(tableNumber)) return 'premium';
          if ([4, 5, 6, 7].includes(tableNumber)) return 'front_row';
          return 'standard'; // Tables 9-26
        };

        // Create table data for all 26 tables
        const tablesToInsert = templates.map(template => {
          const tier = getTierForTable(template.table_number);
          const config = TIER_CONFIG[tier];

          return {
            event_id: eventId,
            table_template_id: template.id,
            table_number: template.table_number,
            tier: tier,
            capacity: config.capacity,
            price_cents: config.price * 100,
            package_description: config.package,
            bottles_included: tier === 'premium' ? 1 : 1,
            champagne_included: tier === 'premium' ? 1 : 0,
            is_available: true,
            is_active: true, // Required for ticket purchase site compatibility
            display_order: template.table_number,
          };
        });

        const { error: insertError } = await supabase
          .from('event_vip_tables')
          .insert(tablesToInsert);

        if (insertError) throw insertError;

        // Reload tables after creation
        await loadTables();
      }

      const { error } = await supabase
        .from('events')
        .update({
          vip_enabled: enabled,
          vip_configured_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId);

      if (error) throw error;

      setVipEnabled(enabled);
      toast({
        title: enabled ? 'VIP Section Enabled' : 'VIP Section Disabled',
        description: enabled
          ? 'VIP table reservations are now available for this event. Edit table pricing below.'
          : 'VIP section is now hidden from the live website.',
      });
    } catch (err) {
      console.error('Error toggling VIP:', err);
      toast({
        title: 'Error',
        description: 'Failed to update VIP settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsTogglingVip(false);
    }
  };

  const loadTables = async () => {
    if (!eventId) {
      console.error('No eventId provided to loadTables');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Check Supabase configuration
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase is not configured. Please check your environment variables.');
      }

      const { data, error } = await supabase
        .from('event_vip_tables')
        .select('*')
        .eq('event_id', eventId)
        .order('table_number', { ascending: true });

      if (error) {
        console.error('Error fetching VIP tables:', error);
        throw error;
      }

      setTables(data || []);
    } catch (error) {
      console.error('Error loading tables:', error);
      const errorMessage = error instanceof Error
        ? `${error.message}${error.cause ? ` (${error.cause})` : ''}`
        : 'Unknown error';
      
      toast({
        title: 'Error Loading VIP Tables',
        description: `Failed to load VIP tables: ${errorMessage}. Check browser console for details.`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTable(null);
    setFormData({
      table_number: '',
      tier: 'standard',
      price: 600,
      capacity: 6,
      package_description: '1 Bottle',
    });
    setShowCreateDialog(true);
  };

  const handleEdit = (table: EventVipTable) => {
    setEditingTable(table);
    setFormData({
      table_number: table.table_number.toString(),
      tier: table.tier,
      price: table.price_cents / 100, // Convert cents to dollars
      capacity: table.capacity,
      package_description: table.package_description || '',
    });
    setShowCreateDialog(true);
  };

  const handleTierChange = (tier: 'premium' | 'front_row' | 'standard') => {
    const config = TIER_CONFIG[tier];
    setFormData({
      ...formData,
      tier,
      price: config.price,
      capacity: config.capacity,
      package_description: config.package,
    });
  };

  const handleSave = async () => {
    if (!eventId) {
      toast({
        title: 'Error',
        description: 'Event ID is required',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.table_number) {
      toast({
        title: 'Error',
        description: 'Table number is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      // Get table template ID for the table number
      const { data: templateData, error: templateError } = await supabase
        .from('vip_table_templates')
        .select('id')
        .eq('table_number', parseInt(formData.table_number))
        .maybeSingle();

      if (templateError) {
        throw new Error(`Error fetching table template: ${templateError.message}`);
      }
      if (!templateData) {
        throw new Error(`Table template not found for table number ${formData.table_number}`);
      }

      const tableData = {
        event_id: eventId,
        table_template_id: templateData.id,
        table_number: parseInt(formData.table_number),
        tier: formData.tier,
        capacity: formData.capacity,
        price_cents: Math.round(formData.price * 100), // Convert dollars to cents
        package_description: formData.package_description,
        bottles_included: formData.tier === 'premium' ? 1 : 1,
        champagne_included: formData.tier === 'premium' ? 1 : 0,
        is_available: true,
        is_active: true, // Required for ticket purchase site compatibility
        display_order: parseInt(formData.table_number),
      };

      if (editingTable) {
        // Update existing table
        const { error } = await supabase
          .from('event_vip_tables')
          .update(tableData)
          .eq('id', editingTable.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'VIP table updated successfully',
        });
      } else {
        // Create new table
        const { error } = await supabase
          .from('event_vip_tables')
          .insert(tableData);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'VIP table created successfully',
        });
      }

      setShowCreateDialog(false);
      await loadTables();
    } catch (error) {
      console.error('Error saving table:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save VIP table',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle selecting a table from the floor plan
  const handleFloorPlanTableSelect = (table: EventVIPTable) => {
    setSelectedFloorPlanTableId(table.id);
  };

  // Update a table directly from floor plan quick edit
  const handleQuickUpdate = async (tableId: string, updates: Partial<EventVIPTable>) => {
    try {
      const { error } = await supabase
        .from('event_vip_tables')
        .update(updates)
        .eq('id', tableId);

      if (error) throw error;

      // Update local state
      setTables(prev => prev.map(t => 
        t.id === tableId ? { ...t, ...updates } : t
      ));

      toast({
        title: 'Updated',
        description: 'Table updated successfully',
      });
    } catch (error) {
      console.error('Error updating table:', error);
      toast({
        title: 'Error',
        description: 'Failed to update table',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (tableId: string) => {
    if (!confirm('Are you sure you want to delete this VIP table? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('event_vip_tables')
        .delete()
        .eq('id', tableId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'VIP table deleted successfully',
      });

      await loadTables();
    } catch (error) {
      console.error('Error deleting table:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete VIP table',
        variant: 'destructive',
      });
    }
  };

  const handleQuickAddAll = async () => {
    if (!eventId) {
      toast({
        title: 'Error',
        description: 'Event ID is required',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm('This will create all 26 tables with default pricing. Continue?')) {
      return;
    }

    try {
      setIsQuickAdding(true);

      // Get all table templates
      const { data: templates, error: templatesError } = await supabase
        .from('vip_table_templates')
        .select('id, table_number, default_tier')
        .order('table_number', { ascending: true });

      if (templatesError || !templates) {
        throw new Error('Failed to load table templates');
      }

      // Check which tables already exist
      const { data: existingTables } = await supabase
        .from('event_vip_tables')
        .select('table_number')
        .eq('event_id', eventId);

      const existingTableNumbers = new Set((existingTables || []).map(t => t.table_number));

      // Define tier mapping based on user requirements
      const getTierForTable = (tableNumber: number): 'premium' | 'front_row' | 'standard' => {
        if ([1, 2, 3, 8].includes(tableNumber)) return 'premium';
        if ([4, 5, 6, 7].includes(tableNumber)) return 'front_row';
        return 'standard'; // Tables 9-26
      };

      // Create table data for all 26 tables
      const tablesToInsert = templates
        .filter(template => !existingTableNumbers.has(template.table_number))
        .map(template => {
          const tier = getTierForTable(template.table_number);
          const config = TIER_CONFIG[tier];
          
          return {
            event_id: eventId,
            table_template_id: template.id,
            table_number: template.table_number,
            tier: tier,
            capacity: config.capacity,
            price_cents: config.price * 100,
            package_description: config.package,
            bottles_included: tier === 'premium' ? 1 : 1,
            champagne_included: tier === 'premium' ? 1 : 0,
            is_available: true,
            display_order: template.table_number,
          };
        });

      if (tablesToInsert.length === 0) {
        toast({
          title: 'Info',
          description: 'All tables already exist for this event',
        });
        return;
      }

      const { error } = await supabase
        .from('event_vip_tables')
        .insert(tablesToInsert);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Created ${tablesToInsert.length} VIP tables successfully`,
      });

      await loadTables();
    } catch (error) {
      console.error('Error quick adding tables:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create tables',
        variant: 'destructive',
      });
    } finally {
      setIsQuickAdding(false);
    }
  };

  const getTierBadge = (tier: string) => {
    const colors = {
      premium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      front_row: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      standard: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    };
    const displayNames = {
      premium: 'Premium',
      front_row: 'Front Row',
      standard: 'Standard',
    };
    return (
      <Badge className={colors[tier as keyof typeof colors] || colors.standard}>
        {displayNames[tier as keyof typeof displayNames] || tier.toUpperCase()}
      </Badge>
    );
  };

  if (!eventId) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-destructive" />
          <p className="text-muted-foreground">No event selected. Please select an event to manage VIP tables.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading VIP tables...</p>
        </CardContent>
      </Card>
    );
  }

  // Get the selected table for quick edit panel
  const selectedTable = tables.find(t => t.id === selectedFloorPlanTableId);

  return (
    <div className="space-y-6">
      {/* VIP Enable/Disable Toggle */}
      <Card className={vipEnabled ? 'border-green-500/30' : 'border-orange-500/30'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-full ${vipEnabled ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                <Crown className={`w-5 h-5 ${vipEnabled ? 'text-green-500' : 'text-orange-500'}`} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">VIP Section for Live Website</h3>
                <p className="text-sm text-muted-foreground">
                  {vipEnabled 
                    ? 'VIP table reservations are visible and available for customers on the live website.'
                    : 'VIP section is currently hidden from customers. Enable to allow table reservations.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isTogglingVip && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={vipEnabled}
                onCheckedChange={handleToggleVip}
                disabled={isTogglingVip}
                className="data-[state=checked]:bg-green-500"
              />
              <Badge variant={vipEnabled ? 'default' : 'secondary'} className={vipEnabled ? 'bg-green-500/20 text-green-400 border-green-500/50' : ''}>
                {vipEnabled ? 'Live' : 'Off'}
              </Badge>
            </div>
          </div>
          {tables.length === 0 && !vipEnabled && (
            <p className="text-xs text-muted-foreground mt-2 ml-14">
              Enable VIP section to automatically create all 26 tables with default pricing.
            </p>
          )}
          {isTogglingVip && tables.length === 0 && (
            <p className="text-xs text-blue-400 mt-2 ml-14">
              Creating VIP tables...
            </p>
          )}
        </CardContent>
      </Card>

      {/* VIP Tables Setup Card - Only show when VIP is enabled */}
      {vipEnabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-6 h-6 text-yellow-500" />
                  VIP Tables Setup
                </CardTitle>
                <CardDescription>
                  {eventName ? `Manage VIP tables for: ${eventName}` : 'Manage VIP table configurations, pricing, and availability'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!eventId ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please select an event to manage VIP tables.
                </AlertDescription>
              </Alert>
            ) : tables.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  VIP tables are being created... Please wait.
                </AlertDescription>
              </Alert>
            ) : (
            <Tabs defaultValue="floor-plan" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="floor-plan" className="gap-2">
                  <Map className="w-4 h-4" />
                  Floor Plan
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-2">
                  <List className="w-4 h-4" />
                  List View
                </TabsTrigger>
              </TabsList>

              {/* Floor Plan Tab */}
              <TabsContent value="floor-plan">
                <div className="flex gap-4">
                  {/* Floor Plan - Left Side (compact for event editor) */}
                  <div className="flex-1">
                    <VIPFloorPlanAdmin
                      tables={tables}
                      reservations={[]}
                      selectedTableId={selectedFloorPlanTableId}
                      onSelectTable={handleFloorPlanTableSelect}
                      compact={true}
                    />
                  </div>

                  {/* Quick Edit Panel - Right Side */}
                  <div className="w-64 flex-shrink-0">
                    <Card className="border-primary/20 sticky top-4">
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Edit className="w-3 h-3" />
                          Quick Edit
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        {selectedTable ? (
                          <div className="space-y-3">
                            {/* Table header */}
                            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                              <div className={`w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-bold ${
                                selectedTable.tier === 'premium' ? 'bg-amber-500' :
                                selectedTable.tier === 'front_row' ? 'bg-purple-500' : 'bg-blue-500'
                              }`}>
                                {selectedTable.table_number}
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold">Table {selectedTable.table_number}</h4>
                                {getTierBadge(selectedTable.tier)}
                              </div>
                            </div>

                            {/* Availability Toggle */}
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Available</Label>
                              <Switch
                                checked={selectedTable.is_available}
                                onCheckedChange={(checked) =>
                                  handleQuickUpdate(selectedTable.id, { is_available: checked })
                                }
                              />
                            </div>

                            {/* Price & Capacity Row */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  Price
                                </Label>
                                <Input
                                  type="number"
                                  className="h-8 text-sm"
                                  value={selectedTable.price_cents / 100}
                                  onChange={(e) =>
                                    handleQuickUpdate(selectedTable.id, {
                                      price_cents: Number(e.target.value) * 100,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  Capacity
                                </Label>
                                <Input
                                  type="number"
                                  className="h-8 text-sm"
                                  min={1}
                                  max={20}
                                  value={selectedTable.capacity}
                                  onChange={(e) =>
                                    handleQuickUpdate(selectedTable.id, {
                                      capacity: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                            </div>

                            {/* Tier */}
                            <div className="space-y-1">
                              <Label className="text-xs">Tier</Label>
                              <Select
                                value={selectedTable.tier}
                                onValueChange={(value: 'premium' | 'front_row' | 'standard') =>
                                  handleQuickUpdate(selectedTable.id, { tier: value })
                                }
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="premium">
                                    <span className="flex items-center gap-2 text-sm">
                                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                                      Premium
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="front_row">
                                    <span className="flex items-center gap-2 text-sm">
                                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                                      Front Row
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="standard">
                                    <span className="flex items-center gap-2 text-sm">
                                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                                      Standard
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Bottles */}
                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1">
                                <Wine className="w-3 h-3" />
                                Bottles
                              </Label>
                              <Input
                                type="number"
                                className="h-8 text-sm"
                                min={0}
                                max={10}
                                value={selectedTable.bottles_included}
                                onChange={(e) =>
                                  handleQuickUpdate(selectedTable.id, {
                                    bottles_included: Number(e.target.value),
                                  })
                                }
                              />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={() => setSelectedFloorPlanTableId(undefined)}
                              >
                                Clear
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={() => handleEdit(selectedTable)}
                              >
                                Full Edit
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground">
                            <Map className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">Click a table to edit</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* List View Tab */}
              <TabsContent value="list">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table #</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tables.map((table) => (
                        <TableRow key={table.id}>
                          <TableCell className="font-semibold">#{table.table_number}</TableCell>
                          <TableCell>{getTierBadge(table.tier)}</TableCell>
                          <TableCell className="font-semibold">${(table.price_cents / 100).toLocaleString()}</TableCell>
                          <TableCell>{table.capacity} guests</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {table.package_description || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={table.is_available ? 'default' : 'secondary'}>
                              {table.is_available ? 'Available' : 'Unavailable'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(table)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(table.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTable ? 'Edit VIP Table' : 'Create VIP Table'}
            </DialogTitle>
            <DialogDescription>
              Configure the VIP table details and pricing
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="table_number">Table Number *</Label>
              <Select
                value={formData.table_number}
                onValueChange={(value) => setFormData({ ...formData, table_number: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select table number" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 26 }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      Table {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tier">Tier *</Label>
              <Select
                value={formData.tier}
                onValueChange={(value: 'premium' | 'front_row' | 'standard') =>
                  handleTierChange(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="front_row">Front Row</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price ($) *</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                min="0"
                step="0.01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity (guests) *</Label>
              <Input
                id="capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                min="1"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="package_description">Package Description *</Label>
              <Textarea
                id="package_description"
                value={formData.package_description}
                onChange={(e) => setFormData({ ...formData, package_description: e.target.value })}
                placeholder="e.g., 1 Bottle + 1 Champagne"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

