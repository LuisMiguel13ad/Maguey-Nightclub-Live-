import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Save, Plus, Trash2, RefreshCw, 
  Calendar, DollarSign, Users, Wine, Check, X,
  Copy, Settings, Eye, Map
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminVIPFloorPlan } from '@/components/admin/AdminVIPFloorPlan';

// Types
interface Event {
  id: string;
  name: string;
  event_date: string;
  event_time: string;
}

interface VIPTableTemplate {
  id: string;
  table_number: number;
  default_tier: 'premium' | 'front_row' | 'standard';
  default_capacity: number;
  position_x: number;
  position_y: number;
  position_row: number;
}

interface EventVIPTable {
  id: string;
  event_id: string;
  table_template_id: string;
  table_number: number;
  tier: 'premium' | 'front_row' | 'standard';
  capacity: number;
  price_cents: number;
  bottles_included: number;
  champagne_included: number;
  package_description: string | null;
  is_available: boolean;
  display_order: number;
}

interface EventVIPConfig {
  id: string;
  event_id: string;
  vip_enabled: boolean;
  refund_policy_text: string;
  disclaimer_text: string;
}

interface VIPReservation {
  id: string;
  table_number: number;
  purchaser_name: string;
  purchaser_email: string;
  amount_paid_cents: number;
  status: string;
  created_at: string;
}

// Default tier pricing
const DEFAULT_TIER_PRICING = {
  premium: 75000, // $750
  front_row: 70000, // $700
  standard: 60000, // $600
};

const TIER_COLORS = {
  premium: 'bg-amber-500',
  front_row: 'bg-purple-500',
  standard: 'bg-blue-500',
};

const TIER_LABELS = {
  premium: 'Premium',
  front_row: 'Front Row',
  standard: 'Standard',
};

export default function VIPTableManager() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [templates, setTemplates] = useState<VIPTableTemplate[]>([]);
  const [eventTables, setEventTables] = useState<EventVIPTable[]>([]);
  const [eventConfig, setEventConfig] = useState<EventVIPConfig | null>(null);
  const [reservations, setReservations] = useState<VIPReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedFloorPlanTableId, setSelectedFloorPlanTableId] = useState<string | undefined>(undefined);

  // Bulk pricing state
  const [bulkPricing, setBulkPricing] = useState({
    premium: 750,
    front_row: 700,
    standard: 600,
  });

  // Load events on mount
  useEffect(() => {
    loadEvents();
    loadTemplates();
  }, []);

  // Load event-specific data when event is selected
  useEffect(() => {
    if (selectedEventId) {
      loadEventData(selectedEventId);
    }
  }, [selectedEventId]);

  async function loadEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('id, name, event_date, event_time')
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true });

    if (error) {
      console.error('Error loading events:', error);
      toast.error('Failed to load events');
      return;
    }

    setEvents(data || []);
    setIsLoading(false);
  }

  async function loadTemplates() {
    const { data, error } = await supabase
      .from('vip_table_templates')
      .select('*')
      .order('table_number', { ascending: true });

    if (error) {
      console.error('Error loading templates:', error);
      return;
    }

    setTemplates(data || []);
  }

  async function loadEventData(eventId: string) {
    setIsLoading(true);

    // Load event VIP tables
    const { data: tables, error: tablesError } = await supabase
      .from('event_vip_tables')
      .select('*')
      .eq('event_id', eventId)
      .order('table_number', { ascending: true });

    if (tablesError) {
      console.error('Error loading event tables:', tablesError);
    }

    // Load event VIP config
    const { data: config, error: configError } = await supabase
      .from('event_vip_configs')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();

    if (configError) {
      console.error('Error loading event config:', configError);
    }

    // Load reservations for this event
    const { data: res, error: resError } = await supabase
      .from('vip_reservations')
      .select('id, table_number, purchaser_name, purchaser_email, amount_paid_cents, status, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (resError) {
      console.error('Error loading reservations:', resError);
    }

    setEventTables(tables || []);
    setEventConfig(config);
    setReservations(res || []);
    setHasChanges(false);
    setIsLoading(false);
  }

  async function initializeEventTables() {
    if (!selectedEventId || templates.length === 0) return;

    setIsSaving(true);

    try {
      // Create event_vip_tables for each template
      const tablesToInsert = templates.map((template) => ({
        event_id: selectedEventId,
        table_template_id: template.id,
        table_number: template.table_number,
        tier: template.default_tier,
        capacity: template.default_capacity,
        price_cents: DEFAULT_TIER_PRICING[template.default_tier],
        bottles_included: 1,
        champagne_included: 0,
        package_description: `${TIER_LABELS[template.default_tier]} bottle service`,
        is_available: true,
        display_order: template.table_number,
      }));

      const { error } = await supabase
        .from('event_vip_tables')
        .insert(tablesToInsert);

      if (error) throw error;

      // Create event config
      await supabase
        .from('event_vip_configs')
        .insert({
          event_id: selectedEventId,
          vip_enabled: true,
        });

      toast.success('VIP tables initialized for this event');
      loadEventData(selectedEventId);
    } catch (error) {
      console.error('Error initializing tables:', error);
      toast.error('Failed to initialize VIP tables');
    } finally {
      setIsSaving(false);
    }
  }

  async function copyFromEvent(sourceEventId: string) {
    if (!selectedEventId) return;

    setIsSaving(true);

    try {
      // Get source event tables
      const { data: sourceTables, error: sourceError } = await supabase
        .from('event_vip_tables')
        .select('*')
        .eq('event_id', sourceEventId);

      if (sourceError) throw sourceError;

      if (!sourceTables || sourceTables.length === 0) {
        toast.error('Source event has no VIP tables configured');
        return;
      }

      // Delete existing tables for current event
      await supabase
        .from('event_vip_tables')
        .delete()
        .eq('event_id', selectedEventId);

      // Copy tables with new event_id
      const tablesToInsert = sourceTables.map((table) => ({
        event_id: selectedEventId,
        table_template_id: table.table_template_id,
        table_number: table.table_number,
        tier: table.tier,
        capacity: table.capacity,
        price_cents: table.price_cents,
        bottles_included: table.bottles_included,
        champagne_included: table.champagne_included,
        package_description: table.package_description,
        is_available: true, // Reset availability
        display_order: table.display_order,
      }));

      const { error } = await supabase
        .from('event_vip_tables')
        .insert(tablesToInsert);

      if (error) throw error;

      toast.success('VIP configuration copied from selected event');
      loadEventData(selectedEventId);
    } catch (error) {
      console.error('Error copying configuration:', error);
      toast.error('Failed to copy configuration');
    } finally {
      setIsSaving(false);
    }
  }

  function updateTableLocally(tableId: string, updates: Partial<EventVIPTable>) {
    setEventTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, ...updates } : t))
    );
    setHasChanges(true);
  }

  async function saveChanges() {
    setIsSaving(true);

    try {
      // Update all tables
      for (const table of eventTables) {
        const { error } = await supabase
          .from('event_vip_tables')
          .update({
            tier: table.tier,
            capacity: table.capacity,
            price_cents: table.price_cents,
            bottles_included: table.bottles_included,
            champagne_included: table.champagne_included,
            package_description: table.package_description,
            is_available: table.is_available,
          })
          .eq('id', table.id);

        if (error) throw error;
      }

      // Update config if exists
      if (eventConfig) {
        const { error } = await supabase
          .from('event_vip_configs')
          .update({
            vip_enabled: eventConfig.vip_enabled,
            refund_policy_text: eventConfig.refund_policy_text,
            disclaimer_text: eventConfig.disclaimer_text,
          })
          .eq('id', eventConfig.id);

        if (error) throw error;
      }

      toast.success('Changes saved successfully');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }

  function applyBulkPricing() {
    setEventTables((prev) =>
      prev.map((t) => ({
        ...t,
        price_cents: bulkPricing[t.tier] * 100,
      }))
    );
    setHasChanges(true);
    toast.success('Bulk pricing applied');
  }

  function toggleAllAvailability(available: boolean) {
    setEventTables((prev) =>
      prev.map((t) => ({ ...t, is_available: available }))
    );
    setHasChanges(true);
  }

  // Handle selecting a table from the floor plan
  function handleFloorPlanTableSelect(table: EventVIPTable) {
    setSelectedFloorPlanTableId(table.id);
  }

  // Group tables by tier for display
  const tablesByTier = {
    premium: eventTables.filter((t) => t.tier === 'premium'),
    front_row: eventTables.filter((t) => t.tier === 'front_row'),
    standard: eventTables.filter((t) => t.tier === 'standard'),
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">VIP Table Manager</h1>
          <p className="text-muted-foreground">
            Configure VIP tables, pricing, and availability for each event
          </p>
        </div>
        {hasChanges && (
          <Button onClick={saveChanges} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      {/* Event Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Select Event
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Choose an event to configure..." />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name} - {new Date(event.event_date).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && selectedEventId && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* No Tables - Initialize */}
      {selectedEventId && !isLoading && eventTables.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Wine className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No VIP Tables Configured</h3>
            <p className="text-muted-foreground mb-6">
              This event doesn't have VIP tables set up yet. You can initialize with defaults or copy from another event.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={initializeEventTables} disabled={isSaving}>
                <Plus className="w-4 h-4 mr-2" />
                Initialize Default Tables
              </Button>
              <Select onValueChange={copyFromEvent}>
                <SelectTrigger className="w-[250px]">
                  <Copy className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Copy from event..." />
                </SelectTrigger>
                <SelectContent>
                  {events
                    .filter((e) => e.id !== selectedEventId)
                    .map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Management UI */}
      {selectedEventId && !isLoading && eventTables.length > 0 && (
        <Tabs defaultValue="floor-plan" className="space-y-6">
          <TabsList>
            <TabsTrigger value="floor-plan" className="gap-2">
              <Map className="w-4 h-4" />
              Floor Plan
            </TabsTrigger>
            <TabsTrigger value="tables">Tables ({eventTables.length})</TabsTrigger>
            <TabsTrigger value="pricing">Bulk Pricing</TabsTrigger>
            <TabsTrigger value="reservations">Reservations ({reservations.length})</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Floor Plan Tab */}
          <TabsContent value="floor-plan" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Floor Plan - Takes 2 columns on xl */}
              <div className="xl:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Map className="w-5 h-5" />
                      VIP Table Layout
                    </CardTitle>
                    <CardDescription>
                      Click on any table to select it for editing. This is the same view customers see.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AdminVIPFloorPlan
                      tables={eventTables}
                      reservations={reservations}
                      selectedTableId={selectedFloorPlanTableId}
                      onSelectTable={handleFloorPlanTableSelect}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Quick Edit Panel - Takes 1 column on xl */}
              <div className="xl:col-span-1">
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Quick Edit
                    </CardTitle>
                    <CardDescription>
                      {selectedFloorPlanTableId 
                        ? 'Edit the selected table below'
                        : 'Select a table from the floor plan to edit'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedFloorPlanTableId ? (
                      (() => {
                        const table = eventTables.find(t => t.id === selectedFloorPlanTableId);
                        if (!table) return null;
                        
                        const hasReservation = reservations.some(
                          r => r.table_number === table.table_number && 
                               ['pending', 'confirmed', 'checked_in'].includes(r.status)
                        );

                        return (
                          <div className="space-y-4">
                            {/* Table header with number and status */}
                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg',
                                  table.tier === 'premium' && 'bg-amber-500',
                                  table.tier === 'front_row' && 'bg-purple-500',
                                  table.tier === 'standard' && 'bg-blue-500',
                                )}>
                                  {table.table_number}
                                </div>
                                <div>
                                  <h4 className="font-semibold">Table {table.table_number}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {TIER_LABELS[table.tier]}
                                  </Badge>
                                </div>
                              </div>
                              {hasReservation && (
                                <Badge className="bg-green-500">Reserved</Badge>
                              )}
                            </div>

                            {/* Availability Toggle */}
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>Available for booking</Label>
                                <p className="text-xs text-muted-foreground">
                                  {hasReservation ? 'Cannot disable - has active reservation' : 'Toggle table availability'}
                                </p>
                              </div>
                              <Switch
                                checked={table.is_available}
                                onCheckedChange={(checked) =>
                                  updateTableLocally(table.id, { is_available: checked })
                                }
                                disabled={hasReservation}
                              />
                            </div>

                            {/* Price */}
                            <div className="space-y-2">
                              <Label>Price ($)</Label>
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  value={table.price_cents / 100}
                                  onChange={(e) =>
                                    updateTableLocally(table.id, {
                                      price_cents: Number(e.target.value) * 100,
                                    })
                                  }
                                />
                              </div>
                            </div>

                            {/* Tier */}
                            <div className="space-y-2">
                              <Label>Tier</Label>
                              <Select
                                value={table.tier}
                                onValueChange={(value: 'premium' | 'front_row' | 'standard') =>
                                  updateTableLocally(table.id, { tier: value })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="premium">
                                    <span className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                                      Premium
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="front_row">
                                    <span className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                                      Front Row
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="standard">
                                    <span className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                                      Standard
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Capacity */}
                            <div className="space-y-2">
                              <Label>Guest Capacity</Label>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={table.capacity}
                                  onChange={(e) =>
                                    updateTableLocally(table.id, {
                                      capacity: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                            </div>

                            {/* Bottles Included */}
                            <div className="space-y-2">
                              <Label>Bottles Included</Label>
                              <div className="flex items-center gap-2">
                                <Wine className="w-4 h-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={table.bottles_included}
                                  onChange={(e) =>
                                    updateTableLocally(table.id, {
                                      bottles_included: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                            </div>

                            {/* Clear selection button */}
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => setSelectedFloorPlanTableId(undefined)}
                            >
                              Clear Selection
                            </Button>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Map className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Click on a table in the floor plan to edit it</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Tables Tab */}
          <TabsContent value="tables" className="space-y-6">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleAllAvailability(true)}>
                <Check className="w-4 h-4 mr-1" />
                Enable All
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleAllAvailability(false)}>
                <X className="w-4 h-4 mr-1" />
                Disable All
              </Button>
              <Button variant="outline" size="sm" onClick={() => loadEventData(selectedEventId)}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>

            {/* Tables by Tier */}
            {(['premium', 'front_row', 'standard'] as const).map((tier) => (
              <Card key={tier}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className={cn('w-3 h-3 rounded-full', TIER_COLORS[tier])} />
                    {TIER_LABELS[tier]} Tables ({tablesByTier[tier].length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tablesByTier[tier].map((table) => {
                      const hasReservation = reservations.some(
                        (r) => r.table_number === table.table_number && 
                               ['pending', 'confirmed', 'checked_in'].includes(r.status)
                      );

                      return (
                        <div
                          key={table.id}
                          className={cn(
                            'border rounded-lg p-4 space-y-3',
                            !table.is_available && 'bg-muted/50',
                            hasReservation && 'border-green-500'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-lg">Table {table.table_number}</span>
                              {hasReservation && (
                                <Badge variant="default" className="bg-green-500">Reserved</Badge>
                              )}
                            </div>
                            <Switch
                              checked={table.is_available}
                              onCheckedChange={(checked) =>
                                updateTableLocally(table.id, { is_available: checked })
                              }
                              disabled={hasReservation}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Price</Label>
                              <div className="flex items-center">
                                <span className="text-muted-foreground mr-1">$</span>
                                <Input
                                  type="number"
                                  value={table.price_cents / 100}
                                  onChange={(e) =>
                                    updateTableLocally(table.id, {
                                      price_cents: Number(e.target.value) * 100,
                                    })
                                  }
                                  className="h-8"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Capacity</Label>
                              <Input
                                type="number"
                                value={table.capacity}
                                onChange={(e) =>
                                  updateTableLocally(table.id, {
                                    capacity: Number(e.target.value),
                                  })
                                }
                                className="h-8"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Bottles</Label>
                              <Input
                                type="number"
                                value={table.bottles_included}
                                onChange={(e) =>
                                  updateTableLocally(table.id, {
                                    bottles_included: Number(e.target.value),
                                  })
                                }
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Tier</Label>
                              <Select
                                value={table.tier}
                                onValueChange={(value: 'premium' | 'front_row' | 'standard') =>
                                  updateTableLocally(table.id, { tier: value })
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="premium">Premium</SelectItem>
                                  <SelectItem value="front_row">Front Row</SelectItem>
                                  <SelectItem value="standard">Standard</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Bulk Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Bulk Tier Pricing
                </CardTitle>
                <CardDescription>
                  Set pricing for all tables of each tier at once
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(['premium', 'front_row', 'standard'] as const).map((tier) => (
                    <div key={tier} className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <span className={cn('w-3 h-3 rounded-full', TIER_COLORS[tier])} />
                        {TIER_LABELS[tier]}
                      </Label>
                      <div className="flex items-center">
                        <span className="text-muted-foreground mr-2 text-lg">$</span>
                        <Input
                          type="number"
                          value={bulkPricing[tier]}
                          onChange={(e) =>
                            setBulkPricing((prev) => ({
                              ...prev,
                              [tier]: Number(e.target.value),
                            }))
                          }
                          className="text-lg"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {tablesByTier[tier].length} tables
                      </p>
                    </div>
                  ))}
                </div>
                <Button onClick={applyBulkPricing}>
                  Apply Pricing to All Tables
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reservations Tab */}
          <TabsContent value="reservations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Current Reservations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reservations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No reservations for this event yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reservations.map((res) => (
                      <div
                        key={res.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <div className="font-medium">Table {res.table_number}</div>
                          <div className="text-sm text-muted-foreground">
                            {res.purchaser_name} • {res.purchaser_email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(res.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">
                            ${(res.amount_paid_cents / 100).toFixed(0)}
                          </div>
                          <Badge
                            variant={res.status === 'confirmed' ? 'default' : 'secondary'}
                          >
                            {res.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  VIP Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {eventConfig ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>VIP Section Enabled</Label>
                        <p className="text-sm text-muted-foreground">
                          Show VIP table selection on the ticket purchase page
                        </p>
                      </div>
                      <Switch
                        checked={eventConfig.vip_enabled}
                        onCheckedChange={(checked) => {
                          setEventConfig({ ...eventConfig, vip_enabled: checked });
                          setHasChanges(true);
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Disclaimer Text</Label>
                      <Textarea
                        value={eventConfig.disclaimer_text || ''}
                        onChange={(e) => {
                          setEventConfig({ ...eventConfig, disclaimer_text: e.target.value });
                          setHasChanges(true);
                        }}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Refund Policy</Label>
                      <Textarea
                        value={eventConfig.refund_policy_text || ''}
                        onChange={(e) => {
                          setEventConfig({ ...eventConfig, refund_policy_text: e.target.value });
                          setHasChanges(true);
                        }}
                        rows={3}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No VIP config found. Initialize tables first.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Preview Link */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => window.open(`/events/${selectedEventId}/vip-tables`, '_blank')}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Open VIP Page in New Tab
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

