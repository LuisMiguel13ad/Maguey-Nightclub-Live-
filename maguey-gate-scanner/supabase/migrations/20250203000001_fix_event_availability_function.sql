-- Migration: Fix Event Availability Function
-- Updates get_event_availability to use ticket_types table and calculate correctly

-- Drop old function
DROP FUNCTION IF EXISTS public.get_event_availability(text);

-- Create updated function that uses ticket_types table
CREATE OR REPLACE FUNCTION public.get_event_availability(event_name_param text)
RETURNS TABLE (
  event_name text,
  total_capacity integer,
  tickets_sold bigint,
  tickets_available bigint,
  ticket_types jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH event_ticket_types AS (
    SELECT 
      e.id as event_id,
      e.name,
      COALESCE(SUM(tt.total_inventory), 0)::integer as total_capacity,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'name', tt.name,
            'price', tt.price,
            'capacity', tt.total_inventory
          )
        ) FILTER (WHERE tt.id IS NOT NULL),
        '[]'::jsonb
      ) as ticket_types_json
    FROM public.events e
    LEFT JOIN public.ticket_types tt ON tt.event_id = e.id
    WHERE e.name = event_name_param 
      AND (e.status = 'published' OR e.status IS NULL OR e.status = 'draft')
    GROUP BY e.id, e.name
  ),
  tickets_sold_count AS (
    SELECT 
      COUNT(t.id)::bigint as sold_count
    FROM public.tickets t
    WHERE t.event_name = event_name_param
      AND (t.status IN ('issued', 'used', 'scanned') OR t.status IS NULL)
  )
  SELECT 
    ett.name as event_name,
    ett.total_capacity,
    COALESCE(tsc.sold_count, 0) as tickets_sold,
    GREATEST(0, ett.total_capacity - COALESCE(tsc.sold_count, 0)) as tickets_available,
    COALESCE(ett.ticket_types_json, '[]'::jsonb) as ticket_types
  FROM event_ticket_types ett
  LEFT JOIN tickets_sold_count tsc ON true
  WHERE ett.name = event_name_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_ticket_count_by_type to use event_id and ticket_type_id
CREATE OR REPLACE FUNCTION public.get_ticket_count_by_type(event_name_param text, ticket_type_param text)
RETURNS integer AS $$
DECLARE
  count_result integer;
  event_id_val uuid;
  ticket_type_id_val uuid;
BEGIN
  -- Get event ID
  SELECT id INTO event_id_val
  FROM public.events
  WHERE name = event_name_param;
  
  IF event_id_val IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get ticket type ID
  SELECT id INTO ticket_type_id_val
  FROM public.ticket_types
  WHERE event_id = event_id_val AND name = ticket_type_param;
  
  IF ticket_type_id_val IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Count sold tickets (only issued, used, scanned statuses)
  SELECT COUNT(*) INTO count_result
  FROM public.tickets
  WHERE event_id = event_id_val 
    AND ticket_type_id = ticket_type_id_val
    AND status IN ('issued', 'used', 'scanned');
  
  RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_event_availability IS 'Returns real-time ticket availability for an event using ticket_types table';
COMMENT ON FUNCTION public.get_ticket_count_by_type IS 'Returns count of sold tickets for a specific event and ticket type';

