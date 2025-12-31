import { supabase } from "@/lib/supabase";

export interface Promotion {
  id: string;
  code: string;
  discount_type: "amount" | "percent";
  amount: number;
  usage_limit: number | null;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
}

export async function fetchPromotion(code: string): Promise<Promotion | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("code", normalized)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("fetchPromotion error:", error);
    return null;
  }

  if (!data) return null;

  const now = new Date();
  if (data.valid_from && new Date(data.valid_from) > now) {
    console.warn("Promotion not yet valid");
    return null;
  }
  if (data.valid_to && new Date(data.valid_to) < now) {
    console.warn("Promotion expired");
    return null;
  }

  // Check usage_limit by counting redemptions
  if (data.usage_limit !== null) {
    const { count, error: countError } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("promo_code_id", data.id)
      .in("status", ["paid", "pending"]); // Count both paid and pending orders

    if (!countError && count !== null && count >= data.usage_limit) {
      console.warn("Promotion usage limit reached");
      return null;
    }
  }

  return {
    id: data.id,
    code: data.code,
    discount_type: data.discount_type === "percent" ? "percent" : "amount",
    amount: Number(data.amount),
    usage_limit: data.usage_limit,
    active: data.active,
    valid_from: data.valid_from,
    valid_to: data.valid_to,
  };
}


