/**
 * Your pledge, read and written in the browser under RLS (migration 127): one
 * row, yours alone. A pledge charges nothing — it says you'd support letsee
 * at the price shown, and which perk you'd use most.
 */
import { supabase } from "@/utils/supabase/client";
import { isPerk, type Perk, type Price } from "@/lib/people/supporter";

export type Pledge = { currency: string; amount: number; mostWanted: Perk | null; createdAt: string };

export async function fetchMyPledge(me: string): Promise<Pledge | null> {
  const { data, error } = await supabase.from("supporter_pledges").select("currency, amount, most_wanted, created_at").eq("user_id", me).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { currency: data.currency as string, amount: data.amount as number, mostWanted: isPerk(data.most_wanted) ? data.most_wanted : null, createdAt: data.created_at as string };
}

export async function pledge(me: string, price: Price): Promise<boolean> {
  const { error } = await supabase.from("supporter_pledges").upsert({ user_id: me, currency: price.currency, amount: price.amount }, { onConflict: "user_id" });
  if (error) console.error("pledge:", error);
  return !error;
}

export async function setMostWanted(me: string, perk: Perk | null): Promise<boolean> {
  const { error } = await supabase.from("supporter_pledges").update({ most_wanted: perk }).eq("user_id", me);
  if (error) console.error("setMostWanted:", error);
  return !error;
}

export async function withdrawPledge(me: string): Promise<boolean> {
  const { error } = await supabase.from("supporter_pledges").delete().eq("user_id", me);
  if (error) console.error("withdrawPledge:", error);
  return !error;
}
