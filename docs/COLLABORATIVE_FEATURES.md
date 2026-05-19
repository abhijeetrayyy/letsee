# LetSee — Collaborative Features Roadmap

> **Goal**: Transform LetSee from a personal film journal into a thriving social hub where users discover content through each other, share opinions, and build community around movies and TV.

---

## Current State

LetSee already has a **solid social foundation**:

| Feature | Status |
|---------|--------|
| Follow/unfollow with request system | ✅ Working |
| Direct messaging (text + card shares) | ✅ Working |
| User-to-user recommendations on profiles | ✅ Working |
| Friend compatibility score (genre + rating) | ✅ Working |
| Public reviews on movie/TV detail pages | ✅ Working |
| Shared custom lists with visibility controls | ✅ Working |
| Profile browsing & discovery page | ✅ Working |
| Collaborative filtering (people like you also like) | ✅ Working |
| Discover People on home page | ✅ Working |
| Follow request notifications | ✅ Working (basic) |

**What's Missing** (the collaborative layer):

| Feature | Priority | Impact |
|---------|----------|--------|
| Global Following Activity Feed on home page | **P0** | Highest — shows what friends are watching |
| Like/Reaction system on reviews & activity | **P0** | High — enables lightweight engagement |
| Full notification center (likes, follows, comments, friend activity) | **P1** | High — keeps users coming back |
| Comments on public reviews | **P1** | High — enables discussion |
| Notification preferences UI | **P1** | Medium — gives user control |
| User blocking & reporting | **P2** | Medium — safety & moderation |
| @mentions in reviews & messages | **P2** | Low — nice-to-have |
| Collaborative lists | **P3** | Medium — group curation |
| Gamification (badges, challenges) | **P3** | Low — engagement driver |
| Watch parties | **P4** | Low — advanced social |

---

## Phase 1: Global Following Activity Feed

**Goal**: Replace the current static "Discover People" section on the home page with a dynamic feed of what the people you follow are watching, rating, and reviewing.

### Database Changes

New migration: `025_following_activity_feed.sql`

```sql
-- Create a materialized activity view for efficient feed queries
create table if not exists public.user_activity (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('watched', 'rated', 'reviewed', 'list_created', 'favored')),
  item_id text,
  item_type text check (item_type in ('movie', 'tv')),
  item_name text,
  image_url text,
  score smallint check (score >= 1 and score <= 10),
  review_text text,
  list_name text,
  list_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists user_activity_user_id_idx on public.user_activity (user_id);
create index if not exists user_activity_created_at_idx on public.user_activity (created_at desc);
```

**RLS**: Insert on own activity, select if viewer follows user or user is public.

### API

`GET /api/feed/following` — returns paginated activity feed for the current user

```typescript
// Response shape
{
  items: ActivityItem[];
  nextCursor: string | null;
  hasMore: boolean;
}
```

**Algorithm**:
1. Get list of user IDs the current user follows (from `user_connections`)
2. Query `user_activity` for those users (or fallback to `watched_items` for `watched` type) ordered by `created_at` desc
3. Paginate with cursor-based pagination (20 items per page)
4. If user follows < 3 people, supplement with popular/recent activity from public users

### UI Components

1. **`FollowingFeed.tsx`** — Main feed component
   - Infinite scroll with IntersectionObserver
   - Each item shows: avatar + username, activity type tag, timestamp, poster, rating stars, review snippet
   - Like button on each activity item
   - Click-through to user profile, movie/TV detail page

2. **Update `src/app/app/page.tsx`** — Replace "Discover People" section with "Following Feed" when user follows someone, keep "Discover People" as a smaller side section

### Files to Create / Modify

| File | Action |
|------|--------|
| `src/app/api/feed/following/route.ts` | **Create** — new API endpoint |
| `src/components/feed/FollowingFeed.tsx` | **Create** — feed component |
| `src/components/feed/ActivityCard.tsx` | **Create** — individual activity card |
| `src/app/app/page.tsx` | **Modify** — add feed section after "Continue Watching" |
| `migrations/025_following_activity_feed.sql` | **Create** — migration |

---

## Phase 2: Like / Reaction System

**Goal**: Allow users to like/reaction activity items, reviews, and lists. Simple ❤️ with count.

### Database Changes

New migration: `026_reactions.sql`

```sql
create table if not exists public.reactions (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  reaction_type text not null default 'like' check (reaction_type in ('like', 'love', 'laugh', 'wow', 'sad', 'fire')),
  target_type text not null check (target_type in ('activity', 'review', 'list', 'comment')),
  target_id bigint not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create index if not exists reactions_target_idx on public.reactions (target_type, target_id);
create index if not exists reactions_user_idx on public.reactions (user_id);
```

### API

`POST /api/reactions/toggle` — toggle like on any target
`GET /api/reactions?target_type=review&target_id=123` — get reaction count + user's reaction

### UI Updates

- Add ❤️ button to activity feed cards
- Add ❤️ button to public reviews on movie/TV detail pages
- Add ❤️ button to custom lists
- Animated heart on click (CSS transition)

---

## Phase 3: Comments on Public Reviews

**Goal**: Enable discussion on public reviews. Users can comment on movie/TV detail page reviews and profile reviews.

### Database Changes

```sql
create table if not exists public.comments (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('review', 'list', 'activity')),
  target_id bigint not null,
  content text not null check (char_length(content) >= 1 and char_length(content) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_target_idx on public.comments (target_type, target_id);
create index if not exists comments_user_idx on public.comments (user_id);
```

### API

`GET /api/comments?target_type=review&target_id=123` — paginated comments
`POST /api/comments` — create comment
`DELETE /api/comments/:id` — delete own comment

### UI

- Comment section below public reviews on movie/TV pages
- Comment section on profile review cards
- Inline reply design (expandable thread per review)
- Avatar + username + timestamp per comment

---

## Phase 4: Full Notification System

**Goal**: A comprehensive notification center with all activity types: follow requests, likes, comments, friend activity, streaming alerts.

### Database Changes

New migration: `027_notifications.sql`

```sql
create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'follow_request', 'follow_accepted',
    'like', 'comment',
    'friend_watched', 'friend_reviewed', 'friend_rated',
    'streaming_available', 'new_episode',
    'recommendation_received'
  )),
  actor_id uuid not null references public.users(id) on delete cascade,
  target_type text,
  target_id bigint,
  metadata jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx on public.notifications (user_id, is_read) where not is_read;
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
```

### Notification Preferences UI

Build a settings page at `/app/settings/notifications`:

- Toggle: Follow requests
- Toggle: Likes on my content
- Toggle: Comments on my content
- Toggle: Friend activity (watched, reviewed, rated)
- Toggle: Streaming availability alerts
- Digest frequency: Never / Daily / Weekly

### Notification Center

Replace the current barebones `/app/notification` page with a full notification center:

- Grouped by type ("John liked your review of Inception")
- Clickable -> navigate to relevant content
- Mark all as read button
- Unread count badge in header (already partially working)
- "View all" link from bell dropdown

---

## Implementation Sequence

```
Week 1: Phase 1 — Following Activity Feed
  ├── Migration + new activity table
  ├── API: GET /api/feed/following
  ├── Components: FollowingFeed, ActivityCard
  └── Home page integration

Week 2: Phase 2 — Like System
  ├── Migration: reactions table
  ├── API: POST /api/reactions/toggle
  ├── UI: Like buttons on feed, reviews, lists
  └── Real-time count updates

Week 3: Phase 3 — Comments + Notifications Phase 1
  ├── Migration: comments table
  ├── API: CRUD for comments
  ├── UI: Comment threads on reviews
  └── Notification triggers for likes + comments

Week 4: Phase 4 — Full Notification Center
  ├── Migration: notifications table
  ├── API: Notifications CRUD
  ├── Notification Preferences settings page
  ├── Full notification center UI
  └── Migration: streaming alerts to notifications
```
