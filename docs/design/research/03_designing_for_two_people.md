# 03 — Designing for two people

> Research note for the letsee redesign. Question: how should every surface of the app be designed so that the *other person* is present in it — so it feels like a place you share with specific people rather than a catalogue with a social feature bolted on?
>
> Status: complete first pass (2026-10-03). Web sources were checked via fetch where possible; claims that could only be confirmed from secondary press are labelled as such.
>
> Convention: **[E]** = evidence (sourced fact). **[O]** = opinion / design judgement.

## 1. What the research says about felt connection

### 1.1 Social presence: the other person must be *salient*, not just listed
- **[E]** Social presence theory (Short, Williams & Christie, 1976) defines presence as "the degree of salience of the other person in the interaction and the consequent salience of the interpersonal relationships"; media that carry more cues (face, voice, gaze) register as higher-presence than text. [theorizeit](https://is.theorizeit.org/wiki/Social_Presence_Theory), [Kingston/Rettie](https://eprints.kingston.ac.uk/2106/1/Rettie.pdf)
- **[O]** The design implication is not "add video". It is: on every surface, the *specific* other (a face, a first name, their words) should be salient enough that you think of them, not of "users". A count ("12 friends watched") has almost no presence; one face plus a sentence ("Priya — 6, 'too long, loved the sand'") has a lot.

### 1.2 Shared attention: watching *with* someone changes the experience itself
- **[E]** Experiences attended to simultaneously with another person, even without talking, are rated as more intense, for pleasant and unpleasant stimuli alike (Boothby, Clark & Bargh, 2014, "Shared experiences are amplified"). [Yale ACME lab PDF](https://acmelab.yale.edu/sites/default/files/2014_shared_experiences_are_amplified.pdf), [APS summary](https://psychologicalscience.org/?p=103000)
- **[E]** Shteynberg's shared-attention theory (2015) reviews evidence that attending *together* affects memory, motivation, judgement and emotion, and notes media now let attention be shared without co-presence. [APS abstract](https://www.psychologicalscience.org/journals/perspectives/1745691615589104/)
- **[E]** In virtual watch parties, perceived *emotional synchrony* predicted enjoyment and intention to share; text backchannel during viewing increased synchrony even for physically isolated viewers (Drewery, 2022, Waterloo thesis: survey + experiment). [UWSpace](https://uwspace.uwaterloo.ca/handle/10012/18087)
- **[E]** YouTube comments written live during news events are more emotionally intense than retrospective comments (Luo, Hsu, Park & Hancock, CSCW 2020). [ACM via Crossref](https://api.crossref.org/works/10.1145%2F3392853)
- **[O]** For letsee, "watched together" is the highest-presence fact the product holds. A co-logged viewing should be treated as a *memory of a shared experience*, not as two rows that happen to match.

### 1.3 Feeling understood: the intimacy process and "I-sharing"
- **[E]** Reis & Shaver's interpersonal process model: intimacy grows when a disclosure is met with a response the discloser perceives as *understanding, validating and caring*. Disclosure alone is not enough; perceived responsiveness is the active ingredient. [Sage encyclopedia entry](https://sk.sagepub.com/ency/edvol/embed/humanrelationships/chpt/interpersonal-process-model-intimacy), [Maisel et al. 2008 PDF](https://labs.psych.ucsb.edu/gable/shelly/sites/labs.psych.ucsb.edu.gable.shelly/files/pubs/maisel_et_al._2008.pdf)
- **[E]** "I-sharing" — the sense that your subjective experience overlapped with someone's in the moment (e.g., laughing at the same joke) — increases liking, including across group lines, and works via a felt subjective connection (Pinel and colleagues). [Duke ID lab PDF](https://sites.duke.edu/dukeidlab/files/2016/09/Isharing.SocialPsych.2016.pdf)
- **[E]** The single-item Inclusion of Other in the Self (IOS) scale — two circles overlapping by degrees — is a validated measure of closeness (Aron, Aron & Smollan, 1992). [SPARQ PDF](https://www.sparqtools.org/wp-content/uploads/2022/10/Inclusion-of-Other-in-Self.pdf), [Edinstruments](https://edinstruments.org/node/494)
- **[O]** Two consequences: (a) the *moment of overlap* ("you both rated the ending 5") is more connective than an aggregate similarity score; (b) overlapping circles are not just a UI cliché — they are literally how closeness is measured, which is a good argument for joined-avatar elements for pairs.

### 1.4 The "we" frame
- **[E]** A meta-analysis of 30 studies (>5,000 participants) found "we-talk" (we/us/our) in couples is associated with better relationship and personal functioning (Karan, Rosenthal & Robbins, 2018, *JSPR*). [UCR News](https://news.ucr.edu/articles/2018/10/04/research-affirms-power-we)
- **[O]** This is correlational and about couples' own speech, not app copy. It is still a reasonable prior for microcopy: "you and Priya", "your 12 films together", "what we're watching" frames the relationship as the unit.

### 1.5 Active vs passive use; strong vs weak ties
- **[E]** Passive Facebook use (scrolling without interacting) predicted declines in affective well-being, mediated by envy, in a lab experiment and an experience-sampling field study (Verduyn et al., 2015, *JEP: General*). [PubMed](https://pubmed.ncbi.nlm.nih.gov/25706656/)
- **[E]** Burke & Kraut (2016, *JCMC*, n=1,910, server logs + surveys): well-being rose with *composed, targeted* communication (comments, messages) from *strong ties*; one-click feedback and broadcast reading did not show the same benefit, and the same composed messages from weak ties showed little effect. [World Database of Happiness](https://worlddatabaseofhappiness.eur.nl/publications/the-relationship-between-facebook-use-and-well-being-depends-on-communication-type-and-tie-strength-15305). Facebook Research's summary: ~50 more comments from close friends tracked with 1–3% gains in life satisfaction, mood, support; passively reading about acquaintances tracked with ~1% more negative mood. [Meta Research blog](https://research.facebook.com/blog/2016/1/online-or-offline-connecting-with-close-friends-improves-well-being/)
- **[E]** The dichotomy has been refined, not discarded: Verduyn, Gugushvili & Kross (2022) split active use into *reciprocity* and *communion* and passive use into *achievement* and *self-relevance* content, and note active use isn't always good nor passive always bad. [Gugushvili summary](https://gugushvili.quarto.pub/publications/extended-model/index.html). Meier & Krause's (2022) adversarial review argues evidence for the passive-use hypothesis is mixed. [FAU CRIS](https://cris.fau.de/publications/284523009)
- **[E]** Weak ties matter too: more interactions with classmates/acquaintances than usual predicted more daily happiness and belonging (Sandstrom & Dunn, 2014, *PSPB*). [WDH](https://worlddatabaseofhappiness.eur.nl/publications/social-interactions-and-well-being-the-surprising-power-of-weak-ties-12167/)
- **[O]** For letsee: the passive surface people will scroll most (home) should be built around *strong-tie, composed* content and should end in an action addressed to someone, not an infinite feed of achievement content ("X logged 400 films"). Weak-tie / stranger content is fine as texture but never as the default first layer.

### 1.6 Small signals carry relationship meaning
- **[E]** "Likes" and similar one-click cues (paralinguistic digital affordances) are read as relationship signals, not just content approval — interpretation depends on who sent them (Hayes, Carr & Wohn, 2016). [NJIT](https://digitalcommons.njit.edu/fac_pubs/10732)
- **[E]** Couples given a one-bit "Virtual Intimate Object" (a dot you click that lights your partner's dot) built rich, context-dependent meanings around it (Kaye et al., CHI 2005 EA, "Communicating intimacy one bit at a time"). [MIT CV listing](https://alumni.media.mit.edu/~jofish/writing/index.htm)
- **[O]** Lightweight reactions are worth having *between people who know each other*. They are worth much less as public tallies. Burke & Kraut suggest they should be an on-ramp to composed replies, not a substitute.

### 1.7 Mutual knowledge, silence, and gratitude
- **[E]** Cramton (2001) found that distributed collaborators fail at "mutual knowledge" in five ways, including *difficulty interpreting the meaning of silence*, which pushes people toward unflattering dispositional attributions. [IDEAS/RePEc](https://ideas.repec.org/a/inm/ororsc/v12y2001i3p346-371.html)
- **[E]** People who write thank-you notes underestimate how positive and surprised recipients feel and overestimate awkwardness (Kumar & Epley, 2018, *Psychological Science*). [PubMed](https://pubmed.ncbi.nlm.nih.gov/29949445/)
- **[E]** People underestimate how much others appreciate being reached out to, and appreciation grows with surprise (Liu, Rim, Min & Min, 2022, *JPSP*). [KU summary](https://business.ku.edu/people-underestimate-surprising-impact-reaching-out-study-finds)
- **[O]** The "recommender is told when you finally watch it" loop is backed by two separate findings: the recommender will value it more than you think, and its surprise (months later) increases its value. Silence ("seen" with no reply, a recommendation that vanished) is actively harmful; the product should close loops on people's behalf.

### 1.8 Feeling known vs feeling watched
- **[E]** Behavioural tailoring is perceived simultaneously as "smart, useful, scary, creepy"; people were surprised their history was used and over-estimated what was collected (Ur et al., 2012, CMU). [FPF PDF](https://fpf.org/wp-content/uploads/2021/05/Smart-Useful-Scary-Creepy.-Perceptions-of-Online-Behavioral-Advertising-.pdf)
- **[E]** Facebook's 2011 Open Graph "frictionless sharing" auto-posted what people read and listened to (Spotify was a launch partner); Spotify added a private listening mode, and Facebook later said it was moving away from "passive sharing" because the signal was weak. [Hypebot](https://www.hypebot.com/hypebot/2012/10/facebook-music-a-big-vision-mostly-unrealized.html), [CBS News](https://www.cbsnews.com/news/facebook-to-curb-frictionless-sharing)
- **[E]** Video viewing history has its own US law: the Video Privacy Protection Act (1988) followed the publication of Robert Bork's rental list; a 2012 amendment let services obtain advance, revocable consent (max 2 years) before sharing viewing to social networks. [NBC News](https://www.nbcnews.com/news/amp/wbna46107038), [Proskauer](https://privacylaw.proskauer.com/2013/01/articles/online-privacy/facebook-and-netflix-now-in-a-relationship/)
- **[E]** Facebook's 2014 automated "Year in Review" put Eric Meyer's recently deceased daughter at the top of his recap; he called it "inadvertent algorithmic cruelty"; Facebook apologised. [The Drum](https://www.thedrum.com/news/2014/12/28/facebook-sorry-cruel-year-review-blunder)
- **[O]** "Known" = something a person *chose* to tell you, reflected back with care. "Watched" = something the system *inferred or broadcast* without a moment of choice. letsee's rule should be: social surfaces only use what someone deliberately logged or said, and anything retrospective (recaps, "a year ago with Priya") must be editable and suppressible per person.

## 2. Products that do two-person connection well

### 2.1 Co-viewing products: synchronous watch-together is fragile
- **[E]** Apple SharePlay (iOS 15.1, 2021) syncs playback inside FaceTime with *shared* controls (anyone can pause/scrub), "smart volume" that ducks the film when friends talk, and a button into the shared Messages thread. [Apple Newsroom](https://apple.com/au/newsroom/2021/11/shareplay-powers-new-ways-to-stay-connected-and-share-experiences-in-facetime)
- **[E]** Discord's Watch Together syncs YouTube inside a voice channel with a shared playlist. [Discord support](https://support-apps.discord.com/hc/en-us/articles/26502500234519-Watch-Together)
- **[E]** Disney+ removed GroupWatch on 18 Sept 2023 without announcement ([TechRadar](https://www.techradar.com/streaming/disney-plus-just-removed-one-of-its-best-friends-and-family-focused-features)); Amazon removed Prime Video Watch Party on 2 Apr 2024 ([Android Authority](https://androidauthority.com/amazon-prime-viewing-party-axed-3458167)). Both launched in 2020 lockdowns.
- **[E]** Watching is often solitary: 47% of US TV watchers normally watch alone (CivicScience, 2022), older adults most so. [CivicScience](https://civicscience.com/heres-what-watching-tv-looks-like-for-americans-today/). Industry surveys reported by trade press put solo binge-watching at roughly 58–60% (not independently verified here). [Quartz](https://qz.com/460587/youre-not-alone-binge-watching-is-a-solo-activity-for-most-people), [Broadcast Bridge](https://thebroadcastbridge.com/content/entry/2795/binge-viewing-is-a-solo-activity)
- **[E]** The second screen is where the social talk happens: in Nielsen's Q1 2013 survey 46% of smartphone owners used them while watching TV daily, and at least a fifth read social discussion about the show they were watching. [Nielsen](https://www.nielsen.com/insights/2013/action-figures-how-second-screens-are-transforming-tv-viewing/)
- **[O]** The streamers' retreat suggests real-time co-watch is a lockdown behaviour, not a durable habit. letsee's strength is *asynchronous* togetherness: watched-it-together memories, side-by-side takes after the fact, and spoiler-safe threads that let two people "watch together" across different nights (see StoryGraph below). Don't build a sync player.

### 2.2 Pattern catalogue
Each row: what exactly is shown, where, and whether it builds **closeness** (C) or **compulsion** (X). Labels are my judgement [O]; facts are sourced.

| Product | What it shows, where | C / X |
|---|---|---|
| **Spotify Blend** | A playlist for exactly two (later up to 10) people; generated cover art with both identities; a "taste match" % plus a line naming the *song that brings you together*; daily refresh; Premium shows data on which person's preferences contributed each song. [TechCrunch](https://techcrunch.com/?p=2196189), [9to5Mac](https://9to5mac.com/2021/08/31/spotify-blend-shared-playlists/), [Engadget](https://engt.co/3iPa0Lm) | **C** — the named overlap song is an "I-sharing" moment. The % is the weakest part (invites ranking friends). |
| **Spotify Jam** | Real-time shared queue; everyone sees *who added which song*; recommendations from the overlap of everyone's taste; join by tapping phones/QR. [9to5Mac](https://9to5mac.com/2023/09/26/spotify-jam-new-feature-music/), [Fox 4](https://www.fox4news.com/news/spotify-jam-how-to-start-session-music-songs) | **C** — attribution per item is the key detail. |
| **Letterboxd** | Film pages carry a friends' activity view (who you follow, their stars/reviews); a third-party add-on exists specifically to put "the average score from the users you follow" right under the global chart. [Letterboxd Toolkit](https://addons.mozilla.org/en-CA/android/addon/letterboxd-toolkit/). No private accounts; blocking does not hide your content. [Letterboxd FAQ](https://letterboxd.com/about/faq/) | **C** for friends' takes; the public-by-default model is a gap letsee already fills with private diary. |
| **StoryGraph buddy reads** | Comments pinned to a position in the book stay *locked* for each reader until their own logged progress reaches that point. [Goodereader](https://goodereader.com/blog/?p=365337), [StoryGraph roadmap](https://roadmap.thestorygraph.com/requests-ideas/posts/option-to-unlock-buddy-reads-comment-regardless-of-your-progress) | **C** — the exact model for letsee episode threads between two people at different speeds. |
| **Strava** | Overlapping recorded activities are auto-linked as a Group Activity ("ran with"); Kudos is a one-tap acknowledgement. Auto-grouping strangers drew "creepy" complaints in 2020; Flyby is now opt-in, group visibility is Everyone / Followers / Only You. [Yahoo News](https://malaysia.news.yahoo.com/strava-users-call-apps-creepy-111100166.html), [Strava support](https://support.strava.com/hc/articles/207343930) | **C** for "with" among friends; a cautionary tale for auto-inference. |
| **BeReal** | Once-daily prompt; *you can't see friends' posts until you post yours*; reactions are photos of your face ("RealMojis"); late posts are labelled as late. DAU fell from ~15M (Oct 2022) to ~6M (spring 2023). [Wikipedia](https://en.wikipedia.org/wiki/BeReal), [PetaPixel](https://petapixel.com/2023/02/22/bereal-may-be-on-the-out-users-have-nearly-halved-since-peak) | **Mixed** — reciprocity gate and face-reactions build presence; the daily timed alarm and public lateness are compulsion. |
| **Locket** | Friends' photos appear *on your home-screen widget*; capped at 20 friends, which the founder calls the natural limit for "your closest connections"; 20M+ downloads by Aug 2022. [TechCrunch](https://techcrunch.com/2022/08/02/locket-app-that-lets-yor-post-photos-to-your-loved-ones-homescreens-raises-12-5m), [Dead Pixels Society](https://thedeadpixelssociety.com/photo-widget-locket-raises-12-5-million/) | **C** — small cap, ambient presence. |
| **Retro** | Open a friend and see "all of this week's content from this specific friend"; no algorithmic feed, no influencers to follow; built by two former Instagram staff. [TechCrunch](https://techcrunch.com/2023/12/07/retro-lets-you-create-recaps-of-your-most-memorable-photos-and-send-the-best-ones-as-postcards) | **C** — the per-person weekly unit maps to "your week with Priya". |
| **Path** (historic) | Capped networks at 50 friends "to encourage greater sharing" with an inner circle; later raised to 150, then removed. Also uploaded address books without permission (2012). [Wikipedia](https://en.wikipedia.org/wiki/Path_(social_network)) | **C** design, **X** data practice. |
| **Partiful** | Invite is a link; guests RSVP "without requiring account registration or app installation"; named Google's Best App of 2024. [Wikipedia](https://en.wikipedia.org/wiki/Partiful) | **C** — invitation as artefact. |
| **Hinge** | You can't "like" a profile in general; you like a *specific* photo or prompt and can comment on it. Hinge says likes with a comment are 2x as likely to lead to a date; 72% of daters are more likely to consider someone whose like included a message. [Hinge Newsroom](https://hinge.co/newsroom/convo-starters), [Wikipedia](https://en.wikipedia.org/wiki/Hinge_(app)) | **C** — conversation from a detail. |
| **Co-Star** | Chart comparison with friends; daily push copy described as "brutally honest". [Wikipedia](https://en.wikipedia.org/wiki/Co%E2%80%93Star) | **Mixed** — compatibility as entertainment; harsh tone sometimes used to rank friends. |
| **Apple Photos / iCloud Shared Library** | Shared library for up to six; sharing can be set by *people in the photos*; camera toggle and suggestions when participants are detected. [9to5Mac](https://9to5mac.com/2022/08/15/icloud-shared-photo-library/). iOS 18 Collections include People & Pets and a carousel that features "favorite people". [Apple Newsroom](https://www.apple.com/newsroom/2024/06/ios-18-makes-iphone-more-personal-capable-and-intelligent-than-ever/) | **C** — people are a primary index of memory. |
| **Google Photos** | Face groups; "Hide face from memories"; reported "show less/more" of a person in Memories — explicitly for breakups and bereavement. [Tom's Guide](https://tomsguide.com/computing/mobile-apps/google-photos-may-make-it-easier-to-hide-unwanted-faces-whats-new), [Android Authority](https://androidauthority.com/google-photos-hide-faces-3465522) | **C** — the suppress control is what makes people-led memories safe. |
| **Duolingo** | Friends Quests: two friends share a weekly goal; nudges and gifts; Friend Streaks (up to 5). Duolingo says learners who add friends are 5.6x more likely to finish a course and those with a shared streak 22% more likely to do the daily lesson. [Duolingo blog](https://blog.duolingo.com/friends-social-features/), [Friends Quests](https://blog.duolingo.com/friends-quests/) | **Quests C, streaks X** — a joint goal is cooperative; a streak converts a friendship into an obligation. |
| **Snapchat streaks** | A fire emoji and day count next to a chat while two people snap daily; an hourglass warns it "is about to expire"; lost streaks can be restored "for a limited time only" ([Snapchat Support](https://help.snapchat.com/hc/en-us/articles/7012394193684-What-are-Streaks-and-how-do-I-keep-them)). A survey of Egyptian teenagers found 35% rated streaks "very important", with late-night use, streaks prioritised over sleep or study, and sadness when a streak is lost ([MJSM study](https://mjsm.journals.ekb.eg/article_422365.html)); educators report teens fear being seen as "bad friends" if a streak breaks ([Girls Leadership](https://girlsleadership.org/blog/mediamondaytip-how-grown-ups-can-help-girls-stressed-out-by-snapstreaks/)). Evidence quality: survey/correlational. | **X** — the canonical compulsion pattern. |
| **Find My / Check In** | Location shared person-by-person; iOS 17 Check In tells a chosen friend when you *arrived*, an event rather than a live trail. [Apple Newsroom](https://www.apple.com/newsroom/2023/06/ios-17-makes-iphone-more-personal-and-intuitive/) | **C** when event-based; surveillance risk when continuous. |
| **Instagram Close Friends / Notes** | A private list for stories; Notes (Dec 2022) are 60-character status lines for chosen people, replies go to DMs. [Wikipedia](https://en.wikipedia.org/wiki/Instagram) | **C** — Notes are "a detail to reply to"; replies are private. |
| **iMessage Tapbacks** | Reactions attached to a specific message; iOS 18 expanded to any emoji or sticker. [Apple Newsroom](https://www.apple.com/newsroom/2024/06/ios-18-makes-iphone-more-personal-capable-and-intelligent-than-ever/) | **C** — a reaction always points at something specific. |
| **WhatsApp** | Last-seen default narrowed to contacts in Dec 2021; option to hide "online" (2022); read receipts can be turned off (2014, within a week of launching them). [Wikipedia](https://en.wikipedia.org/wiki/WhatsApp) | **C** — presence is negotiable. |
| **Figma multiplayer** | Live cursors and selections of everyone in the file; avatars top-right; following someone is opt-in. Figma: cursors provide "important context". [Figma blog](https://www.figma.com/blog/multiplayer-editing-in-figma/) | **C** — presence *located on the content*. |

### 2.3 Closeness vs compulsion — the dividing line
- **[O]** From the table, closeness patterns share four traits: (1) they **point at something specific** (a song, a prompt, a page in the book, a message); (2) they are **between named people, small in number** (Locket 20, Path 50, Blend 2); (3) they **reward the relationship, not the volume** (a joint goal, a shared playlist); (4) they **can lapse without penalty**.
- **[O]** Compulsion patterns share the opposite: a **counter that can be lost** (Snapstreak, Duolingo streak), **public scoring of a relationship** (Snap Score, "best friends" emoji), **timed alarms** (BeReal's two minutes), and **auto-inference the person didn't author** (Strava stranger grouping, frictionless sharing).
- **[E]** The engagement lift from compulsion is real (Duolingo reports +22% daily-lesson completion with a shared streak). **[O]** That is exactly why it is tempting. letsee's doctrine already rejects streaks; the same logic must exclude *relationship streaks* ("12 weeks in a row with Priya") which are streaks wearing a friendship costume.

## 3. Concrete UI patterns

### 3.1 A friend's take before strangers' on a title page
- **[E]** Strong-tie, composed content is what moves well-being (Burke & Kraut, §1.5). Eye-tracking shows people look at photos of *real, relevant people* and ignore decorative ones (NN/g). [NN/g](https://www.nngroup.com/articles/photos-as-web-content/). A third-party Letterboxd add-on exists to put "the average score from the users you follow" beside the global chart, so people don't have to dig through the friends-activity tab. [Letterboxd Toolkit](https://addons.mozilla.org/en-CA/android/addon/letterboxd-toolkit/)
- **[E]** Online networks are no larger than offline ones, and their inner layers (the "support clique" and "sympathy group", ~5 and ~15 in Dunbar's broader work, within ~150) match offline patterns (Dunbar, 2016). [Royal Society Open Science](https://api.crossref.org/works/10.1098/rsos.150292)
- **[O]** Order of the title page, top to bottom:
  1. **Shared memory** if one exists: "You watched this with Priya · 12 Mar · at hers" with both ratings side by side and her line, if she wrote one.
  2. **Your people**: up to 3 faces, ranked by *closeness* (watched-with count, DMs, mutual recommendations), not by recency or follower count. Each shows rating + first line of their note + "Reply". Then "and 4 others you follow" collapsed.
  3. **Recommended to you by**: if it's on your watchlist from someone, show their face and *their words* ("Arjun, March: 'the train scene'").
  4. Global stats and strangers' reviews last.
- **[O]** If nobody you know has seen it, show *nothing* about friends (never "0 friends watched"). Show instead a soft prompt: "Who'd watch this with you?" that opens a Tonight room or a DM with the title card.
- **[O]** Friends' *ratings* are spoiler-safe and can always show; their *notes* inherit the spoiler gate until you've logged the title/episode.

### 3.2 Faces vs initials vs avatars
- **[E]** Presence scales with the cues a medium carries (social presence theory, §1.1); faces of relevant people draw attention (NN/g, above).
- **[O]** Hierarchy: **photo > initials monogram > nothing**. Never a grey silhouette: it reads as "absent person". Monograms get a *stable* hue derived from the account id, so Priya is always the same colour everywhere (in rating cards, timelines, room seats). Hue is identity, so never reuse it for status (error/success).
- **[O]** People named in "watched with" who aren't on letsee get a distinct, honest chip: initials in an outlined circle, no fill, label "not on letsee yet". It keeps them present in *your* diary without pretending they're here.
- **[O]** Minimum face size where a person is the point of the element (rating card, memory, notification): 32px; facepiles can go to 20–24px but must have the name within one tap.

### 3.3 Two people in one element
- **[E]** Closeness is literally measured as overlapping circles (IOS scale, §1.3). Atlassian's avatar-group spec caps stacks at five with a "+N" overflow and requires a text alternative for screen readers. [Atlassian](https://atlassian.design/components/avatar-group/usage). Spotify Blend gives every pair generated cover art that identifies the pair. [9to5Mac](https://9to5mac.com/2021/08/31/spotify-blend-shared-playlists/)
- **[O]** Three pair primitives, and when to use each:
  - **Overlapping pair** (two faces, ~30% overlap, a 2px ring of the background colour between them): "watched together", the header of a shared timeline, a DM header. Accessible name: "You and Priya".
  - **Split card** (two halves, each tinted with the person's hue, ratings facing each other): "We watched Dune. You 8 · Priya 6". Equal width always; the viewer is on the left, never larger.
  - **Joined colour** (a thin gradient from your hue to theirs): the edge/underline of anything that belongs to the pair (shared timeline, a viewing card in both diaries). Use sparingly; it is the "this is ours" signal.
- **[O]** Groups (Tonight rooms) use a facepile capped at 5 + "+N", seated in the order people joined.

### 3.4 "You and X" comparisons that aren't a competition
- **[E]** In Aron et al.'s closeness procedure, *attitude matching* did not add closeness; escalating reciprocal disclosure did. [Crossref](https://api.crossref.org/works/10.1177/0146167297234003). In existing relationships, *perceived* similarity predicts attraction while actual similarity does not (Montoya, Horton & Kirchner, 2008, 313 studies). [Crossref](https://api.crossref.org/works/10.1177/0265407508096700). Shared *moments* of experience (I-sharing) build connection (§1.3).
- **[O]** Therefore: lead with **specific overlaps**, treat **differences as conversation**, and demote the **score**.
  - Lead: "You both gave *Past Lives* a 9." "You've both rewatched *Before Sunrise*." (named titles, not %).
  - Difference: "You split on *Dune*: you 8, Priya 6. Ask her about it." The Ask button opens a DM with the card.
  - Score: if a compatibility number exists, it sits below the overlaps as a band ("a lot in common") and is never sortable, ranked, or shown in lists of friends.
- **[O]** No "who agrees with you most" leaderboard, no "your most compatible friend" badge, no public compatibility on profiles viewed by third parties.

### 3.5 Conversation starters attached to content
- **[E]** Hinge forces a like to target a specific photo or prompt; likes with a comment are twice as likely to become a date. [Hinge](https://hinge.co/newsroom/convo-starters). Instagram Notes replies land in DMs, privately. [Wikipedia](https://en.wikipedia.org/wiki/Instagram). Composed messages from strong ties carry the well-being benefit (§1.5).
- **[O]** Every piece of a friend's content has a reply affordance that *quotes the detail*: replying to Priya's note on episode 4 opens your DM with the episode card and her line quoted. Replies are private by default; public threads are a separate, deliberate act.
- **[O]** Generated starters, if any, must reference something both people did ("You both rated the finale 10 — what got you?"). Never generic ("Say hi to Priya!").

### 3.6 Lightweight reactions
- **[E]** One-click signals carry relationship meaning that depends on who sent them (Hayes, Carr & Wohn, 2016). [NJIT](https://digitalcommons.njit.edu/fac_pubs/10732). iMessage tapbacks attach to one message; iOS 18 opened them to any emoji. [Apple](https://www.apple.com/newsroom/2024/06/ios-18-makes-iphone-more-personal-capable-and-intelligent-than-ever/)
- **[O]** Reactions on letsee: attached to *a specific thing* (a rating, a note, a co-viewing), visible as **who** ("Priya ♥"), never as a public count; a small vocabulary that is about film talk ("same", "need to talk about this", "adding it", ♥), plus "reply" right next to it so a reaction is a door to a composed message, not a substitute.

### 3.7 Showing someone is around, without surveillance
- **[E]** Silence is the hardest thing for remote partners to interpret and pushes them to blame the person (Cramton, 2001, §1.7). WhatsApp narrowed last-seen to contacts by default (2021), added hide-online (2022), and let people turn off read receipts within a week of launching them (2014). [Wikipedia](https://en.wikipedia.org/wiki/WhatsApp). Strava's auto-grouping of strangers read as "creepy". [Yahoo](https://malaysia.news.yahoo.com/strava-users-call-apps-creepy-111100166.html). Apple's Check In shares an *event* (arrived) rather than a trail. [Apple](https://www.apple.com/newsroom/2023/06/ios-17-makes-iphone-more-personal-and-intuitive/). Figma shows presence *on the content* — cursors where people are working. [Figma](https://www.figma.com/blog/multiplayer-editing-in-figma/)
- **[O]** Presence on letsee is built from **things people authored**, scoped to **where you both are**:
  - Yes: "Priya logged *Severance* 2x04 last night" in your home; "Priya is up to 2x03" on the episode page you share; seats filled in a Tonight room you're both in; "typing" inside a DM.
  - No: green "online" dots, "last active 4 min ago" on profiles, read receipts by default, "who viewed your profile", live "watching now" broadcasts.
  - Progress on a series is shown only between people who have both logged that series, so it works as a spoiler map, not a tracker.

### 3.8 Shared history timelines
- **[E]** People are a primary index for memories: Apple Photos' People & Pets collection and favourite-people carousel ([Apple](https://www.apple.com/newsroom/2024/06/ios-18-makes-iphone-more-personal-capable-and-intelligent-than-ever/)); Retro's per-friend weekly card ([TechCrunch](https://techcrunch.com/2023/12/07/retro-lets-you-create-recaps-of-your-most-memorable-photos-and-send-the-best-ones-as-postcards)). The same systems need "hide this face from memories" for breakups and bereavement ([Android Authority](https://androidauthority.com/google-photos-hide-faces-3465522)), and Facebook's automated Year in Review showed a grieving father his daughter ([The Drum](https://www.thedrum.com/news/2014/12/28/facebook-sorry-cruel-year-review-blunder)).
- **[O]** A pair page, "You and Priya": overlapping-pair header; a sentence not a dashboard ("12 films together since March 2025, mostly at hers, mostly on Fridays"); a chronological list of co-viewings (date, place, both ratings, either person's note); then "she recommended, you watched" and vice versa; then films you both logged separately. Either person can remove a viewing from the shared history, and either can choose "show Priya less in recaps" without telling her.

### 3.9 Invitations that feel personal
- **[E]** Partiful's invite is a link that works without an account or app install. [Wikipedia](https://en.wikipedia.org/wiki/Partiful). LinkedIn paid a $13M settlement (2015) over *repeated* reminder emails sent to people's contacts after the first invite. [Wikipedia](https://en.wikipedia.org/wiki/LinkedIn)
- **[O]** An "I was there too" invite should show the actual memory, from the actual person: Priya's face, "Arjun says you watched *Dune* together on 12 Mar at his place. Add it to your diary?" with "Yes, I was there" / "Not me". The landing page works before sign-up and shows exactly what will be shared. One invite, sent by the person from their own channel. No automated reminders.

### 3.10 Gratitude loops (telling the recommender)
- **[E]** Gratitude "finds, reminds and binds" relationship partners (Algoe, 2012). [Crossref](https://api.crossref.org/works/10.1111/j.1751-9004.2012.00439.x). Thankers underestimate the good it does (Kumar & Epley, 2018); people underestimate how much being reached out to is appreciated, more so when surprising (Liu et al., 2022). See §1.7.
- **[O]** On logging a title that came from someone's recommendation, the log sheet shows their face and words ("Priya, 14 March: 'the train scene'") and a pre-ticked "Let Priya know" with a preview of the message and an optional line. The recommender's notification names the person and carries the rating: "Arjun finally watched *Past Lives* — 9. You told him to in March." One tap to reply. It's private between the two, never a public "recommendation score".

## 4. Language and tone

### 4.1 What the evidence supports
- **[E]** "We"-language tracks better relationship functioning in couples (meta-analysis, §1.4). [UCR](https://news.ucr.edu/articles/2018/10/04/research-affirms-power-we)
- **[E]** Mailchimp's widely copied voice guide: plainspoken, genuine, and "it's always more important to be clear than entertaining" in sensitive moments; forced humour is worse than none. [Mailchimp](https://styleguide.mailchimp.com/voice-and-tone/)
- **[E]** Empty states should state system status, teach in context, and give a direct path to the key task (NN/g). [NN/g](https://www.nngroup.com/articles/empty-state-interface-design/)
- **[E]** Hinge's own advice for openers: skip the generic "hey" and connect their prompt to your life. [Hinge](https://hinge.co/newsroom/convo-starters)

### 4.2 Copy rules for letsee [O]
1. **First names, always.** "Priya", not "@priya_k" or "a friend". Handles appear only where disambiguation is needed (search, invites).
2. **The pair is the subject.** "You and Priya", "your 12 films together", "what you two are watching". Avoid "Users who watched this also…".
3. **Past tense for memories, present for invitations.** "You watched *Dune* with Priya in March" (memory) vs "Priya wants to watch something tonight" (invitation).
4. **Quote people, don't summarise them.** "Priya: 'too long, loved the sand'" beats "Priya rated this 6/10".
5. **Say who will see it, at the moment of sharing.** "Only Priya will see this." "This stays in your diary." "Priya will be asked first; nothing appears on her diary until she says yes."
6. **Name consequences of leaving kindly.** "You've left this viewing. It's gone from your diary; Priya's still has it."
7. **No scoreboard words** for people: no "top friend", "best match", "rank", "beat". "In common", "together", "split on" are fine.
8. **Never count people at someone.** No "0 friends", "only 1 friend", "you watched alone 80% of the time".

### 4.3 Microcopy table [O]

| Surface | Avoid | Prefer |
|---|---|---|
| Title page, no friends have seen it | "None of your friends have watched this" | "Who'd watch this with you?" |
| Home, zero friends | "Your feed is empty. Add friends!" | "Your diary starts here. Log what you watched last; add who you watched it with — they don't need to be on letsee." |
| Watched-with field | "Tag users" | "Who were you with?" (free text, suggestions from people you've watched with) |
| Solo viewing | "Watched alone" | "Just me" (first-class option, same weight as a name) |
| Recap, mostly solo | "You watched 80% of films alone" | "41 films this year. 6 with Priya, and your own Friday-night run of Ozu." |
| Recommendation closed | "Your recommendation was completed" | "Arjun finally watched *Past Lives* — 9. You told him to in March." |
| Invite landing | "Join letsee to see this" | "Arjun says you watched *Dune* together on 12 March. Add it to your diary?" |
| Compatibility | "87% match" | "You both loved *Past Lives* and *Aftersun*. You split on *Dune*." |

## 5. Safety and consent in a two-person design

### 5.1 Being named on someone's viewing
- **[E]** Precedents: Facebook's tag review keeps a tag hidden until the tagged person approves it ([Facebook Help](https://www.facebook.com/help/247746261926036)); Strava lets people set group-activity visibility to Everyone / Followers / Only You and leave a group ([Strava](https://support.strava.com/hc/articles/207343930)); Strava's automatic stranger grouping was called "creepy" ([Yahoo](https://malaysia.news.yahoo.com/strava-users-call-apps-creepy-111100166.html)).
- **[O]** Rules: (1) Your diary can say "with Priya" as *your* memory in plain text, visible only where your diary is visible to you. (2) A *link* to Priya's account, any appearance on her diary, on your public shelf, in compatibility or in recaps others can see, needs her yes. (3) Either person can unlink at any time without notifying the other. (4) Unaccepted invites expire silently; there is no "Priya ignored your invite" state. (5) The product never infers co-viewing (same title, same night) by itself.

### 5.2 Private vs shared moments
- **[E]** Viewing history is legally sensitive in the US (VPPA, 1988; consent required to share, renewable at most every 2 years since the 2012 amendment). [Proskauer](https://privacylaw.proskauer.com/2013/01/articles/online-privacy/facebook-and-netflix-now-in-a-relationship/). Automatic "frictionless" sharing of media consumption was rolled back after users disliked it. [CBS News](https://www.cbsnews.com/news/facebook-to-curb-frictionless-sharing)
- **[O]** Three visibility tiers per viewing, chosen at log time and visible as a single word under the save button: **Just me** (private diary) / **Us** (only the people you watched with) / **Shelf** (your public profile). Default for a viewing with named companions: **Us**. "Us" is the important new tier: a moment shared with Priya and nobody else.

### 5.3 Blocking and leaving
- **[E]** Letterboxd: blocking ends the follow both ways but "does not hide your content from them" because there are no private accounts. [Letterboxd FAQ](https://letterboxd.com/about/faq/)
- **[O]** On letsee, blocking must also remove the pair from: each other's watched-with links (text stays in the blocker's private diary only if they want it), compatibility, "People you watch with", recaps, Tonight room suggestions and recommendation notifications. No notice to the blocked person. A softer "show less of Priya" (recaps, home) exists for breakups and bereavement, modelled on Google Photos' hide-face control. [Tom's Guide](https://tomsguide.com/computing/mobile-apps/google-photos-may-make-it-easier-to-hide-unwanted-faces-whats-new)

### 5.4 Don't expose who viewed what
- **[E]** LinkedIn shows profile viewers and makes private browsing cost you the ability to see your own viewers on free accounts. [LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a567226)
- **[O]** letsee never records or shows profile views, title-page views, or "seen" on someone's notes or shelf. Reading should be free and invisible; only authored acts (log, reply, react, recommend) are social.

### 5.5 Social comparison
- **[E]** Passive browsing hurt affect via envy (Verduyn et al., 2015, §1.5); social media use has been linked to lower self-esteem via upward comparison (Vogel et al., 2014). [Crossref](https://api.crossref.org/works/10.1037/ppm0000047). Instagram found hidden like counts "beneficial for some, and annoying to others" and made them optional. [Instagram](https://about.instagram.com/blog/announcements/giving-people-more-control)
- **[O]** The comparison risks specific to a film journal are *volume* (Priya logged 300 films, you logged 40) and *taste status* (who has "better" taste). Neither number appears on a friend's surface; profile totals are visible to the owner, optional on the shelf.

### 5.6 Designing for people who mostly watch alone
- **[E]** About half of US viewers normally watch alone (CivicScience, 2022). [CivicScience](https://civicscience.com/heres-what-watching-tv-looks-like-for-americans-today/)
- **[O]** Solo viewing is a first-class log ("Just me"), recaps never frame it as a lack, and the social layer reaches solo watchers through *asynchronous* ties: recommendations received, friends' takes on the same title, and spoiler-gated threads on episodes they both watch on different nights (StoryGraph's model). Connection doesn't require co-presence.

## 6. Cold start

### 6.1 Evidence from launches
- **[E]** Single-player utility first: "The tool helps get to initial critical mass. The network creates the long term value" (Dixon). [cdixon](https://cdixon.org/2015/01/31/come-for-the-tool-stay-for-the-network). Andrew Chen lists single-user utility, publishing into existing networks, products that work at very small network sizes (Skype needs two people), and densely connected niches. [Andrew Chen](https://andrewchen.com/how-to-solve-the-cold-start-problem-for-social-products/)
- **[E]** Activation thresholds: Nextdoor required a founding member to attract 10 households before a neighbourhood launched (as of 2016). [Wikipedia](https://en.wikipedia.org/wiki/Nextdoor)
- **[E]** Small-circle products launch through pairs: Locket started as one developer's side project for his girlfriend and caps friends at 20. [Dead Pixels Society](https://thedeadpixelssociety.com/photo-widget-locket-raises-12-5-million/)
- **[E]** Link-first invites work: Partiful guests need no account. [Wikipedia](https://en.wikipedia.org/wiki/Partiful)
- **[E]** Saturation without depth burns out: Gas reached #1 on the App Store (Oct 2022) on anonymous compliment polls about classmates, was bought by Discord, and shut in Nov 2023 ([Wikipedia](https://en.wikipedia.org/wiki/Gas_(app))); BeReal lost roughly half its DAU within months of peaking ([PetaPixel](https://petapixel.com/2023/02/22/bereal-may-be-on-the-out-users-have-nearly-halved-since-peak)).
- **[E]** Contact harvesting carries legal and trust cost: Path uploaded address books without permission (2012) ([Wikipedia](https://en.wikipedia.org/wiki/Path_(social_network))); LinkedIn's repeated contact reminders cost $13M ([Wikipedia](https://en.wikipedia.org/wiki/LinkedIn)). Since iOS 18, people can share *only selected* contacts with an app. [Apple](https://www.apple.com/newsroom/2024/06/ios-18-makes-iphone-more-personal-capable-and-intelligent-than-ever/)

### 6.2 What that means for letsee [O]
- **The atomic network is two people.** Onboarding success is "one other person linked", not "follow 30". Every cold-start flow aims at getting the first "watched together" or first recommendation exchanged.
- **The diary is valuable alone.** Logging, the watchlist with "why", and recaps must feel complete with zero friends (Dixon's tool).
- **Names before accounts.** "Watched with" accepts any name. Those people live as private placeholders in your diary ("not on letsee yet"). When one of them joins via your link, offer: "You're in 4 of Arjun's diary entries. Add them to yours?" — retroactive linking makes a new account feel populated on day one with *its own* history.
- **Invites are artefacts.** The share sheet sends a card of a real memory or a recommendation ("Watch this — I think you'll like the ending"), and the landing page works without an account (Partiful).
- **Contacts: optional, late, partial.** Ask only after the first log, explain the exact use ("find people you already know"), use the system's selected-contacts picker, never upload or message non-users automatically, never remind on the user's behalf.
- **Regional activity: texture, never fake friends.** "Popular in Bengaluru this week" may show aggregated counts above a privacy floor (e.g. ≥ 20 distinct people) with no faces. It is labelled as strangers, sits below anything personal, and disappears once the person has three or more connections. Never seed the home with invented or unlabelled activity.
- **Rooms seed pairs.** A Tonight room link that works without an account is the cheapest way to turn "a friend who isn't here" into "a person you watched with".

## Recommendation for letsee

> Everything in this section is **[O]**, design judgement built on the evidence above. The evidence that carries the most weight: strong-tie composed communication (Burke & Kraut), shared attention and I-sharing, perceived responsiveness (Reis & Shaver), gratitude under-valuation (Kumar & Epley), and the consistent backlash to inferred or automatic sharing (Strava, Open Graph, Year in Review).

**Fifteen principles for making the other person present**

1. **The person before the population.** Any surface that has both a friend's take and an aggregate shows the friend first, with face, first name and their words.
   *Title page:* shared memory card → up to 3 of "your people" (ranked by closeness) → "recommended by" → global stats and strangers.

2. **A shared viewing is a memory, not a match.** Co-logged viewings are a single object that belongs to both people, shown with the pair primitive, date and place.
   *Profile → "You and Priya":* "12 films together since March 2025, mostly at hers" with the chronological list underneath.

3. **Point at something specific.** Every social act (reply, reaction, recommendation, thank-you) is attached to a detail: a rating, a line, an episode, a scene.
   *Episode page:* replying to Priya's note on 2x04 opens your DM with the episode card and her sentence quoted.

4. **Overlap first, difference as a question, score last.** Lead with named titles you both loved; present a split as an invitation to talk; keep any compatibility number below, banded, unsortable.
   *Profile (someone else's):* "You both loved *Past Lives* and *Aftersun*. You split on *Dune* — ask Priya about it."

5. **Close every loop on someone's behalf.** When an action finishes something another person started (a recommendation, an invite, a room pick), tell that person, by name, with the outcome.
   *Watchlist:* each item shows who recommended it and their words; logging it pre-ticks "Let Priya know". *Notifications:* "Arjun finally watched *Past Lives* — 9. You told him to in March."

6. **Presence is authored and located.** Show what people *did*, where you both are; never ambient status.
   *Episode page:* "Priya is up to 2x03" only when both of you are logging the series. *Header:* no online dots, no last-active.

7. **Consent at the edge of someone else's diary.** Your diary can mention anyone; nothing touches another person's diary, shelf, recap or compatibility without their yes, and either side can unlink silently.
   *Notifications:* "Arjun says you watched *Dune* together on 12 March. Add it to your diary?" — "Yes, I was there" / "Not me". No "declined" state is ever shown to Arjun.

8. **Three visibility words: Just me / Us / Shelf.** "Us" (only the people you watched with) is the default when companions are named; the choice is one visible word at save time.
   *Log sheet:* under Save, "Visible to: Us (you and Priya)", tap to change.

9. **Solo is whole.** Watching alone is a first-class, warmly described way to watch, and the social layer reaches solo watchers asynchronously.
   *Home for a mostly-solo user:* friends' takes on what *you* just logged and recommendations waiting for you, not a prompt to find company. *Recap:* "your Friday-night run of Ozu".

10. **Small circles, ranked by closeness, not by count.** Ordering of people anywhere uses co-viewings, exchanged recommendations and DMs; the default top layer is the inner ~5–15 (Dunbar).
    *Profile → "People you watch with":* top 5 by co-viewings, faces large, no follower totals anywhere.

11. **One face, one colour, everywhere.** Each person has a photo or a monogram in a stable hue; pairs use the overlap, split-card or joined-colour primitives consistently.
    *Header:* your avatar; the DM entry shows the face of whoever last wrote to you. *Rating cards:* each half tinted with its person's hue.

12. **Reactions are doors, not tallies.** Reactions show *who*, never how many; "Reply" sits next to every reaction.
    *Episode thread:* "Priya, Dev — same" with a reply field; no counts, no sorting by reactions among friends.

13. **Names before accounts.** "Watched with" accepts anyone; non-users appear as honest outlined chips; when they join via your link, they inherit their place in your history.
    *Home, first week:* "You're in 4 of Arjun's diary entries. Add them to yours?" for a newly joined user.

14. **Let people fade someone out quietly.** Per-person "show less" for recaps and home, full block that removes the pair from every shared surface, nothing ever announced to the other person.
    *Profile → ⋯ on a person:* "Show Priya less in recaps", "Unlink our viewings", "Block".

15. **Recaps lead with people, but ask before they headline anyone.** Month/year recaps open with the people you watched with, show a preview, and let you remove a person or a film before the recap is shown or shared.
    *Home (recap card):* "Your year: 41 films, 6 with Priya" with "Edit before you see it" one tap away.

### Anti-patterns letsee must never ship
- **Streaks of any kind**, including relationship streaks ("8 weekends in a row with Priya"), hourglass warnings, or "restore your streak" offers (Snapchat's model).
- **Ranking people:** public compatibility percentages, "best match", "top friend", leaderboards of films logged, side-by-side volume counts between friends.
- **Shaming empty states:** "0 friends", "none of your friends watched this", "you watched alone 80% of the time".
- **Inferred social facts:** auto-linking people who logged the same title the same night, "people near you watched", any co-viewing the user didn't state (Strava grouping).
- **Automatic sharing** of viewings to the public shelf or to other networks without a per-viewing choice (Open Graph frictionless sharing).
- **Ambient surveillance:** online dots, "last active", read receipts on by default, "seen by", typing indicators outside an open DM.
- **Who viewed your profile / shelf / review**, in any form, paid or free.
- **Public tallies on people's words:** like counts on friends' notes, follower counts, "popular among your friends" sorting that turns friends into an audience.
- **Contact harvesting:** address-book upload by default, auto-invites, reminder messages sent to non-users on someone's behalf (Path, LinkedIn).
- **Fake warmth:** unlabelled seeded activity, bot "friends", stranger activity dressed as friend activity.
- **Guilt notifications:** "Priya is waiting for your reply", "You haven't watched with Arjun in a while", "Priya declined your invite".
- **Generic prompts:** "Say hi to Priya!" or AI openers that reference nothing the two people share.
- **Unreviewable retrospectives:** recaps or "on this day" cards that headline a person with no remove/suppress option (Year in Review).
- **Aggregate notifications about strangers:** "12 people liked your review".
- **A sync-player watch party as the core social feature** (both big streamers abandoned theirs).

## Sources
Inline links above carry every factual claim. Primary research cited:
- Short, Williams & Christie (1976), social presence — [theorizeit](https://is.theorizeit.org/wiki/Social_Presence_Theory)
- Boothby, Clark & Bargh (2014), shared experiences amplified — [Yale PDF](https://acmelab.yale.edu/sites/default/files/2014_shared_experiences_are_amplified.pdf)
- Shteynberg (2015), shared attention — [APS](https://www.psychologicalscience.org/journals/perspectives/1745691615589104/)
- Drewery (2022), emotional synchrony in virtual watch parties — [UWSpace](https://uwspace.uwaterloo.ca/handle/10012/18087)
- Luo, Hsu, Park & Hancock (2020), emotional amplification in live comments — [Crossref](https://api.crossref.org/works/10.1145%2F3392853)
- Reis & Shaver (1988), interpersonal process model of intimacy — [Sage](https://sk.sagepub.com/ency/edvol/embed/humanrelationships/chpt/interpersonal-process-model-intimacy)
- Pinel et al., I-sharing — [Duke PDF](https://sites.duke.edu/dukeidlab/files/2016/09/Isharing.SocialPsych.2016.pdf)
- Aron, Aron & Smollan (1992), IOS scale — [SPARQ](https://www.sparqtools.org/wp-content/uploads/2022/10/Inclusion-of-Other-in-Self.pdf)
- Aron et al. (1997), experimental generation of closeness — [Crossref](https://api.crossref.org/works/10.1177/0146167297234003)
- Karan, Rosenthal & Robbins (2018), we-talk meta-analysis — [UCR](https://news.ucr.edu/articles/2018/10/04/research-affirms-power-we)
- Verduyn et al. (2015), passive Facebook use — [PubMed](https://pubmed.ncbi.nlm.nih.gov/25706656/); Verduyn, Gugushvili & Kross (2022) — [summary](https://gugushvili.quarto.pub/publications/extended-model/index.html); Meier & Krause (2022) — [FAU](https://cris.fau.de/publications/284523009)
- Burke & Kraut (2016), communication type and tie strength — [WDH](https://worlddatabaseofhappiness.eur.nl/publications/the-relationship-between-facebook-use-and-well-being-depends-on-communication-type-and-tie-strength-15305), [Meta Research](https://research.facebook.com/blog/2016/1/online-or-offline-connecting-with-close-friends-improves-well-being/)
- Sandstrom & Dunn (2014), weak ties — [WDH](https://worlddatabaseofhappiness.eur.nl/publications/social-interactions-and-well-being-the-surprising-power-of-weak-ties-12167/)
- Dunbar (2016), online network size — [Crossref](https://api.crossref.org/works/10.1098/rsos.150292)
- Montoya, Horton & Kirchner (2008), perceived vs actual similarity — [Crossref](https://api.crossref.org/works/10.1177/0265407508096700)
- Hayes, Carr & Wohn (2016), one-click cues — [NJIT](https://digitalcommons.njit.edu/fac_pubs/10732)
- Kaye et al. (2005), Virtual Intimate Object — [MIT](https://alumni.media.mit.edu/~jofish/writing/index.htm)
- Cramton (2001), mutual knowledge — [RePEc](https://ideas.repec.org/a/inm/ororsc/v12y2001i3p346-371.html)
- Algoe (2012), find-remind-bind — [Crossref](https://api.crossref.org/works/10.1111/j.1751-9004.2012.00439.x); Kumar & Epley (2018) — [PubMed](https://pubmed.ncbi.nlm.nih.gov/29949445/); Liu et al. (2022) — [KU](https://business.ku.edu/people-underestimate-surprising-impact-reaching-out-study-finds)
- Vogel et al. (2014), social comparison and self-esteem — [Crossref](https://api.crossref.org/works/10.1037/ppm0000047)
- Ur et al. (2012), perceptions of behavioural tailoring — [FPF PDF](https://fpf.org/wp-content/uploads/2021/05/Smart-Useful-Scary-Creepy.-Perceptions-of-Online-Behavioral-Advertising-.pdf)

Product and industry sources are linked inline in §2–§6 (Spotify, Letterboxd, StoryGraph, Strava, BeReal, Locket, Retro, Path, Partiful, Hinge, Co-Star, Apple, Google Photos, Duolingo, Snapchat, Instagram, WhatsApp, Figma, LinkedIn, Nextdoor, Gas, Geneva, CivicScience, Nielsen, NN/g, Atlassian, Mailchimp).

**Gaps / not verified:** Geneva (now owned by Bumble, [geneva.com](https://www.geneva.com/)) is a group-community product with little two-person mechanics, so it is not in the pattern table. Apple Music shared listening is covered by SharePlay. No primary source was found for Facebook's often-quoted "7 friends in 10 days" activation rule, so it is not used.
