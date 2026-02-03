import Link from "next/link";
import {
  Film,
  Search,
  Share2,
  Video,
  List,
  TvMinimal,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-700 text-white">
      {/* Hero Section */}
      <header className="relative py-20 text-center px-4">
        <div className="absolute inset-0 bg-linear-to-b from-neutral-900/50 to-neutral-700" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Track. Share. Discover.
          </h1>
          <p className="text-lg sm:text-xl text-neutral-300 mb-8">
            Your social hub for movies and TV — watchlists, where to stream, AI
            recommendations, and friends.
          </p>
          <Link
            href="/app"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-lg transition"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 text-neutral-100">
          What you can do
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          <div className="bg-neutral-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:-translate-y-1">
            <List className="w-12 h-12 text-indigo-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-neutral-100">
              Your lists
            </h3>
            <p className="text-neutral-400 mb-4 text-sm">
              Watchlist, favorites, and watched — all in one place with genre
              stats on your profile.
            </p>
            <Link
              href="/app/profile"
              className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-lg transition text-sm font-medium"
            >
              View lists
            </Link>
          </div>

          <div className="bg-neutral-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:-translate-y-1">
            <TvMinimal className="w-12 h-12 text-indigo-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-neutral-100">
              Where to watch
            </h3>
            <p className="text-neutral-400 mb-4 text-sm">
              See streaming options for every movie and show — Netflix, Prime,
              Disney+, and more.
            </p>
            <Link
              href="/app"
              className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-lg transition text-sm font-medium"
            >
              Discover
            </Link>
          </div>

          <div className="bg-neutral-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:-translate-y-1">
            <Sparkles className="w-12 h-12 text-indigo-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-neutral-100">
              AI recommendations
            </h3>
            <p className="text-neutral-400 mb-4 text-sm">
              Personalized picks based on your favorites and watched list.
            </p>
            <Link
              href="/app"
              className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-lg transition text-sm font-medium"
            >
              Get recommendations
            </Link>
          </div>

          <div className="bg-neutral-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:-translate-y-1">
            <Search className="w-12 h-12 text-indigo-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-neutral-100">
              Search movies & TV
            </h3>
            <p className="text-neutral-400 mb-4 text-sm">
              Find any title or person with search powered by TMDB.
            </p>
            <Link
              href="/app"
              className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-lg transition text-sm font-medium"
            >
              Start searching
            </Link>
          </div>

          <div className="bg-neutral-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:-translate-y-1">
            <Share2 className="w-12 h-12 text-indigo-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-neutral-100">
              Share & chat
            </h3>
            <p className="text-neutral-400 mb-4 text-sm">
              Follow friends, send movie/TV cards in DMs, and recommend titles
              to each other.
            </p>
            <Link
              href="/app/messages"
              className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-lg transition text-sm font-medium"
            >
              Messages
            </Link>
          </div>

          <div className="bg-neutral-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:-translate-y-1">
            <Video className="w-12 h-12 text-indigo-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-neutral-100">
              Movie reels
            </h3>
            <p className="text-neutral-400 mb-4 text-sm">
              Short clips by genre and keyword — swipe through and discover.
            </p>
            <Link
              href="/app/reel"
              className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-lg transition text-sm font-medium"
            >
              Watch reels
            </Link>
          </div>
        </div>
        <div className="text-center mt-10">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-medium"
          >
            <Film className="w-5 h-5" />
            Explore the app
          </Link>
        </div>
      </section>

      <footer className="bg-neutral-800 py-6 text-center">
        <p className="text-neutral-400 text-sm">
          &copy; 2025 Letsee (Movie Social). All rights reserved.
        </p>
      </footer>
    </div>
  );
}
