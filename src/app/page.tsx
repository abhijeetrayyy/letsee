import Link from "next/link";
import {
  Film,
  Search,
  Share2,
  Video,
  List,
  TvMinimal,
  Sparkles,
  PenLine,
  Users,
  ArrowRight,
  Star,
  Calendar,
  TrendingUp,
} from "lucide-react";

const features = [
  {
    icon: List,
    title: "Your Film Diary",
    description:
      "Log every film you watch. Rate, review, and build a personal archive of your cinematic journey.",
    href: "/app/profile",
    color: "text-brand-400",
    bg: "bg-brand-500/10",
  },
  {
    icon: TvMinimal,
    title: "Track TV Progress",
    description:
      "Follow series episode by episode. Mark what you've watched and pick up right where you left off.",
    href: "/app",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: PenLine,
    title: "Write Reviews",
    description:
      "Share your thoughts with the community. From quick ratings to in-depth analysis.",
    href: "/app/profile",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: Sparkles,
    title: "AI Recommendations",
    description:
      "Get personalized picks based on your taste. Discover hidden gems you'd never find alone.",
    href: "/app",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: Search,
    title: "Explore Everything",
    description:
      "Search 800K+ movies and shows. Filter by genre, year, language, or streaming provider.",
    href: "/app/search",
    text: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    icon: Share2,
    title: "Share & Connect",
    description:
      "Follow friends, share film cards in DMs, and see what the community is watching.",
    href: "/app/messages",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
];

const stats = [
  { value: "800K+", label: "Films & Shows" },
  { value: "AI", label: "Recommendations" },
  { value: "Real-time", label: "Social Feed" },
  { value: "Free", label: "Forever" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-950 text-white overflow-hidden">
      {/* Hero Section */}
      <header className="relative min-h-[92vh] flex items-center justify-center">
        {/* Background layers */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.08)_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(59,130,246,0.06)_0%,transparent_50%)]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-500/5 rounded-full blur-3xl" />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-400 mb-8 animate-fade-down">
            <Film className="w-4 h-4" />
            <span>The social film journal for cinephiles</span>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 animate-fade-up">
            <span className="block text-white">Track.</span>
            <span className="block text-gradient-brand">Review.</span>
            <span className="block text-white">Connect.</span>
          </h1>

          <p className="text-lg sm:text-xl text-surface-400 max-w-2xl mx-auto mb-10 animate-fade-up stagger-2 leading-relaxed">
            Your personal film journal meets social network. Log every movie,
            write reviews, discover new favorites, and share the experience
            with fellow cinephiles.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-up stagger-3">
            <Link
              href="/app"
              className="group inline-flex items-center gap-2.5 bg-brand-500 hover:bg-brand-600 text-surface-950 font-semibold py-3.5 px-8 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/25 hover:scale-[1.02]"
            >
              Start Your Journal
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/app/search"
              className="inline-flex items-center gap-2.5 border border-surface-700 hover:border-surface-500 text-surface-300 hover:text-white font-medium py-3.5 px-8 rounded-full transition-all duration-300 hover:bg-surface-800/50"
            >
              <Search className="w-4 h-4" />
              Browse Films
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto animate-fade-up stagger-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-surface-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-pulse-soft">
          <div className="w-6 h-10 rounded-full border-2 border-surface-600 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-3 rounded-full bg-surface-500" />
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(39,39,42,0.3)_0%,transparent_70%)]" />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything a cinephile needs
            </h2>
            <p className="text-surface-400 text-lg max-w-2xl mx-auto">
              From logging your first review to building a community of
              film-loving friends.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <Link
                key={feature.title}
                href={feature.href}
                className={`group relative rounded-2xl border border-surface-800 bg-surface-900/50 p-6 sm:p-7 card-hover animate-fade-up stagger-${i + 1}`}
              >
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${feature.bg} mb-5`}
                >
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-brand-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-surface-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
                <ArrowRight className="absolute top-6 right-6 w-4 h-4 text-surface-600 opacity-0 group-hover:opacity-100 group-hover:text-brand-400 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Community Section */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 border-t border-surface-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-sm text-amber-400 mb-6">
                <Users className="w-3.5 h-3.5" />
                <span>Built for communities</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 leading-tight">
                Film is better
                <br />
                <span className="text-gradient-brand">with friends</span>
              </h2>
              <p className="text-surface-400 text-lg mb-8 leading-relaxed">
                See what your friends are watching, share recommendations, and
                discover your next favorite film through the people who know
                your taste best.
              </p>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-500/10 flex items-center justify-center">
                    <Star className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      Rate & Review
                    </div>
                    <div className="text-xs text-surface-500">
                      Quick stars or deep dives
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      Activity Feed
                    </div>
                    <div className="text-xs text-surface-500">
                      See what friends watch
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      Film Diary
                    </div>
                    <div className="text-xs text-surface-500">
                      Your watching history
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative card stack */}
            <div className="relative hidden lg:block">
              <div className="absolute -inset-4 bg-gradient-to-r from-brand-500/10 via-blue-500/10 to-purple-500/10 rounded-3xl blur-2xl" />
              <div className="relative space-y-4">
                {[
                  {
                    title: "The Godfather",
                    year: "1972",
                    rating: 5,
                    review: "A masterpiece of American cinema. Every frame is perfect.",
                    user: "Sarah K.",
                    time: "2h ago",
                  },
                  {
                    title: "Parasite",
                    year: "2019",
                    rating: 5,
                    review: "Bong Joon-ho at his absolute best. Genre-defying brilliance.",
                    user: "Alex M.",
                    time: "5h ago",
                  },
                  {
                    title: "Dune: Part Two",
                    year: "2024",
                    rating: 4,
                    review: "Villeneuve delivers an epic that surpasses the first film.",
                    user: "Jordan L.",
                    time: "1d ago",
                  },
                ].map((item, i) => (
                  <div
                    key={item.title}
                    className="glass rounded-xl p-5 animate-fade-up"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-white text-sm">
                          {item.title}{" "}
                          <span className="text-surface-500">({item.year})</span>
                        </h4>
                        <div className="flex items-center gap-0.5 mt-1">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star
                              key={j}
                              className={`w-3 h-3 ${
                                j < item.rating
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-surface-600"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-surface-500">{item.time}</span>
                    </div>
                    <p className="text-sm text-surface-400 mb-2">{item.review}</p>
                    <span className="text-xs text-surface-500">
                      by {item.user}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative rounded-3xl border border-surface-800 bg-surface-900/50 p-10 sm:p-16 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.06)_0%,transparent_60%)]" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Start your cinematic journey
              </h2>
              <p className="text-surface-400 text-lg mb-8 max-w-xl mx-auto">
                Join a community of film lovers. Track, review, and discover —
                all in one place.
              </p>
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2.5 bg-brand-500 hover:bg-brand-600 text-surface-950 font-semibold py-3.5 px-8 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/25 hover:scale-[1.02]"
              >
                Create Your Account
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <p className="text-surface-500 text-sm mt-4">
                Free forever. No credit card required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-800/50 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-surface-400">
            <Film className="w-4 h-4 text-brand-500" />
            <span className="font-semibold text-white">LetSee</span>
            <span className="text-surface-600">—</span>
            <span className="text-sm">Social Film Journal</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-surface-500">
            <span>
              Developer:{" "}
              <Link
                target="_blank"
                className="text-brand-400 hover:text-brand-300 transition-colors"
                href="https://github.com/abhijeetrayy"
              >
                Abhijeet Ray
              </Link>
            </span>
            <Link
              className="text-brand-400 hover:text-brand-300 transition-colors"
              target="_blank"
              href="https://developer.themoviedb.org"
            >
              TMDB API
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
