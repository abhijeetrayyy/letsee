/**
 * Rooms: everything that passed between you and one person, derived from what
 * is already stored (docs/design/RETHINK.md §4, "Data").
 *
 * A one-to-one room has no table of its own. It is the union of the messages
 * between the two of you, the viewings you logged together, and the passes
 * (`title_recommendations`) either of you sent the other. Every read here runs
 * in the browser under the viewer's own row-level security, so a room page
 * costs no server work: `messages_select_participants`, `viewings_self` and
 * `title_recommendations_select_party` already decide what the viewer may see.
 *
 * Still to come, each with its migration (docs/design/EXECUTION.md §1):
 * hiding an event for yourself (104), words seen only by the people who were
 * there (105), group rooms from clubs (107), and the `room_timeline` RPC that
 * replaces these several reads with one once rooms are the default.
 */

import { supabase } from "@/utils/supabase/client";
import { getBlockedUserIds } from "@/utils/blocks";
import { fetchConversations } from "@/lib/db/social";
import { fetchDiary } from "@/lib/db/viewings";
import { titleMetaFor } from "@/utils/viewings";
import { closeness, isOneOfYourPeople } from "@/lib/people/closeness";
import { listsMeet, pickMoments, type ListMeet, type ListTitle, type Moment, type Rating } from "@/lib/people/moments";

export type RoomPerson = { id: string; username: string; avatarUrl: string | null };

/** A title card's metadata, as `sendCard` and `sendPass` write it. */
export type CardMeta = { media_type?: string; media_id?: string; media_name?: string; media_image?: string };

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  message_type: "text" | "cardmix";
  metadata: CardMeta | null;
  is_read: boolean;
  created_at: string;
  /** Local only: an optimistic message still in flight, or one that failed. */
  pending?: boolean;
  failed?: boolean;
};

/** A viewing in your diary with this person on it. */
export type Together = {
  viewingId: number;
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  watchedOn: string;
  /** When it was logged: where it sits among the messages. */
  at: string;
  /**
   * What each of you wrote about it that the other may read — words for the
   * people who were there (112's 'us') or on your shelf. Filled in a room only.
   */
  words?: { mine: string | null; theirs: string | null };
};

/** A film one of you passed the other. */
export type Pass = {
  id: number;
  fromMe: boolean;
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  note: string | null;
  at: string;
  watchedAt: string | null;
  dismissedAt: string | null;
};

export type RoomSummary = {
  person: RoomPerson;
  lastAt: string;
  /** The last thing that happened, as one line. */
  last: { kind: "message" | "together" | "pass"; text: string; fromMe: boolean };
  /** A message from them you have not read. Shown as a dot, never a number. */
  unread: boolean;
  together: number;
  lastTogether: string | null;
  passes: number;
  lastPass: string | null;
  lastMessage: string | null;
  mutual: boolean;
};

/** Someone you named on a viewing who is not on letsee. */
export type NamedCompanion = { name: string; viewings: number; last: string };

export type RoomList = {
  rooms: RoomSummary[];
  requests: Request[];
  /** Your people, closest first (RETHINK.md §5): rooms and mutual follows. */
  people: RoomSummary[];
  /** Passes to you that are still open, newest first, each with who sent it. */
  passesToMe: (Pass & { person: RoomPerson })[];
  named: NamedCompanion[];
  diaryEmpty: boolean;
  /** Everyone you follow, so suggestions never offer to follow them again. */
  following: string[];
};

/** Someone asking something of you that a room cannot answer yet. */
export type Request =
  | { kind: "follow"; id: number; person: RoomPerson; at: string }
  | { kind: "was-there"; viewingId: number; person: RoomPerson; itemId: string; itemType: "movie" | "tv"; itemName: string; watchedOn: string; at: string };

type PassRow = {
  id: number;
  from_user_id: string;
  to_user_id: string;
  item_id: string;
  item_type: string;
  item_name: string;
  image_url: string | null;
  note: string | null;
  created_at: string;
  watched_at: string | null;
  dismissed_at: string | null;
};

const PASS_COLUMNS = "id, from_user_id, to_user_id, item_id, item_type, item_name, image_url, note, created_at, watched_at, dismissed_at";

function toPass(r: PassRow, me: string): Pass {
  return {
    id: r.id,
    fromMe: r.from_user_id === me,
    itemId: r.item_id,
    itemType: r.item_type === "tv" ? "tv" : "movie",
    itemName: r.item_name || "a title",
    imageUrl: r.image_url,
    note: r.note,
    at: r.created_at,
    watchedAt: r.watched_at,
    dismissedAt: r.dismissed_at,
  };
}

/** `ilike` treats `%`, `_` and `\` as pattern characters; a username is not a pattern. */
function literal(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function people(ids: string[]): Promise<Map<string, RoomPerson>> {
  const out = new Map<string, RoomPerson>();
  if (!ids.length) return out;
  const { data } = await supabase.from("users").select("id, username, avatar_url").in("id", ids);
  for (const u of data ?? []) {
    if (u.username) out.set(u.id, { id: u.id, username: u.username, avatarUrl: u.avatar_url });
  }
  return out;
}

/** Your diary's shared viewings, grouped by the person you watched with. */
async function diaryCompanions(me: string): Promise<{ byUser: Map<string, Together[]>; named: NamedCompanion[]; empty: boolean }> {
  const diary = await fetchDiary(me, { limit: 400 });
  const byUser = new Map<string, Together[]>();
  const named = new Map<string, NamedCompanion>();
  for (const v of diary) {
    for (const c of v.companions) {
      if (!c.userId) {
        const name = c.name?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        const cur = named.get(key) ?? { name, viewings: 0, last: v.watchedOn };
        cur.viewings += 1;
        if (v.watchedOn > cur.last) cur.last = v.watchedOn;
        named.set(key, cur);
        continue;
      }
      const list = byUser.get(c.userId) ?? [];
      list.push({
        viewingId: v.id,
        itemId: v.itemId,
        itemType: v.itemType,
        itemName: v.itemName || "a title",
        imageUrl: v.imageUrl,
        watchedOn: v.watchedOn,
        at: v.createdAt,
      });
      byUser.set(c.userId, list);
    }
  }
  return {
    byUser,
    named: [...named.values()].sort((a, b) => b.last.localeCompare(a.last)),
    empty: diary.length === 0,
  };
}

async function togetherByPerson(me: string): Promise<Map<string, Together[]>> {
  return (await diaryCompanions(me)).byUser;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** By username, or by id — old message links address a person by their id. */
export async function findPerson(username: string): Promise<RoomPerson | null> {
  const byId = UUID.test(username);
  let q = supabase.from("users").select("id, username, avatar_url").is("deleted_at", null);
  q = byId ? q.eq("id", username) : q.ilike("username", literal(username));
  const { data } = await q.limit(1).maybeSingle();
  return data?.username ? { id: data.id, username: data.username, avatarUrl: data.avatar_url } : null;
}

/** People whose username starts with `query`, to start a room with. */
export async function searchPeople(query: string, me: string): Promise<RoomPerson[]> {
  const q = query.trim().replace(/^@/, "");
  if (q.length < 2) return [];
  const { data } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .ilike("username", `${literal(q)}%`)
    .is("deleted_at", null)
    .neq("id", me)
    .limit(6);
  return (data ?? []).filter((u) => u.username).map((u) => ({ id: u.id, username: u.username!, avatarUrl: u.avatar_url }));
}

export async function fetchRoomList(me: string): Promise<RoomList> {
  const [conversations, diary, passRows, blocked, followRows, wasThereRows, connections] = await Promise.all([
    fetchConversations(me).catch(() => []),
    diaryCompanions(me),
    supabase
      .from("title_recommendations")
      .select(PASS_COLUMNS)
      .or(`from_user_id.eq.${me},to_user_id.eq.${me}`)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => (data ?? []) as PassRow[]),
    getBlockedUserIds(supabase, me),
    supabase
      .from("user_follow_requests")
      .select("id, sender_id, created_at")
      .eq("receiver_id", me)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => data ?? []),
    // Named on someone's viewing and not yet answered, in the last month.
    supabase
      .from("viewing_companions")
      .select("viewing_id, created_at, viewings!viewing_id(user_id, item_id, item_type, watched_on)")
      .eq("companion_user_id", me)
      .is("linked_viewing_id", null)
      .gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString())
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => data ?? []),
    supabase
      .from("user_connections")
      .select("follower_id, followed_id")
      .or(`follower_id.eq.${me},followed_id.eq.${me}`)
      .limit(2000)
      .then(({ data }) => data ?? []),
  ]);

  const following = new Set(connections.filter((c) => c.follower_id === me).map((c) => c.followed_id));
  const mutuals = new Set(connections.filter((c) => c.followed_id === me && following.has(c.follower_id)).map((c) => c.follower_id));

  type Draft = Omit<RoomSummary, "person"> & { person?: RoomPerson; hasRoom: boolean };
  const drafts = new Map<string, Draft>();
  const draft = (id: string): Draft | null => {
    if (id === me || blocked.has(id)) return null;
    let d = drafts.get(id);
    if (!d) {
      d = {
        lastAt: "",
        last: { kind: "message", text: "", fromMe: false },
        unread: false,
        together: 0,
        lastTogether: null,
        passes: 0,
        lastPass: null,
        lastMessage: null,
        mutual: mutuals.has(id),
        hasRoom: false,
      };
      drafts.set(id, d);
    }
    return d;
  };
  const offer = (id: string, at: string, last: RoomSummary["last"]) => {
    const d = draft(id);
    if (!d) return null;
    d.hasRoom = true;
    if (at > d.lastAt) Object.assign(d, { lastAt: at, last });
    return d;
  };

  for (const c of conversations) {
    const d = offer(c.userId, c.lastAt, { kind: "message", text: c.lastMessage || "Sent a title", fromMe: c.fromMe });
    if (!d) continue;
    d.unread = d.unread || c.unread > 0;
    d.lastMessage = c.lastAt;
    d.person = { id: c.userId, username: c.username, avatarUrl: c.avatarUrl };
  }
  for (const [id, list] of diary.byUser) {
    const newest = list.reduce((a, b) => (b.at > a.at ? b : a));
    const d = offer(id, newest.at, { kind: "together", text: newest.itemName, fromMe: true });
    if (!d) continue;
    d.together = list.length;
    d.lastTogether = newest.at;
  }
  for (const r of passRows) {
    const other = r.from_user_id === me ? r.to_user_id : r.from_user_id;
    const d = offer(other, r.created_at, { kind: "pass", text: r.item_name || "a title", fromMe: r.from_user_id === me });
    if (!d) continue;
    d.passes += 1;
    if (!d.lastPass || r.created_at > d.lastPass) d.lastPass = r.created_at;
  }
  for (const id of mutuals) draft(id);

  type WasThereRow = { viewing_id: number; created_at: string; viewings: { user_id: string; item_id: string; item_type: string; watched_on: string } | { user_id: string; item_id: string; item_type: string; watched_on: string }[] | null };
  const wasThere = (wasThereRows as WasThereRow[])
    .map((r) => ({ ...r, v: Array.isArray(r.viewings) ? r.viewings[0] : r.viewings }))
    .filter((r) => r.v && !blocked.has(r.v.user_id));

  const now = Date.now();
  const ranked = [...drafts.entries()]
    .filter(([, d]) => isOneOfYourPeople(d, now))
    .sort((a, b) => closeness(b[1], now) - closeness(a[1], now));

  const missing = new Set<string>();
  for (const [id, d] of drafts) if (!d.person && (d.hasRoom || ranked.slice(0, 24).some(([r]) => r === id))) missing.add(id);
  for (const f of followRows) missing.add(f.sender_id);
  for (const w of wasThere) missing.add(w.v!.user_id);
  const found = await people([...missing]);

  // Titles on someone else's viewing come from their library, which their
  // privacy setting may hide; the request still works without the name.
  const names = new Map<string, string>();
  await Promise.all(
    [...new Set(wasThere.map((w) => w.v!.user_id))].map(async (owner) => {
      const ids = wasThere.filter((w) => w.v!.user_id === owner).map((w) => w.v!.item_id);
      const meta = await titleMetaFor(supabase, owner, ids);
      for (const [k, m] of meta) names.set(`${owner}:${k}`, m.name);
    }),
  );

  const summary = (id: string, d: Draft): RoomSummary | null => {
    const person = d.person ?? found.get(id);
    if (!person) return null;
    return {
      person,
      lastAt: d.lastAt,
      last: d.last,
      unread: d.unread,
      together: d.together,
      lastTogether: d.lastTogether,
      passes: d.passes,
      lastPass: d.lastPass,
      lastMessage: d.lastMessage,
      mutual: d.mutual,
    };
  };

  const rooms: RoomSummary[] = [];
  for (const [id, d] of drafts) {
    if (!d.hasRoom) continue;
    const room = summary(id, d);
    if (room) rooms.push(room);
  }
  rooms.sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  const yourPeople: RoomSummary[] = [];
  for (const [id, d] of ranked.slice(0, 24)) {
    const room = summary(id, d);
    if (room) yourPeople.push(room);
  }

  const requests: Request[] = [];
  for (const f of followRows) {
    const person = found.get(f.sender_id);
    if (person && !blocked.has(person.id)) requests.push({ kind: "follow", id: f.id, person, at: f.created_at });
  }
  for (const w of wasThere) {
    const v = w.v!;
    const person = found.get(v.user_id);
    if (!person) continue;
    const type = v.item_type === "tv" ? "tv" : "movie";
    requests.push({
      kind: "was-there",
      viewingId: w.viewing_id,
      person,
      itemId: v.item_id,
      itemType: type,
      itemName: names.get(`${v.user_id}:${type}:${v.item_id}`) ?? "",
      watchedOn: v.watched_on,
      at: w.created_at,
    });
  }
  requests.sort((a, b) => b.at.localeCompare(a.at));

  const byId = new Map([...rooms, ...yourPeople].map((r) => [r.person.id, r.person]));
  const passesToMe = passRows
    .filter((r) => r.to_user_id === me && !r.watched_at && !r.dismissed_at && !blocked.has(r.from_user_id))
    .map((r) => ({ ...toPass(r, me), person: byId.get(r.from_user_id) }))
    .filter((p): p is Pass & { person: RoomPerson } => !!p.person);

  return { rooms, requests, people: yourPeople, passesToMe, named: diary.named, diaryEmpty: diary.empty, following: [...following] };
}

export type MeetMoment = Moment & { itemId: string; itemType: "movie" | "tv"; itemName: string };

type RatingRow = { item_id: string; item_type: string; score: number; updated_at: string };

async function ratingsOf(userId: string): Promise<Rating[]> {
  const { data } = await supabase
    .from("user_ratings")
    .select("item_id, item_type, score, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(3000);
  return ((data ?? []) as RatingRow[]).map((r) => ({ key: `${r.item_type}:${r.item_id}`, score: Number(r.score), at: r.updated_at }));
}

/**
 * Two films you both loved and one you split on. Their ratings arrive only if
 * their profile is visible to you (RLS, 019); `profile_show_ratings` hides
 * the numbers, and a moment without numbers is not one, so then there are
 * none.
 */
async function whereYouMeet(me: string, other: string): Promise<MeetMoment[]> {
  const [mine, theirs, profile] = await Promise.all([
    ratingsOf(me),
    ratingsOf(other),
    supabase.from("users").select("profile_show_ratings").eq("id", other).maybeSingle(),
  ]);
  if (profile.data?.profile_show_ratings === false) return [];
  const moments = pickMoments(mine, theirs);
  if (!moments.length) return [];
  const names = await titleMetaFor(supabase, me, [...new Set(moments.map((m) => m.key.split(":")[1]))]);
  return moments
    .map((m) => {
      const [type, id] = m.key.split(":");
      return { ...m, itemId: id, itemType: (type === "tv" ? "tv" : "movie") as "movie" | "tv", itemName: names.get(m.key)?.name ?? "" };
    })
    .filter((m) => m.itemName);
}

/**
 * Both people's words on the films they watched together, keyed
 * `user:type:id`. Only words the other one may read: 'us' or on the shelf —
 * never your own private note, which would look shared in a shared room. RLS
 * returns their rows only when 112's rule (or the public rule) admits you.
 */
async function wordsTogether(me: string, other: string, together: Together[]): Promise<Map<string, string>> {
  const ids = [...new Set(together.map((t) => t.itemId))].slice(0, 200);
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("takes")
    .select("user_id, item_id, item_type, body, visibility, updated_at")
    .in("user_id", [me, other])
    .in("item_id", ids)
    .eq("scope", "title")
    .in("visibility", ["us", "shelf"])
    .not("body", "is", null)
    .order("updated_at", { ascending: true });
  const out = new Map<string, string>();
  // Ascending, so the newest of someone's two rows (us and shelf) wins.
  for (const r of (data ?? []) as { user_id: string; item_id: string; item_type: string; body: string | null }[]) {
    const body = r.body?.trim();
    if (body) out.set(`${r.user_id}:${r.item_type}:${r.item_id}`, body);
  }
  return out;
}

/** What a room shows besides the messages: films together, passes both ways, where you meet. */
export async function fetchRoom(
  me: string,
  other: string,
): Promise<{ together: Together[]; passes: Pass[]; meet: MeetMoment[]; blocked: boolean }> {
  const [together, passRows, blocked, meet] = await Promise.all([
    togetherByPerson(me).then((m) => m.get(other) ?? []),
    supabase
      .from("title_recommendations")
      .select(PASS_COLUMNS)
      .or(`and(from_user_id.eq.${me},to_user_id.eq.${other}),and(from_user_id.eq.${other},to_user_id.eq.${me})`)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => (data ?? []) as PassRow[]),
    getBlockedUserIds(supabase, me),
    whereYouMeet(me, other).catch(() => []),
  ]);
  const words = await wordsTogether(me, other, together).catch(() => new Map<string, string>());
  const withWords = together.map((t) => ({
    ...t,
    words: { mine: words.get(`${me}:${t.itemType}:${t.itemId}`) ?? null, theirs: words.get(`${other}:${t.itemType}:${t.itemId}`) ?? null },
  }));
  return {
    together: withWords.sort((a, b) => b.watchedOn.localeCompare(a.watchedOn)),
    passes: passRows.map((r) => toPass(r, me)),
    meet,
    blocked: blocked.has(other),
  };
}

type ListRow = { item_id: string; item_type: string; item_name: string | null; image_url: string | null };
const asTitle = (r: ListRow): ListTitle => ({
  itemId: String(r.item_id),
  itemType: r.item_type === "tv" ? "tv" : "movie",
  itemName: r.item_name ?? "",
  imageUrl: r.image_url,
});

/**
 * Where two people's lists meet (`listsMeet`): read in the browser under your
 * RLS, so their side arrives only when their profile is visible to you.
 * Four small reads rather than two whole libraries: both watchlists (newest
 * 300), then which of yours they've watched and which of theirs you have,
 * asked by id. Loaded apart from the room, so the room never waits on it.
 */
export async function fetchListsMeet(me: string, other: string): Promise<ListMeet[]> {
  const saves = (user: string) =>
    supabase
      .from("user_media_status")
      .select("item_id, item_type, item_name, image_url")
      .eq("user_id", user)
      .eq("status", "watchlist")
      .order("saved_at", { ascending: false, nullsFirst: false })
      .limit(300)
      .then(({ data }) => ((data ?? []) as ListRow[]).map(asTitle).filter((t) => t.itemName));
  const [mine, theirs] = await Promise.all([saves(me), saves(other)]);
  if (!mine.length && !theirs.length) return [];
  const watchedOf = (user: string, list: ListTitle[]) =>
    list.length
      ? supabase
          .from("user_media_status")
          .select("item_id, item_type")
          .eq("user_id", user)
          .in("status", ["watched", "watching"])
          .in("item_id", [...new Set(list.map((t) => t.itemId))])
          .then(({ data }) => new Set(((data ?? []) as { item_id: string; item_type: string }[]).map((r) => `${r.item_type}:${r.item_id}`)))
      : Promise.resolve(new Set<string>());
  const [theySaw, youSaw] = await Promise.all([watchedOf(other, mine), watchedOf(me, theirs)]);
  return listsMeet(mine, theirs, theySaw, youSaw);
}
