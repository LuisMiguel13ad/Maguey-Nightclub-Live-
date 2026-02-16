import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image, apiKey } = await req.json()
    
    // Initialize OpenAI
    // Prioritize key passed in request body (from dashboard settings), fallback to env var
    const OPENAI_API_KEY = apiKey || Deno.env.get('OPENAI_API_KEY')
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API Key not configured. Please add it in Dashboard Settings.')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o", // Use a vision-capable model
        messages: [
          {
            role: "system",
            content: "You are an event assistant. Extract the following details from the event flyer image: Artist Name (as event name), Date (YYYY-MM-DD format), Time (HH:mm format 24h), Venue Name, City, and a short Description. Return ONLY a JSON object with keys: artist, date, time, venue, city, description."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract event details from this flyer." },
              { type: "image_url", image_url: { url: image } } // 'image' should be base64 data url
            ]
          }
        ],
        response_format: { type: "json_object" }
      })
    })

    const aiData = await response.json()
    
    if (!aiData.choices || !aiData.choices[0] || !aiData.choices[0].message) {
       // Check for OpenAI error response
       if (aiData.error) {
         throw new Error(`OpenAI Error: ${aiData.error.message}`)
       }
       throw new Error('Invalid response from OpenAI')
    }

    const result = JSON.parse(aiData.choices[0].message.content)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
