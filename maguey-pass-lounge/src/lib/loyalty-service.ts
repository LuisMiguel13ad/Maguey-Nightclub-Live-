/**
 * Loyalty Service
 * Manages user loyalty points, credits, and membership tiers
 */

import { supabase } from './supabase';

export interface UserLoyalty {
  id: string;
  user_id: string | null;
  email: string;
  points: number;
  credits: number;
  membership_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  total_orders: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get or create loyalty record for a user
 */
export async function getOrCreateLoyalty(
  userId: string | null,
  email: string
): Promise<UserLoyalty | null> {
  try {
    // Try to find existing loyalty record
    let query = supabase.from('user_loyalty').select('*');
    
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('email', email);
    }
    
    const { data, error } = await query.maybeSingle();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error fetching loyalty:', error);
      return null;
    }
    
    if (data) {
      return data as UserLoyalty;
    }
    
    // Create new loyalty record
    const { data: newLoyalty, error: createError } = await supabase
      .from('user_loyalty')
      .insert({
        user_id: userId,
        email,
        points: 0,
        credits: 0,
        membership_tier: 'bronze',
        total_orders: 0,
        total_spent: 0,
      })
      .select()
      .single();
    
    if (createError || !newLoyalty) {
      console.error('Error creating loyalty record:', createError);
      return null;
    }
    
    return newLoyalty as UserLoyalty;
  } catch (error) {
    console.error('Error in getOrCreateLoyalty:', error);
    return null;
  }
}

/**
 * Award loyalty points for an order
 * Points are typically 1 point per $1 spent
 */
export async function awardLoyaltyPoints(
  userId: string | null,
  email: string,
  orderTotal: number,
  pointsMultiplier: number = 1
): Promise<boolean> {
  try {
    const loyalty = await getOrCreateLoyalty(userId, email);
    if (!loyalty) {
      return false;
    }
    
    const pointsToAward = Math.floor(orderTotal * pointsMultiplier);
    
    const { error } = await supabase
      .from('user_loyalty')
      .update({
        points: loyalty.points + pointsToAward,
        total_spent: loyalty.total_spent + orderTotal,
        total_orders: loyalty.total_orders + 1,
      })
      .eq('id', loyalty.id);
    
    if (error) {
      console.error('Error awarding loyalty points:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in awardLoyaltyPoints:', error);
    return false;
  }
}

/**
 * Add credits to user's account
 */
export async function addCredits(
  userId: string | null,
  email: string,
  amount: number
): Promise<boolean> {
  try {
    const loyalty = await getOrCreateLoyalty(userId, email);
    if (!loyalty) {
      return false;
    }
    
    const { error } = await supabase
      .from('user_loyalty')
      .update({
        credits: loyalty.credits + amount,
      })
      .eq('id', loyalty.id);
    
    if (error) {
      console.error('Error adding credits:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in addCredits:', error);
    return false;
  }
}

/**
 * Redeem credits for an order
 */
export async function redeemCredits(
  userId: string | null,
  email: string,
  amount: number
): Promise<boolean> {
  try {
    const loyalty = await getOrCreateLoyalty(userId, email);
    if (!loyalty) {
      return false;
    }
    
    if (loyalty.credits < amount) {
      return false; // Insufficient credits
    }
    
    const { error } = await supabase
      .from('user_loyalty')
      .update({
        credits: loyalty.credits - amount,
      })
      .eq('id', loyalty.id);
    
    if (error) {
      console.error('Error redeeming credits:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in redeemCredits:', error);
    return false;
  }
}

/**
 * Get loyalty status for a user
 */
export async function getLoyaltyStatus(
  userId: string | null,
  email: string
): Promise<UserLoyalty | null> {
  return getOrCreateLoyalty(userId, email);
}

/**
 * Convert points to credits (e.g., 100 points = $1 credit)
 */
export async function convertPointsToCredits(
  userId: string | null,
  email: string,
  points: number,
  conversionRate: number = 100 // points per $1 credit
): Promise<boolean> {
  try {
    const loyalty = await getOrCreateLoyalty(userId, email);
    if (!loyalty) {
      return false;
    }
    
    if (loyalty.points < points) {
      return false; // Insufficient points
    }
    
    const creditsToAdd = points / conversionRate;
    
    const { error } = await supabase
      .from('user_loyalty')
      .update({
        points: loyalty.points - points,
        credits: loyalty.credits + creditsToAdd,
      })
      .eq('id', loyalty.id);
    
    if (error) {
      console.error('Error converting points to credits:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in convertPointsToCredits:', error);
    return false;
  }
}

