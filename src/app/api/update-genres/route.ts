import { createClient } from "@/utils/supabase/server";
import { fetchTmdb } from "@/utils/tmdbClient";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

interface WatchedItem {
  id: number;
  item_id: number;
  item_type: string;
  genres: string[] | null;
}

interface TMDBGenre {
  name: string;
}

interface TMDBResponse {
  genres: TMDBGenre[];
}

async function fetchGenres(item: WatchedItem): Promise<string[] | null> {
  try {
    const tmdbUrl = `https://api.themoviedb.org/3/${item.item_type}/${item.item_id}?api_key=${TMDB_API_KEY}&language=en-US`;
    const response = await fetchTmdb(tmdbUrl, { timeoutMs: 15000 });

    if (!response.ok) {
      console.error(
        `Failed to fetch data for item ${item.item_id}: ${response.statusText}`
      );
      return null;
    }

    const tmdbData: TMDBResponse = await response.json();
    return tmdbData.genres.map((genre: TMDBGenre) => genre.name);
  } catch (error) {
    console.error(`Error fetching TMDB data for item ${item.item_id}:`, error);
    return null;
  }
}
// API route function
export async function POST(req: Request) {
  try {
    if (!TMDB_API_KEY) {
      return new Response(
        JSON.stringify({ error: "TMDB_API_KEY is missing on the server." }),
        { status: 500 }
      );
    }

    const supabase = await createClient();

    // Fetch watched items with null genres
    const { data: watchedItems, error } = await supabase
      .from("favorite_items")
      .select("*")
      .is("genres", null);

    if (error) {
      console.error("Supabase fetch error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }

    if (!watchedItems || watchedItems.length === 0) {
      return new Response(JSON.stringify({ message: "No items to update" }), {
        status: 200,
      });
    }

    for (const item of watchedItems) {
      const genres = await fetchGenres(item);
      if (genres) {
        const { error: updateError } = await supabase
          .from("favorite_items")
          .update({ genres })
          .eq("id", item.id);

        if (updateError) {
          console.error(`Error updating item ${item.item_id}:`, updateError);
        }
      }
      console.log(`Updated genres for item ${item.item_id}:`, genres);
      await delay(250); // Respect TMDB rate limits (4 requests per second)
    }

    return new Response(
      JSON.stringify({ message: "Genres updated successfully" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating genres:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}
