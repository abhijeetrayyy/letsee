--
-- PostgreSQL database dump
-- (Remove invalid \restrict line if re-dumping; this file is for reference/diff only.)
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: follow_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.follow_request_status AS ENUM (
    'pending',
    'accepted',
    'rejected'
);


--
-- Name: message_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_type AS ENUM (
    'text',
    'cardmix'
);


--
-- Name: visibility_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visibility_level AS ENUM (
    'public',
    'followers',
    'private'
);


--
-- Name: decrement_favorites_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_favorites_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set favorites_count = greatest(favorites_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: decrement_watched_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_watched_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watched_count = greatest(watched_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: decrement_watchlist_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_watchlist_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watchlist_count = greatest(watchlist_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: ensure_user_cout_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_user_cout_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;


--
-- Name: increment_favorites_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_favorites_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set favorites_count = favorites_count + 1,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: increment_watched_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_watched_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watched_count = watched_count + 1,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: increment_watchlist_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_watchlist_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watchlist_count = watchlist_count + 1,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: profile_visible_to_viewer(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profile_visible_to_viewer(owner_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.users u
    where u.id = owner_user_id
    and (
      -- Public: allow if visibility is public (case-insensitive) or null
      (u.visibility is null or lower(trim(u.visibility::text)) = 'public')
      or (
        auth.uid() is not null
        and lower(trim(u.visibility::text)) = 'followers'
        and exists (
          select 1 from public.user_connections c
          where c.followed_id = u.id and c.follower_id = auth.uid()
        )
      )
    )
  );
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: favorite_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorite_items (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_name text NOT NULL,
    item_type text NOT NULL,
    image_url text,
    item_adult boolean DEFAULT false NOT NULL,
    genres text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT favorite_items_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: favorite_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.favorite_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: favorite_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.favorite_items_id_seq OWNED BY public.favorite_items.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    content text NOT NULL,
    message_type public.message_type DEFAULT 'text'::public.message_type NOT NULL,
    metadata jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recommendation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    name text NOT NULL,
    item_type text NOT NULL,
    image text,
    adult boolean DEFAULT false NOT NULL,
    recommended_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recommendation_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: recommendation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recommendation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recommendation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recommendation_id_seq OWNED BY public.recommendation.id;


--
-- Name: user_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_connections (
    id bigint NOT NULL,
    follower_id uuid NOT NULL,
    followed_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_connections_check CHECK ((follower_id <> followed_id))
);


--
-- Name: user_connections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_connections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_connections_id_seq OWNED BY public.user_connections.id;


--
-- Name: user_cout_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_cout_stats (
    user_id uuid NOT NULL,
    watched_count integer DEFAULT 0 NOT NULL,
    favorites_count integer DEFAULT 0 NOT NULL,
    watchlist_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_favorite_display; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_favorite_display (
    user_id uuid NOT NULL,
    "position" smallint NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    image_url text,
    item_name text NOT NULL,
    CONSTRAINT user_favorite_display_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text]))),
    CONSTRAINT user_favorite_display_position_check CHECK ((("position" >= 1) AND ("position" <= 4)))
);


--
-- Name: user_follow_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_follow_requests (
    id bigint NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    status public.follow_request_status DEFAULT 'pending'::public.follow_request_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_follow_requests_check CHECK ((sender_id <> receiver_id))
);


--
-- Name: user_follow_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_follow_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_follow_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_follow_requests_id_seq OWNED BY public.user_follow_requests.id;


--
-- Name: user_list_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_list_items (
    id bigint NOT NULL,
    list_id bigint NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    item_name text NOT NULL,
    image_url text,
    item_adult boolean DEFAULT false NOT NULL,
    genres text[],
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_list_items_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: user_list_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_list_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_list_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_list_items_id_seq OWNED BY public.user_list_items.id;


--
-- Name: user_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_lists (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    visibility public.visibility_level DEFAULT 'public'::public.visibility_level NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_lists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_lists_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_lists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_lists_id_seq OWNED BY public.user_lists.id;


--
-- Name: user_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_ratings (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    score smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_ratings_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text]))),
    CONSTRAINT user_ratings_score_check CHECK (((score >= 1) AND (score <= 10)))
);


--
-- Name: user_ratings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_ratings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_ratings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_ratings_id_seq OWNED BY public.user_ratings.id;


--
-- Name: user_watchlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_watchlist (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_name text NOT NULL,
    item_type text NOT NULL,
    image_url text,
    item_adult boolean DEFAULT false NOT NULL,
    genres text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_watchlist_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: user_watchlist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_watchlist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_watchlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_watchlist_id_seq OWNED BY public.user_watchlist.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    username text,
    about text,
    visibility public.visibility_level DEFAULT 'public'::public.visibility_level NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text,
    banner_url text,
    tagline text,
    featured_list_id bigint,
    pinned_review_id bigint,
    profile_show_diary boolean DEFAULT true NOT NULL,
    profile_show_ratings boolean DEFAULT true NOT NULL,
    profile_show_public_reviews boolean DEFAULT true NOT NULL
);


--
-- Name: COLUMN users.pinned_review_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.pinned_review_id IS 'watched_items.id; app must ensure it belongs to this user';


--
-- Name: COLUMN users.profile_show_diary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.profile_show_diary IS 'When true, visitors who can see the profile see diary (review_text) on watched cards.';


--
-- Name: COLUMN users.profile_show_ratings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.profile_show_ratings IS 'When true, visitors see ratings on profile.';


--
-- Name: COLUMN users.profile_show_public_reviews; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.profile_show_public_reviews IS 'When true, visitors see public review snippets on profile.';


--
-- Name: watched_episodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watched_episodes (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    show_id text NOT NULL,
    season_number smallint NOT NULL,
    episode_number smallint NOT NULL,
    watched_at timestamp with time zone DEFAULT now() NOT NULL,
    runtime_minutes integer,
    CONSTRAINT watched_episodes_episode_number_check CHECK ((episode_number >= 1)),
    CONSTRAINT watched_episodes_season_number_check CHECK ((season_number >= 0))
);


--
-- Name: COLUMN watched_episodes.runtime_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.watched_episodes.runtime_minutes IS 'Episode runtime in minutes (from TMDB).';


--
-- Name: watched_episodes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.watched_episodes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: watched_episodes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.watched_episodes_id_seq OWNED BY public.watched_episodes.id;


--
-- Name: watched_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watched_items (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_name text NOT NULL,
    item_type text NOT NULL,
    image_url text,
    item_adult boolean DEFAULT false NOT NULL,
    genres text[],
    watched_at timestamp with time zone DEFAULT now() NOT NULL,
    review_text text,
    public_review_text text,
    is_watched boolean DEFAULT true NOT NULL,
    runtime_minutes integer,
    CONSTRAINT watched_items_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: COLUMN watched_items.is_watched; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.watched_items.is_watched IS 'When false, item is not shown in Watched list but diary/public review row is kept.';


--
-- Name: COLUMN watched_items.runtime_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.watched_items.runtime_minutes IS 'Movie runtime in minutes (from TMDB). Null for TV.';


--
-- Name: watched_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.watched_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: watched_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.watched_items_id_seq OWNED BY public.watched_items.id;


--
-- Name: favorite_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_items ALTER COLUMN id SET DEFAULT nextval('public.favorite_items_id_seq'::regclass);


--
-- Name: recommendation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation ALTER COLUMN id SET DEFAULT nextval('public.recommendation_id_seq'::regclass);


--
-- Name: user_connections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_connections ALTER COLUMN id SET DEFAULT nextval('public.user_connections_id_seq'::regclass);


--
-- Name: user_follow_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follow_requests ALTER COLUMN id SET DEFAULT nextval('public.user_follow_requests_id_seq'::regclass);


--
-- Name: user_list_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_items ALTER COLUMN id SET DEFAULT nextval('public.user_list_items_id_seq'::regclass);


--
-- Name: user_lists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_lists ALTER COLUMN id SET DEFAULT nextval('public.user_lists_id_seq'::regclass);


--
-- Name: user_ratings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ratings ALTER COLUMN id SET DEFAULT nextval('public.user_ratings_id_seq'::regclass);


--
-- Name: user_watchlist id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_watchlist ALTER COLUMN id SET DEFAULT nextval('public.user_watchlist_id_seq'::regclass);


--
-- Name: watched_episodes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_episodes ALTER COLUMN id SET DEFAULT nextval('public.watched_episodes_id_seq'::regclass);


--
-- Name: watched_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_items ALTER COLUMN id SET DEFAULT nextval('public.watched_items_id_seq'::regclass);


--
-- Name: favorite_items favorite_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_items
    ADD CONSTRAINT favorite_items_pkey PRIMARY KEY (id);


--
-- Name: favorite_items favorite_items_user_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_items
    ADD CONSTRAINT favorite_items_user_id_item_id_key UNIQUE (user_id, item_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: recommendation recommendation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation
    ADD CONSTRAINT recommendation_pkey PRIMARY KEY (id);


--
-- Name: user_connections user_connections_follower_id_followed_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_connections
    ADD CONSTRAINT user_connections_follower_id_followed_id_key UNIQUE (follower_id, followed_id);


--
-- Name: user_connections user_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_connections
    ADD CONSTRAINT user_connections_pkey PRIMARY KEY (id);


--
-- Name: user_cout_stats user_cout_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cout_stats
    ADD CONSTRAINT user_cout_stats_pkey PRIMARY KEY (user_id);


--
-- Name: user_favorite_display user_favorite_display_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorite_display
    ADD CONSTRAINT user_favorite_display_pkey PRIMARY KEY (user_id, "position");


--
-- Name: user_follow_requests user_follow_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follow_requests
    ADD CONSTRAINT user_follow_requests_pkey PRIMARY KEY (id);


--
-- Name: user_follow_requests user_follow_requests_sender_id_receiver_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follow_requests
    ADD CONSTRAINT user_follow_requests_sender_id_receiver_id_key UNIQUE (sender_id, receiver_id);


--
-- Name: user_list_items user_list_items_list_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_items
    ADD CONSTRAINT user_list_items_list_id_item_id_key UNIQUE (list_id, item_id);


--
-- Name: user_list_items user_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_items
    ADD CONSTRAINT user_list_items_pkey PRIMARY KEY (id);


--
-- Name: user_lists user_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_lists
    ADD CONSTRAINT user_lists_pkey PRIMARY KEY (id);


--
-- Name: user_ratings user_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ratings
    ADD CONSTRAINT user_ratings_pkey PRIMARY KEY (id);


--
-- Name: user_ratings user_ratings_user_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ratings
    ADD CONSTRAINT user_ratings_user_id_item_id_key UNIQUE (user_id, item_id);


--
-- Name: user_watchlist user_watchlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_watchlist
    ADD CONSTRAINT user_watchlist_pkey PRIMARY KEY (id);


--
-- Name: user_watchlist user_watchlist_user_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_watchlist
    ADD CONSTRAINT user_watchlist_user_id_item_id_key UNIQUE (user_id, item_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: watched_episodes watched_episodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_episodes
    ADD CONSTRAINT watched_episodes_pkey PRIMARY KEY (id);


--
-- Name: watched_episodes watched_episodes_user_id_show_id_season_number_episode_numb_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_episodes
    ADD CONSTRAINT watched_episodes_user_id_show_id_season_number_episode_numb_key UNIQUE (user_id, show_id, season_number, episode_number);


--
-- Name: watched_items watched_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_items
    ADD CONSTRAINT watched_items_pkey PRIMARY KEY (id);


--
-- Name: watched_items watched_items_user_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_items
    ADD CONSTRAINT watched_items_user_id_item_id_key UNIQUE (user_id, item_id);


--
-- Name: favorite_items_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX favorite_items_user_id_idx ON public.favorite_items USING btree (user_id);


--
-- Name: messages_is_read_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_is_read_idx ON public.messages USING btree (is_read);


--
-- Name: messages_recipient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_recipient_id_idx ON public.messages USING btree (recipient_id);


--
-- Name: messages_sender_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_sender_id_idx ON public.messages USING btree (sender_id);


--
-- Name: recommendation_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_user_id_idx ON public.recommendation USING btree (user_id);


--
-- Name: user_connections_followed_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_connections_followed_id_idx ON public.user_connections USING btree (followed_id);


--
-- Name: user_connections_follower_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_connections_follower_id_idx ON public.user_connections USING btree (follower_id);


--
-- Name: user_favorite_display_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_favorite_display_user_id_idx ON public.user_favorite_display USING btree (user_id);


--
-- Name: user_follow_requests_receiver_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_follow_requests_receiver_id_idx ON public.user_follow_requests USING btree (receiver_id);


--
-- Name: user_follow_requests_sender_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_follow_requests_sender_id_idx ON public.user_follow_requests USING btree (sender_id);


--
-- Name: user_list_items_list_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_list_items_list_id_idx ON public.user_list_items USING btree (list_id);


--
-- Name: user_lists_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_lists_user_id_idx ON public.user_lists USING btree (user_id);


--
-- Name: user_watchlist_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_watchlist_user_id_idx ON public.user_watchlist USING btree (user_id);


--
-- Name: watched_episodes_show_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watched_episodes_show_id_idx ON public.watched_episodes USING btree (show_id);


--
-- Name: watched_episodes_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watched_episodes_user_id_idx ON public.watched_episodes USING btree (user_id);


--
-- Name: watched_episodes_user_show_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watched_episodes_user_show_idx ON public.watched_episodes USING btree (user_id, show_id);


--
-- Name: watched_items_item_id_item_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watched_items_item_id_item_type_idx ON public.watched_items USING btree (item_id, item_type);


--
-- Name: watched_items_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watched_items_user_id_idx ON public.watched_items USING btree (user_id);


--
-- Name: users create_user_cout_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER create_user_cout_stats AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.ensure_user_cout_stats();


--
-- Name: user_cout_stats set_user_cout_stats_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_cout_stats_updated_at BEFORE UPDATE ON public.user_cout_stats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_lists set_user_lists_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_lists_updated_at BEFORE UPDATE ON public.user_lists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users set_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: favorite_items favorite_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_items
    ADD CONSTRAINT favorite_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recommendation recommendation_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation
    ADD CONSTRAINT recommendation_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_connections user_connections_followed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_connections
    ADD CONSTRAINT user_connections_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_connections user_connections_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_connections
    ADD CONSTRAINT user_connections_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_cout_stats user_cout_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cout_stats
    ADD CONSTRAINT user_cout_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_favorite_display user_favorite_display_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorite_display
    ADD CONSTRAINT user_favorite_display_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_follow_requests user_follow_requests_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follow_requests
    ADD CONSTRAINT user_follow_requests_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_follow_requests user_follow_requests_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follow_requests
    ADD CONSTRAINT user_follow_requests_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_list_items user_list_items_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_items
    ADD CONSTRAINT user_list_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.user_lists(id) ON DELETE CASCADE;


--
-- Name: user_lists user_lists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_lists
    ADD CONSTRAINT user_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_ratings user_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ratings
    ADD CONSTRAINT user_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_watchlist user_watchlist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_watchlist
    ADD CONSTRAINT user_watchlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_featured_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_featured_list_id_fkey FOREIGN KEY (featured_list_id) REFERENCES public.user_lists(id) ON DELETE SET NULL;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: watched_episodes watched_episodes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_episodes
    ADD CONSTRAINT watched_episodes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: watched_items watched_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_items
    ADD CONSTRAINT watched_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: favorite_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorite_items ENABLE ROW LEVEL SECURITY;

--
-- Name: favorite_items favorite_items_select_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY favorite_items_select_profile_visible ON public.favorite_items FOR SELECT USING (((auth.uid() = user_id) OR public.profile_visible_to_viewer(user_id)));


--
-- Name: favorite_items favorite_items_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY favorite_items_self ON public.favorite_items USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_delete_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_delete_participants ON public.messages FOR DELETE USING (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));


--
-- Name: messages messages_insert_sender; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_insert_sender ON public.messages FOR INSERT WITH CHECK ((auth.uid() = sender_id));


--
-- Name: messages messages_select_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_select_participants ON public.messages FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));


--
-- Name: messages messages_update_recipient; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_update_recipient ON public.messages FOR UPDATE USING ((auth.uid() = recipient_id));


--
-- Name: recommendation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recommendation ENABLE ROW LEVEL SECURITY;

--
-- Name: recommendation recommendation_select_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recommendation_select_profile_visible ON public.recommendation FOR SELECT USING (((auth.uid() = user_id) OR public.profile_visible_to_viewer(user_id)));


--
-- Name: recommendation recommendation_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recommendation_self ON public.recommendation USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: user_connections user_connections_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_connections_delete_self ON public.user_connections FOR DELETE USING ((auth.uid() = follower_id));


--
-- Name: user_connections user_connections_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_connections_insert_self ON public.user_connections FOR INSERT WITH CHECK ((auth.uid() = follower_id));


--
-- Name: user_connections user_connections_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_connections_select_public ON public.user_connections FOR SELECT USING (true);


--
-- Name: user_cout_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_cout_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: user_cout_stats user_cout_stats_modify_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_cout_stats_modify_self ON public.user_cout_stats USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_cout_stats user_cout_stats_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_cout_stats_select_public ON public.user_cout_stats FOR SELECT USING (true);


--
-- Name: user_favorite_display; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_favorite_display ENABLE ROW LEVEL SECURITY;

--
-- Name: user_favorite_display user_favorite_display_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_favorite_display_delete_self ON public.user_favorite_display FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_favorite_display user_favorite_display_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_favorite_display_insert_self ON public.user_favorite_display FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_favorite_display user_favorite_display_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_favorite_display_select ON public.user_favorite_display FOR SELECT USING (true);


--
-- Name: user_favorite_display user_favorite_display_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_favorite_display_update_self ON public.user_favorite_display FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_follow_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_follow_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: user_follow_requests user_follow_requests_delete_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_follow_requests_delete_participants ON public.user_follow_requests FOR DELETE USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));


--
-- Name: user_follow_requests user_follow_requests_insert_sender; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_follow_requests_insert_sender ON public.user_follow_requests FOR INSERT WITH CHECK ((auth.uid() = sender_id));


--
-- Name: user_follow_requests user_follow_requests_select_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_follow_requests_select_participants ON public.user_follow_requests FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));


--
-- Name: user_follow_requests user_follow_requests_update_receiver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_follow_requests_update_receiver ON public.user_follow_requests FOR UPDATE USING ((auth.uid() = receiver_id));


--
-- Name: user_list_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_list_items ENABLE ROW LEVEL SECURITY;

--
-- Name: user_list_items user_list_items_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_list_items_delete_owner ON public.user_list_items FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_lists l
  WHERE ((l.id = user_list_items.list_id) AND (l.user_id = auth.uid())))));


--
-- Name: user_list_items user_list_items_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_list_items_insert_owner ON public.user_list_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_lists l
  WHERE ((l.id = user_list_items.list_id) AND (l.user_id = auth.uid())))));


--
-- Name: user_list_items user_list_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_list_items_select ON public.user_list_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_lists l
  WHERE ((l.id = user_list_items.list_id) AND ((l.user_id = auth.uid()) OR (l.visibility = 'public'::public.visibility_level) OR ((l.visibility = 'followers'::public.visibility_level) AND (l.user_id IN ( SELECT user_connections.followed_id
           FROM public.user_connections
          WHERE (user_connections.follower_id = auth.uid())))))))));


--
-- Name: user_list_items user_list_items_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_list_items_update_owner ON public.user_list_items FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_lists l
  WHERE ((l.id = user_list_items.list_id) AND (l.user_id = auth.uid())))));


--
-- Name: user_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: user_lists user_lists_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_delete_self ON public.user_lists FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_lists user_lists_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_insert_self ON public.user_lists FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_lists user_lists_select_followers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_select_followers ON public.user_lists FOR SELECT USING (((visibility = 'followers'::public.visibility_level) AND (user_id IN ( SELECT user_connections.followed_id
   FROM public.user_connections
  WHERE (user_connections.follower_id = auth.uid())))));


--
-- Name: user_lists user_lists_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_select_own ON public.user_lists FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_lists user_lists_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_select_public ON public.user_lists FOR SELECT USING ((visibility = 'public'::public.visibility_level));


--
-- Name: user_lists user_lists_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_update_self ON public.user_lists FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_ratings user_ratings_select_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_ratings_select_profile_visible ON public.user_ratings FOR SELECT USING (((auth.uid() = user_id) OR public.profile_visible_to_viewer(user_id)));


--
-- Name: user_ratings user_ratings_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_ratings_self ON public.user_ratings USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_watchlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;

--
-- Name: user_watchlist user_watchlist_select_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_watchlist_select_profile_visible ON public.user_watchlist FOR SELECT USING (((auth.uid() = user_id) OR public.profile_visible_to_viewer(user_id)));


--
-- Name: user_watchlist user_watchlist_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_watchlist_self ON public.user_watchlist USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_insert_self ON public.users FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: users users_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select_public ON public.users FOR SELECT USING (true);


--
-- Name: users users_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update_self ON public.users FOR UPDATE USING ((auth.uid() = id));


--
-- Name: watched_episodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watched_episodes ENABLE ROW LEVEL SECURITY;

--
-- Name: watched_episodes watched_episodes_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watched_episodes_select_public ON public.watched_episodes FOR SELECT USING (true);


--
-- Name: watched_episodes watched_episodes_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watched_episodes_self ON public.watched_episodes USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: watched_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watched_items ENABLE ROW LEVEL SECURITY;

--
-- Name: watched_items watched_items_select_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watched_items_select_profile_visible ON public.watched_items FOR SELECT USING (((auth.uid() = user_id) OR public.profile_visible_to_viewer(user_id)));


--
-- Name: watched_items watched_items_select_public_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watched_items_select_public_reviews ON public.watched_items FOR SELECT USING ((public_review_text IS NOT NULL));


--
-- Name: watched_items watched_items_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watched_items_self ON public.watched_items USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- PostgreSQL database dump complete
--

\unrestrict ueF8OfSNF3OonvzAstUkB1nYgtbpjgTXMBlfUxBxdQvcLjox0sPV0rNFRdV4O9L

