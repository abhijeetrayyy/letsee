import Link from "next/link";
import React from "react";

function foot() {
  return (
    <div className="w-full flex justify-center my-8 sm:my-10 px-3 sm:px-4">
      <div className="max-w-7xl w-full flex flex-wrap justify-center items-center gap-3 sm:gap-5 text-center text-sm sm:text-base">
        <h1>Let&apos;s see</h1>
        <span>
          <span>Developer: </span>
          <span>
            Github -{" "}
            <Link
              target="_blank"
              className="text-indigo-500"
              href={"https://github.com/abhijeetrayy"}
            >
              Abhijeet Ray
            </Link>
          </span>
        </span>
        <p>
          <Link
            className="text-green-500"
            target="_blank"
            href={"https://developer.themoviedb.org"}
          >
            TMDB API
          </Link>
        </p>
      </div>
    </div>
  );
}

export default foot;
