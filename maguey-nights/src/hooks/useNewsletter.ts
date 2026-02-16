import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface SubscribeResult {
  success: boolean;
  message: string;
  alreadySubscribed?: boolean;
}

export function useNewsletter() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const subscribe = async (email: string, source: string = 'website'): Promise<SubscribeResult> => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return { success: false, message: 'Invalid email address' };
    }

    try {
      // First, try to insert directly to Supabase
      const { data, error: insertError } = await supabase
        .from('newsletter_subscribers')
        .insert([{ email: email.toLowerCase().trim(), source }])
        .select()
        .single();

      if (insertError) {
        // Check if it's a duplicate email error (unique constraint violation)
        if (insertError.code === '23505') {
          setSuccess(true);
          setIsLoading(false);
          return {
            success: true,
            message: "You're already on the list! We'll keep you posted.",
            alreadySubscribed: true
          };
        }
        throw insertError;
      }

      // Call Edge Function to send welcome email
      try {
        await supabase.functions.invoke('newsletter-welcome', {
          body: { email: email.toLowerCase().trim() }
        });
      } catch (emailError) {
        // Don't fail the subscription if email sending fails
        console.warn('Welcome email could not be sent:', emailError);
      }

      setSuccess(true);
      setIsLoading(false);
      return { success: true, message: "You're in! Check your inbox for a welcome message." };

    } catch (err: any) {
      console.error('Newsletter subscription error:', err);
      const errorMessage = err.message || 'Something went wrong. Please try again.';
      setError(errorMessage);
      setIsLoading(false);
      return { success: false, message: errorMessage };
    }
  };

  const reset = () => {
    setError(null);
    setSuccess(false);
    setIsLoading(false);
  };

  return {
    subscribe,
    isLoading,
    error,
    success,
    reset
  };
}
