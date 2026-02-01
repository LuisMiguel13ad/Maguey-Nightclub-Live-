
// Helper function to check if Supabase is configured
// Moved here to avoid circular dependencies and because integrations/client is auto-generated
export const isSupabaseConfigured = (): boolean => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    return !!(url && key &&
        url !== 'https://placeholder.supabase.co' &&
        key !== 'placeholder-key');
};
