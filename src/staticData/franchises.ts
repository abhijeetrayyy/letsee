export type FranchiseEntry = {
  id: number;
  title: string;
  type: "movie" | "tv";
  year: number;
  tmdbId: number;
};

export type Franchise = {
  id: string;
  name: string;
  entries: FranchiseEntry[];
  posterPath?: string;
};

export const FRANCHISES: Franchise[] = [
  {
    id: "mcu",
    name: "Marvel Cinematic Universe",
    posterPath: "/marvel.png",
    entries: [
      { id: 1, title: "Iron Man", type: "movie", year: 2008, tmdbId: 1726 },
      { id: 2, title: "The Incredible Hulk", type: "movie", year: 2008, tmdbId: 1724 },
      { id: 3, title: "Iron Man 2", type: "movie", year: 2010, tmdbId: 10138 },
      { id: 4, title: "Thor", type: "movie", year: 2011, tmdbId: 10195 },
      { id: 5, title: "Captain America: The First Avenger", type: "movie", year: 2011, tmdbId: 1771 },
      { id: 6, title: "The Avengers", type: "movie", year: 2012, tmdbId: 24428 },
      { id: 7, title: "Iron Man 3", type: "movie", year: 2013, tmdbId: 68721 },
      { id: 8, title: "Thor: The Dark World", type: "movie", year: 2013, tmdbId: 76338 },
      { id: 9, title: "Captain America: The Winter Soldier", type: "movie", year: 2014, tmdbId: 100402 },
      { id: 10, title: "Guardians of the Galaxy", type: "movie", year: 2014, tmdbId: 118340 },
      { id: 11, title: "Avengers: Age of Ultron", type: "movie", year: 2015, tmdbId: 99861 },
      { id: 12, title: "Ant-Man", type: "movie", year: 2015, tmdbId: 102899 },
      { id: 13, title: "Captain America: Civil War", type: "movie", year: 2016, tmdbId: 271110 },
      { id: 14, title: "Doctor Strange", type: "movie", year: 2016, tmdbId: 284052 },
      { id: 15, title: "Guardians of the Galaxy Vol. 2", type: "movie", year: 2017, tmdbId: 283995 },
      { id: 16, title: "Spider-Man: Homecoming", type: "movie", year: 2017, tmdbId: 315635 },
      { id: 17, title: "Thor: Ragnarok", type: "movie", year: 2017, tmdbId: 284053 },
      { id: 18, title: "Black Panther", type: "movie", year: 2018, tmdbId: 284054 },
      { id: 19, title: "Avengers: Infinity War", type: "movie", year: 2018, tmdbId: 299536 },
      { id: 20, title: "Ant-Man and the Wasp", type: "movie", year: 2018, tmdbId: 363088 },
      { id: 21, title: "Captain Marvel", type: "movie", year: 2019, tmdbId: 299537 },
      { id: 22, title: "Avengers: Endgame", type: "movie", year: 2019, tmdbId: 299534 },
      { id: 23, title: "Spider-Man: Far From Home", type: "movie", year: 2019, tmdbId: 429617 },
      { id: 24, title: "WandaVision", type: "tv", year: 2021, tmdbId: 85271 },
      { id: 25, title: "The Falcon and the Winter Soldier", type: "tv", year: 2021, tmdbId: 88396 },
      { id: 26, title: "Loki", type: "tv", year: 2021, tmdbId: 84958 },
      { id: 27, title: "Black Widow", type: "movie", year: 2021, tmdbId: 497698 },
      { id: 28, title: "What If...?", type: "tv", year: 2021, tmdbId: 91363 },
      { id: 29, title: "Shang-Chi", type: "movie", year: 2021, tmdbId: 566525 },
      { id: 30, title: "Eternals", type: "movie", year: 2021, tmdbId: 524434 },
      { id: 31, title: "Hawkeye", type: "tv", year: 2021, tmdbId: 88329 },
      { id: 32, title: "Spider-Man: No Way Home", type: "movie", year: 2021, tmdbId: 634649 },
      { id: 33, title: "Moon Knight", type: "tv", year: 2022, tmdbId: 92749 },
      { id: 34, title: "Doctor Strange in the Multiverse of Madness", type: "movie", year: 2022, tmdbId: 453395 },
      { id: 35, title: "Ms. Marvel", type: "tv", year: 2022, tmdbId: 92782 },
      { id: 36, title: "Thor: Love and Thunder", type: "movie", year: 2022, tmdbId: 616037 },
      { id: 37, title: "She-Hulk", type: "tv", year: 2022, tmdbId: 92783 },
      { id: 38, title: "Black Panther: Wakanda Forever", type: "movie", year: 2022, tmdbId: 505642 },
      { id: 39, title: "Ant-Man and the Wasp: Quantumania", type: "movie", year: 2023, tmdbId: 640146 },
      { id: 40, title: "Guardians of the Galaxy Vol. 3", type: "movie", year: 2023, tmdbId: 447365 },
    ],
  },
  {
    id: "star-wars",
    name: "Star Wars Saga",
    entries: [
      { id: 1, title: "Episode I: The Phantom Menace", type: "movie", year: 1999, tmdbId: 1893 },
      { id: 2, title: "Episode II: Attack of the Clones", type: "movie", year: 2002, tmdbId: 1894 },
      { id: 3, title: "Episode III: Revenge of the Sith", type: "movie", year: 2005, tmdbId: 1895 },
      { id: 4, title: "Episode IV: A New Hope", type: "movie", year: 1977, tmdbId: 11 },
      { id: 5, title: "Episode V: The Empire Strikes Back", type: "movie", year: 1980, tmdbId: 1891 },
      { id: 6, title: "Episode VI: Return of the Jedi", type: "movie", year: 1983, tmdbId: 1892 },
      { id: 7, title: "Episode VII: The Force Awakens", type: "movie", year: 2015, tmdbId: 140607 },
      { id: 8, title: "Rogue One", type: "movie", year: 2016, tmdbId: 330459 },
      { id: 9, title: "Episode VIII: The Last Jedi", type: "movie", year: 2017, tmdbId: 181808 },
      { id: 10, title: "Solo", type: "movie", year: 2018, tmdbId: 348350 },
      { id: 11, title: "Episode IX: The Rise of Skywalker", type: "movie", year: 2019, tmdbId: 181812 },
    ],
  },
  {
    id: "harry-potter",
    name: "Harry Potter / Wizarding World",
    entries: [
      { id: 1, title: "Harry Potter and the Sorcerer's Stone", type: "movie", year: 2001, tmdbId: 671 },
      { id: 2, title: "Harry Potter and the Chamber of Secrets", type: "movie", year: 2002, tmdbId: 672 },
      { id: 3, title: "Harry Potter and the Prisoner of Azkaban", type: "movie", year: 2004, tmdbId: 673 },
      { id: 4, title: "Harry Potter and the Goblet of Fire", type: "movie", year: 2005, tmdbId: 674 },
      { id: 5, title: "Harry Potter and the Order of the Phoenix", type: "movie", year: 2007, tmdbId: 675 },
      { id: 6, title: "Harry Potter and the Half-Blood Prince", type: "movie", year: 2009, tmdbId: 767 },
      { id: 7, title: "Harry Potter and the Deathly Hallows Part 1", type: "movie", year: 2010, tmdbId: 12444 },
      { id: 8, title: "Harry Potter and the Deathly Hallows Part 2", type: "movie", year: 2011, tmdbId: 12445 },
      { id: 9, title: "Fantastic Beasts and Where to Find Them", type: "movie", year: 2016, tmdbId: 259316 },
      { id: 10, title: "Fantastic Beasts: The Crimes of Grindelwald", type: "movie", year: 2018, tmdbId: 338952 },
      { id: 11, title: "Fantastic Beasts: The Secrets of Dumbledore", type: "movie", year: 2022, tmdbId: 338953 },
    ],
  },
  {
    id: "lord-of-the-rings",
    name: "Middle-earth (LOTR + Hobbit)",
    entries: [
      { id: 1, title: "The Fellowship of the Ring", type: "movie", year: 2001, tmdbId: 120 },
      { id: 2, title: "The Two Towers", type: "movie", year: 2002, tmdbId: 121 },
      { id: 3, title: "The Return of the King", type: "movie", year: 2003, tmdbId: 122 },
      { id: 4, title: "The Hobbit: An Unexpected Journey", type: "movie", year: 2012, tmdbId: 49051 },
      { id: 5, title: "The Hobbit: The Desolation of Smaug", type: "movie", year: 2013, tmdbId: 57158 },
      { id: 6, title: "The Hobbit: The Battle of the Five Armies", type: "movie", year: 2014, tmdbId: 122917 },
    ],
  },
  {
    id: "john-wick",
    name: "John Wick",
    entries: [
      { id: 1, title: "John Wick", type: "movie", year: 2014, tmdbId: 245891 },
      { id: 2, title: "John Wick: Chapter 2", type: "movie", year: 2017, tmdbId: 324552 },
      { id: 3, title: "John Wick: Chapter 3 - Parabellum", type: "movie", year: 2019, tmdbId: 458156 },
      { id: 4, title: "John Wick: Chapter 4", type: "movie", year: 2023, tmdbId: 603692 },
    ],
  },
  {
    id: "dark-knight",
    name: "The Dark Knight Trilogy",
    entries: [
      { id: 1, title: "Batman Begins", type: "movie", year: 2005, tmdbId: 272 },
      { id: 2, title: "The Dark Knight", type: "movie", year: 2008, tmdbId: 155 },
      { id: 3, title: "The Dark Knight Rises", type: "movie", year: 2012, tmdbId: 49026 },
    ],
  },
  {
    id: "mission-impossible",
    name: "Mission: Impossible",
    entries: [
      { id: 1, title: "Mission: Impossible", type: "movie", year: 1996, tmdbId: 954 },
      { id: 2, title: "Mission: Impossible 2", type: "movie", year: 2000, tmdbId: 955 },
      { id: 3, title: "Mission: Impossible III", type: "movie", year: 2006, tmdbId: 956 },
      { id: 4, title: "Ghost Protocol", type: "movie", year: 2011, tmdbId: 56292 },
      { id: 5, title: "Rogue Nation", type: "movie", year: 2015, tmdbId: 177677 },
      { id: 6, title: "Fallout", type: "movie", year: 2018, tmdbId: 353081 },
      { id: 7, title: "Dead Reckoning Part One", type: "movie", year: 2023, tmdbId: 575264 },
    ],
  },
  {
    id: "conjuring",
    name: "The Conjuring Universe",
    entries: [
      { id: 1, title: "The Conjuring", type: "movie", year: 2013, tmdbId: 138843 },
      { id: 2, title: "Annabelle", type: "movie", year: 2014, tmdbId: 250546 },
      { id: 3, title: "The Conjuring 2", type: "movie", year: 2016, tmdbId: 259693 },
      { id: 4, title: "Annabelle: Creation", type: "movie", year: 2017, tmdbId: 396422 },
      { id: 5, title: "The Nun", type: "movie", year: 2018, tmdbId: 439079 },
      { id: 6, title: "Annabelle Comes Home", type: "movie", year: 2019, tmdbId: 521029 },
      { id: 7, title: "The Conjuring: The Devil Made Me Do It", type: "movie", year: 2021, tmdbId: 423108 },
      { id: 8, title: "The Nun II", type: "movie", year: 2023, tmdbId: 968051 },
    ],
  },
];
