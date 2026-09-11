# Why People Keep a Record of What They Watch — and What It Means for a Movie/TV Journal

*Behavioral-science research brief for the product team. Prepared 2026-09-10.*

**Method.** ~55 web searches and ~40 source fetches; I read primary papers where I could (several extracted from PDF locally), and fell back to abstracts, official company blogs, or reputable long-form journalism where paywalls blocked full text. Every claim below carries an evidence tag:

- **[PR]** peer-reviewed paper or meta-analysis
- **[IND]** company/industry data (Nielsen, Deloitte, Duolingo blog, Letterboxd) — real numbers, but self-interested and usually not causal
- **[LF]** long-form journalism, essays, community threads — good for *how it feels*, not for effect sizes
- **[BK]** classic book/theory — foundational, but not itself an experiment

Where a widely repeated "finding" turned out to be weak or unreplicated (Zeigarnik, shared attention, Hooked), I say so.

---

## 1. One-page synthesis: the seven reasons people keep a record, and what each implies

| # | Reason | Core evidence | What it implies for a movie/TV journal + social app |
|---|---|---|---|
| 1 | **To remember who they were.** A dated log is an externalized autobiographical memory; its job is *self-continuity* (being the same person across time), not accounting. | Conway & Pleydell-Pearce 2000 [PR]; Bluck & Alea 2008/2011 [PR]; Konrad et al. 2016 [PR]; Letterboxd diary essays [LF] | The **date** is the product. Optimize the log for being re-read in five years: "on this day", year-in-review, where/with-whom context. A rating without a date is a database row; a date with a note is a memory cue. |
| 2 | **To say who they are.** Taste is identity, and a public profile is a curated self-portrait; people will perform it. | Bourdieu 1984 [BK]; Berger 2014 [PR]; Launay & Dunbar 2015 [PR]; Letterboxd "four favorites" culture [LF] | Separate the **curated public face** (favorites, lists) from the **honest private log**. Give people small, editable identity surfaces (a top-4, not a top-40). Expect performative logging if everything is public. |
| 3 | **To finish something.** Collecting works because it turns a diffuse hobby into concrete, attainable goals with visible progress; started sets get resumed (Ovsiankina ≈ 67% resumption) — but the "unfinished things haunt memory" story (Zeigarnik) largely does not replicate. | McIntosh & Schmeichel 2004 [PR]; Ghibellini & Meier 2025 meta-analysis [PR]; Norton et al. 2012 [PR] | Offer **small, finishable sets** (a director's six films, a friend's 10-film list, a season) rather than an ever-growing watchlist. Progress on a bounded set motivates; an unbounded backlog demoralizes. |
| 4 | **To feel it again — before, during, after.** Savoring has three tenses (anticipation, moment, reminiscence); nostalgia and rewatching are emotion-regulation tools, not laziness. | Bryant & Veroff 2007 [BK]; Smith & Bryant 2021 [PR]; Sedikides & Wildschut 2008/2022 [PR]; Russell & Levy 2012, Shackleford et al. 2025 [PR] | Treat the watchlist as **anticipation**, not a to-do list ("why I want to see this"). Make **rewatching first-class** (comfort shelf, rewatch counts). Resurface old entries with care (negative memories can contaminate mood). |
| 5 | **To decide faster.** Choice overload on streaming is measured and growing (7 → 10.5 → ~12 minutes per session; ~1 in 5 give up); deferral, not choosing, is what produces stress. | Gomez-Uribe & Hunt 2015 [PR/IND]; Nielsen 2019–2024 [IND]; Kim, Choi & Bao 2025 [PR]; Romero Meza & D'Urso 2024 [PR] | The journal's most valuable job on a Tuesday night is producing a **shortlist of three**, ideally from people the user trusts. Build a "tonight" mode that shrinks the choice set instead of expanding it. |
| 6 | **To be together.** Watching the same thing, at the same time or in the same social circle, creates a shared social world; shared media predicts closeness, especially for couples without shared friends. Ambient awareness of friends' activity is the retention glue of small social networks. | Gomillion et al. 2017 [PR]; Shteynberg 2015 [PR, contested]; Kim et al. 2021 [PR]; Thompson 2008 [LF]; Franken et al. 2023 [PR] | "**Watched with**" is a core field, not metadata. Co-logging, a friends-only feed of what people watched (ambient, low-pressure), and recommendation-as-gift ("I told you so" loops) are the social features with evidence behind them. |
| 7 | **To have made something.** Labor produces ownership (IKEA effect) — but only for *completed* things; people overvalue what they've curated and hate losing it. | Norton, Mochon & Ariely 2012 [PR]; Kahneman, Knetsch & Thaler 1990 [PR]; psychological-ownership literature [PR] | Let people build **artifacts they own** (lists, notes, a "shelf") and export them. The endowment effect is your retention moat *and* the reason lapsed users feel guilty. Never delete or hide their work; make coming back feel like re-opening a drawer, not starting over. |

**The one-sentence version:** people keep a record to remember, to signal, to finish, to feel, to decide, to belong, and to own — and the mechanics that corrode (streaks, counts, leaderboards) do so precisely when they replace reasons 1, 4 and 6 with reason 3 in its most compulsive form.

---

## 2. Per-topic findings

### 2.1 Motives for logging and collecting

#### Self-continuity and autobiographical memory
- **Conway & Pleydell-Pearce (2000)**, *Psychological Review* — the Self-Memory System: autobiographical memory is organized by lifetime periods, general events and event-specific knowledge, and its job is to maintain a coherent "working self" over time. [PR] https://www.researchgate.net/publication/12528554
- **Bluck & Alea (2008; 2011, the TALE scale)** — three empirically separable functions of remembering: **self-continuity**, **social bonding**, and **directing behavior**. [PR] https://lifestorylab.psych.ufl.edu/wp-content/uploads/sites/84/bluck-alea-self-continuity-2008.pdf ; https://lifestorylab.psych.ufl.edu/wp-content/uploads/sites/84/bluck-alea-crafting_the_tale-2011.pdf
- **Konrad, Tucker, Crane & Whittaker (2016)** — "Technology and Reflection", 30-day field RCT (n=128) using an app that resurfaces logged memories. Reflecting on *positive* memories while in a bad mood improved momentary mood (d ≈ 1.15); reflecting on negative memories while happy *worsened* it (d ≈ 1.01). No significant change on long-term well-being scales. Also: resurfaced negativity can "contaminate" good moods. [PR] https://pmc.ncbi.nlm.nih.gov/articles/PMC4909790/
- **Facebook "On This Day"**: ~90 million people/day used it (2018 press reporting); Konrad's applied research found people favored posts using words like "miss" and disliked resurfaced food photos, swearing, and sexual content. [IND/LF] https://blog.prototypr.io/facebook-memories-the-research-behind-the-products-that-connect-you-with-your-past-f9a1d8a49a43 ; https://www.apa.org/monitor/2019/03/job-konrad
- Letterboxd users describe the diary as exactly this: a way to keep track of thoughts over time; Letterboxd itself distinguishes "marking watched" (a fact) from "logging" (a dated diary entry). [LF/IND] https://letterboxd.zendesk.com/hc/en-us/articles/15178778774543 ; https://amywild.substack.com/p/why-letterboxd-is-the-only-social

**Product implications**
1. Make the diary entry (date + optional context + optional note) the primary object; ratings and "watched" flags are derived from it, not the other way round.
2. Build "on this day / one year ago" resurfacing, but filter by valence: resurface high ratings, rewatches, and entries with "watched with" by default; make low-rated or "abandoned" entries opt-in. Konrad's data says mood-incongruent negative memories hurt.
3. Capture the *social* context of memory (who, where, occasion) because Bluck & Alea's social-bonding function is as strong as the self function.

#### Identity signaling and taste as identity
- **Bourdieu (1984), *Distinction*** — "taste classifies, and it classifies the classifier"; aesthetic choices are distinctions made in opposition to other groups. [BK] https://en.wikipedia.org/wiki/Distinction_(book)
- **Berger (2014)**, *J. Consumer Psychology* review — word of mouth serves five self-serving functions: impression management (self-enhancement, **identity-signaling**, filling conversational space), emotion regulation, information acquisition, social bonding, persuasion. People share unique things to show they have discriminating taste, and around 60% of retold stories are distorted to serve the teller. [PR] https://faculty.wharton.upenn.edu/wp-content/uploads/2014/12/WOM-Review.pdf
- **Launay & Dunbar (2015)**, *PLOS ONE* — two online experiments (n=294; n=195): of 14 shared traits, **music taste was the strongest predictor** of liking a stranger, ahead of religion, ethics, politics; demographics mattered least. [PR] https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0129688
- **Parkinson, Kleinbaum & Wheatley (2018)**, *Nature Communications* — friends' neural responses to the *same video clips* are exceptionally similar, and similarity decays with social distance. Taste proximity is literally measurable in the brain. [PR] https://www.nature.com/articles/s41467-017-02722-7
- **Letterboxd "four favorites" culture** — journalism and essays describe the top-4 grid as a "personality test" and "mission statement"; people check a date's Letterboxd before meeting; choices get policed as "pretentious" vs "basic". [LF] https://younghollywood.com/scene/letterboxd-gen-z-personality-test.html ; https://izzyscott.substack.com/p/what-makes-a-perfect-letterboxd-top
- **Spotify Wrapped** — Annabell & Rasmussen (2025), *New Media & Society*, analyze Wrapped as an "algorithmic event" that repackages behavior as identity in a story-format built for sharing; workshop research (J. Gender Studies 2024) documents "Wrapped anxiety" and **performative listening** — people change behavior so the summary looks right. [PR] https://journals.sagepub.com/doi/10.1177/14614448251391301 ; https://www.tandfonline.com/doi/full/10.1080/09589236.2024.2433674

**Product implications**
1. Give every user a tiny, high-signal identity surface (top-4 films, a "comfort watch", a "hill I'll die on") — small enough to curate carefully, distinctive enough to start conversations. This is the feature Launay & Dunbar's data says will make strangers like each other.
2. Keep the identity surface *separate* from the complete log, and make the log private by default; otherwise Wrapped-style performative logging pollutes the data you need for reason #1 and #5.
3. Anti-snobbery is a design choice: Amy Wild's essay credits Letterboxd's tone (gushing over *High School Musical* next to dunking on *The Irishman*) for making it feel safe. Copy, defaults, and moderation should reward honesty over prestige.

#### Completionism and the collector's mindset
- **Belk (1988)**, *J. Consumer Research*, "Possessions and the Extended Self" — curated possessions become part of the self; their loss is experienced as grief. Cushing (2011) extends this to *digital* possessions. [PR] https://academic.oup.com/jcr/article-abstract/15/2/139/1841428 ; https://asistdl.onlinelibrary.wiley.com/doi/10.1002/meet.2011.14504801304
- **McIntosh & Schmeichel (2004)**, *Leisure Sciences* — collecting bolsters the self by creating goals that are tangible, attainable, and give concrete feedback on progress; an eight-step process (goal formation → hunting → acquisition → post-acquisition → cataloguing/display → ...). [PR] https://www.tandfonline.com/doi/abs/10.1080/01490400490272639
- **Carey (2008)**, *J. Economic Psychology*, "Modeling collecting behavior: the role of set completion" — the desire to complete a defined set is the engine; value of items rises as the set nears completion. [PR] https://www.sciencedirect.com/science/article/abs/pii/S0167487007000682
- **Cao, Brucks & Reimann** — desire for control motivates collecting; collections impose structure. [PR, working-paper PDF] https://martinreimann.com/pdf/Cao,%20Brucks,%20Reimann.%20Seeking%20Structure%20in%20Collections.pdf

**Product implications**
1. Completion needs a *bounded set*. "Everything on my watchlist" is not a set; "all 7 Kubrick films from 1968 on", "the 12 films my sister recommended", or "Season 2" are. Surface progress on bounded sets prominently and let users define their own.
2. Cataloguing/display is a stage of collecting, not a by-product: shelves, posters-grid views, and stats are the "display case" and deserve real design investment.

#### Zeigarnik and Ovsiankina — what actually replicates
- **Ghibellini & Meier (2025)**, *Humanities & Social Sciences Communications*, meta-analysis of 59 publications: the **Zeigarnik effect (better memory for interrupted tasks) does not hold** — weighted recall ratio 0.99, d_z ≈ 0.15, and in achievement-pressure settings interrupted tasks are remembered *worse* (ratio 0.88). The **Ovsiankina effect (tendency to resume an interrupted task) is robust**: ~67% resumption across studies. [PR] https://www.nature.com/articles/s41599-025-05000-w
- Pop-science framing (Ness Labs, gamification blogs) still presents Zeigarnik as settled; treat those as [LF]. https://nesslabs.com/unfinished-tasks

**Product implications**
1. Don't design on the assumption that unfinished items nag at memory — they don't. Design on the assumption that *already-started* things get resumed: "Continue watching" for series and half-finished lists is the mechanism with evidence, not "you have 212 unwatched films".
2. The meta-analysis's moderator (achievement pressure suppresses the effect) is a warning against turning the watchlist into a performance target.

#### Endowment, ownership and the IKEA effect
- **Kahneman, Knetsch & Thaler (1990)**, *J. Political Economy* — owners demand ~2× what buyers will pay for the same mug; the endowment effect. [PR, classic; not fetched this session]
- **Norton, Mochon & Ariely (2012)**, *J. Consumer Psychology* — the IKEA effect: people value self-assembled products near expert-made ones, **but only when the task is completed**; incomplete or destroyed builds eliminate the effect. [PR] https://www.sciencedirect.com/science/article/abs/pii/S1057740811000829
- Psychological-ownership literature (Morewedge et al., Wharton framework) — ownership feelings arise from control, customization and invested effort; consumers feel *less* ownership of digital goods than physical ones. [PR] https://faculty.wharton.upenn.edu/wp-content/uploads/2020/11/EvolutionofConsumption_APsychologicalOwnershipFramework.pdf

**Product implications**
1. Lists and notes are user-built artifacts: let them be named, ordered, described, and exported. Ownership is the reason people don't churn to the next app.
2. The IKEA boundary condition matters: half-finished lists or import jobs that stall produce *no* attachment. Make list creation finishable in one sitting (templates, import, "start with 5").

#### Quantified self
- **Choe, Lee, Lee, Pratt & Kientz (2014)**, CHI — analysis of 52 Quantified Self talks: motivations were health (67%), other goals, work efficiency, and curiosity/new experiences; common **pitfalls: tracking too many things, not tracking context/triggers, insufficient rigor**. [PR] https://dl.acm.org/doi/10.1145/2556288.2557372
- **Epstein et al. (2016)**, CHI, "Beyond Abandonment" (n=193 + 12 interviews) — six reasons for stopping: cost of collecting, cost of having/sharing data, discomfort with what the data reveals, data-quality concerns, learned enough, life circumstances changed. Five perspectives after quitting: no effect, frustration, **guilt**, freedom, still using learned skills. [PR] https://www.smunson.com/portfolio/projects/lifelogs/life_after_tracking_chi16.pdf

**Product implications**
1. The pitfall Choe et al. name — "not tracking context" — is the one a movie journal can fix cheaply: where, with whom, what mood, what occasion. That context is what makes entries re-readable later.
2. Design for the "learned enough" exit: a journal is not a health intervention, so people never *graduate* from it — but they do plateau. Give them a reason to keep the record even when they've stopped rating (memory, social), or they'll churn with guilt.

#### Nostalgia
- **Sedikides, Wildschut, Arndt & Routledge (2008)**, *Current Directions* — nostalgia is a predominantly positive, social emotion that raises positive affect, self-esteem, social connectedness and existential meaning. [PR] https://journals.sagepub.com/doi/abs/10.1111/j.1467-8721.2008.00595.x
- **Sedikides et al. (2016)**, *Emotion* — nostalgia fosters self-continuity **via** social connectedness, and this confers eudaimonic well-being (vitality). [PR] https://engagedscholarship.csuohio.edu/clpsych_facpub/59/
- **Wildschut & Sedikides (2022)** chapter — external triggers include **music, song lyrics, smells, tastes, objects/events from childhood**; the most common internal trigger is **loneliness**; nostalgia acts as a homeostatic corrective. [PR] https://www.southampton.ac.uk/~crsi/Wildschut%20&%20Sedikides,%202022.pdf

**Product implications**
1. "Films you watched N years ago this month" is a nostalgia trigger by design; it works best when it foregrounds people ("you watched this with Sam") because social connectedness is the mediator.
2. Nostalgia is triggered by loneliness — resurfacing shared viewing is a plausibly kind feature for lapsed or isolated users, and a plausible re-activation hook.

#### Journaling and well-being (Pennebaker)
- **Pennebaker's expressive-writing paradigm**: across 100+ studies the average health effect is small (Cohen's d ≈ 0.16 per Pennebaker & Chung's review); Smyth's 1998 meta-analysis of healthy participants found d ≈ 0.47; adolescent meta-analysis (Travagin et al. 2015) g ≈ 0.13. Effects are real but modest and depend on engagement and instructions (2023 replication work). [PR] https://c3po.media.mit.edu/wp-content/uploads/sites/45/2016/01/PennebakerChung_FriedmanChapter.pdf ; https://www.sciencedirect.com/science/article/abs/pii/S0272735815000161 ; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10300201/

**Product implications**
1. Don't oversell "journaling is good for you"; the well-being effect is small. Sell the *memory* and *social* payoffs instead.
2. What the literature does support: prompts that invite emotion ("how did it land?") outperform blank boxes for engagement. Use them.

#### Savoring and anticipation (Bryant & Veroff)
- **Bryant & Veroff (2007)**, *Savoring: A New Model of Positive Experience* — three temporal modes: anticipation, savoring the moment, reminiscence; they are only weakly correlated (separate skills). [BK]
- **Smith & Bryant (2021)** review — savoring capacity predicts happiness beyond personality; broader savoring repertoires → higher happiness; **anticipating an experience heightens enjoyment during and after it**; deliberately planning positive experiences with friends predicts life satisfaction more than passive approaches. [PR] https://pmc.ncbi.nlm.nih.gov/articles/PMC8712667/
- **Shu & Gneezy (2010)**, *J. Marketing Research*, "Procrastination of Enjoyable Experiences" — people postpone pleasant experiences just as they postpone chores; in their field experiments, gift certificates with *shorter* deadlines were redeemed far more often than ones with generous deadlines. [PR; confirmed by DOI 10.1509/jmkr.47.5.933, full text not fetched — verify exact rates before quoting them]

**Product implications**
1. The watchlist is an anticipation device. Ask "why do you want to see this?" at save time; show that note when the user returns. Anticipation is a savoring skill you can scaffold.
2. Enjoyable things get procrastinated. Deadlines and occasions ("this weekend", "leaving Netflix on the 30th") are not manipulative here — they are the thing that gets people to the pleasure they already wanted.

---

### 2.2 Habit and retention mechanics — and their critiques

#### Fogg Behavior Model (B = MAP)
- **Fogg (2009)**, Persuasive Technology conference — behavior happens when motivation, ability and a prompt converge; increasing *ability* (making it easier) beats increasing motivation. A 2025 scoping review (BMC Public Health) finds FBM-based interventions show positive outcomes, but the model itself has never been validated by RCTs of its specific predictions, and critics note it models a single moment, not sustained habits. [PR conference paper + review] https://www.behaviormodel.org/ ; https://link.springer.com/article/10.1186/s12889-025-24525-y

**Implication:** the model is a reasonable design heuristic, not a law. Its useful half is "reduce ability cost": the log action should be one tap from wherever the user already is (share sheet, notification after a known viewing, calendar).

#### Hooked / variable rewards (Eyal) and the ethical critique
- **Eyal (2014)**, *Hooked* — trigger → action → variable reward → investment. [BK]
- Critiques: Yu-kai Chou argues the Hook Model builds compulsion via "black hat" drives rather than habits; the Center for Humane Technology / "Time Well Spent" position is that engagement metrics themselves are the problem; **Monge Roffarello & De Russis (2022, CHI EA)** catalog "attention-capture dark patterns" (infinite scroll, autoplay, streaks-as-pressure). [LF + PR] https://yukaichou.com/gamification-analysis/hook-model-octalysis-habit-addiction/ ; https://dl.acm.org/doi/fullHtml/10.1145/3491101.3519829
- **Mogavi et al. (2022)**, ACM Learning@Scale, "When Gamification Spoils Your Learning" — nine years of Duolingo forum data + 15 interviews: gamification *misuse* is driven by competitiveness, overindulgence in playfulness, herding, and "dark nudges"; consequences include reduced learning, obsessive attachment ("My brother lost his 110-day streak, and now he is an abandoned account"), disrupted sleep. The most-requested fix from users was **the option to disable gamification** entirely. [PR] https://doi.org/10.1145/3491140.3528274

**Implication:** the "investment" step of the Hook Model is the legitimate one for a journal (users invest data that makes the product better for them). The "variable reward" step is where the ethics break; a journal doesn't need slot-machine feeds.

#### Streaks: Duolingo and Snapchat
- **Duolingo (company blog, 2023)** — 7-day streak users are 3.6× more likely to complete a course (correlational); milestone animations lifted 7-day retention +1.7%; **doubling streak-freeze allowance raised DAU +0.38%**, explicitly citing research that "slack" in goals sustains motivation better than rigid rules. [IND] https://blog.duolingo.com/how-duolingo-streak-builds-habit/
- **Jackson Shuttleworth (Duolingo retention PM) on Lenny's Podcast** — 600+ streak experiments; simplifying the streak to "one lesson a day" beat XP-tied streaks; "commit to my goal" copy beat "continue"; letting users **opt out / choose duration** *increased* retention; and "if users don't find inherent value in your product, streaks won't change that". [IND/LF] https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks
- **Mogavi et al. (2022)** — see above: streak loss → account abandonment. [PR]
- **van Essen & Van Ouytsel (2023)**, *Telematics & Informatics Reports* — 2,483 Belgian early adolescents (M age 13.5): 83% of girls and 67% of boys had a live Snapstreak; streak engagement correlated with problematic smartphone use, FOMO and lower social-media self-control, but **weakly (r ≈ 0.09–0.12)**; the authors argue streaks are mostly a normative communication ritual, with peer-pressure norms attached. [PR] https://www.sciencedirect.com/science/article/pii/S2772503023000476

**Implication:** streaks work when the unit is trivially achievable and the user controls the terms; they corrode when losing one erases a visible identity asset. See §3.

#### Goodreads Reading Challenge
- **Jafari, Sabri & Bahrak (2021)**, arXiv — large-scale Goodreads scrape: mean pledge ≈ 36.6 books/yr, mean read ≈ 23.3; people read significantly more in years they join a challenge (81% read more on average); posts about the challenge spike in January (19–22% of the year's posts) and again in December; sentiment of posts is rarely negative (~5%). The paper does *not* measure book length or abandonment. [PR-preprint] https://arxiv.org/abs/2012.03932
- **Quantity-over-quality**: the widely repeated claim that the challenge pushes people toward short books and rushed reading rests on essays and reader testimony, not measurement — but the testimony is consistent and vivid (rushing, picking novellas, feeling relief on marking "read", quitting the challenge to recover the joy). [LF] https://adam-mckenna.medium.com/the-goodreads-reading-challenge-is-a-fallacy-heres-why-4dad678c6aeb ; https://arielcurry.com/2020/12/21/why-im-not-doing-the-goodreads-challenge-in-2021/ ; https://thestraymag.wordpress.com/2021/02/19/is-goodreads-actually-good-for-reading/

**Implication:** an annual *count* target measurably raises volume and comes with a January/December rhythm you can plan around; it also invites gaming the unit. A film journal should let people set goals in units that can't be gamed toward junk (hours, "films outside my usual", "one film with a friend a month") or none at all.

#### Strava (kudos, segments) and Untappd (badges)
- **Franken, Bekhuis & Tolsma (2023)**, *Social Networks* — longitudinal Strava network data: **receiving kudos caused runners to run more and more often**, and runners converged toward the behavior of their "kudos-friends" (people they gave kudos to). [PR] https://www.sciencedirect.com/science/article/pii/S0378873322000909
- **Kolnes & Øvretveit (2026)**, *Behavioral Sciences* — 225 Norwegian club runners: Strava helps via feedback, routine and connection, but adds comparison pressure ("everything becomes a competition, every day"); runners who *deleted slow workouts* scored higher on avoidance goals — image management undermining intrinsic motivation, especially when injured. Many coped by hiding activities or muting notifications. [PR] https://pmc.ncbi.nlm.nih.gov/articles/PMC12938745/
- **Molléri et al. (2026)**, Dark Software Engineering workshop — 2020→2025 longitudinal ethical audit of Untappd: badges ("99 Bottles"), streaks and location challenges persisted with only superficial disclaimers; the authors judge the gamification of drinking ethically unresolved. [PR-workshop] https://arxiv.org/abs/2601.04841

**Implication:** low-cost social affirmation (kudos/likes on a log entry) has *causal* evidence for sustaining activity, and the influence flows along the edges people choose. Leaderboards and segments are where comparison turns into hiding. For a film journal: likes on diary entries yes; ranking friends by films-watched no.

#### Wordle's shareable grid
- Josh Wardle added the emoji share grid in December 2021 after a New Zealand player did it by hand; the grid is spoiler-free, legible at a glance, and tells a small story of luck or struggle. Growth followed the share format, not marketing. [LF/IND] https://x.com/powerlanguish/status/1471493886031773707 ; https://puzzlecottage.com/wordle-history

**Implication:** the winning share unit is (a) spoiler-free, (b) legible without the app, (c) about *the person's experience*, not the product. A film-journal equivalent: a 4-poster "this month" grid, or "3 friends have this on their list", not a rating screenshot.

#### Spotify Wrapped and the year-in-review effect
- Annabell & Rasmussen (2025) and the 2024 J. Gender Studies workshops (above) — Wrapped succeeds because it makes data feel like identity in a story format; the cost is performative behavior and "Wrapped anxiety". Letterboxd gates its Year in Review behind ≥10 diary entries and a Pro subscription — a year-in-review is both a retention and a monetization surface. [PR + IND] https://letterboxd.com/about/faq/

**Implication:** year-in-review is the single strongest *re-activation* moment you can manufacture; design it to reward honesty (most rewatched comfort film, most-watched-with person) rather than volume.

#### Loss aversion, the fresh-start effect, implementation intentions
- **Dai, Milkman & Riis (2014)**, *Management Science* — gym visits, goal commitments and "diet" searches all jump after temporal landmarks (new week, month, year, semester, birthdays), because landmarks let people separate from a "past imperfect self". [PR] https://pubsonline.informs.org/doi/10.1287/mnsc.2014.1901
- **Gollwitzer & Sheeran (2006)** meta-analysis, 94 studies, n > 8,000 — forming if-then plans (when/where/how) raises goal attainment by **d = 0.65**, and d ≈ 0.61 specifically for "getting started". [PR] https://www.researchgate.net/publication/37367696
- **Sheeran & Webb (2016)**, "The Intention–Behavior Gap" — intentions translate into behavior only about half the time; the gap is largest for behaviors that are pleasant but unscheduled. [PR; confirmed by DOI 10.1111/spc3.12265, abstract not retrievable this session]

**Implication:** a bare "watch later" is an intention with no if-then. The evidence says attach a *when* ("Friday"), a *where/with* ("with Priya"), and a *cue* ("when the kids are asleep"). Fresh-start moments (New Year, birthday, new season drop, moving house) are the right time to prompt list clean-ups and goals.

#### Paradox of choice and recommendation fatigue on streaming
- **Gomez-Uribe & Hunt (2015)**, *ACM TMIS* — Netflix's own consumer research: a member loses interest after **60–90 seconds** of browsing, having looked at 10–20 titles (≈3 in detail); beyond that, abandonment risk rises. [PR/IND] https://dl.acm.org/doi/10.1145/2843948
- **Nielsen** — average time to choose: 7.4 min (2019), 10.5 min (2023, with ~2.7M titles available and **1 in 5 sessions abandoned** with no viewing), ~12 min (2024 reporting). [IND] https://deadline.com/2019/07/streaming-overload-netflix-nielsen-report-average-viewer-takes-7-minutes-to-pick-what-to-watch-1202640213/ ; https://www.nielsen.com/news-center/2023/nielsens-state-of-play-report-delivers-new-insights-as-streamings-next-evolution-brings-content-discovery-challenges-for-viewers/ ; https://www.tvtechnology.com/news/study-streamers-now-wasting-record-amounts-of-time-finding-something-to-watch
- **Kim, Choi & Bao (2025)**, *Asian J. Public Opinion Research* — 443 Korean Netflix subscribers, SEM: content overload → choice deferral (β = .31); **affective ambivalence** (conflicted feelings about what to pick) is the strongest driver of deferral (β = .59); deferral → stress (β = .62); **social capital slightly reduces deferral** — having people to ask helps. [PR] https://www.ajpor.org/article/129993
- **Romero Meza & D'Urso (2024)**, *Psychological Studies* — 12 Netflix interviews: prolonged search, high effort, moderate satisfaction, recommendations perceived as unattractive and low-diversity; users rely on the rows yet are repeatedly disappointed — the "user's dilemma". [PR] https://link.springer.com/article/10.1007/s12646-024-00807-0
- **Deloitte Digital Media Trends 2025** (n=3,595 US) — 53% say they get better recommendations from social media than from streaming services; 56% of Gen Z/millennials watch something after hearing about it from an online creator; 39% cancelled a service in six months, 24% churn-and-return. [IND] https://www.deloitte.com/us/en/insights/industry/technology/digital-media-trends-consumption-habits-survey/2025.html

**Implication:** the competitive gap is not "more recommendations" — it's a **trusted, small, socially sourced shortlist**. Three titles from people you follow beats forty rows. Design the "tonight" surface to fit within Netflix's own 60–90-second attention window.

---

### 2.3 Social mechanics

#### Social proof, taste proximity and homophily
- Launay & Dunbar 2015 and Parkinson et al. 2018 (above): shared taste is the strongest cue for liking a stranger, and friends process films similarly at the neural level. [PR]
- Last.fm network analysis (arXiv 2111.00562): friends share not just artists but *preference styles* (mainstream vs. niche, diversity-seeking), and this homophily predicts new links. [PR-preprint] https://arxiv.org/abs/2111.00562

**Implication:** "taste match" scores between friends are grounded in real psychology; but show *why* (the overlap), not just a percentage, because the overlap is what starts the conversation.

#### Why niche communities retain (Reddit-style vs. broadcast)
- **Nielsen (NN/G, 2006)** — 90-9-1 participation inequality; the distribution can't be changed much, but you can (1) lower the bar to contribute, (2) make participation a side effect of use, (3) let people *edit* rather than create from blank, (4) reward modestly, (5) surface quality contributors. [LF/IND] https://www.nngroup.com/articles/participation-inequality/
- Statsignificant's Letterboxd analysis: users arrive by typing the URL (destination behavior), spend longer per visit than on IMDb, and heavily read reviews *for films they haven't seen* — lurking is a core use, not a failure mode. [LF/IND] https://www.statsignificant.com/p/the-rise-and-potential-fall-of-letterboxd

**Implication:** design for the 90% lurkers as first-class users (reading friends' diaries is the product), and make the 9% contribution a by-product of logging (a rating *is* a contribution). A "review" should not be the only contribution unit.

#### Parasocial vs. reciprocal
- Kowert & Daniel (2021), *Computers in Human Behavior Reports* — live streaming produces "one-and-a-half-sided" relationships; reciprocity, even minimal, changes the bond. [PR] https://www.sciencedirect.com/science/article/pii/S2451958821000981
- Deloitte 2025: ~50% of Gen Z/millennials feel a stronger personal connection to creators than to actors. [IND]

**Implication:** a film journal's social graph should be reciprocal-by-default (friends), with parasocial follows (critics, creators) as a clearly separate lane; the reciprocal lane is where retention lives.

#### Ambient awareness
- **Thompson (2008)**, *NYT Magazine*, "Brave New World of Digital Intimacy" — a stream of small updates coalesces into a pointillist portrait of friends' lives; it feels like being physically near someone. [LF] https://www.nytimes.com/2008/09/07/magazine/07awareness-t.html

**Implication:** a quiet feed of "Sam watched *Columbo* last night" needs no likes or comments to be valuable; it is ambient intimacy. Don't make people perform to appear in it.

#### Fear of judgment and how prompts reduce it
- Rosenberg's evaluation apprehension (1965) is the classic construct. [BK]
- **"Seeking safer spaces" (2020)**, *Computers in Human Behavior* — young adults' fear of negative evaluation on Facebook/Instagram is mitigated by *audience expectations* (who will see it) and *posting type*. [PR] https://www.sciencedirect.com/science/article/abs/pii/S074756322030087X
- WeChat study (2021): fear of evaluation reduces disclosure frequency but *raises* the drive to make a good impression — people post less, and more carefully. [PR] https://pmc.ncbi.nlm.nih.gov/articles/PMC8424039/
- NN/G's "edit, don't create" principle (above) is the practical version: a blank box is the highest-apprehension surface you can ship.

**Implication:** replace the blank review box with structured, low-stakes prompts ("one word", "would you rewatch?", "who should see this?"), and let people choose audience per entry. Both reduce evaluation apprehension.

#### Reciprocity and the gift of recommending
- **Berger (2014)** — recommending is self-serving (looks smart, signals taste) *and* bonding; people share what makes them look good and what creates common ground. [PR]
- **Kim, Choi & Bao (2025)** — social capital reduces choice deferral. [PR]

**Implication:** build the "I told you so" loop explicitly: when a friend watches something you recommended, both of you should find out. That closes the gift with recognition (Berger's self-enhancement) and it's the reciprocity engine.

#### Watching together / co-viewing
- **Shteynberg (2015)**, *Perspectives on Psychological Science* — shared-attention theory: attending to the same thing at the same time as others deepens processing, intensifies emotion, and strengthens memory; Shteynberg et al. (2014) found scary ads scarier and sad clips sadder when co-attended. [PR] https://journals.sagepub.com/doi/10.1177/1745691615589104
  - **Caveat:** **Mairon et al. (2020)**, *Scientific Reports*, found **no amplification** of attention or memory by shared attention in an EEG study, and a 2025 hyperscanning study reports mixed results. Treat "shared attention amplifies" as plausible but contested. [PR] https://www.nature.com/articles/s41598-020-65311-7
- **Gomillion, Gabriel, Kawakami & Young (2017)**, *J. Social & Personal Relationships* — two studies: shared media use predicts relationship quality **especially when couples lack shared friends** (b = .32, f² = .09 in the low-shared-friends group); an experiment showed that reminding people they lacked shared friends *increased* their motivation to share media with a partner. Shared fictional social worlds compensate for missing real ones. [PR] https://ubwp.buffalo.edu/gabriellab/wp-content/uploads/sites/65/2025/04/Gomillion-S.-Gabriel-S.-Kawakami-K.-Young-A.-F.-2017.-Lets-stay-home-and-watch-TV-The-benefits-of-shared-media-use-for-close-relationships.pdf
- **Kim, Merrill, Collins & Yang (2021)**, *Technology in Society* — during lockdown, **social presence of virtual co-viewers mediated** the link between social-TV engagement and enjoyment. [PR] https://pubmed.ncbi.nlm.nih.gov/34538985/
- **Bellur et al. (2019)**, *J. Broadcasting & Electronic Media* — 230 students: mandatory live-tweeting during *Friends* reduced narrative transportation and emotional engagement. Second screens *during* the show cost immersion. [PR] https://www.sciencedaily.com/releases/2019/07/190702112706.htm
- TDG (2021): ~25M US adults (1 in 7 SVOD users) co-watched remotely during the pandemic; Teleparty, Discord and Zoom were the tools. [IND] https://www.prnewswire.com/news-releases/tdg-watch-parties-get-a-foothold-during-the-pandemic-301258316.html

**Implication:** (1) "Watched with" is the highest-value social field you can capture; it links entries across accounts and feeds Gomillion's mechanism. (2) Social should happen *before* (choosing) and *after* (reacting) the film, not during — the second-screen evidence is against in-watch chatter. (3) Couples and households are a natural unit; shared lists and joint logs serve the strongest evidence base.

#### Group decision research
- **Kim, Choi & Bao (2025)** — ambivalence, not too many options per se, drives deferral. [PR]
- **The Ringer (2022)** — couples develop explicit rules to survive choosing: "three options, you pick", opt-out rules, 60/20/20 splits, and long-running rewatches as shared history; a psychologist notes TV negotiation mirrors wider relationship dynamics. [LF] https://www.theringer.com/2022/02/14/tv/valentines-day-couples-relationships-tv-what-to-watch
- Group recommender literature (Masthoff 2004, "least misery" strategies) formalizes what couples do by hand: pick the option nobody hates. [PR, classic; not fetched this session]

**Implication:** a group-choice tool should present *three* candidates drawn from both people's lists, support a fast veto, and treat "rewatch the familiar" as a legitimate outcome rather than a failure of discovery.

---

### 2.4 Why people abandon tracking apps — and what brings them back

- **Epstein et al. (2016, CHI)** — six reasons (cost of collecting; cost of having/sharing; discomfort with what's revealed; data quality; learned enough; life changed). Manual-entry tools (spreadsheets, food logs) are the hardest to sustain; **guilt** is a common after-state — participants report wishing they had found the will to resume. [PR]
- **Epstein et al. (2016, UbiComp)**, "Reconsidering the Device in the Drawer" — 141 lapsed Fitbit users: lapses are usually *intentional and temporary*; of those who felt guilt/frustration, **97% were willing to return**; participants preferred visualizations that **showcase successful periods rather than highlight gaps**; recommendations: frame return positively, respect "happy abandonment", use positive social comparison. [PR] https://pmc.ncbi.nlm.nih.gov/articles/PMC5432203/
- **Clark, Southerton & Driller (2024)**, *New Media & Society* — "the myth of discontinuance": self-tracking rarely just stops; it lapses, mutates, moves between tools. [PR] https://journals.sagepub.com/doi/abs/10.1177/14614448221083992
- **Backlog shame** — gaming communities call unplayed games a "pile of shame"; Scully-Blaker's study of r/patientgamers (cited via TheGamer) describes players "held ransom by an obligation to relax"; the word *backlog* itself imports project-management overdue-ness into leisure. Vendor claims like "89% of Steam users own games they never launched" are unverified. [LF] https://www.thegamer.com/dont-be-ashamed-of-your-backlog/ ; https://www.thegamecrater.com/the-psychology-behind-a-video-game-backlog/
- **Netflix** added "Not started / Started" filters to My List in 2023 — an implicit admission that lists accumulate unwatched titles at scale. [IND] https://techcrunch.com/2023/05/22/netflix-updates-my-list-feature-so-users-can-find-content-they-have-yet-to-watch/
- **Performance anxiety / "the app made me watch for the number"** — the Goodreads testimony, Strava's session-deleters, and Wrapped's performative listening are three independent instances of the same failure. [LF/PR]
- **Feed becoming noise** — Marwick & boyd's *context collapse* (2011) and the social-media-fatigue literature explain why broadcast feeds decay; Letterboxd's growth is credited by observers to *not* having an algorithmic feed. [BK/LF] https://www.statsignificant.com/p/the-rise-and-potential-fall-of-letterboxd

**What re-activates lapsed users (evidence-backed):**
1. **Temporal landmarks** — new year, birthday, new season/big release (Dai et al. 2014). [PR]
2. **Year-in-review / on-this-day** — resurfaced positive memories reliably lift mood (Konrad 2016) and Wrapped-style summaries drive sharing (Annabell & Rasmussen 2025). [PR]
3. **A friend joining or acting** — kudos and friend behavior causally change activity on Strava (Franken 2023); social capital reduces deferral (Kim 2025). [PR]
4. **A gap-tolerant welcome back** — showcase what they logged, not what they missed (Epstein UbiComp 2016). [PR]

**Product implications**
1. Never show "you haven't logged in 47 days" or a broken streak. Show "the last three things you loved" and one thing a friend watched.
2. Make re-entry one tap: a single "what did you watch recently?" prompt with autocomplete beats a backlog to clear.
3. Treat life changes (new partner, new baby, new city) as *events to design for* — "watched with" changes, viewing hours change; the record should absorb that, not shame it.

---

### 2.5 Movie/TV-specific behavior

#### Rewatching and therapeutic reconsumption
- **Russell & Levy (2012)**, *J. Consumer Research* — phenomenological interviews on rereading, rewatching and revisiting: volitional reconsumption is actively sought; it works through *temporal* dynamics (noticing change in oneself against a fixed text) and *focal* dynamics (attending to new details); it's far richer than nostalgia — a way to measure one's own growth. [PR] https://academic.oup.com/jcr/article-abstract/39/2/341/1797212
- **Shackleford, Whiteman, Cohen, Buttafuoco & Reed (2025)**, *Social & Personality Psychology Compass* — review: rewatching is now prevalent under on-demand; motivations are **comfort and emotion regulation, social connection, identity continuity, nostalgia**; familiarity lowers cognitive load; risks include narrowing exposure and algorithm-shaped "playlist pasts". [PR] https://compass.onlinelibrary.wiley.com/doi/10.1111/spc3.70119

#### Binge-watching
- **Flayelle et al. (2020)**, *Current Addiction Reports* and **Starosta & Izydorczyk (2020)**, *IJERPH* — systematic reviews: motivations include enjoyment, transportation, social influence, escape and emotion regulation; outcomes span sleep loss, regret and guilt, but the construct is poorly defined and most harm findings are correlational; non-harmful and problematic binge-watching are separable profiles. [PR] https://www.mdpi.com/1660-4601/17/12/4469 ; https://www.semanticscholar.org/paper/3aee2a1efc6898f433fdfb2716362a06738f5b0a

#### How people actually choose, and how often they give up
- Netflix: 60–90 seconds, 10–20 titles. Nielsen: 7.4 → 10.5 → ~12 minutes; **~20% abandon**. Deloitte: 53% prefer social recommendations; Gen Z discovers via social first. Kim et al. 2025: deferral → stress. (All cited above.)

#### Social viewing
- Remote co-viewing became mainstream in 2020–21 (TDG); social presence mediates enjoyment (Kim et al. 2021); second-screening during the show reduces immersion (Bellur et al. 2019). (All cited above.)

#### Gen Z, Letterboxd and TikTok as identity
- Letterboxd grew from ~1.5M (2019) to 26M+ members (early 2026) with ~700M ratings logged in 2025; half of users are under 35 and 16–24 is the largest segment. [IND/LF] https://www.statsignificant.com/p/the-rise-and-potential-fall-of-letterboxd ; https://youscan.io/blog/how-letterboxd-is-reshaping-film-culture/
- The top-4 grid functions as a dating-profile-grade identity signal and gets policed for pretension or basicness; users report checking someone's profile before hanging out. [LF] (Young Hollywood; Izzy Scott, above)

**Product implications**
1. A **rewatch** should be a celebrated entry type with its own count and its own "why this again?" prompt — Russell & Levy's temporal dynamic ("how I've changed since") is a journaling prompt waiting to be built.
2. Comfort shelf: let users flag comfort watches; surface them in the "tonight" flow when the user says they're tired — Shackleford et al. name comfort/emotion regulation as the #1 rewatch motive.
3. Log **abandoned** series without shame ("dropped at S2E3") — the binge literature's regret/guilt outcomes are exactly what a judgment-free "dropped" state defuses.

---

## 3. Mechanics that work but corrode

| Mechanic | Evidence it works | Evidence it corrodes | Gentler alternative that keeps the benefit |
|---|---|---|---|
| **Streaks** | Duolingo: +1.7% D7 retention from milestone animations; freeze slack → +0.38% DAU; 7-day streakers 3.6× more likely to finish (correlational) [IND]. Snapstreaks: a normative friendship ritual for most teens [PR]. | Mogavi 2022: lost streak → abandoned account; competitiveness/herding drive misuse; users beg for an off switch [PR]. Snapstreaks weakly linked to FOMO/problematic use [PR]. Duolingo's own lesson: the unit must be trivial and user-controlled [IND]. | **Calendar heatmap** (GitHub-style) that shows presence without a breakable chain; **"N of the last 30 days"** rolling window instead of consecutive days; **seasonal/monthly "you showed up"** notes; no notifications about *not* logging. |
| **Counts / annual targets** | Goodreads: joining a challenge → significantly more books read; January/December rhythm [PR-preprint]. | Consistent testimony of gaming the unit (short books), rushing, marking "read" for relief; Wrapped-style performative behavior [LF/PR]. | Goals in **ungameable units** (hours, "outside my usual", "with someone"), **opt-in**, and shown as *pace* not *deficit*; celebrate the record, not the number. |
| **Leaderboards / segments** | Strava: kudos causally increase running; social comparison motivates re-runs [PR]. | Strava: "everything becomes a competition"; deleting slow sessions; hiding activity during injury [PR]. Duolingo leagues drive cheating and 3 a.m. sessions [PR]. | **Kudos without ranking**; **positive social comparison** framed as similarity ("you and Sam both loved…") not rank; never rank friends by volume. |
| **Badges** | Collecting's completion drive is real [PR]; badges give concrete feedback (McIntosh & Schmeichel). | Untappd: badges normalize risky volume; ethics unresolved five years on [PR]. | **Bounded, meaningful sets** the user chooses (a director's filmography, a friend's list) with quiet completion notes; no badges for quantity. |
| **Public-by-default logging** | Public goals raise follow-through (Goodreads) [PR-preprint]; identity display is a core motive [PR]. | Evaluation apprehension suppresses disclosure; performative logging pollutes the record [PR]. | **Private-by-default diary + curated public shelf**; per-entry audience choice. |
| **Year-in-review** | Reminiscence on positive memories lifts mood (Konrad, d ≈ 1.15 on momentary mood) [PR]; Wrapped is the strongest sharing event in consumer software [PR/IND]. | "Wrapped anxiety", performative listening [PR]. | Year-in-review that leads with **people and moments** (most-watched-with, best cinema night) and relegates counts; **"on this day"** resurfacing filtered to positive/shared entries. |
| **Variable-reward feeds** | Hooked model; engagement [BK]. | Attention-capture dark patterns literature; Letterboxd's growth attributed to *not* doing this [PR/LF]. | **Chronological friends-only feed**, finite ("you're caught up"), ambient rather than performative. |

**Rule of thumb from the evidence:** a mechanic corrodes when *losing* it costs the user an identity asset (a streak number, a rank, a public count). Mechanics that record presence without creating a loss-able asset keep most of the benefit.

---

## 4. The "watch later" problem

**Why saving is easy and returning is hard**

1. **Saving is an intention; intentions convert about half the time** (Sheeran & Webb 2016), and least for pleasant, unscheduled behaviors. Saving is a one-tap act of *anticipation* (savoring's first tense) that feels like progress — it is partly consumed at the moment of saving.
2. **Enjoyable experiences get procrastinated** like chores (Shu & Gneezy 2010): with no deadline, "someday" wins.
3. **The list grows into a backlog**, and the "pile of shame" language shows that an unbounded list of leisure becomes an obligation; the Ovsiankina resumption effect applies to *started* things, not to a list of 200 never-started ones (Ghibellini & Meier 2025).
4. **Choice overload at the moment of decision**: the list is consulted when the user is tired and ambivalent (Kim et al. 2025's strongest predictor of deferral is affective ambivalence), within a 60–90-second attention window (Netflix).
5. **Availability churn**: titles leave services; 39% of consumers cancel a service within six months and 24% churn-and-return (Deloitte 2025), so the saved item often isn't where the user thought it was.
6. **Context is lost**: the reason you saved it, who told you, and for what occasion are gone; the list shows a poster and nothing else (Choe et al.'s "not tracking context").

**Designs that close the loop (each tied to the mechanism it fixes)**

| Design | Mechanism | Evidence |
|---|---|---|
| **Time-boxed saving** — "for this weekend", "this month" — with graceful expiry to an archive, never a red badge | If-then planning; deadlines beat open-ended intentions | Gollwitzer & Sheeran 2006 (d = 0.65 for when/where plans); Shu & Gneezy 2010 |
| **Context-tagged saves** — *why* ("Nadia said it's like *Columbo*"), *for what* (date night, rainy Sunday, with the kids) | Restores the anticipation and the memory cue; feeds the "tonight" filter | Savoring/anticipation (Smith & Bryant 2021); Choe et al. 2014 |
| **"With whom"** — saves tied to a person, with a shared queue for couples/households | Shared media → closeness; social capital → less deferral | Gomillion et al. 2017; Kim, Choi & Bao 2025 |
| **"Tonight" mode** — three candidates max, drawn from the list + friends' recent loves, filtered by available services and time left in the evening | Fits inside the 60–90-second window; shrinks ambivalence | Gomez-Uribe & Hunt 2015; Nielsen 2023; Romero Meza & D'Urso 2024 |
| **Expiring availability nudges** — "leaves Netflix on the 30th; 2 friends have it saved" | Deadline + social proof; legitimate scarcity (it really is leaving) | Shu & Gneezy 2010; Deloitte churn data |
| **Friend-recommended items get their own lane** and a close-the-loop notification to the recommender when watched | Reciprocity and self-enhancement; the "I told you so" payoff | Berger 2014; Franken et al. 2023 (kudos) |
| **Bounded sub-lists with progress** ("5 from Nadia", "Kurosawa 1950s") instead of one infinite list | Set completion; Ovsiankina resumption on started sets | Carey 2008; McIntosh & Schmeichel 2004; Ghibellini & Meier 2025 |
| **Fresh-start clean-ups** — New Year / birthday / new season: "Still want these? Archive the rest." | Temporal landmarks separate from the past self | Dai, Milkman & Riis 2014 |
| **Rolling archive, not deletion** — items age out of "up next" into "someday" automatically; nothing is ever lost | Endowment: users hate losing curated items; guilt reduction | Kahneman et al. 1990; Epstein UbiComp 2016 (showcase success, not gaps) |

**Anti-patterns the evidence argues against:** total-count badges on the watchlist; "you have N unwatched"; sorting by date added (surfaces the oldest, most-guilt-laden items first); making saves public by default (adds evaluation apprehension to an already fragile intention).

---

## 5. Top 15 design principles, ranked

1. **The date is the product.** A dated, contextual diary entry is an autobiographical memory cue; that's what people come back to re-read (Conway 2000; Bluck & Alea 2011; Konrad 2016; Letterboxd diary practice).
2. **Private diary, public shelf.** Separate the honest log from the curated identity surface so performative logging doesn't corrupt the record (evaluation-apprehension research; Wrapped's performative listening; Goodreads testimony).
3. **"Watched with" is a first-class field.** Shared media use predicts closeness, especially for couples lacking shared friends, and social context is what makes memories re-readable (Gomillion 2017; Bluck & Alea's social function).
4. **Shrink the choice, don't expand it.** Users decide within 60–90 seconds and one in five give up; a three-item, socially sourced "tonight" list beats more rows (Gomez-Uribe & Hunt 2015; Nielsen 2023; Kim, Choi & Bao 2025).
5. **A save needs a when, a why, and a who.** Implementation intentions raise follow-through by d ≈ 0.65 and pleasant experiences get procrastinated without deadlines (Gollwitzer & Sheeran 2006; Shu & Gneezy 2010).
6. **Bounded sets, not infinite backlogs.** Completion motivates on finishable sets and resumption applies to started things; unbounded lists become "piles of shame" (McIntosh & Schmeichel 2004; Carey 2008; Ghibellini & Meier 2025).
7. **Record presence without a breakable chain.** Streaks retain until they're lost, then they churn; heatmaps and rolling windows keep the benefit (Duolingo's own freeze data; Mogavi 2022; van Essen & Van Ouytsel 2023).
8. **Kudos yes, rankings no.** Low-cost affirmation causally increases activity; leaderboards produce hiding and deletion (Franken 2023; Kolnes & Øvretveit 2026).
9. **Rewatching is a feature, not a failure.** Comfort and emotion regulation are the top rewatch motives and reconsumption is a way to measure personal change (Russell & Levy 2012; Shackleford et al. 2025).
10. **Prompts, not blank boxes.** Structured, low-stakes prompts and per-entry audience control reduce fear of negative evaluation and convert lurkers (NN/G "edit, don't create"; "Seeking safer spaces" 2020).
11. **Close the recommendation loop.** Recommending is self-enhancing and bonding; tell the recommender when their pick was watched (Berger 2014; Deloitte 2025 on social recommendations).
12. **Design the return, not just the habit.** Lapses are normal and mostly temporary; welcome back by showcasing what they logged, never the gap (Epstein CHI & UbiComp 2016; Clark et al. 2024).
13. **Year-in-review leads with people and moments, counts last.** Reminiscing on positive memories lifts mood and drives sharing; counts invite gaming and anxiety (Konrad 2016; Annabell & Rasmussen 2025; Goodreads testimony).
14. **Use fresh starts.** New year, birthdays, and big releases are when people re-commit; time list clean-ups and goal prompts to them (Dai, Milkman & Riis 2014).
15. **Social before and after, not during.** Second-screening during a film reduces immersion; co-presence around the choice and the reaction is where enjoyment is mediated (Bellur et al. 2019; Kim et al. 2021).

---

## Appendix: claims I checked and would *not* build on

- **Zeigarnik effect** ("unfinished lists nag at memory") — does not replicate (Ghibellini & Meier 2025).
- **"Shared attention amplifies emotion/memory"** — theory is influential but a well-powered EEG study found no amplification (Mairon et al. 2020); use co-viewing evidence (Gomillion; Kim 2021) instead.
- **Fogg Behavior Model as validated science** — useful heuristic; never tested by RCT as a model.
- **"Goodreads Challenge makes people read shorter books"** — plausible, widely reported, unmeasured.
- **Specific Netflix "My List" abandonment percentages** and **"89% of Steam users…"** — no credible public source found.
- **Expressive writing as a big well-being lever** — real but small effects (d ≈ 0.1–0.5 depending on population).
