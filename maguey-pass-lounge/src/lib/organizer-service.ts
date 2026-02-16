import { supabase } from "@/lib/supabase";

export interface OrganizerProfileInput {
  companyName: string;
  contactPhone?: string;
}

export interface OrganizerEventInput {
  name: string;
  description?: string;
  imageUrl?: string;
  venueName: string;
  venueAddress?: string;
  city?: string;
  eventDate: string;
  eventTime: string;
  ageRestriction?: string;
  seatingType?: string;
  status?: "draft" | "published" | "archived";
  isActive?: boolean;
  ticketTypes?: Array<{
    name: string;
    code?: string;
    price: number;
    fee?: number;
    totalInventory?: number | null;
    category?: "general" | "vip" | "service" | "section";
    sectionName?: string | null;
    sectionDescription?: string | null;
    displayOrder?: number;
  }>;
}

export interface OrganizerEventSummary {
  id: string;
  name: string;
  event_date: string;
  event_time: string;
  status: string | null;
  is_active: boolean | null;
  venue_name: string | null;
  city: string | null;
}

export interface EventAttendee {
  ticket_id: string;
  attendee_name: string | null;
  attendee_email: string | null;
  status: string;
  issued_at: string;
  ticket_type_name: string;
  qr_code_url: string | null;
  order_name: string | null;
}

async function requireAuthenticatedUser() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    throw new Error("You must be signed in to perform this action.");
  }
  return data.user;
}

async function getOrganizerProfileId(): Promise<string> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from("organizer_profiles")
    .select("id, verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Organizer profile not found. Please complete organizer registration.");
  }

  if (data.verification_status === "rejected") {
    throw new Error("Organizer profile has been rejected. Contact support for assistance.");
  }

  return data.id;
}

export async function ensureOrganizerProfile(input: OrganizerProfileInput) {
  const user = await requireAuthenticatedUser();

  const { error } = await supabase.from("organizer_profiles").upsert(
    {
      user_id: user.id,
      company_name: input.companyName,
      contact_phone: input.contactPhone || null,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
}

export async function createOrganizerEvent(payload: OrganizerEventInput) {
  const organizerId = await getOrganizerProfileId();
  const eventId = `evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

  const { error: eventError } = await supabase.from("events").insert({
    id: eventId,
    name: payload.name,
    description: payload.description || "",
    image_url: payload.imageUrl || "",
    venue_name: payload.venueName,
    venue_address: payload.venueAddress || "",
    city: payload.city || "",
    event_date: payload.eventDate,
    event_time: payload.eventTime,
    age_restriction: payload.ageRestriction || null,
    seating_type: payload.seatingType || null,
    status: payload.status || "draft",
    is_active: payload.isActive ?? true,
    organizer_id: organizerId,
  });

  if (eventError) {
    throw eventError;
  }

  if (payload.ticketTypes?.length) {
    const ticketRows = payload.ticketTypes.map((ticket, index) => ({
      event_id: eventId,
      code: ticket.code || ticket.name.toUpperCase().replace(/\s+/g, "_"),
      name: ticket.name,
      price: ticket.price,
      fee: ticket.fee ?? 0,
      total_inventory: ticket.totalInventory ?? null,
      category: ticket.category || "general",
      section_name: ticket.sectionName || null,
      section_description: ticket.sectionDescription || null,
      display_order: ticket.displayOrder ?? index,
    }));

    const { error: ticketError } = await supabase.from("ticket_types").insert(ticketRows);
    if (ticketError) {
      throw ticketError;
    }
  }

  return eventId;
}

export async function getOrganizerEvents(): Promise<OrganizerEventSummary[]> {
  try {
    const organizerId = await getOrganizerProfileId();
    const { data, error } = await supabase
      .from("events")
      .select("id, name, event_date, event_time, status, is_active, venue_name, city")
      .eq("organizer_id", organizerId)
      .order("event_date", { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("getOrganizerEvents error:", error);
    return [];
  }
}

export async function getAttendeesForEvent(eventId: string): Promise<EventAttendee[]> {
  try {
    await getOrganizerProfileId();
    const { data, error } = await supabase
      .from("tickets")
      .select(
        "ticket_id, attendee_name, attendee_email, status, issued_at, ticket_type_name, qr_code_url, orders(purchaser_name)"
      )
      .eq("event_id", eventId)
      .order("issued_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (
      data?.map((row) => ({
        ticket_id: row.ticket_id,
        attendee_name: row.attendee_name,
        attendee_email: row.attendee_email,
        status: row.status,
        issued_at: row.issued_at,
        ticket_type_name: row.ticket_type_name,
        qr_code_url: row.qr_code_url,
        order_name: row.orders?.purchaser_name || null,
      })) || []
    );
  } catch (error) {
    console.error("getAttendeesForEvent error:", error);
    return [];
  }
}

