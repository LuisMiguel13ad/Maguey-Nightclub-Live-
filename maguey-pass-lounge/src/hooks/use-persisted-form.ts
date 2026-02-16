import { useState, useCallback } from "react";

const STORAGE_KEY = "maguey_checkout_form";

interface CheckoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface UsePersistedFormReturn {
  formData: Partial<CheckoutFormData>;
  setFormField: <K extends keyof CheckoutFormData>(
    field: K,
    value: CheckoutFormData[K]
  ) => void;
  clearForm: () => void;
  hasPersistedData: boolean;
}

/**
 * Persists checkout form data to localStorage for returning visitors.
 * Per context decision: Remember name/email for faster checkout.
 *
 * Handles quota exceeded errors gracefully per RESEARCH pitfall #4.
 */
export function usePersistedForm(): UsePersistedFormReturn {
  const [formData, setFormData] = useState<Partial<CheckoutFormData>>(() => {
    if (typeof window === "undefined") return {};

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore specific fields (not phone for privacy)
        return {
          firstName: parsed.firstName || "",
          lastName: parsed.lastName || "",
          email: parsed.email || "",
        };
      }
    } catch (err) {
      console.warn("[usePersistedForm] Failed to load:", err);
    }
    return {};
  });

  const [hasPersistedData] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved !== null && saved !== "{}";
    } catch {
      return false;
    }
  });

  // Persist changes to localStorage
  const persistToStorage = useCallback((data: Partial<CheckoutFormData>) => {
    try {
      // Only persist essential fields (name, email) - not phone
      const toPersist = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
    } catch (err) {
      // Quota exceeded - silently fail (per RESEARCH pitfall #4)
      console.warn("[usePersistedForm] Failed to persist:", err);
    }
  }, []);

  const setFormField = useCallback(
    <K extends keyof CheckoutFormData>(field: K, value: CheckoutFormData[K]) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value };
        persistToStorage(next);
        return next;
      });
    },
    [persistToStorage]
  );

  const clearForm = useCallback(() => {
    setFormData({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore errors
    }
  }, []);

  return {
    formData,
    setFormField,
    clearForm,
    hasPersistedData,
  };
}
