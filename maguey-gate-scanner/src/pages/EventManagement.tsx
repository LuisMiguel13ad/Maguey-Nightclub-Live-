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
  Ticket,
  Globe,
  Archive,
  FileText,
  Mail,
  Send,
  Users,
  CheckCircle,
  Loader2,
  Crown,
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
import { Upload, X, Image as ImageIcon, Wand2, Settings } from "lucide-react";
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
import { logAuditEvent } from "@/lib/audit-service";

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
  newsletter_sent_at: string | null;
  newsletter_sent_count: number;
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
    { name: "VIP Table", price: 250, capacity: 10 },
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

  // Newsletter notification state
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [eventToNotify, setEventToNotify] = useState<Event | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  // VIP section state for new events
  const [enableVipOnCreate, setEnableVipOnCreate] = useState(false);

  // Wizard step state for new event creation (1 = Event Details, 2 = VIP Setup)
  const [wizardStep, setWizardStep] = useState(1);

  // VIP table pricing configuration
  const [vipTablePricing, setVipTablePricing] = useState({
    premium: 750,
    front_row: 600,
    standard: 500,
  });

  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour < 12 ? "AM" : "PM";
    return {
      value: `${hour.toString().padStart(2, '0')}:${minute}`,
      label: `${hour12}:${minute} ${ampm}`
    };
  });

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

  const handleOpenNotifyDialog = async (event: Event) => {
    setEventToNotify(event);
    setCustomMessage("");
    setNotifyDialogOpen(true);

    // Fetch subscriber count
    try {
      const { count, error } = await supabase
        .from("newsletter_subscribers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (!error) {
        setSubscriberCount(count);
      }
    } catch (err) {
      console.error("Error fetching subscriber count:", err);
    }
  };

  const handleSendNotification = async () => {
    if (!eventToNotify) return;

    setSendingNotification(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-event-announcement", {
        body: {
          eventId: eventToNotify.id,
          customMessage: customMessage.trim() || undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Notification Sent!",
        description: data.message || `Announcement sent to ${data.sentCount} subscribers`,
      });

      setNotifyDialogOpen(false);
      loadEvents(); // Refresh to show updated newsletter status
    } catch (error: any) {
      console.error("Error sending notification:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send notification",
      });
    } finally {
      setSendingNotification(false);
    }
  };

  // Redirect employees (allow owners and promoters)
  useEffect(() => {
    if (role !== 'owner' && role !== 'promoter') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Event management is only available to owners and promoters.",
      });
      navigate("/scanner");
    }
  }, [role, navigate, toast]);

  // Load events
  useEffect(() => {
    if (role === 'owner' || role === 'promoter') {
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
        .select("id, name, description, event_date, event_time, venue_name, venue_address, city, image_url, status, published_at, categories, tags, created_at, updated_at, newsletter_sent_at, newsletter_sent_count")
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
        newsletter_sent_at: (event as any).newsletter_sent_at || null,
        newsletter_sent_count: (event as any).newsletter_sent_count || 0,
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
    setEventStatus('published');
    setCategories([]);
    setTags([]);
    setCategoriesInput("");
    setTagsInput("");
    setEnableVipOnCreate(false);
    // Reset wizard state for new event creation
    setWizardStep(1);
    setVipTablePricing({ premium: 750, front_row: 600, standard: 500 });
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

      // Enable VIP section and create VIP tables if requested for new events
      if (!editingEvent && enableVipOnCreate) {
        // Create VIP tables with custom pricing
        const vipTableTemplates = [
          { table_number: 1, tier: 'premium', table_name: 'Premium 1' },
          { table_number: 2, tier: 'premium', table_name: 'Premium 2' },
          { table_number: 3, tier: 'premium', table_name: 'Premium 3' },
          { table_number: 4, tier: 'front_row', table_name: 'Front Row 4' },
          { table_number: 5, tier: 'front_row', table_name: 'Front Row 5' },
          { table_number: 6, tier: 'front_row', table_name: 'Front Row 6' },
          { table_number: 7, tier: 'front_row', table_name: 'Front Row 7' },
          { table_number: 8, tier: 'standard', table_name: 'Standard 8' },
        ];

        const tablesToInsert = vipTableTemplates.map(t => ({
          event_id: eventId,
          table_number: t.table_number,
          table_name: t.table_name,
          tier: t.tier,
          price_cents: vipTablePricing[t.tier as keyof typeof vipTablePricing] * 100,
          capacity: t.tier === 'premium' ? 8 : 6,
          bottles_included: t.tier === 'premium' ? 2 : 1,
          is_available: true,
          is_active: true,
          display_order: t.table_number,
        }));

        const { error: tablesError } = await supabase
          .from('event_vip_tables')
          .insert(tablesToInsert);

        if (tablesError) {
          console.warn('Failed to create VIP tables:', tablesError);
          // Don't fail the event creation, just warn
        }

        // Update event to mark VIP as enabled
        const { error: vipError } = await supabase
          .from("events")
          .update({
            vip_enabled: true,
            vip_configured_at: new Date().toISOString(),
          })
          .eq("id", eventId);

        if (vipError) {
          console.warn('Failed to enable VIP section:', vipError);
          // Don't fail the event creation, just warn
        }
      }

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

      // Audit log: event created or updated
      logAuditEvent(
        editingEvent ? 'event_updated' : 'event_created',
        'event',
        `Event ${editingEvent ? 'updated' : 'created'}: ${eventName}`,
        {
          userId: user?.id,
          resourceId: eventId,
          severity: 'info',
          metadata: {
            eventName,
            eventDate,
            eventTime,
            status: eventStatus,
            ticketTypesCount: ticketTypes.length,
          },
        }
      ).catch(() => { }); // Non-blocking

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

      // Audit log: event deleted
      logAuditEvent('event_deleted', 'event', `Event deleted: ${eventToDelete.name}`, {
        userId: user?.id,
        resourceId: eventToDelete.id,
        severity: 'warning',
        metadata: {
          eventName: eventToDelete.name,
          eventDate: eventToDelete.event_date,
        },
      }).catch(() => { }); // Non-blocking

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

  if (role !== 'owner' && role !== 'promoter') {
    return null;
  }

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="icon" onClick={() => setSettingsDialogOpen(true)} className="border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20">
        <Settings className="h-4 w-4" />
      </Button>
      <Button onClick={handleCreateNew}>
        <Plus className="mr-2 h-4 w-4" />
        New Event
      </Button>
      <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20">
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
        <Card className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] shadow-[0_45px_90px_rgba(3,7,23,0.7)]">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-indigo-500/20 border-indigo-500/30 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-500/50"
              />
            </div>
          </CardContent>
        </Card>

        {/* Events Table */}
        <Card className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] shadow-[0_45px_90px_rgba(3,7,23,0.7)]">
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
                        onNotify={handleOpenNotifyDialog}
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
        <Dialog open={editDialogOpen} onOpenChange={(open) => {
          setEditDialogOpen(open);
          // Reset wizard state when dialog closes
          if (!open) {
            setWizardStep(1);
            setVipTablePricing({ premium: 750, front_row: 600, standard: 500 });
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#030712] border-white/10 text-white shadow-2xl backdrop-blur-xl">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                {editingEvent ? "Edit Event" : "Create New Event"}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingEvent
                  ? "Update event details and ticket types."
                  : wizardStep === 1
                    ? "Step 1: Enter event details and ticket configurations."
                    : "Step 2: Configure VIP table reservations."}
              </DialogDescription>
            </DialogHeader>

            {/* Step Indicator - Only show for new events */}
            {!editingEvent && (
              <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/10 my-2">
                {/* Step 1 */}
                <div className={`flex items-center gap-2 ${wizardStep >= 1 ? 'text-indigo-400' : 'text-slate-500'}`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    wizardStep >= 1 ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-400'
                  }`}>
                    1
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide hidden sm:inline">Event Details</span>
                </div>

                {/* Connector */}
                <div className={`flex-1 h-0.5 rounded-full ${wizardStep >= 2 ? 'bg-indigo-500' : 'bg-white/10'}`} />

                {/* Step 2 */}
                <div className={`flex items-center gap-2 ${wizardStep >= 2 ? 'text-indigo-400' : 'text-slate-500'}`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    wizardStep >= 2 ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-400'
                  }`}>
                    2
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide hidden sm:inline">VIP Setup</span>
                </div>
              </div>
            )}

            {/* Section indicator for edit mode */}
            {editingEvent && (
              <div className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-xl border border-white/10 my-2">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-8 bg-indigo-500 rounded-full" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Event Details</span>
                </div>
              </div>
            )}

            {/* For editing events - use Tabs */}
            {editingEvent ? (
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10 rounded-xl p-1">
                  <TabsTrigger value="details" className="rounded-lg data-[state=active]:bg-indigo-500/20 data-[state=active]:text-white">Event Details</TabsTrigger>
                  <TabsTrigger value="vip-setup" className="rounded-lg data-[state=active]:bg-indigo-500/20 data-[state=active]:text-white">VIP Setup</TabsTrigger>
                  <TabsTrigger value="vip-reservations" className="rounded-lg data-[state=active]:bg-indigo-500/20 data-[state=active]:text-white">VIP Reservations</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-6 py-6">
                <div className="space-y-2">
                  <Label htmlFor="event-name" className="text-slate-300 font-medium tracking-wide">Event Name *</Label>
                  <Input
                    id="event-name"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g., Perreo Fridays"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-indigo-500/20 h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-description" className="text-slate-300 font-medium tracking-wide">Description</Label>
                  <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <RichTextEditor
                      content={eventDescription}
                      onChange={setEventDescription}
                      placeholder="Event description... (supports rich text formatting)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-date" className="text-slate-300 font-medium tracking-wide">Event Date *</Label>
                    <Input
                      id="event-date"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="bg-white/5 border-white/10 text-white h-11 rounded-xl [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-time" className="text-slate-300 font-medium tracking-wide">Event Time *</Label>
                    <Select value={eventTime} onValueChange={setEventTime}>
                      <SelectTrigger id="event-time" className="bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-indigo-500/50 focus:ring-indigo-500/20">
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0b0f1a] border-white/10 text-white max-h-[300px]">
                        {timeSlots.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value} className="focus:bg-white/10 focus:text-white">
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>


                <div className="space-y-4">
                  <Label className="text-slate-300 font-medium tracking-wide">Event Image / Flyer</Label>
                  <div className="space-y-4">
                    {imagePreview ? (
                      <div className="relative group rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                        <img
                          src={imagePreview}
                          alt="Event preview"
                          className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="rounded-full h-10 w-10 p-0 shadow-lg"
                            onClick={removeImage}
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        </div>
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-white/20 backdrop-blur-md text-white border-white/20">Preview</Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-white/10 rounded-2xl p-10 text-center bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                        <div className="h-16 w-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <ImageIcon className="h-8 w-8 text-slate-400 group-hover:text-indigo-400" />
                        </div>
                        <p className="text-sm text-slate-300 font-medium mb-1">
                          Upload event flyer or image
                        </p>
                        <p className="text-xs text-slate-500 mb-6 font-normal">
                          Max resolution: 2000x2000px
                        </p>
                        <Input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={handleImageSelect}
                          className="max-w-xs mx-auto bg-white/5 border-white/10 text-white cursor-pointer"
                        />
                      </div>
                    )}

                    {imageFile && !imagePreview && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleImageUpload}
                        disabled={uploadingImage}
                        className="w-full h-11 border-indigo-500/30 bg-indigo-500/10 text-white hover:bg-indigo-500/20 rounded-xl"
                      >
                        {uploadingImage ? (
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            Uploading...
                          </div>
                        ) : "Upload Image"}
                      </Button>
                    )}

                    {imageFile && openaiKey && (
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleScanFlyer}
                          disabled={isScanning || uploadingImage}
                          className="w-full h-11 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white hover:from-indigo-500/30 hover:to-purple-500/30 border border-white/10 rounded-xl transition-all"
                        >
                          <Wand2 className="mr-2 h-4 w-4 text-indigo-400" />
                          {isScanning ? "Reading Flyer..." : "Auto-fill Details from Flyer"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 font-medium tracking-wide text-base">Ticket Types *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTicketType}
                      className="border-indigo-500/30 bg-indigo-500/10 text-white hover:bg-indigo-500/20 rounded-xl px-4"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Type
                    </Button>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                    {ticketTypes.map((ticketType, index) => (
                      <div key={index} className="grid grid-cols-12 gap-3 items-end p-4 rounded-xl bg-white/5 border border-white/5 shadow-sm transition-all hover:bg-white/10">
                        <div className="col-span-4 space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 ml-1">Name</Label>
                          <Input
                            value={ticketType.name}
                            onChange={(e) => updateTicketType(index, "name", e.target.value)}
                            placeholder="e.g., GA"
                            className="bg-white/5 border-white/10 text-white h-10 rounded-lg placeholder:text-slate-600"
                          />
                        </div>
                        <div className="col-span-3 space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 ml-1">Price ($)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ticketType.price}
                            onChange={(e) => updateTicketType(index, "price", parseFloat(e.target.value) || 0)}
                            className="bg-white/5 border-white/10 text-white h-10 rounded-lg"
                          />
                        </div>
                        <div className="col-span-3 space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 ml-1">Capacity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={ticketType.capacity}
                            onChange={(e) => updateTicketType(index, "capacity", parseInt(e.target.value) || 0)}
                            className="bg-white/5 border-white/10 text-white h-10 rounded-lg"
                          />
                        </div>
                        <div className="col-span-2 flex justify-center pb-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            onClick={() => removeTicketType(index)}
                            disabled={ticketTypes.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-2 pt-2">
                      <span className="text-xs text-slate-500 font-medium">Total Ticket Capacity</span>
                      <span className="text-sm font-bold text-white px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
                        {ticketTypes.reduce((sum, tt) => sum + tt.capacity, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

              </TabsContent>

                <TabsContent value="vip-setup" className="py-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 min-h-[400px]">
                    <VIPSetupManager
                      eventId={editingEvent.id}
                      eventName={editingEvent.name}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="vip-reservations" className="py-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 min-h-[400px]">
                    <VIPReservationsList
                      eventId={editingEvent.id}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              /* For new events - step-based wizard */
              <div className="w-full">
                {/* Step 1: Event Details */}
                {wizardStep === 1 && (
                  <div className="space-y-6 py-6">
                    <div className="space-y-2">
                      <Label htmlFor="event-name-new" className="text-slate-300 font-medium tracking-wide">Event Name *</Label>
                      <Input
                        id="event-name-new"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        placeholder="e.g., Perreo Fridays"
                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-indigo-500/20 h-11 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="event-description-new" className="text-slate-300 font-medium tracking-wide">Description</Label>
                      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                        <RichTextEditor
                          content={eventDescription}
                          onChange={setEventDescription}
                          placeholder="Event description... (supports rich text formatting)"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="event-date-new" className="text-slate-300 font-medium tracking-wide">Event Date *</Label>
                        <Input
                          id="event-date-new"
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="bg-white/5 border-white/10 text-white h-11 rounded-xl [color-scheme:dark]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="event-time-new" className="text-slate-300 font-medium tracking-wide">Event Time *</Label>
                        <Select value={eventTime} onValueChange={setEventTime}>
                          <SelectTrigger id="event-time-new" className="bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-indigo-500/50 focus:ring-indigo-500/20">
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0b0f1a] border-white/10 text-white max-h-[300px]">
                            {timeSlots.map((slot) => (
                              <SelectItem key={slot.value} value={slot.value} className="focus:bg-white/10 focus:text-white">
                                {slot.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-slate-300 font-medium tracking-wide">Event Image / Flyer</Label>
                      <div className="space-y-4">
                        {imagePreview ? (
                          <div className="relative group rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                            <img
                              src={imagePreview}
                              alt="Event preview"
                              className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="rounded-full h-10 w-10 p-0 shadow-lg"
                                onClick={removeImage}
                              >
                                <X className="h-5 w-5" />
                              </Button>
                            </div>
                            <div className="absolute top-4 left-4">
                              <Badge className="bg-white/20 backdrop-blur-md text-white border-white/20">Preview</Badge>
                            </div>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-white/10 rounded-2xl p-10 text-center bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                            <div className="h-16 w-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                              <ImageIcon className="h-8 w-8 text-slate-400 group-hover:text-indigo-400" />
                            </div>
                            <p className="text-sm text-slate-300 font-medium mb-1">
                              Upload event flyer or image
                            </p>
                            <p className="text-xs text-slate-500 mb-6 font-normal">
                              Max resolution: 2000x2000px
                            </p>
                            <Input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              onChange={handleImageSelect}
                              className="max-w-xs mx-auto bg-white/5 border-white/10 text-white cursor-pointer"
                            />
                          </div>
                        )}

                        {imageFile && !imagePreview && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleImageUpload}
                            disabled={uploadingImage}
                            className="w-full h-11 border-indigo-500/30 bg-indigo-500/10 text-white hover:bg-indigo-500/20 rounded-xl"
                          >
                            {uploadingImage ? (
                              <div className="flex items-center gap-2">
                                <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Uploading...
                              </div>
                            ) : "Upload Image"}
                          </Button>
                        )}

                        {imageFile && openaiKey && (
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={handleScanFlyer}
                              disabled={isScanning || uploadingImage}
                              className="w-full h-11 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white hover:from-indigo-500/30 hover:to-purple-500/30 border border-white/10 rounded-xl transition-all"
                            >
                              <Wand2 className="mr-2 h-4 w-4 text-indigo-400" />
                              {isScanning ? "Reading Flyer..." : "Auto-fill Details from Flyer"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-slate-300 font-medium tracking-wide text-base">Ticket Types *</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addTicketType}
                          className="border-indigo-500/30 bg-indigo-500/10 text-white hover:bg-indigo-500/20 rounded-xl px-4"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Type
                        </Button>
                      </div>
                      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                        {ticketTypes.map((ticketType, index) => (
                          <div key={index} className="grid grid-cols-12 gap-3 items-end p-4 rounded-xl bg-white/5 border border-white/5 shadow-sm transition-all hover:bg-white/10">
                            <div className="col-span-4 space-y-1.5">
                              <Label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 ml-1">Name</Label>
                              <Input
                                value={ticketType.name}
                                onChange={(e) => updateTicketType(index, "name", e.target.value)}
                                placeholder="e.g., GA"
                                className="bg-white/5 border-white/10 text-white h-10 rounded-lg placeholder:text-slate-600"
                              />
                            </div>
                            <div className="col-span-3 space-y-1.5">
                              <Label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 ml-1">Price ($)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={ticketType.price}
                                onChange={(e) => updateTicketType(index, "price", parseFloat(e.target.value) || 0)}
                                className="bg-white/5 border-white/10 text-white h-10 rounded-lg"
                              />
                            </div>
                            <div className="col-span-3 space-y-1.5">
                              <Label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 ml-1">Capacity</Label>
                              <Input
                                type="number"
                                min="1"
                                value={ticketType.capacity}
                                onChange={(e) => updateTicketType(index, "capacity", parseInt(e.target.value) || 0)}
                                className="bg-white/5 border-white/10 text-white h-10 rounded-lg"
                              />
                            </div>
                            <div className="col-span-2 flex justify-center pb-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                onClick={() => removeTicketType(index)}
                                disabled={ticketTypes.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between px-2 pt-2">
                          <span className="text-xs text-slate-500 font-medium">Total Ticket Capacity</span>
                          <span className="text-sm font-bold text-white px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
                            {ticketTypes.reduce((sum, tt) => sum + tt.capacity, 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: VIP Setup */}
                {wizardStep === 2 && (
                  <div className="space-y-6 py-6">
                    {/* VIP Enable Toggle */}
                    <Card className="border-white/10 bg-white/5">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-yellow-500/20 flex items-center justify-center">
                              <Crown className="h-5 w-5 text-yellow-500" />
                            </div>
                            <div>
                              <CardTitle className="text-lg text-white">VIP Table Reservations</CardTitle>
                              <CardDescription className="text-slate-400">
                                Allow customers to reserve VIP tables for this event
                              </CardDescription>
                            </div>
                          </div>
                          <Switch
                            checked={enableVipOnCreate}
                            onCheckedChange={setEnableVipOnCreate}
                            className="data-[state=checked]:bg-purple-500"
                          />
                        </div>
                      </CardHeader>
                    </Card>

                    {/* VIP Pricing Configuration */}
                    {enableVipOnCreate && (
                      <Card className="border-white/10 bg-white/5">
                        <CardHeader>
                          <CardTitle className="text-lg text-white flex items-center gap-2">
                            <Ticket className="h-5 w-5 text-indigo-400" />
                            Table Pricing
                          </CardTitle>
                          <CardDescription className="text-slate-400">
                            Set prices for each table tier. Default tables will be created for your event.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Premium Tables */}
                          <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-semibold text-white">Premium Tables (1-3)</h4>
                                <p className="text-xs text-slate-400">8 guests, 2 bottles included</p>
                              </div>
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Premium</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">$</span>
                              <Input
                                type="number"
                                min="0"
                                value={vipTablePricing.premium}
                                onChange={(e) => setVipTablePricing(prev => ({ ...prev, premium: Number(e.target.value) || 0 }))}
                                className="bg-white/5 border-white/10 text-white h-11 rounded-lg w-32"
                              />
                              <span className="text-slate-400">per table</span>
                            </div>
                          </div>

                          {/* Front Row Tables */}
                          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-semibold text-white">Front Row Tables (4-7)</h4>
                                <p className="text-xs text-slate-400">6 guests, 1 bottle included</p>
                              </div>
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Front Row</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">$</span>
                              <Input
                                type="number"
                                min="0"
                                value={vipTablePricing.front_row}
                                onChange={(e) => setVipTablePricing(prev => ({ ...prev, front_row: Number(e.target.value) || 0 }))}
                                className="bg-white/5 border-white/10 text-white h-11 rounded-lg w-32"
                              />
                              <span className="text-slate-400">per table</span>
                            </div>
                          </div>

                          {/* Standard Tables */}
                          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-500/10 to-gray-500/10 border border-slate-500/20">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-semibold text-white">Standard Tables (8+)</h4>
                                <p className="text-xs text-slate-400">6 guests, 1 bottle included</p>
                              </div>
                              <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Standard</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">$</span>
                              <Input
                                type="number"
                                min="0"
                                value={vipTablePricing.standard}
                                onChange={(e) => setVipTablePricing(prev => ({ ...prev, standard: Number(e.target.value) || 0 }))}
                                className="bg-white/5 border-white/10 text-white h-11 rounded-lg w-32"
                              />
                              <span className="text-slate-400">per table</span>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                            <p className="text-xs text-indigo-300">
                              8 VIP tables will be created automatically when you create this event. You can customize table details later in the VIP Setup tab.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {!enableVipOnCreate && (
                      <div className="text-center py-8 text-slate-400">
                        <Crown className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>VIP tables are disabled for this event.</p>
                        <p className="text-sm mt-1">Toggle the switch above to enable VIP reservations.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="border-t border-white/10 pt-6 mt-6 sm:justify-between items-center">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 hidden sm:block">
                {editingEvent ? "All changes are synced live" : `Step ${wizardStep} of 2`}
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                {/* For editing events or new events on step 2 - show cancel/back */}
                {editingEvent ? (
                  <Button
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                    disabled={saving}
                    className="flex-1 sm:flex-none h-11 rounded-xl border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  >
                    Cancel
                  </Button>
                ) : wizardStep === 1 ? (
                  <Button
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                    disabled={saving}
                    className="flex-1 sm:flex-none h-11 rounded-xl border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setWizardStep(1)}
                    disabled={saving}
                    className="flex-1 sm:flex-none h-11 rounded-xl border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  >
                    Back
                  </Button>
                )}

                {/* For editing events - Update button */}
                {editingEvent ? (
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 sm:flex-none h-11 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 text-white shadow-lg shadow-indigo-900/40 hover:scale-105 transition-transform"
                  >
                    {saving ? (
                      <div className="flex items-center gap-2 px-4">
                        <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Saving...
                      </div>
                    ) : (
                      <span className="px-4">Update Event</span>
                    )}
                  </Button>
                ) : wizardStep === 1 ? (
                  /* Step 1: Next button */
                  <Button
                    onClick={() => setWizardStep(2)}
                    className="flex-1 sm:flex-none h-11 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 text-white shadow-lg shadow-indigo-900/40 hover:scale-105 transition-transform"
                  >
                    <span className="px-4">Next</span>
                  </Button>
                ) : (
                  /* Step 2: Create Event button */
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 sm:flex-none h-11 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 text-white shadow-lg shadow-indigo-900/40 hover:scale-105 transition-transform"
                  >
                    {saving ? (
                      <div className="flex items-center gap-2 px-4">
                        <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Creating...
                      </div>
                    ) : (
                      <span className="px-4">Create Event</span>
                    )}
                  </Button>
                )}
              </div>
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

        {/* Newsletter Notification Dialog */}
        <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-500" />
                Notify Subscribers
              </DialogTitle>
              <DialogDescription>
                Send an email announcement about this event to all newsletter subscribers.
              </DialogDescription>
            </DialogHeader>

            {eventToNotify && (
              <div className="space-y-4 py-4">
                {/* Event Preview */}
                <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                  {eventToNotify.image_url && (
                    <img
                      src={eventToNotify.image_url}
                      alt={eventToNotify.name}
                      className="w-20 h-20 rounded object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold">{eventToNotify.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(eventToNotify.event_date), "EEEE, MMMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {eventToNotify.venue_name || "Maguey Delaware"}
                    </p>
                  </div>
                </div>

                {/* Subscriber Count */}
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <Users className="h-5 w-5 text-blue-500" />
                  <span className="text-sm">
                    {subscriberCount !== null ? (
                      <>This will be sent to <strong>{subscriberCount}</strong> active subscriber{subscriberCount !== 1 ? 's' : ''}</>
                    ) : (
                      "Loading subscriber count..."
                    )}
                  </span>
                </div>

                {/* Previous Notification Warning */}
                {eventToNotify.newsletter_sent_at && (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm text-amber-700">
                      Already sent to {eventToNotify.newsletter_sent_count} subscribers on{" "}
                      {format(new Date(eventToNotify.newsletter_sent_at), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                )}

                {/* Custom Message */}
                <div className="space-y-2">
                  <Label htmlFor="custom-message">Custom Message (Optional)</Label>
                  <Textarea
                    id="custom-message"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a personal message to include in the announcement..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    This message will appear highlighted in the email above the event details.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setNotifyDialogOpen(false)}
                disabled={sendingNotification}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendNotification}
                disabled={sendingNotification || subscriberCount === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sendingNotification ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Announcement
                  </>
                )}
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
  onNotify: (event: Event) => void;
  getStats: (eventId: string) => Promise<{ totalTickets: number; scannedTickets: number; revenue: number }>;
}

const EventRow = ({ event, onEdit, onDelete, onNotify, getStats }: EventRowProps) => {
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
  const hasBeenNotified = !!event.newsletter_sent_at;

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
          <div>
            <span>{event.name}</span>
            {hasBeenNotified && (
              <div className="flex items-center gap-1 text-xs text-emerald-500 mt-0.5">
                <CheckCircle className="h-3 w-3" />
                <span>Notified {event.newsletter_sent_count} subscribers</span>
              </div>
            )}
          </div>
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
            onClick={() => onNotify(event)}
            title={hasBeenNotified ? "Resend notification" : "Notify subscribers"}
            className={hasBeenNotified ? "text-emerald-500" : "text-blue-500"}
          >
            <Mail className="h-4 w-4" />
          </Button>
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


