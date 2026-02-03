# Messaging System

## Overview

Direct messaging between users with support for **text** and **card** (movie/TV) shares. Built on Supabase (Postgres + Realtime + RLS).

## Schema

- **`messages`**: `id`, `sender_id`, `recipient_id`, `content` (text), `message_type` (enum: `text` | `cardmix`), `metadata` (jsonb), `is_read`, `created_at`.
- **RLS**: Select if participant; insert only as sender; update (e.g. mark read) only as recipient; delete if participant.

## Flow

1. **Send (Share)**
   - **SendMessageModal** (`sendCard.tsx`): Share to 1–5 recipients. Optional movie/TV `data` → `message_type: "cardmix"`, `metadata: { media_type, media_id, media_name, media_image }`. Content max 2000 chars. Search users debounced (300ms). Insert one row per recipient.
   - **Chat** (`messages/[id]/page.tsx`): Text-only send from conversation; `message_type: "text"`, `metadata: null`. Same 2000-char limit.

2. **Inbox** (`messages/page.tsx`)
   - Server: Fetch all messages for user, unique other users, unread counts, last message time and preview (text snippet or “Shared a movie or TV show”). Sorted by last message time.

3. **Conversation** (`messages/[id]/page.tsx`)
   - Load messages for (currentUser, recipientId) with pagination (50 per page). Mark as read when opening. Realtime: subscribe to INSERT on `messages`, filter by conversation, append and scroll or show “N new messages”. Card messages render poster + link to `/app/{movie|tv}/{id}`; image URL from TMDB path helper.

4. **Unread**
   - **RealtimeUnreadCount**: Count where `recipient_id = userId` and `is_read = false`. Realtime: INSERT (recipient) → +1; UPDATE (recipient) → refetch so marking as read decrements.

## Security

- All access enforced by RLS. No server API for sending; client inserts with `auth.uid() = sender_id`.
- Card metadata sanitized: `media_type` in `['movie','tv']`, `media_id` string, `media_name`/`media_image` string. Content length capped at 2000.

## Performance

- Search users: debounced 300ms, limit 10.
- Inbox: one query for messages, one for users, one for unread; last preview from same message set (no extra query).
- Chat: pagination 50; Realtime filter by conversation in client after INSERT.
