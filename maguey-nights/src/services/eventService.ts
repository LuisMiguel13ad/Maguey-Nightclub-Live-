import { supabase } from '@/lib/supabase'
import { getCheckoutUrlForEvent } from '@/lib/purchaseSiteConfig'
import { 
  Result, 
  AsyncResult, 
  ok, 
  err, 
  isOk 
} from '@/lib/result'
import {
  AppError,
  EventNotFoundError,
  DatabaseError,
} from '@/lib/errors'
import { createLogger } from '@/lib/logger'

// Create module-scoped logger
const logger = createLogger({ module: 'event-service' })

export interface SupabaseEvent {
  id: string
  name: string
  description?: string | null
  event_date: string
  event_time: string
  venue_name?: string
  venue_address?: string
  city?: string
  image_url?: string
  banner_url?: string | null
  genre?: string
  event_category?: string | null
  status?: string | null
  created_at?: string
  updated_at?: string
  tags?: string[] // Tags will be populated from join query
}

export interface TicketAvailability {
  ticketTypeCode: string
  available: number
  total: number
  sold: number
}

export interface EventAvailability {
  eventName: string
  ticketTypes: TicketAvailability[]
}

export interface EventDisplay {
  id: string
  artist: string
  date: string
  time: string
  price: string
  description: string
  features: string[]
  venue: string
  address: string
  locationLine: string
  image: string
  bannerUrl?: string
  tags: string[]
  eventId: string
  purchaseUrl?: string
  category?: string
  status?: string
  eventDate: string
  eventTime: string
  scheduleLabel: string
}

// Transform Supabase event to display format
const transformEvent = (event: SupabaseEvent): EventDisplay => {
  const parseLocalDate = (dateString: string) => {
    if (!dateString) {
      return null
    }
    const [yearStr, monthStr, dayStr] = dateString.split('-')
    const year = Number(yearStr)
    const monthIndex = Number(monthStr) - 1
    const day = Number(dayStr)
    if (
      Number.isNaN(year) ||
      Number.isNaN(monthIndex) ||
      Number.isNaN(day) ||
      monthIndex < 0 ||
      monthIndex > 11 ||
      day < 1 ||
      day > 31
    ) {
      return null
    }
    return new Date(year, monthIndex, day)
  }

  // Format date from ISO string to display format
  const formatDateParts = (dateString: string) => {
    const date = parseLocalDate(dateString)
    if (!date || Number.isNaN(date.getTime())) {
      return {
        monthShort: 'TBD',
        dayNumber: '',
        weekdayFull: 'TBD',
        weekdayShort: 'TBD',
        monthTitleCase: 'TBD'
      }
    }
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
    const month = months[date.getMonth()]
    const day = date.getDate()
    const dayName = days[date.getDay()]
    return {
      monthShort: month,
      monthTitleCase: month.charAt(0) + month.slice(1).toLowerCase(),
      dayNumber: day.toString().padStart(2, '0'),
      weekdayFull: dayName,
      weekdayShort: dayName.substring(0, 3)
    }
  }

  // Format time from HH:MM:SS to display format
  const formatTime = (timeString: string): string => {
    if (!timeString) return 'TBD'
    const [hourStr, minuteStr] = timeString.split(':')
    if (!hourStr || !minuteStr) return timeString
    const date = new Date()
    date.setHours(Number(hourStr), Number(minuteStr))
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatCategory = (category?: string | null): string | undefined => {
    if (!category) return undefined
    return category
      .split(/[_\s]+/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  const dateParts = formatDateParts(event.event_date)
  const formattedTime = formatTime(event.event_time)
  const scheduleSegments: string[] = []
  if (dateParts.weekdayShort !== 'TBD') {
    scheduleSegments.push(dateParts.weekdayShort.charAt(0).toUpperCase() + dateParts.weekdayShort.slice(1).toLowerCase())
  }
  if (dateParts.monthTitleCase !== 'TBD') {
    scheduleSegments.push(`${dateParts.monthTitleCase} ${parseInt(dateParts.dayNumber || '0', 10) || ''}`.trim())
  }
  let scheduleLabel = scheduleSegments.length > 0 ? scheduleSegments.join(' | ') : 'Date TBA'
  if (formattedTime && formattedTime !== 'TBD') {
    scheduleLabel = `${scheduleLabel}, ${formattedTime}`
  }

  const locationParts: string[] = []
  if (event.venue_name) {
    locationParts.push(event.venue_name)
  }
  if (event.city) {
    locationParts.push(event.city)
  } else if (event.venue_address) {
    locationParts.push(event.venue_address)
  }
  const defaultLocation = 'Maguey Delaware • Wilmington, DE'
  const locationLine = locationParts.length > 0 ? locationParts.join(' • ') : defaultLocation

  const displayDay = dateParts.dayNumber ? parseInt(dateParts.dayNumber, 10).toString() : ''
  const dateDisplayParts = [dateParts.monthShort, displayDay, dateParts.weekdayFull].filter(Boolean)

  return {
    id: event.id,
    artist: event.name || 'Event',
    date: dateDisplayParts.join(' ').trim(),
    time: formattedTime,
    price: 'TBD', // Price comes from ticket types now
    description: event.description || '',
    features: [], // Features not in new schema
    venue: event.venue_name || 'MAGUEY DELAWARE',
    address: event.venue_address ? `${event.venue_address}, ${event.city || ''}` : '123 Main Street, Wilmington, DE 19801',
    locationLine,
    image: event.image_url || '/placeholder.svg',
    bannerUrl: event.banner_url || undefined,
    tags: event.tags || [],
    eventId: event.id,
    purchaseUrl: getCheckoutUrlForEvent(event.id), // Generate checkout URL
    category: formatCategory(event.event_category),
    status: event.status || undefined,
    eventDate: event.event_date,
    eventTime: event.event_time,
    scheduleLabel,
  }
}

// Fetch active events from Supabase (Result-based version)
export const fetchActiveEventsResult = async (): AsyncResult<EventDisplay[], AppError> => {
  const done = logger.time('fetchActiveEvents')
  logger.debug('Fetching active events')
  
  const today = new Date().toISOString().split('T')[0]
  
  const { data: eventsData, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .eq('is_active', true)
    .gte('event_date', today)
    .order('event_date', { ascending: true })

  if (eventsError) {
    logger.error('Failed to fetch active events', eventsError)
    done()
    return err(new DatabaseError('fetchActiveEvents', eventsError))
  }

  if (!eventsData || eventsData.length === 0) {
    logger.info('No active events found')
    done()
    return ok([])
  }

  // Fetch tags for all events
  const eventIds = eventsData.map(e => e.id)
  const tagsByEventId: Record<string, string[]> = {}
  
  if (eventIds.length > 0) {
    const { data: tagMapData } = await supabase
      .from('event_tag_map')
      .select(`event_id, tag_id, event_tags (name)`)
      .in('event_id', eventIds)

    if (tagMapData) {
      tagMapData.forEach((map: any) => {
        if (!tagsByEventId[map.event_id]) {
          tagsByEventId[map.event_id] = []
        }
        if (map.event_tags?.name) {
          tagsByEventId[map.event_id].push(map.event_tags.name)
        }
      })
    }
  }

  const events = eventsData.map(event => {
    const eventWithTags = { ...event, tags: tagsByEventId[event.id] || [] }
    return transformEvent(eventWithTags)
  })

  logger.info('Fetched active events', { count: events.length })
  done()

  return ok(events)
}

// Fetch active events from Supabase (only published events with is_active = true)
// Includes tags via join query
// @deprecated Use fetchActiveEventsResult for better error handling
export const fetchActiveEvents = async (): Promise<EventDisplay[]> => {
  const result = await fetchActiveEventsResult()
  
  if (isOk(result)) {
    return result.data
  }
  
  // Error already logged in fetchActiveEventsResult
  return []
}

// Fetch event by ID (Result-based version)
export const fetchEventByIdResult = async (eventId: string): AsyncResult<EventDisplay, AppError> => {
  const log = logger.child({ eventId })
  const done = log.time('fetchEventById')
  
  log.debug('Fetching event by ID')

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      log.warn('Event not found')
      done()
      return err(new EventNotFoundError(eventId))
    }
    log.error('Failed to fetch event', error)
    done()
    return err(new DatabaseError('fetchEventById', error))
  }

  if (!data) {
    log.warn('Event not found')
    done()
    return err(new EventNotFoundError(eventId))
  }

  // Fetch tags for this event
  const tags: string[] = []
  const { data: tagMapData } = await supabase
    .from('event_tag_map')
    .select(`tag_id, event_tags (name)`)
    .eq('event_id', eventId)

  if (tagMapData) {
    tagMapData.forEach((map: any) => {
      if (map.event_tags?.name) {
        tags.push(map.event_tags.name)
      }
    })
  }

  const eventWithTags = { ...data, tags }
  
  log.info('Event fetched successfully', { eventName: data.name })
  done()
  
  return ok(transformEvent(eventWithTags))
}

// Fetch event by ID (includes tags)
// @deprecated Use fetchEventByIdResult for better error handling
export const fetchEventById = async (eventId: string): Promise<EventDisplay | null> => {
  const result = await fetchEventByIdResult(eventId)
  
  if (isOk(result)) {
    return result.data
  }
  
  // Error already logged in fetchEventByIdResult
  return null
}

// Fetch real-time availability from Scanner API
export const fetchEventAvailability = async (eventName: string): Promise<EventAvailability | null> => {
  const log = logger.child({ eventName })
  const done = log.time('fetchEventAvailability')
  
  // Get environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    log.warn('Supabase credentials not configured, skipping availability check')
    return null
  }

  try {
    log.debug('Fetching event availability from API')
    
    const headers: Record<string, string> = {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/event-availability/${encodeURIComponent(eventName)}`,
      {
        method: 'GET',
        headers,
      }
    )

    if (!response.ok) {
      log.warn('Availability API returned error', { status: response.status })
      done()
      return null
    }

    const data = await response.json()
    
    log.info('Fetched event availability', { 
      ticketTypeCount: data?.ticketTypes?.length || 0 
    })
    done()
    
    return data as EventAvailability
  } catch (error) {
    log.error('Failed to fetch availability from API', error)
    done()
    return null
  }
}

