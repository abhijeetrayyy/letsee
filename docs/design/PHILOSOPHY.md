# Someone else is in the room

**The letsee design philosophy.** Written 3 October 2026; second pass the same day, after the owner rejected the first colour direction as brownish and playful. It replaces every earlier design and layout document in this repository; on any question of how something looks, where it sits on a page, or how a flow goes, this folder wins over older docs. Product behaviour that older docs decided — no streaks, notifications only for what a person caused, the private diary, the cost discipline — stands, and this philosophy is built on top of it.

The evidence behind each idea is in `research/01`–`05`. What the app looks like today is in `00_current_state.md`. How every feature changes is in `RETHINK.md`. The tokens and components are in `SYSTEM.md`, every page's plan is in `PAGES.md`, and how the change reaches every page and every instance is in `EXECUTION.md`.

---

## The thesis

The product is called *letsee*: say it aloud and it is "let's see" — a suggestion one person makes to another. The name is first person plural. The design should be too.

Most people who log a film watched it alone; nearly half of TV viewing is solitary (research/03 §2.1). That does not make it a solo product. Someone recommended the film. Someone you trust rated it. Someone is waiting to hear what you thought, and someone will watch it next week because you liked it. **There is always someone else in the room**, even when they were not on the couch. Every screen in letsee should make that person visible — by name, by face, in their own words — before it shows anything else.

**People first; cinema is what passes between them.** The film is the reason two people have something to say to each other: they watched it together, one passed it to the other, they disagree about the ending. So the people are the structure of the product — every relationship is a room — and the films are what moves through it.

## The room

Picture the place this product lives: a dark room, lit by a screen, with somebody beside you. That picture decides the visual language, and it is a mature one.

- **The room is graphite.** A true neutral dark with the faintest cool bias. Not black, not brown, not blue. It recedes and lasts.
- **The interface is white.** Text and the one primary action in each place are white on graphite: the most confident contrast a dark screen has. There is no accent colour.
- **The film is the colour.** Posters, stills and backdrops are large and uncropped, and a title page is lit by its own poster the way a screen colours the wall behind it.
- **People are faces.** A photo, or initials on a quiet disc. Two people together are two faces overlapping — and two overlapping circles is, literally, how psychologists measure closeness between two people (research/03 §1.3). The mark is that picture.

So colour means one thing: **every hue on screen came from a film or a face.** Anything else is a mistake, or a warning.

The first pass gave the interface a wine-velvet base, a peach accent and a pastel colour for every person. On a screen someone looks at every night for years, that read as a toy. Confidence on a dark screen comes from contrast, type and space, and the colour is better left to the films.

## The principles

1. **People before titles, friends before strangers.**
   On every page the first social thing you see is a specific person you know — a face, a first name, a sentence they wrote — not a count. "Priya · 6 · *too long, loved the sand*" has presence; "12 friends watched this" has almost none. Strangers' opinions come after friends'; the catalogue comes after both.

2. **Every relationship is a place.**
   Each person you watch with has a room: the conversation, the films you watched together, what you passed each other, what you both want to see. Messages, group decisions and clubs live in rooms, not in separate features. A notification is just something that happened in a room.

3. **Lead with the decision.**
   Every page opens with the one thing a person came to do: log it, continue it, decide on it, reply to it. Reference material — full credits, keywords, release history, every rent-and-buy shop — is folded away behind one tap. A film page is a place to act and to see your people, not an encyclopedia entry. Target: the decision and your people inside the first screen on a phone, the whole page inside four.

4. **A viewing is a keepsake.**
   What you log is shown as a stub: the date, where you were, who was there. People keep stubs; they do not keep rows. Logging takes one tap and is never interrupted by a form; remembering is where the richness goes — the calendar, on this day, the month and the year, all led by people.

5. **Overlap, not score.**
   Between two people, show the moment you agreed ("you both gave the ending a 5"), the film one of you gave the other, the twelve you watched together. Do not rank friends against each other, and do not lead with a percentage. A comparison is a conversation starter, never a contest.

6. **Close the loop for people.**
   When something you did reaches someone — they finally watched the film you recommended, they said they were there too — they hear about it, once, from you by name. Silence is designed out. So is broadcast: nothing is ever announced to "your followers".

7. **Only what you chose to share.**
   Social surfaces use what a person deliberately logged or said, never what the system inferred. Anything that looks back — a recap, "a year ago with Priya" — can be edited, hidden, and turned off for a specific person.

8. **Spoilers are a kindness.**
   One clear gate per page, decided by the viewer's own progress, with an honest "show anyway". Friends' episode reactions unlock as you catch up, the way a buddy read does.

9. **Calm, not compulsive.**
   No streaks, including friendship streaks. No counts as identity. No badges, scores or red dots that exist to bring you back. Motion only shows that something changed or that someone arrived; nothing floats, pulses or glows for its own sake. Everything can lapse without penalty.

10. **Cheap by construction.**
   The design never spends the cost discipline the product earned. Colours are precomputed, fonts self-hosted, images requested at the size shown, sections deferred, nothing crawlable, nothing prefetched by default. Beauty that needs a server round trip per view is not allowed.

## How it should sound

The interface talks like a friend who keeps good notes.

- **First names and "you".** "You and Priya", "your 12 films together", "Kabir's pick". The relationship is the unit.
- **Memories in past tense, plans in future.** "You watched this with Mira on a Friday in March." "Lined up for the weekend."
- **Plain verbs on buttons.** *Log it*, *I was there too*, *Save for later*, *Tell Priya*. The button and its confirmation use the same verb.
- **Empty means "start here", never "you have nobody".** A person with no friends yet sees what to do first and a way to bring someone in, not an empty grid or a guilt line.
- **No exclamation marks, no gamer talk, no "cinephile" flattery.** The current "A true cinephile" label is the kind of line this rules out.

## What letsee will never ship

- Streaks of any kind, including "weeks in a row with Priya".
- Follower or watched counts as the headline of a profile.
- A ranked list of friends by compatibility.
- "Who viewed your profile".
- Auto-posting anything a person did not log themselves.
- A recap or memory that cannot be hidden.
- Hue used for decoration: gradient section headers, rainbow category accents, glowing borders, a colour per person.
- Ambient animation: floating, pulsing, shimmering, slow-spinning.
- A red number on anything.
- An infinite feed with no end.
- A page whose first screen is only catalogue facts.

## When in doubt

Ask these in order, and stop at the first one that decides it.

1. Does it make a specific person more present, or less?
2. Does it help someone do what they came to this page to do?
3. Would it still be true if the person mostly watches alone?
4. Can it lapse without anyone being punished?
5. Does it cost a server round trip per view? If yes, find another way.
6. Did every colour on it come from a film or a face?
