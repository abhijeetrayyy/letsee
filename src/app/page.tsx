import Link from "next/link";
import {
  Film,
  Search,
  Share2,
  Sparkles,
  PenLine,
  Users,
  ArrowRight,
  Star,
  Calendar,
  TrendingUp,
  Play,
  Clapperboard,
  BookOpen,
  Heart,
  MessageSquare,
  ChevronDown,
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Your Film Diary",
    description:
      "Log every film you watch. Rate, review, and build a personal archive of your cinematic journey.",
    href: "/app/profile",
    color: "text-brand-400",
    bg: "bg-brand-500/10",
    border: "border-brand-500/20",
  },
  {
    icon: Film,
    title: "Track TV Progress",
    description:
      "Follow series episode by episode. Mark what you've watched and pick up right where you left off.",
    href: "/app",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: PenLine,
    title: "Write Reviews",
    description:
      "Share your thoughts with the community. From quick ratings to in-depth analysis.",
    href: "/app/profile",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    icon: Sparkles,
    title: "AI Recommendations",
    description:
      "Get personalized picks based on your taste. Discover hidden gems you'd never find alone.",
    href: "/app",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  {
    icon: Search,
    title: "Explore Everything",
    description:
      "Search 800K+ movies and shows. Filter by genre, year, language, or streaming provider.",
    href: "/app/search",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
  {
    icon: Share2,
    title: "Share & Connect",
    description:
      "Follow friends, share film cards in DMs, and see what the community is watching.",
    href: "/app/messages",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
];

const stats = [
  { value: "800K+", label: "Films & Shows" },
  { value: "AI", label: "Smart Picks" },
  { value: "Live", label: "Social Feed" },
  { value: "Free", label: "Forever" },
];

const testimonials = [
  {
    title: "The Godfather",
    year: "1972",
    rating: 5,
    review: "A masterpiece of American cinema. Every frame is perfect.",
    user: "Sarah K.",
    time: "2h ago",
    poster: "https://image.tmdb.org/t/p/w185/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
  },
  {
    title: "Parasite",
    year: "2019",
    rating: 5,
    review: "Bong Joon-ho at his absolute best. Genre-defying brilliance.",
    user: "Alex M.",
    time: "5h ago",
    poster: "https://image.tmdb.org/t/p/w185/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
  },
  {
    title: "Dune: Part Two",
    year: "2024",
    rating: 4,
    review: "Villeneuve delivers an epic that surpasses the first film.",
    user: "Jordan L.",
    time: "1d ago",
    poster: "https://image.tmdb.org/t/p/w185/8b8R8l88Qje9dn9OE8PY66Nez6q.jpg",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-950 text-white overflow-hidden">
      {/* ──────── HERO ──────── */}
      <header className="relative min-h-screen flex items-center justify-center">
        {/* Background layers */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.12)_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(59,130,246,0.08)_0%,transparent_50%)]" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-brand-500/5 rounded-full blur-3xl" />
          {/* Subtle film grain */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/5 backdrop-blur-sm px-4 py-1.5 text-sm text-brand-400 mb-8 animate-fade-down">
            <Clapperboard className="w-4 h-4" />
            <span>The social film journal for cinephiles</span>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6 animate-fade-up leading-none">
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
              className="group inline-flex items-center gap-2.5 bg-brand-500 hover:bg-brand-400 text-surface-950 font-semibold py-4 px-9 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/30 hover:-translate-y-0.5 active:translate-y-0 text-base"
            >
              <Play className="w-4 h-4 fill-surface-950" />
              Start Your Journal
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/app/search"
              className="inline-flex items-center gap-2.5 border border-white/10 hover:border-white/20 text-surface-300 hover:text-white font-medium py-4 px-9 rounded-full transition-all duration-300 hover:bg-white/5 text-base"
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
        <a
          href="#features"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce"
          aria-label="Scroll to features"
        >
          <ChevronDown className="w-6 h-6 text-surface-500" />
        </a>
      </header>

      {/* ──────── FEATURES ──────── */}
      <section id="features" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(39,39,42,0.3)_0%,transparent_70%)]" />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-surface-700/50 bg-surface-800/30 px-3 py-1 text-xs font-semibold text-surface-400 uppercase tracking-wider mb-4">
              Features
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
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
                className={`group relative rounded-2xl border border-surface-800 bg-surface-900/40 backdrop-blur-sm p-6 sm:p-7 hover-lift animate-fade-up stagger-${i + 1} hover:border-${feature.border} transition-all duration-300`}
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

      {/* ──────── SOCIAL PROOF ──────── */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 border-t border-surface-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-6">
                <Users className="w-3.5 h-3.5" />
                <span>Community</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight tracking-tight">
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
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      Direct Messages
                    </div>
                    <div className="text-xs text-surface-500">
                      Share films with friends
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative card stack */}
            <div className="relative hidden lg:block">
              <div className="absolute -inset-4 bg-gradient-to-r from-brand-500/10 via-blue-500/10 to-purple-500/10 rounded-3xl blur-2xl" />
              <div className="relative space-y-4">
                {testimonials.map((item, i) => (
                  <div
                    key={item.title}
                    className="glass-card rounded-xl p-5 animate-fade-up hover-lift"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="flex items-start gap-4">
                      <img
                        src={item.poster}
                        alt={item.title}
                        className="w-12 h-16 rounded-lg object-cover shrink-0 poster-shadow"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
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
                        <p className="text-sm text-surface-400">{item.review}</p>
                        <span className="text-xs text-surface-500 mt-1 block">
                          by {item.user}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────── CTA ──────── */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative rounded-3xl border border-white/5 bg-surface-900/40 backdrop-blur-sm p-10 sm:p-16 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.08)_0%,transparent_60%)]" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-500/5 rounded-full blur-3xl" />
            <div className="relative">
              <Heart className="w-10 h-10 text-brand-400 mx-auto mb-6" />
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
                Start your cinematic journey
              </h2>
              <p className="text-surface-400 text-lg mb-8 max-w-xl mx-auto">
                Join a community of film lovers. Track, review, and discover —
                all in one place.
              </p>
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2.5 bg-brand-500 hover:bg-brand-400 text-surface-950 font-semibold py-4 px-9 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/30 hover:-translate-y-0.5 active:translate-y-0 text-base"
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

      {/* ──────── FOOTER ──────── */}
      <footer className="border-t border-surface-800/50 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Film className="w-5 h-5 text-brand-500" />
                <span className="font-bold text-white text-lg">LetSee</span>
              </div>
              <p className="text-sm text-surface-500">
                The social film journal for cinephiles. Track, review, and connect.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Explore</h4>
              <div className="space-y-2">
                <Link href="/app/search" className="block text-sm text-surface-500 hover:text-brand-400 transition-colors">
                  Search
                </Link>
                <Link href="/app" className="block text-sm text-surface-500 hover:text-brand-400 transition-colors">
                  Home
                </Link>
                <Link href="/app/reel" className="block text-sm text-surface-500 hover:text-brand-400 transition-colors">
                  Reels
                </Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Connect</h4>
              <div className="space-y-2">
                <Link href="/signup" className="block text-sm text-surface-500 hover:text-brand-400 transition-colors">
                  Sign Up
                </Link>
                <Link href="/login" className="block text-sm text-surface-500 hover:text-brand-400 transition-colors">
                  Log In
                </Link>
                <a
                  href="https://github.com/abhijeetrayy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-surface-500 hover:text-brand-400 transition-colors"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-surface-800/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-surface-500">
            <span>
              Built by{" "}
              <Link
                target="_blank"
                className="text-brand-400 hover:text-brand-300 transition-colors"
                href="https://github.com/abhijeetrayy"
              >
                Abhijeet Ray
              </Link>
            </span>
            <span>
              Powered by{" "}
              <Link
                className="text-brand-400 hover:text-brand-300 transition-colors"
                target="_blank"
                href="https://developer.themoviedb.org"
              >
                TMDB API
              </Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
