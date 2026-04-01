import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  Loader2,
  Tag,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PriceTier {
  id?: string;
  tier_name: string;
  price: number;
  tickets_available: number;
  tickets_sold: number;
  sort_order: number;
  is_active: boolean;
  _dirty?: boolean; // local-only flag
}

interface TicketTypeWithTiers {
  id: string;
  name: string;
  price: number;
  fee: number;
  total_inventory: number | null;
  tickets_sold: number;
  tiers: PriceTier[];
  expanded: boolean;
  saving: boolean;
}

interface EventRow {
  id: string;
  name: string;
  event_date: string;
  ticketTypes: TicketTypeWithTiers[];
  expanded: boolean;
  loading: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

const EventManagement = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load events on mount
  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id, name, event_date")
      .order("event_date", { ascending: false });

    if (error) {
      toast({ title: "Error loading events", description: error.message, variant: "destructive" });
    } else {
      setEvents(
        (data || []).map((e) => ({
          ...e,
          ticketTypes: [],
          expanded: false,
          loading: false,
        }))
      );
    }
    setIsLoading(false);
  }

  async function toggleEvent(eventId: string) {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        if (e.expanded) return { ...e, expanded: false };
        return { ...e, expanded: true, loading: e.ticketTypes.length === 0 };
      })
    );

    const event = events.find((e) => e.id === eventId);
    if (!event || event.expanded || event.ticketTypes.length > 0) return;

    // Load ticket types + tiers
    const { data: ttData, error: ttError } = await supabase
      .from("ticket_types")
      .select("id, name, price, fee, total_inventory, tickets_sold")
      .eq("event_id", eventId)
      .order("price", { ascending: true });

    if (ttError) {
      toast({ title: "Error loading ticket types", description: ttError.message, variant: "destructive" });
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, loading: false } : e)));
      return;
    }

    const ticketTypeIds = (ttData || []).map((t) => t.id);
    let tiersMap: Record<string, PriceTier[]> = {};

    if (ticketTypeIds.length > 0) {
      const { data: tiersData } = await supabase
        .from("ticket_type_price_tiers")
        .select("*")
        .in("ticket_type_id", ticketTypeIds)
        .order("sort_order", { ascending: true });

      if (tiersData) {
        for (const tier of tiersData) {
          if (!tiersMap[tier.ticket_type_id]) tiersMap[tier.ticket_type_id] = [];
          tiersMap[tier.ticket_type_id].push({
            id: tier.id,
            tier_name: tier.tier_name,
            price: Number(tier.price),
            tickets_available: tier.tickets_available,
            tickets_sold: tier.tickets_sold,
            sort_order: tier.sort_order,
            is_active: tier.is_active,
          });
        }
      }
    }

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          loading: false,
          ticketTypes: (ttData || []).map((tt) => ({
            ...tt,
            total_inventory: tt.total_inventory ?? null,
            tickets_sold: tt.tickets_sold ?? 0,
            tiers: tiersMap[tt.id] || [],
            expanded: false,
            saving: false,
          })),
        };
      })
    );
  }

  function toggleTicketType(eventId: string, ttId: string) {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          ticketTypes: e.ticketTypes.map((tt) =>
            tt.id === ttId ? { ...tt, expanded: !tt.expanded } : tt
          ),
        };
      })
    );
  }

  function addTier(eventId: string, ttId: string) {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          ticketTypes: e.ticketTypes.map((tt) => {
            if (tt.id !== ttId) return tt;
            const nextSort = tt.tiers.length > 0 ? Math.max(...tt.tiers.map((t) => t.sort_order)) + 1 : 0;
            const isFirstTier = tt.tiers.length === 0;
            return {
              ...tt,
              tiers: [
                ...tt.tiers,
                {
                  tier_name: "",
                  price: tt.price,
                  tickets_available: 50,
                  tickets_sold: 0,
                  sort_order: nextSort,
                  is_active: isFirstTier, // first tier auto-active
                  _dirty: true,
                },
              ],
            };
          }),
        };
      })
    );
  }

  function updateTierField(
    eventId: string,
    ttId: string,
    tierIndex: number,
    field: keyof PriceTier,
    value: string | number | boolean
  ) {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          ticketTypes: e.ticketTypes.map((tt) => {
            if (tt.id !== ttId) return tt;
            const newTiers = tt.tiers.map((tier, i) =>
              i === tierIndex ? { ...tier, [field]: value, _dirty: true } : tier
            );
            return { ...tt, tiers: newTiers };
          }),
        };
      })
    );
  }

  function setActiveTier(eventId: string, ttId: string, tierIndex: number) {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          ticketTypes: e.ticketTypes.map((tt) => {
            if (tt.id !== ttId) return tt;
            return {
              ...tt,
              tiers: tt.tiers.map((tier, i) => ({
                ...tier,
                is_active: i === tierIndex,
                _dirty: true,
              })),
            };
          }),
        };
      })
    );
  }

  function removeTier(eventId: string, ttId: string, tierIndex: number) {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          ticketTypes: e.ticketTypes.map((tt) => {
            if (tt.id !== ttId) return tt;
            return { ...tt, tiers: tt.tiers.filter((_, i) => i !== tierIndex) };
          }),
        };
      })
    );
  }

  async function saveTiers(eventId: string, ttId: string) {
    const event = events.find((e) => e.id === eventId);
    const tt = event?.ticketTypes.find((t) => t.id === ttId);
    if (!tt) return;

    // Validate
    for (const tier of tt.tiers) {
      if (!tier.tier_name.trim()) {
        toast({ title: "Tier name required", description: "All tiers must have a name.", variant: "destructive" });
        return;
      }
      if (tier.price < 0) {
        toast({ title: "Invalid price", description: "Price cannot be negative.", variant: "destructive" });
        return;
      }
      if (tier.tickets_available < 1) {
        toast({ title: "Invalid quantity", description: "Tickets available must be at least 1.", variant: "destructive" });
        return;
      }
    }

    const activeCount = tt.tiers.filter((t) => t.is_active).length;
    if (tt.tiers.length > 0 && activeCount !== 1) {
      toast({ title: "Exactly one tier must be active", description: "Please select one tier as the active tier.", variant: "destructive" });
      return;
    }

    // Set saving state
    setEvents((prev) =>
      prev.map((e) => ({
        ...e,
        ticketTypes: e.ticketTypes.map((t) =>
          t.id === ttId ? { ...t, saving: true } : t
        ),
      }))
    );

    try {
      // Upsert all tiers
      const tiersToSave = tt.tiers.map((tier, idx) => ({
        ...(tier.id ? { id: tier.id } : {}),
        ticket_type_id: ttId,
        tier_name: tier.tier_name.trim(),
        price: tier.price,
        tickets_available: tier.tickets_available,
        tickets_sold: tier.tickets_sold,
        sort_order: idx,
        is_active: tier.is_active,
        updated_at: new Date().toISOString(),
      }));

      // Delete existing tiers first (simplest approach to handle removals)
      const { error: deleteError } = await supabase
        .from("ticket_type_price_tiers")
        .delete()
        .eq("ticket_type_id", ttId);

      if (deleteError) throw deleteError;

      if (tiersToSave.length > 0) {
        const { error: insertError } = await supabase
          .from("ticket_type_price_tiers")
          .insert(tiersToSave.map(({ id: _id, ...rest }) => rest)); // strip id for fresh insert

        if (insertError) throw insertError;
      }

      // Reload tiers for this ticket type
      const { data: refreshed } = await supabase
        .from("ticket_type_price_tiers")
        .select("*")
        .eq("ticket_type_id", ttId)
        .order("sort_order", { ascending: true });

      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== eventId) return e;
          return {
            ...e,
            ticketTypes: e.ticketTypes.map((t) => {
              if (t.id !== ttId) return t;
              return {
                ...t,
                saving: false,
                tiers: (refreshed || []).map((tier) => ({
                  id: tier.id,
                  tier_name: tier.tier_name,
                  price: Number(tier.price),
                  tickets_available: tier.tickets_available,
                  tickets_sold: tier.tickets_sold,
                  sort_order: tier.sort_order,
                  is_active: tier.is_active,
                })),
              };
            }),
          };
        })
      );

      toast({ title: "Pricing tiers saved", description: `${tiersToSave.length} tiers saved for ${tt.name}.` });
    } catch (err: any) {
      toast({ title: "Error saving tiers", description: err.message, variant: "destructive" });
      setEvents((prev) =>
        prev.map((e) => ({
          ...e,
          ticketTypes: e.ticketTypes.map((t) =>
            t.id === ttId ? { ...t, saving: false } : t
          ),
        }))
      );
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Event Pricing Tiers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure early-bird and dynamic pricing tiers per ticket type. The active tier price is
          fetched server-side at checkout — customers cannot tamper with it.
        </p>
      </div>

      {events.length === 0 && (
        <p className="text-muted-foreground py-8 text-center">No events found.</p>
      )}

      {events.map((event) => (
        <div key={event.id} className="border border-border rounded-lg overflow-hidden">
          {/* Event row */}
          <button
            onClick={() => toggleEvent(event.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
          >
            <div>
              <span className="font-semibold">{event.name}</span>
              <span className="ml-3 text-sm text-muted-foreground">
                {new Date(event.event_date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {event.loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {event.expanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {/* Ticket types */}
          {event.expanded && !event.loading && (
            <div className="divide-y divide-border">
              {event.ticketTypes.length === 0 && (
                <p className="px-6 py-4 text-sm text-muted-foreground">No ticket types for this event.</p>
              )}

              {event.ticketTypes.map((tt) => (
                <div key={tt.id} className="px-6 py-4">
                  {/* Ticket type header */}
                  <button
                    onClick={() => toggleTicketType(event.id, tt.id)}
                    className="flex items-center gap-2 w-full text-left group"
                  >
                    {tt.expanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{tt.name}</span>
                    <span className="text-sm text-muted-foreground">
                      base ${tt.price.toFixed(2)} + ${tt.fee.toFixed(2)} fee
                    </span>
                    {tt.tiers.length > 0 && (
                      <Badge variant="outline" className="ml-auto text-xs flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {tt.tiers.length} tier{tt.tiers.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </button>

                  {/* Tiers table */}
                  {tt.expanded && (
                    <div className="mt-4 space-y-3">
                      {tt.tiers.length > 0 && (
                        <div className="rounded-md border border-border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tier Name</th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Price ($)</th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground"># Tickets</th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Sold</th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                                <th className="px-3 py-2 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {tt.tiers.map((tier, idx) => (
                                <tr key={idx} className={tier.is_active ? "bg-green-50/60 dark:bg-green-950/20" : ""}>
                                  <td className="px-3 py-2">
                                    <Input
                                      value={tier.tier_name}
                                      onChange={(e) =>
                                        updateTierField(event.id, tt.id, idx, "tier_name", e.target.value)
                                      }
                                      placeholder="e.g. Early Bird"
                                      className="h-8 text-sm"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={tier.price}
                                      onChange={(e) =>
                                        updateTierField(event.id, tt.id, idx, "price", parseFloat(e.target.value) || 0)
                                      }
                                      className="h-8 text-sm w-24"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={tier.tickets_available}
                                      onChange={(e) =>
                                        updateTierField(
                                          event.id,
                                          tt.id,
                                          idx,
                                          "tickets_available",
                                          parseInt(e.target.value) || 1
                                        )
                                      }
                                      className="h-8 text-sm w-24"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">{tier.tickets_sold}</td>
                                  <td className="px-3 py-2">
                                    {tier.is_active ? (
                                      <Badge className="bg-green-600/90 text-white text-xs border-none">Active</Badge>
                                    ) : (
                                      <button
                                        onClick={() => setActiveTier(event.id, tt.id, idx)}
                                        className="text-xs text-muted-foreground underline hover:text-foreground"
                                      >
                                        Set Active
                                      </button>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      onClick={() => removeTier(event.id, tt.id, idx)}
                                      className="text-destructive hover:text-destructive/80 transition-colors"
                                      title="Remove tier"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {tt.tiers.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No tiers configured. Add a tier below to enable dynamic pricing. Without tiers, the base
                          price (${tt.price.toFixed(2)}) is used.
                        </p>
                      )}

                      <div className="flex items-center gap-3 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addTier(event.id, tt.id)}
                          className="gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Tier
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveTiers(event.id, tt.id)}
                          disabled={tt.saving}
                          className="gap-1.5"
                        >
                          {tt.saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Save Tiers
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default EventManagement;
