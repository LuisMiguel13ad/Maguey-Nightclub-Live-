import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Plus,
  Edit,
  Trash2,
  Search,
  Users,
  Ticket,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  Globe,
  Archive,
  FileText,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Upload, X, Image as ImageIcon, Wand2, Settings, Key } from "lucide-react";
import { generateTicketTypeCode } from "@/lib/ticket-type-utils";
import { uploadEventImage, validateImageFile } from "@/lib/event-image-service";
import { EventBulkImport } from "@/components/EventBulkImport";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { syncEvent } from "@/lib/cross-site-sync";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { validateEventDayOfWeek } from "@/lib/event-day-validation";
import { checkForDuplicateEvent, getDuplicateErrorMessage } from "@/lib/event-duplicate-check";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VIPSetupManager, VIPReservationsList } from "@/components/vip";

interface TicketType {
  name: string;
  price: number;
  capacity: number;
}

interface Event {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  event_time: string;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  image_url: string | null;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  categories: string[];
  tags: string[];
  ticket_types: TicketType[];
  created_at: string;
  updated_at: string;
}

const EventManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  
  // Form state
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  // Default venue values for single-venue nightclub
  const DEFAULT_VENUE_NAME = "Maguey Delaware";
  const DEFAULT_VENUE_ADDRESS = "3320 Old Capitol Trl";
  const DEFAULT_CITY = "Wilmington";
  
  const [venueName, setVenueName] = useState(DEFAULT_VENUE_NAME);
  const [venueAddress, setVenueAddress] = useState(DEFAULT_VENUE_ADDRESS);
  const [city, setCity] = useState(DEFAULT_CITY);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([
    { name: "General Admission", price: 25, capacity: 100 },
  ]);
  const [saving, setSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [eventStatus, setEventStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [categoriesInput, setCategoriesInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  // Settings state
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [tempOpenaiKey, setTempOpenaiKey] = useState("");

  useEffect(() => {
    // Load API key from local storage on mount
    const storedKey = localStorage.getItem("maguey_openai_key");
    if (storedKey) {
      setOpenaiKey(storedKey);
      setTempOpenaiKey(storedKey);
    }
  }, []);

  const handleSaveSettings = () => {
    if (tempOpenaiKey.trim()) {
      localStorage.setItem("maguey_openai_key", tempOpenaiKey.trim());
      setOpenaiKey(tempOpenaiKey.trim());
      toast({
        title: "Settings Saved",
        description: "OpenAI API Key has been saved.",
      });
    } else {
      localStorage.removeItem("maguey_openai_key");
      setOpenaiKey("");
      setTempOpenaiKey("");
      toast({
        title: "Settings Updated",
        description: "API Key removed.",
      });
    }
    setSettingsDialogOpen(false);
  };

  // Redirect employees
  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Event management is only available to owners.",
      });
      navigate("/scanner");
    }
  }, [role, navigate, toast]);

  // Load events
  useEffect(() => {
    if (role === 'owner') {
      loadEvents();
    }
  }, [role]);

  // Filter events based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEvents(events);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = events.filter(e =>
      e.name.toLowerCase().includes(query) ||
      e.description?.toLowerCase().includes(query)
    );
    setFilteredEvents(filtered);
  }, [searchQuery, events]);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        toast({
          variant: "destructive",
          title: "Configuration Error",
          description: "Supabase is not configured. Events cannot be loaded.",
        });
        setIsLoading(false);
        return;
      }

      // Query events with new fields
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("id, name, description, event_date, event_time, venue_name, venue_address, city, image_url, status, published_at, categories, tags, created_at, updated_at")
        .order("event_date", { ascending: false });

      if (eventsError) throw eventsError;

      // Query ticket types separately
      const { data: ticketTypesData, error: ticketTypesError } = await supabase
        .from("ticket_types")
        .select("id, event_id, name, price, total_inventory");

      if (ticketTypesError) throw ticketTypesError;

      // Merge data for display
      const eventsWithTicketTypes = (eventsData || []).map(event => ({
        ...event,
        status: (event as any).status || 'draft',
        published_at: (event as any).published_at || null,
        categories: Array.isArray((event as any).categories) ? (event as any).categories : [],
        tags: Array.isArray((event as any).tags) ? (event as any).tags : [],
        ticket_types: (ticketTypesData || [])
          .filter(tt => tt.event_id === event.id)
          .map(tt => ({
            name: tt.name,
            price: parseFloat(tt.price.toString()),
            capacity: tt.total_inventory || 0,
          })),
      }));

      setEvents(eventsWithTicketTypes);
      setFilteredEvents(eventsWithTicketTypes);
    } catch (error: any) {
      console.error('Error loading events:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load events.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingEvent(null);
    setEventName("");
    setEventDescription("");
    setEventDate("");
    setEventTime("");
    setVenueName(DEFAULT_VENUE_NAME);
    setVenueAddress(DEFAULT_VENUE_ADDRESS);
    setCity(DEFAULT_CITY);
    setImageUrl("");
    setImageFile(null);
    setImagePreview("");
    setTicketTypes([{ name: "General Admission", price: 25, capacity: 100 }]);
    setEventStatus('draft');
    setCategories([]);
    setTags([]);
    setCategoriesInput("");
    setTagsInput("");
    setEditDialogOpen(true);
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setEventName(event.name);
    setEventDescription(event.description || "");
    
    const eventDateTime = new Date(event.event_date);
    setEventDate(eventDateTime.toISOString().split('T')[0]);
    setEventTime(event.event_time || "20:00");
    setVenueName(event.venue_name || "");
    setVenueAddress(event.venue_address || "");
    setCity(event.city || "");
    setImageUrl(event.image_url || "");
    setImageFile(null);
    setImagePreview(event.image_url || "");
    setTicketTypes(event.ticket_types || []);
    setEventStatus(event.status || 'draft');
    setCategories(event.categories || []);
    setTags(event.tags || []);
    setCategoriesInput((event.categories || []).join(", "));
    setTagsInput((event.tags || []).join(", "));
    setEditDialogOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast({
        variant: "destructive",
        title: "Invalid Image",
        description: validation.error,
      });
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleScanFlyer = async () => {
    if (!imageFile) {
      toast({
        variant: "destructive",
        title: "No Image",
        description: "Please select an image to scan first.",
      });
      return;
    }

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      reader.onload = async () => {
        const base64Image = reader.result;
        
        const { data, error } = await supabase.functions.invoke('scan-flyer', {
          body: { image: base64Image, apiKey: openaiKey }
        });

        if (error) throw error;

        if (data) {
          if (data.artist) setEventName(data.artist);
          if (data.date) setEventDate(data.date);
          if (data.time) setEventTime(data.time);
          if (data.venue) setVenueName(data.venue);
          if (data.city) setCity(data.city);
          if (data.description) setEventDescription(data.description);
          
          toast({
            title: "Flyer Scanned",
            description: "Event details auto-filled from flyer!",
          });
        }
      };
    } catch (error: any) {
      console.error("Scan error:", error);
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: "Could not read flyer details. Please fill manually.",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;

    setUploadingImage(true);
    try {
      const result = await uploadEventImage(imageFile, editingEvent?.id);
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: result.error,
        });
        return;
      }

      setImageUrl(result.url);
      toast({
        title: "Image Uploaded",
        description: "Event image uploaded successfully!",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: error.message || "Failed to upload image",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    if (!editingEvent) {
      setImageUrl("");
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!eventName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Event name is required.",
      });
      return;
    }

    if (!eventDate || !eventTime) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Event date and time are required.",
      });
      return;
    }

    if (!venueName?.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Venue name is required.",
      });
      return;
    }

    // City is optional - default to "Wilmington" if empty (single-venue nightclub)
    // No validation needed as city can be null in database

    if (ticketTypes.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "At least one ticket type is required.",
      });
      return;
    }

    // Validate ticket types - ensure all required fields are present
    for (const ticketType of ticketTypes) {
      if (!ticketType.name.trim()) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "All ticket types must have a name.",
        });
        return;
      }
      if (ticketType.price < 0 || ticketType.price === null || ticketType.price === undefined) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: `Ticket type "${ticketType.name}" must have a valid price (0 or greater).`,
        });
        return;
      }
      if (ticketType.capacity <= 0 || ticketType.capacity === null || ticketType.capacity === undefined) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: `Ticket type "${ticketType.name}" must have a capacity greater than 0.`,
        });
        return;
      }
    }

    // Validate date is not in the past
    const eventDateTime = new Date(`${eventDate}T${eventTime}`);
    if (eventDateTime < new Date()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Event date and time must be in the future.",
      });
      return;
    }

    // Validate event day of week matches event name pattern
    const dayValidation = validateEventDayOfWeek(eventName, eventDateTime);
    if (!dayValidation.isValid) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: dayValidation.errorMessage || "Event date does not match the required day of week.",
      });
      return;
    }

    // Upload image if new file selected
    let finalImageUrl = imageUrl;
    if (imageFile && !imageUrl) {
      setSaving(true);
      const uploadResult = await uploadEventImage(imageFile, editingEvent?.id);
      if (uploadResult.error) {
        toast({
          variant: "destructive",
          title: "Image Upload Failed",
          description: uploadResult.error,
        });
        setSaving(false);
        return;
      }
      finalImageUrl = uploadResult.url;
    }

    setSaving(true);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured");
      }

      const eventDateTime = new Date(`${eventDate}T${eventTime}`);
      
      // Parse categories and tags from comma-separated input
      const parsedCategories = categoriesInput.split(',').map(c => c.trim()).filter(c => c.length > 0);
      const parsedTags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
      
      // Determine published_at timestamp
      const shouldSetPublishedAt = eventStatus === 'published' && (!editingEvent || editingEvent.status !== 'published');
      const publishedAtValue = shouldSetPublishedAt ? new Date().toISOString() : 
        (editingEvent?.status === 'published' ? editingEvent.published_at : null);
      
      const eventData = {
        name: eventName.trim(),
        description: eventDescription.trim() || null,
        event_date: eventDateTime.toISOString().split('T')[0], // Date only
        event_time: eventTime,
        venue_name: venueName.trim() || DEFAULT_VENUE_NAME,
        venue_address: venueAddress.trim() || DEFAULT_VENUE_ADDRESS,
        city: city.trim() || DEFAULT_CITY, // Default to Wilmington if empty
        image_url: finalImageUrl || null,
        status: eventStatus,
        published_at: publishedAtValue,
        categories: parsedCategories,
        tags: parsedTags,
      };

      let eventId: string;

      if (editingEvent) {
        // Update existing event
        // First, perform the update without select to avoid 406 errors
        const { error: updateError } = await supabase
          .from("events")
          .update(eventData)
          .eq("id", editingEvent.id);

        if (updateError) {
          console.error('Error updating event:', updateError);
          throw updateError;
        }
        
        // Verify the update succeeded by fetching the event
        const { data: fetchedData, error: fetchError } = await supabase
          .from("events")
          .select("id")
          .eq("id", editingEvent.id)
          .maybeSingle();
        
        if (fetchError) {
          console.error('Error verifying event update:', fetchError);
          throw new Error(`Event update verification failed: ${fetchError.message}`);
        }
        
        if (!fetchedData) {
          throw new Error("Event not found after update");
        }
        
        // Update succeeded, use the eventId
        eventId = editingEvent.id;

        // Delete old ticket types and recreate
        await supabase
          .from("ticket_types")
          .delete()
          .eq("event_id", eventId);
      } else {
        // Check for duplicate event before creating
        const duplicateCheck = await checkForDuplicateEvent(
          eventData.name,
          eventData.event_date
        );

        if (duplicateCheck.isDuplicate) {
          throw new Error(getDuplicateErrorMessage(duplicateCheck));
        }

        // Create new event
        const { data, error } = await supabase
          .from("events")
          .insert(eventData)
          .select("id, name, event_date, event_time, status")
          .maybeSingle();

        if (error) {
          if (error.code === '23505') { // Unique violation
            throw new Error("An event with this name already exists. Please check for duplicates.");
          }
          throw error;
        }
        if (!data) {
          throw new Error("Failed to create event - no data returned");
        }
        eventId = data.id;
      }

      // Insert ticket types into separate table
      const ticketTypeRows = ticketTypes.map((tt, index) => ({
        event_id: eventId,
        name: tt.name.trim(),
        code: generateTicketTypeCode(tt.name, index),
        price: tt.price,
        total_inventory: tt.capacity,
      }));

      const { error: ttError } = await supabase
        .from("ticket_types")
        .insert(ticketTypeRows);

      if (ttError) throw ttError;

      // Sync event to other sites
      try {
        const syncResult = await syncEvent(eventId);
        if (!syncResult.success) {
          console.warn('Event sync had issues:', syncResult.errors);
        }
      } catch (syncError) {
        console.error('Error syncing event:', syncError);
        // Don't fail the save if sync fails - event is still saved
      }

      toast({
        title: "Success",
        description: `Event ${editingEvent ? 'updated' : 'created'} successfully! ${editingEvent ? '' : 'Synced to main and purchase sites.'}`,
      });

      setEditDialogOpen(false);
      loadEvents();
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save event.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!eventToDelete) return;

    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured");
      }

      // Check if there are tickets for this event
      const { data: tickets, error: ticketsError } = await supabase
        .from("tickets")
        .select("id")
        .eq("event_id", eventToDelete.id)
        .limit(1);

      if (ticketsError) throw ticketsError;

      if (tickets && tickets.length > 0) {
        toast({
          variant: "destructive",
          title: "Cannot Delete",
          description: "This event has tickets associated with it. Cannot delete.",
        });
        setDeleteDialogOpen(false);
        return;
      }

      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventToDelete.id);

      if (error) throw error;

      toast({
        title: "Event Deleted",
        description: `Event "${eventToDelete.name}" has been deleted.`,
      });

      setDeleteDialogOpen(false);
      loadEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete event.",
      });
    }
  };

  const addTicketType = () => {
    setTicketTypes([...ticketTypes, { name: "", price: 0, capacity: 0 }]);
  };

  const removeTicketType = (index: number) => {
    setTicketTypes(ticketTypes.filter((_, i) => i !== index));
  };

  const updateTicketType = (index: number, field: keyof TicketType, value: string | number) => {
    const updated = [...ticketTypes];
    updated[index] = { ...updated[index], [field]: value };
    setTicketTypes(updated);
  };

  const getEventStats = async (eventId: string) => {
    try {
      const { data: tickets, error } = await supabase
        .from("tickets")
        .select("id, status, scanned_at, price")
        .eq("event_id", eventId);

      if (error) throw error;

      const totalTickets = tickets?.length || 0;
      const scannedTickets = tickets?.filter(t => t.scanned_at)?.length || 0;
      const revenue = tickets?.reduce((sum, t) => {
        const price = typeof t.price === 'string' ? parseFloat(t.price) : (parseFloat(t.price?.toString() || '0') || 0);
        return sum + price;
      }, 0) || 0;

      return { totalTickets, scannedTickets, revenue };
    } catch (error) {
      console.error('Error getting event stats:', error);
      return { totalTickets: 0, scannedTickets: 0, revenue: 0 };
    }
  };

  if (role !== 'owner') {
    return null;
  }

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="icon" onClick={() => setSettingsDialogOpen(true)}>
        <Settings className="h-4 w-4" />
      </Button>
      <Button onClick={handleCreateNew}>
        <Plus className="mr-2 h-4 w-4" />
        New Event
      </Button>
      <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Bulk Import
      </Button>
    </div>
  );

  return (
    <OwnerPortalLayout
      title="Event Management"
      subtitle="Plan and optimize events"
      description="Create and manage events, capacity, and ticket types."
      actions={headerActions}
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Events Table */}
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>
              Manage your events and ticket configurations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading events...
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No events found matching your search." : "No events yet. Create your first event!"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>Ticket Types</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => (
                      <EventRow
                        key={event.id}
                        event={event}
                        onEdit={handleEdit}
                        onDelete={(e) => {
                          setEventToDelete(e);
                          setDeleteDialogOpen(true);
                        }}
                        getStats={(eventId) => getEventStats(eventId)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit/Create Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? "Edit Event" : "Create New Event"}
              </DialogTitle>
              <DialogDescription>
                {editingEvent
                  ? "Update event details and ticket types."
                  : "Create a new event with capacity and ticket type configurations."}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Event Details</TabsTrigger>
                {editingEvent && (
                  <>
                    <TabsTrigger value="vip-setup">VIP Setup</TabsTrigger>
                    <TabsTrigger value="vip-reservations">VIP Reservations</TabsTrigger>
                  </>
                )}
              </TabsList>

              <TabsContent value="details" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="event-name">Event Name *</Label>
                <Input
                  id="event-name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g., Perreo Fridays"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="venue-name">Venue Name</Label>
                  <Input
                    id="venue-name"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="e.g., Club Maguey"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City (optional)</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Wilmington (default)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue-address">Venue Address</Label>
                <Input
                  id="venue-address"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="e.g., 123 Main St"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-status">Status *</Label>
                <Select value={eventStatus} onValueChange={(value: 'draft' | 'published' | 'archived') => setEventStatus(value)}>
                  <SelectTrigger id="event-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Draft
                      </div>
                    </SelectItem>
                    <SelectItem value="published">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Published
                      </div>
                    </SelectItem>
                    <SelectItem value="archived">
                      <div className="flex items-center gap-2">
                        <Archive className="h-4 w-4" />
                        Archived
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {eventStatus === 'draft' && 'Event is not visible to public'}
                  {eventStatus === 'published' && 'Event is visible on main and purchase sites'}
                  {eventStatus === 'archived' && 'Event is hidden but preserved'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-description">Description</Label>
                <RichTextEditor
                  content={eventDescription}
                  onChange={setEventDescription}
                  placeholder="Event description... (supports rich text formatting)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categories">Categories</Label>
                  <Input
                    id="categories"
                    value={categoriesInput}
                    onChange={(e) => setCategoriesInput(e.target.value)}
                    placeholder="Music, Nightlife, Latin (comma-separated)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated categories for organizing events
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="reggaeton, friday, vip (comma-separated)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated tags for filtering and search
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="event-date">Event Date *</Label>
                  <Input
                    id="event-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-time">Event Time *</Label>
                  <Input
                    id="event-time"
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Event Image / Flyer</Label>
                <div className="space-y-2">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Event preview"
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={removeImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Upload event flyer or image
                      </p>
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleImageSelect}
                        className="max-w-xs mx-auto"
                      />
                    </div>
                  )}
                  {imageFile && !imagePreview && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleImageUpload}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? "Uploading..." : "Upload Image"}
                    </Button>
                  )}
                  
                  {imageFile && openaiKey && (
                    <div className="mt-2 flex gap-2">
                       <Button
                        type="button"
                        variant="secondary"
                        onClick={handleScanFlyer}
                        disabled={isScanning || uploadingImage}
                        className="w-full"
                      >
                        <Wand2 className="mr-2 h-4 w-4" />
                        {isScanning ? "Reading Flyer..." : "Auto-fill Details from Flyer"}
                      </Button>
                    </div>
                  )}

                  {imageUrl && !imageFile && (
                    <p className="text-xs text-muted-foreground">
                      Current image URL: {imageUrl.substring(0, 50)}...
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Ticket Types *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTicketType}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Type
                  </Button>
                </div>
                <div className="space-y-3 border rounded-lg p-4">
                  {ticketTypes.map((ticketType, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={ticketType.name}
                          onChange={(e) => updateTicketType(index, "name", e.target.value)}
                          placeholder="e.g., VIP"
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Price ($)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={ticketType.price}
                          onChange={(e) => updateTicketType(index, "price", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Capacity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={ticketType.capacity}
                          onChange={(e) => updateTicketType(index, "capacity", parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTicketType(index)}
                          disabled={ticketTypes.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="text-sm text-muted-foreground mt-2">
                    Total Ticket Capacity: {ticketTypes.reduce((sum, tt) => sum + tt.capacity, 0)}
                  </div>
                </div>
              </div>
              </TabsContent>

              {editingEvent && (
                <>
                  <TabsContent value="vip-setup" className="py-4">
                    <VIPSetupManager 
                      eventId={editingEvent.id}
                      eventName={editingEvent.name}
                    />
                  </TabsContent>

                  <TabsContent value="vip-reservations" className="py-4">
                    <VIPReservationsList 
                      eventId={editingEvent.id}
                    />
                  </TabsContent>
                </>
              )}
            </Tabs>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingEvent ? "Update Event" : "Create Event"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Event</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{eventToDelete?.name}"? This action cannot be undone.
                Events with associated tickets cannot be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Import Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bulk Import Events</DialogTitle>
              <DialogDescription>
                Upload a CSV or Excel file to create multiple events at once.
                Download the template to see the required format.
              </DialogDescription>
            </DialogHeader>
            
            <EventBulkImport
              onImportComplete={() => {
                loadEvents();
                setImportDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Dashboard Settings</DialogTitle>
              <DialogDescription>
                Configure external integrations and preferences.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="openai-key">OpenAI API Key (for Flyer Scanning)</Label>
                <div className="flex gap-2">
                  <Input
                    id="openai-key"
                    type="password"
                    value={tempOpenaiKey}
                    onChange={(e) => setTempOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This key is stored locally on your device and used to scan flyers for event details.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </OwnerPortalLayout>
  );
};

interface EventRowProps {
  event: Event;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
  getStats: (eventId: string) => Promise<{ totalTickets: number; scannedTickets: number; revenue: number }>;
}

const EventRow = ({ event, onEdit, onDelete, getStats }: EventRowProps) => {
  const [stats, setStats] = useState<{ totalTickets: number; scannedTickets: number; revenue: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    loadStats();
  }, [event.id]);

  const loadStats = async () => {
    setLoadingStats(true);
    const eventStats = await getStats(event.id);
    setStats(eventStats);
    setLoadingStats(false);
  };

  const eventDate = new Date(event.event_date);
  const totalTicketCapacity = event.ticket_types.reduce((sum, tt) => sum + tt.capacity, 0);
  const timeDisplay = event.event_time || "20:00";

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {event.image_url && (
            <img
              src={event.image_url}
              alt={event.name}
              className="w-10 h-10 rounded object-cover"
            />
          )}
          <span>{event.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <div>{format(eventDate, "MMM d, yyyy")}</div>
            <div className="text-sm text-muted-foreground">
              {timeDisplay}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div>
          {event.venue_name && <div className="font-medium">{event.venue_name}</div>}
          {event.city && (
            <div className="text-sm text-muted-foreground">{event.city}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {event.ticket_types.map((tt, idx) => (
            <Badge key={idx} variant="secondary">
              {tt.name} (${tt.price})
            </Badge>
          ))}
        </div>
        {stats && (
          <div className="text-xs text-muted-foreground mt-1">
            {stats.totalTickets} sold • {totalTicketCapacity} capacity
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(event)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(event)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default EventManagement;


