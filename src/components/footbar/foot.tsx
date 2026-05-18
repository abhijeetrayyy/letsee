import Link from "next/link";
import React from "react";
import { Film, Github, ExternalLink } from "lucide-react";

function Footbar() {
  return (
    <footer className="border-t border-surface-800/50 bg-surface-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Film className="w-4 h-4 text-brand-500" />
            </div>
            <div>
              <span className="font-semibold text-white">LetSee</span>
              <span className="text-surface-500 text-sm ml-2">
                Social Film Journal
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm">
            <Link
              target="_blank"
              className="flex items-center gap-1.5 text-surface-400 hover:text-brand-400 transition-colors"
              href="https://github.com/abhijeetrayy"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">Abhijeet Ray</span>
            </Link>
            <Link
              className="flex items-center gap-1.5 text-surface-400 hover:text-brand-400 transition-colors"
              target="_blank"
              href="https://developer.themoviedb.org"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">TMDB API</span>
            </Link>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-surface-800/50 text-center">
          <p className="text-xs text-surface-600">
            &copy; {new Date().getFullYear()} LetSee. Data provided by TMDB. Not
            affiliated with TMDB.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footbar;
