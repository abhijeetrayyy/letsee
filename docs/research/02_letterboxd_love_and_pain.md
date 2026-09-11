# Letterboxd: What People Love, Hate, and Wish For
Research report, 2026-09-10. ~35 web searches + ~110 page fetches. STATUS: COMPLETE.

## Method and source caveats
- Reddit blocks the search API, fetcher, and browser. Reddit content was reached via (a) Brave search-result snippets for thread discovery and (b) Pushshift-style archives (pullpush.io, arctic-shift) for comment-level text with scores. ~40 r/Letterboxd threads (2021-Jul 2026) were read at comment level; ~60 more via snippets. Comment scores from archives are often lower than live Reddit (archive captures early); treat as relative, not absolute.
- X/Bluesky: a handful of posts surfaced via search; the Bluesky public API and X are blocked. Reddit, app-store reviews, Trustpilot, and journalism carry the weight.
- Letterboxd.com itself returns 403 to the fetcher; its FAQ, Pro page, Journal posts were read via a reader proxy.
- Flagged as unreliable and NOT relied on: shapes.inc "Letterboxd timeline" (claims TV support shipped Jan 2024 and an AI engine "The Projectionist" — no corroboration, contradicts Letterboxd's own FAQ) and letterboxdguide.com's "Lists 2.0 collaborative lists May 2025" (Letterboxd's FAQ and Zendesk, Jun 2026, say collaboration is still unsupported).

---

## 0. Hard facts (for context)
- Members: ~1M (Jan 2019) -> 3M (Jan 2021) -> 12M (Feb 2024) -> 15M (Jun 2024) -> 17M (end 2024) -> 26M+ (early 2026) -> 28M (Apr 2026) -> 30.7M (end Q2 2026; +43% YoY; +185% since Tiny bought in). Over 50% under 35; a new member "every 5 seconds" (nogood.io, May 2026). Sources: TIME100 2026 https://time.com/collection/time100-most-influential-companies/2026/letterboxd/ ; Wikipedia https://en.wikipedia.org/wiki/Letterboxd ; TheWrap Aug 20 2026 https://www.thewrap.com/industry-news/deals-ma/letterboxd-intrinsic-entertainment-bid-crowfunding-campaign-explained/
- 2025 activity: 898.5M films logged (+28%), 143.6M reviews (+49%), 672.5M ratings (+36%), 12.9M lists (+88%) (Wikipedia citing 2025 Year in Review).
- Pricing (US, web): Pro $19.99/yr; Patron $39.99/yr. Pro = no third-party ads, annual + all-time stats, stats on any list, JustWatch streaming filter on watchlist, notifications when watchlist titles hit your services, friends' average ratings, owned-films tracking, activity-feed filters, pin to profile, duplicate lists, tag management on web, iOS icons. Patron = + custom posters/backdrops, cast/crew images, Patrons page, beta features. https://letterboxd.com/pro/ ; https://letterboxd.com/about/pro/ . Third-party blogs quote $35-$49/yr (Achriom Jun 2026, Moviebase Apr 2026) — likely Patron/app-store/regional pricing; Reddit notes app price > web price and wide regional variance (Argentina ~$6, Germany ~$45 Patron) https://www.reddit.com/r/Letterboxd/comments/1ftvu0q/
- App ratings: iOS ~4.8; Google Play 3.3 stars / 33.7k reviews / 10M+ installs https://play.google.com/store/apps/details?id=com.letterboxd.letterboxd ; Trustpilot 2.2/5 (86% one-star, heavily phishing-email and support complaints) https://www.trustpilot.com/review/letterboxd.com
- Ownership: founded 2011 Auckland (Buchanan, von Randow). Tiny bought 60% Sept 2023 (~$50-60M). Apr 2026: Tiny shopping its stake via LionTree; ~$250M ask; Netflix, Sony, Paramount Skydance, Versant, RedBird, TPG, Alexis Ohanian in early talks (Jul 2026); Intrinsic Entertainment PBC crowdfunding a community bid (>$100k by Aug 2026). Buchanan holds buyer veto. https://www.semafor.com/article/04/26/2026/whats-next-for-letterboxd ; https://www.engadget.com/2212484/netflix-paramount-sony-in-talks-to-buy-letterboxd/ ; https://deadline.com/2026/05/letterboxd-for-sale-1236921783/

---

## 1. What people LOVE (ranked by how often it came up)

1. The diary as a memory prosthetic (most frequent, across every source type). Top comment (233 pts) on "Why do you use Letterboxd?": "I like to log what I watch in a diary, and making lists" https://www.reddit.com/r/Letterboxd/comments/widf5q/ . "it functions very much like a diary for me" (r/Letterboxd, Dec 2025) https://www.reddit.com/r/Letterboxd/comments/1pqkjis/ . "use it so I know what I felt at the time" https://www.reddit.com/r/Letterboxd/comments/1j0trf0/ . "something so satisfying about logging a movie, creating themed Lists" (Medium, Oct 2024) https://medium.com/@kieobn/i-logged-1-000-films-in-my-letterboxd-diary-heres-what-they-say-about-me-4ebb2e8cff10 . Google Play 5-star: "keeping lists of movies you wanna see as well as keeping a diary". Underlying psychology: externalised memory + collection-building ("the drive to differentiate... creates personal investment" — nogood.io https://nogood.io/blog/letterboxd-marketing/ ). The log is proof of a life lived; deleting it feels like losing memories ("Can't remember what I've watched anymore" — a quitter's regret, https://www.reddit.com/r/Letterboxd/comments/1q3ak3r/ ).

2. Watchlist + lists as anticipation and play (very frequent). App Store: "a great way to track what I want to watch and the reviews are entertaining" https://apps.apple.com/us/app/letterboxd/id1054271011?see-all=reviews . Amy Wild loves quirky lists like "Florence Pugh and Timothée Chalamet Get Married" https://amywild.substack.com/p/why-letterboxd-is-the-only-social . Psychology: the watchlist is a promise to future-you (Zeigarnik/open-loop pull); lists are creative self-expression with low stakes.

3. Friends' taste as a trust signal (frequent). "if your most trustworthy friend gave it 2 stars, you know to steer clear" (Amy Wild). "All you have to do is follow people you like and see what they're watching" (9 pts, r/rs_x Apr 2026) https://www.reddit.com/r/rs_x/comments/1sscq19/ . 36 pts: seeing what friends watch and their ratings (widf5q). Inverse proof: "That person's one-sentence opinion apparently trumps the trust nurtured over nearly six years" (Kate Lindsay, Embedded, Aug 2024) https://embedded.substack.com/p/review-culture-letterboxd . Psychology: social proof from known people beats aggregate scores; low-effort ambient intimacy ("what my friends are watching").

4. Funny, human reviews (frequent, and polarising). "reading funny reviews in car after movies sparks engaging discussions" (12 pts) and "casual and human" (8) https://www.reddit.com/r/Letterboxd/comments/1rwk008/ . "Letterboxd one liners must be protected at all costs" (commenter on Ira Madison III) https://www.read-frank.com/p/the-people-vs-letterboxd . Bored Panda (Jul 2026) on reviews with "such a bizarrely threatening energy" https://2.boredpanda.com/letterboxd-reviews-auras/ . Psychology: play and belonging; the post-movie debrief ritual; screenshots spread as memes (free acquisition).

5. "Not IMDb": honest ratings, clean design, no bombing (frequent in older canonical threads). "IMDb looks so ugly" (161 pts); "Review bombs have screwed over IMDb" (109) (widf5q). App Store: IMDb "has become a cesspool of paid for reviews". Trustpilot 4-star: "ratings more realistic than IMDB". Psychology: trust and taste-aesthetic alignment; the product looks like something a cinephile made.

6. Stats and the Year in Review ritual (frequent among payers). "Hate ads. Love looking at the stats." (14 pts) https://www.reddit.com/r/Letterboxd/comments/1i1ackt/ ; "Patron is $3 and change a month for a site I use multiple times a day" https://www.reddit.com/r/Letterboxd/comments/1gvqv38/ . Year in Review needs 10+ logs; delivered Jan 2 https://letterboxd.com/journal/2025-letterboxd-year-in-review-faq/ . Psychology: quantified self, self-knowledge, shareable identity artefact (Spotify Wrapped effect).

7. Taste as identity: Four Favorites (frequent in journalism/essays). "It almost encapsulates who you are as a Letterboxd member" — Aaron Yap, Head of Social https://thespinoff.co.nz/pop-culture/24-04-2025/how-letterboxds-four-favourites-took-over-the-internet . "Within these four tiny poster icons lies the road map to your soul" https://colleenclaes.substack.com/p/the-letterboxd-top-4-decide-or-die . "I pay for Patron and do check it more than I would like to admit" https://izzyscott.substack.com/p/what-makes-a-perfect-letterboxd-top . Guardian: "our era's cinematic confession booth" (via Wikipedia). Psychology: constrained self-presentation (four slots force choice = reveals character); parasocial mirroring of celebrities' picks.

8. A social network that doesn't feel like social media (moderately frequent). "the only social media the commenter doesn't hate" (28 pts, widf5q); "refreshingly free from doom scrolling and comparison traps" (Amy Wild); "enjoyable without feeling overwhelming" https://imfirenzedigest.com/2025/01/17/why-letterboxd-is-the-niche-social-media-every-film-buff-needs/ ; Variety: "a throwback to an internet that increasingly doesn't exist"; WaPo: "vintage internet" (both via Wikipedia). Psychology: chronological, follow-based feed = agency; niche = lower status anxiety than Instagram.

9. Discovery of older/international film (moderate; strongest in journalism). NYT Magazine (Kleeman, Feb 2026): user PUNQ "logged over 1,500 feature films last year, all from 1953 or 1954" https://longreads.com/2026/02/06/letterboxd-nyt-magazine/ . "international reviews provide critical perspectives English-only browsing misses" (7 pts, 1rwk008). Featured Lists (Aug 2025) formalise this https://letterboxd.com/journal/featured-lists-explainer/ .

10. Streaming filter + "your watchlist title just landed" notifications (moderate; the #1 cited reason to pay). "able to build a watchlist and filter it by streaming services I subscribe to" (30 pts, 1i1ackt); "notifications for when a movie on your watchlist pops on... streaming services is seriously so cool" https://www.reddit.com/r/Letterboxd/comments/10un38l/ .

---

## 2. Top complaints and missing features (ranked by frequency across sources)

1. No TV shows (by a wide margin; 25+ Reddit threads 2021-Jul 2026, App Store, Trustpilot, every "alternatives" article). "It's 2026, still waiting for TV shows integration" (Jan 2026) https://www.reddit.com/r/Letterboxd/comments/1q68qdd/ ; "They've been saying this for years and years" (Jul 2026) https://www.reddit.com/r/Letterboxd/comments/1ul2860/ ; "I just want to be able to get off Serializd" (5 pts, 1q68qdd); Trustpilot 1-star (Apr 2026): "You can't review TV shows here." Limelight calls "Why can't I log shows?" the most common complaint https://www.thelimelight.app/letterboxd-alternatives . BUT a large, vocal faction opposes it: "every app does everything poorly; nice to have one that does one thing well" (top reply, Nov 2025) https://www.reddit.com/r/Letterboxd/comments/1p25x79/ ; "If individual episodes are included, I'll stop paying" (4 pts); "Limited TV series already junk up feed" https://www.reddit.com/r/Letterboxd/comments/1t8lqh3/ ; consensus compromise: "I'd be 100% okay with it under a separate tab" (8 pts); "A toggle to see/not see it feels like the most elegant solution". Also the inconsistent miniseries rule ("White Lotus removed when second seasons announced") https://www.reddit.com/r/Letterboxd/comments/1jkep0x/ ; "Either have TV or no TV; rules inconsistently applied" (7 pts) https://www.reddit.com/r/Letterboxd/comments/1e6pt3x/ . Official: "We do not support 'returning' TV shows at this time, but we are working on this" https://letterboxd.com/about/faq/ .

2. Search and filtering are weak (very frequent). "The search is pretty terrible" (5 pts, 1e6pt3x); fails on minor typos, no "did you mean" https://www.reddit.com/r/Letterboxd/comments/1dfrtbw/ ; "Why can I not search my lists. Insane"; "Better, less strict search function. Folders for lists" (9); filter year ranges not single years https://www.reddit.com/r/Letterboxd/comments/1sxesvu/ ; "Hide/Show Concert films" and stand-up specials (19 pts) https://www.reddit.com/r/Letterboxd/comments/1j4l28g/ ; filmographies of "strictly narrative features" (11); filter by language/country; search within watched/watchlist only.

3. App stability, ads, outages (very frequent in app stores; rising in 2025-26). App Store: crashes when commenting/logging/scrolling; "full-screen pop-up ads... even while typing reviews"; Google Play (Nov 2025): "Ads are auto-opening without clicking on them"; "sometimes it will log me out randomly" (Aug 2026). Reddit: "Letterboxd servers go down weekly" (4 pts, 1p25x79); adblock-detection popup on every page (1dfrtbw). Outages: Nov 2025 (TechRadar live blog) and Aug 9 2026 (~8 hours, everyone signed out; "An error occurred. Please try again later") https://www.joblo.com/letterboxd-down-august-2026/ . Android is worse: "Android version is less user-friendly, more buggy, and less polished than iOS" https://punchamoorthee.substack.com/p/a-deep-dive-into-letterboxd ; Featured Lists shipped iOS-first with Android "coming soon".

4. Review culture: jokes drown analysis; ratings inflation; pretension (very frequent, both directions). "frustrating to scroll reviews and get nothing but 'humorous' twitter length reviews" (23 pts, 1pqkjis); "None of which are ever funny" (14); "competition for attention with people gunning for likes and followers" (6, 1sscq19); "now everything debuts as the greatest movie ever" (3); "'it has a 4.1 on letterboxd' is the new 'it got 95% on rotten tomatoes'" (5). Pretension: "if a movie isn't a 5 it's a 1" https://www.reddit.com/r/Letterboxd/comments/1eqk7nl/ ; "rigid and soulless grading systems", "copy paste" taste from top lists (1j0trf0); "pretentious people... tearing down the movies people love" (1dfrtbw). Product asks that follow: word-count filter/3-sentence minimum (13, 5, 5 pts across threads), default sort by new (3), "hot takes" sort by divergence from average (2), hide scores by default.

5. Lists UX (frequent). No collaborative lists — still unsupported as of Jun 2026 https://letterboxd.zendesk.com/hc/en-us/articles/16341872513423 ; "letterboxd still not having collaborative list options is kinda crazy" (X, Jan 2025) https://x.com/badtweetbri/status/1876401344879481027 ; requested in 5+ threads. No folders for lists or tags (6+ threads; "Nested folders for tags" 6 pts). Sort preference doesn't persist (multiple). Can't edit from grid view; can't export list as image; can't cross-reference two lists; can't search inside lists; clone-list spam ("Every film ever").

6. Thin social features (frequent). "threaded comments please we are in 2025 cant even reply to reviews" https://www.reddit.com/r/Letterboxd/comments/1qhy66f/ ; "Liking comments and being able to @ people in them" (25 pts, 1j4l28g); no DMs (2 threads); "close friends" feed to cut clutter (3 threads); mutuals visibility; mute without unfollowing; "Like" a friend's watched entry that has no review (2 threads); taste-compatibility score; compare watchlists (2 threads); "Connect with contacts"; "A dating tab" (10 pts, half-joke, recurring).

7. Privacy (frequent, growing). "make your reviews/diary private" (7 pts, 1j4l28g); "Private account option similar to Instagram" (180mpsv); "private profiles" (1qhy66f); quitters' workaround: "Use personal private account for casual viewing, public for social" (1q3ak3r); lurker: "given my @ to a few too many people I know in real life" https://cinephileandthecity.substack.com/p/25-letterboxd-review-roundup ; Achriom: users "prefer a private library to Letterboxd's public-by-default social model" https://www.achriom.com/blog/best-letterboxd-alternatives/ . Official FAQ: "working on more granular privacy options, more news soon."

8. Diary/logging UX gaps (frequent). Drafts: "desperately needed to prevent losing review progress" https://www.reddit.com/r/Letterboxd/comments/137oidf/ + App Store "needs draft-saving functionality" + 4 other threads. "Did Not Finish" (3 threads) https://www.reddit.com/r/Letterboxd/comments/vkoshg/ . Log which cut/version (19 pts in 2025 wish list; 5 more threads) https://www.reddit.com/r/Letterboxd/comments/1hge0mm/ . Sub vs dub; theatrical vs home; calendar diary view; "On This Day" (13 pts, 2 threads); tag a film without logging it; "ask questions without marking movies as watched" (App Store); "A tag to say if you cried or not".

9. Paywall creep and price friction (moderate, sharp). "Custom posters shouldn't be behind a paywall" (10 pts, 1e6pt3x); "change poster art without $50/year subscription" (180mpsv); Mar 2025 activity filters moved behind Pro: "How is there not more outrage about this?" https://www.reddit.com/r/Letterboxd/comments/1jlelhi/ ; "patron has great perks but is stupidly expensive" (5, 1i1ackt); stats being Pro-only is cited by every 2026 "alternatives" article as a switching reason; app price differs from web price https://www.reddit.com/r/Letterboxd/comments/pxys8b/ .

10. Discovery / recommendations (moderate). "I wish Letterboxd gave you recommendations based on what films you've been watching" https://www.reddit.com/r/Letterboxd/comments/1ccultk/ ; recs "ignore personal taste; shows only 'popular among friends'" (1dfrtbw); Google Play (Jun 2026): "Lack of a browsing system... suggestions based on previous watches". Follow directors/actors with release notifications (3+ threads) https://www.reddit.com/r/Letterboxd/comments/10jsmsw/ ; separate "unreleased" watchlist with release alerts (15 + 11 pts).

11. Notifications unreliable and coarse (moderate). "My Letterboxd app has stopped giving me notifications for anything"; "I hate not knowing when I'm being interacted with"; wants per-friend, theatrical, re-release, physical-media alerts (arctic-shift post search, r/Letterboxd 2024-26).

12. Where-to-watch and region (moderate). Free tier shows only "featured services" on film pages https://letterboxd.com/journal/justwatch-integration/ ; "It won't tell me where to stream" (Limelight); "Missing streaming availability information on film pages" (1dfrtbw); localized release dates and "Localized Theater Showtimes" requested; Video Store availability/pricing "vary by location".

13. Watchlist notes / private notes (moderate but high-scoring). "Add a note to a movie I add to my watchlist! I often forget why I added them" (14 pts) https://www.reddit.com/r/Letterboxd/comments/1p2px5s/ ; "Private reviews and personal notes for movies you've watched" https://www.reddit.com/r/Letterboxd/comments/1joezk2/ ; private notes in the 2021 top-5 thread https://www.reddit.com/r/Letterboxd/comments/pcsrwl/ .

14. Metadata gaps (moderate). Budget/box office (11 pts), awards won (6), MPAA/"Parent Guide"/content warnings (App Store x2), shorts section "full of YouTube videos", English-dub cast missing, "Top 250 should separate narrative films from TV".

15. Language / translation (moderate, very high-scoring when raised). "i don't understand how there isn't a built-in translation feature already" (35 pts, 1j4l28g); language filtering for reviews (14 pts, 1rwk008; 180mpsv).

16. Spoilers (low-moderate). Partial spoiler covers "for specific lines, not entire reviews" (1i22a0e); "half-spoiler reviews" (10 pts, 180mpsv); hide ratings for unwatched films (2).

17. Rating granularity (low but persistent). Half-stars exist; asks are for quarter stars (5 threads, low scores), a zero-star option, separate scores for direction/cinematography/score (6 pts, 1joezk2). Letterboxd's own Bluesky (Apr 2026): "3 stars is good actually" https://bsky.app/profile/letterboxd.social/post/3mimg7p4yk22g .

18. Import/export/API/scrobbling (low-moderate). Import is free via CSV per FAQ, but alternatives articles still claim "no export"/"import tools are Pro" — a discoverability failure. Asks: public API, Plex auto-track, Trakt sync (1j4l28g; Moviebase).

19. Performative pressure and mental load (moderate, mostly in essays and quit threads). See section 5.

20. Video Store pricing (one-off, Dec 2025). "how bout we close the store if $20 to rent one film for 48 hours is going to be the norm?" https://www.thewrap.com/letterboxd-defends-video-store-pricing/ .

21. Support/moderation/phishing (Trustpilot-specific). "Customer support service is a joke"; harassment not actioned; phishing emails impersonating Letterboxd dominate 2022-23 one-stars.

---

## 3. What Letterboxd changed or announced, 2024-2026 (dated, sourced)
- Dec 2023: Showtimes + ticket links via Assemble in US/CA/UK/IE/NZ/AU (Wikipedia). Jan 2024: "Series will be coming later this year... in a way that doesn't disrupt the current experience" (JoBlo, Jan 3 2024) https://www.joblo.com/letterboxd-to-add-tv-show-ratings-later-this-year/ ; Buchanan: pushback is fear "film-logging may be overrun by people binge-watching Friends".
- Feb 2024: data breach (<1% of accounts) via compromised staff account (Wikipedia). Feb 2024 app update: actor/director bios with stats; friends' reviews prioritised on film pages (letterboxdguide.com, unverified detail).
- Mar 2024: Four Favorites red-carpet series at the Oscars becomes "a don't-skip promo stop" (WaPo via Wikipedia).
- Jun 2024: "Journal" editorial launched; filter by decade/year/genre/unreleased; Netflix availability filter (Pro).
- Sept 2024: Tiny's stake now ~1 year old; Cultured Mag on the "Letterboxd effect" https://www.culturedmag.com/article/2024/09/18/letterboxd-film-trend-box-office-gen-z/
- Jan 2025: 2024 Year in Review — Dune: Part Two highest-rated (4.4), Villeneuve responds https://www.hollywoodreporter.com/movies/movie-news/dune-part-2-zendaya-letterboxd-2024-year-in-review-1236103983/ . Feb 2025: Barbie first film logged 5M times.
- Mar 2025: activity-feed filters gated to Pro (user reports) https://www.reddit.com/r/Letterboxd/comments/1jlelhi/
- May 2025: Linklater at Cannes: "I call them the Letterboxd generation" (Wikipedia).
- Aug 9 2025: Featured Lists (iOS first) https://letterboxd.com/journal/featured-lists-explainer/
- Sept 2025: Ankler Media partnership (newsletter, events, ad sales) https://www.axios.com/2025/09/18/ankler-letterboxd-newsletter-events ; Donna Langley (TIFF) cites the "Letterboxd generation".
- Nov 2025: outage (TechRadar live blog). Nov 19-20 2025: Video Store announced https://letterboxd.com/journal/letterboxd-video-store/ ("It's frustrating to add a movie to your watchlist and then realize you can't actually watch it!"); Nov 2025 tweet: TV "still their plan".
- Dec 2025: Video Store live in 23 countries; shelves "Unreleased Gems" and "Lost & Found"; $3.99-$19.99; Dec 11 pricing backlash https://www.thewrap.com/letterboxd-defends-video-store-pricing/ ; Dec 18: It Ends acquired by Neon 8 days into its run.
- Jan 2026: 2025 Year in Review (Chainsaw Man: Reze Arc highest rated; "Festival Faves" and "Proshot Theater" categories) https://letterboxd.com/journal/2025-year-in-review/ ; Linklater-curated shelf; Jan 27-28 Melania reviews vanish then return ("an automatic update, caused by a previously incorrect premiere date") https://www.tmz.com/2026/01/30/melania-trump-documentary-bad-reviews/
- Feb 2026: NYT Magazine "Why the Future of Movies Lives on Letterboxd" (Kleeman) https://longreads.com/2026/02/06/letterboxd-nyt-magazine/
- Apr 2026: TIME100 Most Influential Companies; Semafor: Tiny selling; TIME/Semafor both say "seasons of television" will arrive in 2026 "in its own silo"; De Luca at CinemaCon: "The Letterboxd generation is only growing."
- May 2026: Deadline "Letterboxd for sale"; Intrinsic Entertainment PBC campaign launches https://seedandspark.com/fund/buyletterboxd
- Jun 2026: FAQ still: TV unsupported, collaboration unsupported, "more granular privacy options" coming.
- Jul 2026: Netflix/Sony/Paramount/etc. early talks at ~$250M (Jul 10) https://www.thewrap.com/industry-news/business/letterboxd-sale-netflix-sony-paramount/ ; TV Time shuts down Jul 15 (26.4M installs; "not enough demand for a paid app") https://techcrunch.com/2026/07/02/popular-tv-tracking-app-tv-time-is-shutting-down-as-company-focuses-on-ai/ ; Letterboxd re-confirms TV is coming https://www.reddit.com/r/Letterboxd/comments/1ul2860/ ; 30M+ members.
- Aug 9 2026: ~8-hour outage signs everyone out https://www.joblo.com/letterboxd-down-august-2026/ ; Aug 20: Intrinsic passes $100k.
- As of Sept 10 2026: no evidence TV seasons have shipped; Video Store has moved 5 "Unreleased Gems" titles to distributors (Wikipedia).

---

## 4. The culture: why people post, joke reviews, Four Favorites, the diary, what brings them back

Why people post. Three overlapping motives, in order of prevalence: (a) memory/journal — "use it so I know what I felt at the time"; (b) the post-movie debrief — "reading funny reviews in car after movies sparks engaging discussions" (12 pts); (c) audience — "writing for followers, not performing; reviews range from one to seven paragraphs" (8 pts, 1rwk008). The lurker majority logs and rates without writing: "Everyone fighting over whether you should post one-liners or genuine reviews is too much pressure" (cinephileandthecity, Jan 2026).

The joke-review phenomenon. Reviews sorted by popularity reward one-liners, which become screenshots on X/Reddit/TikTok (Bored Panda, "Letterboxd Reviews With Threatening Auras"). Defenders: "Letterboxd feels like the early days of Twitter when you could see stupid jokes alongside serious discussion" (Ira Madison III, Dec 2023); "people like funny jokes more than walls of text" (TheGamer, Jan 2024) https://www.thegamer.com/stop-complaining-about-dumb-letterboxd-reviews/ . Critics: "Nearly every Letterboxd review falls into one of a few archetypes" (neverhungover, Jul 2023) https://www.neverhungover.club/p/patiently-hating-4-letterboxd ; "a quirky one-liner is not a review, it's a comment" (1n24dyo); "The Great Letterboxd Divide": snobs vs meme lords (lookatmyprofile, Aug 2025). The March 2026 thread "being so goofy and unprofessional is why I love it" shows the pro-joke side is now the majority position on r/Letterboxd.

Four Favorites as identity. Users pick four films at signup; since 2023 it's Letterboxd's flagship video franchise (10M+ TikTok views by 2025). "The number four strikes a balance—more restrictive than five" (Spinoff, Apr 2025). "There's a pressure to present the perfect version of yourself... not too pompous, but not too basic" (birdbathpub, Apr 2024) https://birdbathpub.substack.com/p/letterboxd-four-favorites-why-do . Recurring asks to extend it: 5th slot, favorite actors/directors on profile (27 pts, top of 2025 wishlist), favorite characters, "top 4 actors".

The diary as journal. "Behind each entry was... a story, a different context or aim for each movie watched" (baldmenofthe90s, Mar 2024) https://baldmenofthe90s.substack.com/p/letterboxd-i-hardly-know-her-boxd . Users log retrospectively after breaks ("took year break; logged retrospectively instead"). Year in Review turns the diary into an annual identity artefact; Pro users get stats year-round.

What brings people back daily. Ambient friend activity ("a site I use multiple times a day"), the log-after-watch habit loop, checking likes on a review, watchlist-availability pings, and lists as ongoing projects. nogood.io: "The product keeps people coming back, and the product keeps spreading itself." The culture is now self-aware: Letterboxd's own account posts "3 stars is good actually" (Apr 2026) to fight grade inflation.

---

## 5. Why people STOP using Letterboxd, or never start

1. Tracking turns the hobby into a job (most common in quit essays). "turning my hobbies into chores"; "if I didn't meet my daily goals, I had totally failed as a person" (Dazed, Aug 2025) https://www.dazeddigital.com/life-culture/article/68461/1/why-i-quit-hobby-tracking-apps-letterboxd-goodreads-strava . "At some point I stopped getting lost in films and started picking them apart" (berrohn, 95k views) https://www.youtube.com/watch?v=qcyTaBgvPYE . "I can't enjoy movies anymore because of Letterboxd" (Jan 2026): fixes people found were removing ratings, private accounts, following few people https://www.reddit.com/r/Letterboxd/comments/1q3ak3r/ .

2. Performance anxiety / "resume" feeling. "The app is being increasingly treated as a resume" (Varsity, Apr 2026) https://varsitynewspaper.substack.com/p/the-letterboxd-ification-of-film ; friend "couldn't enjoy Poor Things because he was mentally drafting his Letterboxd review" (baldmenofthe90s); "Your letterboxd should not be a performance for strangers" (X, Aug 2026) https://x.com/aftersunfilm/status/2086097839256486277 ; Trustpilot: "Endless pretense and self righteousness".

3. Discourse fatigue. "I never feel compelled to engage in the 'discourse' online. It's all so tiresome." (The Kino Corner, "Why I Stopped Using Letterboxd", Jun 2026, 19k views) https://www.youtube.com/watch?v=rSyUnNNY-FY .

4. TV-first people never start. "If you watch TV series, Letterboxd cannot help you" (Moviebase, Apr 2026) https://moviebase.app/resources/best-letterboxd-alternatives-for-android ; TV Time's 26M users were pushed to Serializd/Trakt/Simkl/JustWatch in Jul 2026, not Letterboxd.

5. Lurkers who feel they can't post. "I've been on Letterboxd for so long without posting anything that if I started now, it would just make things weird"; too many IRL acquaintances follow them (cinephileandthecity). r/Letterboxd: "Not everybody is a good movie critic... You just have to curate your follows" (1n24dyo).

6. Casual viewers who find it pretentious or pointless. Film-school friend refuses to join, finds "users annoying" https://www.reddit.com/r/Letterboxd/comments/16ekeql/ ; "Because they're a bunch of pretentious asshole" https://www.reddit.com/r/Letterboxd/comments/18es6at/ ; 2021 "Letterboxed is Toxic": "It encourages being pretentious and appealing to the opinion of most" https://www.reddit.com/r/Letterboxd/comments/lgyff8/ ; Amy Wild initially "abandoned it due to finding it boring" and the app "looked like it crawled out of 2013".

7. Private-tracker people. "If you want a personal tracker without a social feed, Letterboxd may feel noisy" (Moviebase); "prefer a private library" (Achriom).

8. Platform trust erosion (new in 2026). Fear of "enshittification... more ads, more rushed AI, and terrible algorithms" under a studio owner (Gizmodo, Apr 2026) https://gizmodo.com/letterboxd-is-reportedly-looking-to-sell-out-2000751185 ; "A major film studio... would be the primary owner of one of the key destinations for folks to discuss their output" (Engadget, Jul 2026); outages and log-outs in Aug 2026.

---

## 6. Verbatim-ish feature wishes (each with source)
TV / media scope
- "TV shows coming to Letterboxd" (21 pts, top of thread) https://www.reddit.com/r/Letterboxd/comments/180mpsv/
- "I'd be 100% okay with it under a separate tab" (8) https://www.reddit.com/r/Letterboxd/comments/1p25x79/
- "It should be a seperate app or section called Pillarboxd" https://www.reddit.com/r/Letterboxd/comments/1q68qdd/
- "Keep TV separate from film side of platform" (13) https://www.reddit.com/r/Letterboxd/comments/1hge0mm/
- "Hide/Show Concert films" and "Hide/Show Standup Comedy specials" (19) https://www.reddit.com/r/Letterboxd/comments/1j4l28g/
- "Top 250 should separate narrative films from TV shows" (180mpsv)
- Anime film inclusion debate https://www.reddit.com/r/Letterboxd/comments/1plixu6/
Logging / diary
- "A mobile app draft feature was desperately needed" https://www.reddit.com/r/Letterboxd/comments/137oidf/ ; "Drafts folder for unpublished reviews" (1j4l28g); App Store "needs draft-saving functionality"
- "Did Not Finish" (vkoshg; 1i22a0e)
- "Option to choose between extended, directors, and theatrical cuts" (19) (1hge0mm); "Dropdown on the log menu for cuts/releases" (5) (1p2px5s)
- "Log movies by subtitle vs. dub option"; "Track theatrical vs. home viewing" (180mpsv)
- "Calendar diary view" (1i22a0e)
- "On This Day spotlight of movies logged that day in previous years" (13) (1p2px5s)
- "Tag movies without logging them first" (1i22a0e); "tagging unwatched films" https://www.reddit.com/r/Letterboxd/comments/1j4l28g/
- "Wants ability to ask questions without marking movies as watched" (App Store, Jun 2026)
- "A tag to say if you cried or not" (1qhy66f)
- "See how each diary entry affects stats... 'Your log moved Brad Pitt up 14 places'" (5) https://www.reddit.com/r/Letterboxd/comments/1joezk2/
- "Percentage watched tracker for completionists" (1i22a0e)
- "Quarter star ratings" (1i22a0e, 1p2px5s, 1j4l28g, 1joezk2); "Zero-star rating option" (1g8dg58)
- "rate direction, cinematography, musical score separately" (6) (1joezk2)
Watchlist
- "Add a note to a movie I add to my watchlist!" (14) (1p2px5s); "Add notes to watchlist films with spoiler text support" (1g8dg58)
- "Separate watchlist for unreleased movies with release notifications" (15) (1hge0mm); "Notify users when watchlist movies are releasing soon" (11) (1p2px5s)
- "Watchlist filtering: see what's 'forgotten'" (180mpsv); "High-priority watchlist tier" (1joezk2)
- "Shuffle feature with runtime filter (e.g., under 105 minutes)" (1i22a0e); "Random movie picker" (1qhy66f)
- "'never watching' filtering options" https://www.reddit.com/r/Letterboxd/comments/1joezk2/
Lists
- "Shared lists multiple people can edit together" (1i22a0e); collaborative lists (1hge0mm, 1joezk2, 180mpsv, X)
- "Folders for lists" (1e6pt3x, 1i22a0e, 1g8dg58); "Nested folders for tags" (6) (1j4l28g)
- "Sort order persistence" (1i22a0e, 1p2px5s, 1qhy66f)
- "cross-referencing lists" https://www.reddit.com/r/Letterboxd/comments/1sxesvu/ ; "compare list overlaps" (1p2px5s)
- "Being able to search my watched film list"; "Why can I not search my lists" (1e6pt3x)
- "Bookmark/save user-created lists" (1g8dg58); "Follow lists that update dynamically, like IMDb Top 250" (180mpsv)
- "Block lists and clones to reduce redundant 'Every film ever' compilations" (1joezk2)
- "list export as images for sharing" (1dfrtbw); "Make lists where you can add actors/directors" (1qhy66f)
Search / filter / metadata
- "Better, less strict search function" (9); "Did you mean?" suggestions (1dfrtbw); "spellcheck or suggestions" (punchamoorthee)
- "filtering by year ranges rather than single years" (1sxesvu)
- "Filter lists by language/country, not just genre"; "Search by language spoke" (1i22a0e, 1qhy66f)
- "Filter movies by combining/excluding tags, country-based release dates" (9) (1hge0mm)
- "Budget and box office numbers" (11) (1hge0mm); "showed what awards a film had won" (6) (1j4l28g)
- "MPAA rating display"; "Parent Guide feature similar to IMDb"; content-rating filters (App Store)
- "Filter for physical media-only availability" (180mpsv)
- "Filter out obscure filmography entries (documentaries, making-of)" (1joezk2); "filmographies that are strictly narrative features" (11) (1e6pt3x)
Reviews / feed
- "Sort reviews by minimum word count" (13) (1p2px5s); "let us filter reviews based on word count" (5) (1sscq19); "3-sentence minimum"
- "Option to default sort reviews by new instead of popularity" (3) (1joezk2)
- "'Sort by hot takes' - rank by score divergence from average" (2) (1i22a0e)
- "built-in translation feature" (35) (1j4l28g); language filtering for reviews (14) (1rwk008)
- "Spoiler covers for specific lines, not entire reviews" (1i22a0e); "Half-spoiler reviews" (10) (180mpsv)
- "hide review scores by default" (1p2px5s); "Hide ratings for unwatched films" (1g8dg58)
- "Half-spoiler... customizable 'read more' placement" (180mpsv)
- "Blog-type feature for general movie thoughts" (180mpsv); "forums" (pcsrwl)
- "Grammar/spelling correction for mobile reviews" (1i22a0e)
- "a little marijuana leaf button" to flag review context (X, 2026) https://x.com/Brocklesnitch/status/2047160579648078155
Social
- "threaded comments please we are in 2025 cant even reply to reviews" (1qhy66f); "reply-to-comments" (1i22a0e)
- "Liking comments and being able to @ people in them" (25) (1j4l28g)
- "Direct messaging between users" (1g8dg58, 1dfrtbw)
- "'Close friends' feed feature to reduce review clutter" (180mpsv, 1i22a0e); "Favorite following accounts to prioritize" (7) (1hge0mm)
- "Mute feature for followed users" (1g8dg58); "friend mutual tracking" (1i22a0e); "mutual follower visibility" (1joezk2)
- "'Like' or comment on friends' watched films without reviews" (1j4l28g)
- "Compatibility feature showing taste similarity between users" (180mpsv); "Compare watchlists with other users" (1i22a0e)
- "Notifications when followers rate/review films" (1g8dg58); "Notifications for specific friends' activities"
- "Connect with contacts" (1qhy66f); "A dating tab" (10) (1hge0mm); "dating functionality" (1m0kzbh)
- "Tag Letterboxd members in comments; member badges" (180mpsv)
- "Activity feed redesign with dropdown filters" (3) (1joezk2)
Profile / identity
- "ability to add favorite cast/crew to my profile" (27) (1hge0mm); "Favorite actors, directors, and characters on profile" (180mpsv); "top 4 actors" (1m0kzbh); "fifth favorite slot" (1p2px5s)
- "Private account option similar to Instagram" (180mpsv); "make your reviews/diary private" (7) (1j4l28g); "private profiles" (1qhy66f)
- "Private reviews and personal notes for movies you've watched" (1joezk2)
- "Custom posters shouldn't be behind a paywall" (10) (1e6pt3x)
- "displaying favorite reviews on profiles"; "pin reviews" (1qhy66f); "Change backdrop to something other than top movie" (1hge0mm)
- "Light mode" (1i22a0e); "Font too small with no option to change it" (1e6pt3x); "text color for dark mode" (Trustpilot)
Discovery
- "Spotify-style recommendations based on watched films and lists" (1ccultk); "AI-based recommendations from rated movies" (1g8dg58)
- "director/actor following with release notifications" (10jsmsw); "upcoming project tracking" (1668l8e)
- "localized upcoming release timelines with streaming info" (1qhy66f); "Sort upcoming movies by theater vs. digital release" (1hge0mm)
- "similar user discovery" (uru3c0)
- "Localized Theater Showtimes" (1qhy66f); "direct streaming app integration" (1j4l28g)
Stats
- "Year-end wrapped feature similar to Spotify" (1i22a0e); "expanded stats sections" (1p2px5s); "Expanded actor/director statistics beyond top 20" (1g8dg58)
- "Stats for unwatched films by actor/director" (180mpsv); "director filmography completion stats" (1p2px5s)
- "shorts separation in stats" (uru3c0) [shipped as a "shorts" tab per 1ul2860]
Platform
- "Release API or approve third-party access" (1i22a0e); "Auto-track movies from Plex integration" (1j4l28g); Trakt sync (Moviebase)
- "less intrusive ads" (pcsrwl); "Adblock detection popup requires exceptions for every page" (1dfrtbw)
- "Letterboxd equivalent for book tracking" (1i22a0e; Substack commenters)
- "widget improvements on mobile; release calendar with phone sync" (1p2px5s)
- "Swipeable film page backdrops showing multiple images"; "Gallery view of all movie posters" (180mpsv, 1j4l28g)

---

## 7. Top 10 insights for a competitor building a warmer, more habit-forming movie+TV journal

1. TV is the open goal, but it must be a silo with a toggle. Letterboxd has promised TV since 2023 and still hasn't shipped it (Sept 2026); TV Time's 26M users were orphaned in Jul 2026. The film community's fear is concrete and specific: episode-level spam in feeds, "reality fans" diluting ratings, Top-250 contamination. Ship season-level logging (not mandatory per-episode), a separate TV tab, and a per-follower/global toggle so film-only users never see it. The Reddit consensus wording is literally "under a separate tab" and "options to hide it".

2. The diary is the product; the review is optional. The single most-upvoted reason to use Letterboxd is logging + lists, and the biggest quit reason is that public reviewing turns watching into performance. Make the private log the default, with notes, DNF, cuts, rewatch context, "why I added this" watchlist notes, and drafts — then let people opt a given entry into public. Letterboxd's FAQ admits it is only now "working on more granular privacy options".

3. Design against the joke-review sort. Popularity-sorted one-liners are the #1 culture complaint and the #1 acquisition channel at once. Keep the humour, but offer word-count/"substantive" filters, default-to-friends sort, "hot takes" (divergence) sort, and reply threads. Users are asking for a "3-sentence minimum" filter, not a ban.

4. Warmth = friends first, strangers never by default. The feature people pay for and love is "what are my friends watching / would my friend rate this 2 stars". The features they want are close-friends feeds, likes on plain logs, @mentions, threaded replies, taste-compatibility, watchlist overlap, and collaborative lists (still missing on Letterboxd after 5 years of asks). None require an algorithm; all reinforce ambient intimacy.

5. Turn stats into a daily loop, not an annual paywall. Year in Review is beloved; "your log moved Brad Pitt up 14 places" (5 pts) shows the appetite for per-log feedback. On This Day, streaks-without-guilt, and free basic stats convert the quantified-self urge into a return visit while avoiding Letterboxd's "stats are Pro-only" resentment.

6. Anti-chore by design. Quitters cite arbitrary goals and "self-worth assigned to films watched". Offer backfill-friendly logging, no yearly target nagging, "took a break" grace, and a private-only mode. Letterboxd's own account is now telling users "3 stars is good actually" — build rating UX that normalises the middle.

7. Where-to-watch must be free, local, and actionable. Free Letterboxd users see only "featured services"; users abroad complain about region gaps; the Video Store's founding rationale is that watchlists rot. Make availability + "arrived on your service" notifications a core free feature, with per-country release dates and localized showtimes.

8. Fix the unglamorous basics Letterboxd never did: fuzzy search with "did you mean", search inside your own lists/watchlist, list folders, persistent sort, hide concert films/stand-up, language filters, built-in translation (35 pts), reliable notifications, an Android app as good as iOS, and no full-screen ads mid-review. These are the most frequently upvoted asks after TV.

9. Identity slots are cheap and beloved — expand them. Four Favorites is the brand; the top 2025 wish is favorite actors/directors on profile (27 pts), plus a 5th slot, favorite characters, pinned reviews, custom art without a $40/yr tier. Let people show taste, not just consumption.

10. Own the trust narrative. In 2026 Letterboxd's users fear a studio owner, enshittification, paywall creep (activity filters moved to Pro; "How is there not more outrage"), outages, and a 2.2/5 Trustpilot dominated by phishing and support failures. A competitor that is explicit about independence, data export/API, sane ads, and responsive support can win the lapsed and the wary — and the Intrinsic PBC campaign shows some users will literally pay to keep a film community independent.
