"use client";

import React, { useEffect, useState } from "react";

function imdbRating({ id }: any) {
  const [imdbRating, setImdbRating] = useState("loading..");

  useEffect(() => {
    const fetchImdb = async () => {
      setImdbRating("loading..");

      try {
        const response = await fetch(`/api/omdb?i=${id}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`OMDb request failed: ${response.status}`);
        }
        const res = await response.json();

        if (res.Response == "False") {
          setImdbRating("N/A");
        } else setImdbRating(res.imdbRating);
      } catch (error) {
        console.log(error);
        setImdbRating("null");
      }
    };
    fetchImdb();
  }, []);
  return (
    <p className={imdbRating !== "loading" || "null" ? "font-bold" : ""}>
      {imdbRating !== "loading.." ? `${imdbRating}` : "Loading.."}
    </p>
  );
}

export default imdbRating;
