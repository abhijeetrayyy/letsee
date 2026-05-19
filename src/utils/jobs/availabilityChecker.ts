import { createAdminClient } from "@/utils/supabase/server";
import { serverFetchJson } from "@/utils/serverFetch";

const TMDB_BASE = "https://api.themoviedb.org/3";

type WatchProviderItem = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
};

type WatchProviderData = {
  results: Record<string, {
    flatrate?: WatchProviderItem[];
    rent?: WatchProviderItem[];
    buy?: WatchProviderItem[];
  }>;
};

/**
 * Check streaming availability for all watchlist items of users who have opted in.
 */
export async function checkWatchlistAvailability(): Promise<{ checked: number; alerts: number }> {
  const supabase = await createAdminClient();
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY is missing");

  const { data: optedInUsers } = await supabase
    .from("user_notification_prefs")
    .select("user_id")
    .eq("notify_streaming_changes", true);

  if (!optedInUsers?.length) return { checked: 0, alerts: 0 };

  const userIds = optedInUsers.map((u) => u.user_id);
  let checked = 0;
  let alerts = 0;

  for (const userId of userIds) {
    const { data: watchlist } = await supabase
      .from("user_watchlist")
      .select("item_id, item_type, item_name")
      .eq("user_id", userId);

    if (!watchlist?.length) continue;

    for (const item of watchlist) {
      checked++;

      try {
        const endpoint = item.item_type === "movie" ? "movie" : "tv";
        const url = `${TMDB_BASE}/${endpoint}/${item.item_id}/watch/providers?api_key=${apiKey}`;
        const data = await serverFetchJson<WatchProviderData>(url);
        const usProviders = data.results?.["US"];

        if (!usProviders) continue;

        const availableProviders = [
          ...(usProviders.flatrate ?? []),
          ...(usProviders.rent ?? []),
          ...(usProviders.buy ?? []),
        ];

        for (const provider of availableProviders) {
          const { data: existing } = await supabase
            .from("watchlist_alerts")
            .select("id")
            .eq("user_id", userId)
            .eq("item_id", item.item_id)
            .eq("item_type", item.item_type)
            .eq("provider_name", provider.provider_name)
            .eq("alert_type", "added")
            .maybeSingle();

          if (!existing) {
            await supabase.from("watchlist_alerts").insert({
              user_id: userId,
              item_id: item.item_id,
              item_type: item.item_type,
              provider_name: provider.provider_name,
              alert_type: "added",
            });
            alerts++;
          }
        }
      } catch {
        // skip items where provider data is unavailable
      }
    }
  }

  return { checked, alerts };
}
