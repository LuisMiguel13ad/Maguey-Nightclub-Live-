# Supabase Integration Setup

This project uses Supabase to fetch and display events dynamically.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project settings:
1. Go to https://app.supabase.com
2. Select your project
3. Navigate to Settings > API
4. Copy the "Project URL" and "anon public" key

## Database Schema

Create a table named `events` in your Supabase database with the following structure:

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  artist TEXT,
  title TEXT,
  description TEXT,
  time TEXT,
  price TEXT,
  venue TEXT,
  address TEXT,
  image TEXT,
  event_id TEXT UNIQUE,
  features TEXT[],
  purchase_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster queries
CREATE INDEX idx_events_active_date ON events(is_active, event_date);
```

## Row Level Security (RLS)

Enable RLS and create a policy to allow public read access:

```sql
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active events"
ON events FOR SELECT
USING (is_active = true);
```

## Usage

The application automatically fetches active events from Supabase when the pages load. Events are:
- Filtered by `is_active = true`
- Ordered by `event_date` ascending
- Displayed on the home page and upcoming events page

If an event has a `purchase_url`, the "Buy Tickets" button will link to that external URL. Otherwise, it will link to the internal checkout page.

