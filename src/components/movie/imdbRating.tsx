"use client";

import React, { useEffect, useState } from "react";

function ImdbRating({ id }: any) {
  // The declaration was `imdbRating`, shadowed immediately by a state variable
  // of the same name — so the identifier meant two different things inside one
  // function body. Capitalising the component fixes the rules-of-hooks error
  // and the shadowing in one move.
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

export default ImdbRating;
