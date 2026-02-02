import { GenreList } from "@/staticData/genreList";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    console.log("User isn't logged in");
    return NextResponse.json(
      { error: "User isn't logged in" },
      { status: 401 }
    );
  }

  const userId = data.user.id;
  const tmdbKey = process.env.TMDB_API_KEY;
  const googleKey = process.env.GOOGLE_KEY;

  if (!tmdbKey) {
    return NextResponse.json(
      { error: "TMDB_API_KEY is missing on the server." },
      { status: 500 }
    );
  }

  if (!googleKey) {
    return NextResponse.json(
      { error: "GOOGLE_KEY is missing on the server." },
      { status: 500 }
    );
  }

  try {
    // Fetch user's favorite movies
    const { data: userFavorites, error: userFavoritesError }: any =
      await supabase
        .from("favorite_items")
        .select("item_name")
        .eq("user_id", userId);

    const { data: userWatched, error: userWatchedError }: any = await supabase
      .from("watched_items")
      .select("item_name")
      .eq("user_id", userId);

    if (userFavoritesError || userWatchedError) {
      return NextResponse.json(
        { error: "Failed to fetch user preferences." },
        { status: 500 }
      );
    }

    const favoriteList = Array.isArray(userFavorites) ? userFavorites : [];
    const watchedList = Array.isArray(userWatched) ? userWatched : [];

    const favoriteTitles = favoriteList
      .map((movie: any) => movie.item_name)
      .join(", ");
    const watchedTitles = watchedList
      .map((movie: any) => movie.item_name)
      .join(", ");

    const prompt = `I have watched and liked the following movies: ${favoriteTitles}. 
Additionally, I have watched these movies: ${watchedTitles}.

Based on my preferences, recommend 5 movies I might like. The recommended movies must:
1. Not be in the list of movies I have already watched or favorited.
2. Be relevant to my preferences.
3. Be returned as a comma-separated list of movie titles only.

Do not include any additional text, explanations, or formatting. Just return the 5 movie titles as a comma-separated list.
`;
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Gemini request failed.",
          upstream_status: geminiResponse.status,
          upstream_message: errorText || geminiResponse.statusText,
        },
        { status: 502 }
      );
    }

    const geminiData = await geminiResponse.json();
    console.log(geminiData);
    const suggestedTitlesText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!suggestedTitlesText) {
      return NextResponse.json(
        { error: "Invalid Gemini response" },
        { status: 500 }
      );
    }

    const suggestedTitles = suggestedTitlesText
      .split(",")
      .map((title: string) => title.trim());

    // Fetch genre list from TMDB
    const { genres } = GenreList;

    const moviePromises = suggestedTitles.map(
      async (title: string | number | boolean) => {
        try {
          const tmdbSearchResponse = await fetch(
            `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(
              title
            )}`
          );
          if (!tmdbSearchResponse.ok) {
            console.error(
              `TMDB search failed for ${title}: ${tmdbSearchResponse.status}`
            );
            return null;
          }
          const tmdbSearchData = await tmdbSearchResponse.json();

          if (tmdbSearchData.results && tmdbSearchData.results.length > 0) {
            const movie = tmdbSearchData.results[0];

            // Map genre IDs to genre names
            const genreNames = movie.genre_ids
              .map((id: number) => {
                const genre = genres.find((g: any) => g.id === id);
                return genre ? genre.name : null;
              })
              .filter(Boolean); // Remove null values

            return {
              name: movie.title,
              poster_url: movie.poster_path
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : null,
              tmdb_id: movie.id,
              genres: genreNames, // Use genre names instead of IDs
            };
          } else {
            console.log(`No TMDB match found for: ${title}`);
            return null; // Or handle no match differently
          }
        } catch (tmdbError) {
          console.error(`TMDB search error for ${title}:`, tmdbError);
          return null;
        }
      }
    );

    const movies = (await Promise.all(moviePromises)).filter(Boolean); // Filter out null results
    return NextResponse.json(movies);
  } catch (error) {
    console.error("Recommendation error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
