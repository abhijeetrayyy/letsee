"use client";

import React, { useState, useEffect, useCallback, useRef, Component } from "react";
import { supabase } from "@/utils/supabase/client";
import { MdContentCopy } from "react-icons/md";
import { FaTwitter, FaWhatsapp } from "react-icons/fa6";
import { IoIosCopy } from "react-icons/io";
import Link from "next/link";

const CONTENT_MAX_LENGTH = 2000;
const SEARCH_DEBOUNCE_MS = 300;
const MAX_RECIPIENTS = 5;
const COPY_FEEDBACK_MS = 2000;

function getBaseUrl(): string {
  try {
    if (typeof window !== "undefined" && window?.location?.origin) return window.location.origin;
    return process.env.NEXT_PUBLIC_APP_URL ?? "https://letsee-dusky.vercel.app";
  } catch {
    return "https://letsee-dusky.vercel.app";
  }
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

interface User {
  id: string;
  username: string;
}

interface Media {
  id?: string | number;
  item_id?: string | number;
  name?: string;
  title?: string;
  item_name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  image_url?: string | null;
  media_type?: string;
  seasons?: unknown[];
}

const DEFAULT_NORMALIZED = {
  id: null as string | number | null,
  displayName: "",
  mediaType: "movie" as const,
  posterOrBackdrop: null as string | null,
};

/** Normalize media from TMDB-shaped or profile-shaped (item_id, item_name, image_url) so link and share text work everywhere. Never throws. */
function normalizeShareData(data: Media | null | undefined, mediaTypeProp: string | null): {
  id: string | number | null;
  displayName: string;
  mediaType: "movie" | "tv";
  posterOrBackdrop: string | null;
} {
  try {
    if (data == null || typeof data !== "object") {
      return { ...DEFAULT_NORMALIZED, mediaType: mediaTypeProp === "tv" ? "tv" : "movie" };
    }
    const id = (data as Media).id ?? (data as Media).item_id ?? null;
    const displayName =
      String((data as Media).name ?? (data as Media).title ?? (data as Media).item_name ?? "").slice(0, 500) || "";
    const mediaType =
      mediaTypeProp === "tv" || (data as Media).media_type === "tv"
        ? "tv"
        : Array.isArray((data as Media).seasons)
          ? "tv"
          : "movie";
    const raw = (data as Media).poster_path ?? (data as Media).backdrop_path ?? (data as Media).image_url ?? null;
    const posterOrBackdrop = typeof raw === "string" ? raw : null;
    return { id, displayName, mediaType, posterOrBackdrop };
  } catch {
    return { ...DEFAULT_NORMALIZED, mediaType: mediaTypeProp === "tv" ? "tv" : "movie" };
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data?: Media | null; // Movie or TV show data from props (optional)
  media_type: string | null;
}

/** Catches render errors inside the share modal so the page-level error boundary doesn't show. */
class ShareModalErrorBoundary extends Component<
  { onClose: () => void; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Share modal error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-9999" onClick={this.props.onClose}>
          <div
            className="bg-neutral-800 w-full max-w-md rounded-lg p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white mb-4">Something went wrong loading the share dialog.</p>
            <button
              type="button"
              onClick={this.props.onClose}
              className="w-full py-2 rounded-lg bg-neutral-600 text-white hover:bg-neutral-500"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Message {
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: "cardmix" | "text";
  metadata: {
    media_type?: string;
    media_id?: string;
    media_name?: string;
    media_image?: string;
  } | null;
}

const SendMessageModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  media_type,
}) => {
  const [search, setSearch] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [sender, setSender] = useState<User | null>(null);
  const [logedin, setLogedin] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [copyToggle, setCopyToggle] = useState(false);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchDebounced = useDebounce(search, SEARCH_DEBOUNCE_MS);

  const normalized = normalizeShareData(data, media_type);
  const link =
    normalized.id != null
      ? `${getBaseUrl()}/app/${normalized.mediaType}/${normalized.id}`
      : "";
  const shareText = normalized.displayName || "Check this out";

  const shareOnTwitter = (url: string, text: string) => {
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
      url
    )}&text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, "_blank");
  };

  const shareOnWhatsApp = (url: string, text: string) => {
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      text + " " + url
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  // const shareOnInstagram = (url: string, text: string) => {
  //   // Instagram does not support direct sharing via URL, so we open the web version
  //   const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  //   if (isMobile) {
  //     // Try to open Instagram Direct Messenger (mobile only)
  //     const instagramUrl = `instagram://direct`;
  //     window.location.href = instagramUrl;

  //     // Fallback: Copy the link to the clipboard
  //     navigator.clipboard
  //       .writeText(url)
  //       .then(() => {
  //         alert(
  //           "Link copied to clipboard! Open Instagram and paste it to share."
  //         );
  //       })
  //       .catch((err) => {
  //         console.error("Failed to copy link: ", err);
  //       });
  //   } else {
  //     // Open Instagram's website on desktop
  //     const instagramUrl = `https://www.instagram.com/`;
  //     navigator.clipboard
  //       .writeText(url)
  //       .then(() => {
  //         alert(
  //           "Link copied to clipboard! Open Instagram and paste it to share."
  //         );
  //       })
  //       .catch((err) => {
  //         console.error("Failed to copy link: ", err);
  //       });
  //     window.open(instagramUrl, "_blank");
  //   }
  // };

  const copyToClipboard = useCallback((text: string) => {
    if (copyFeedbackTimeoutRef.current) {
      clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = null;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopyToggle(true);
        copyFeedbackTimeoutRef.current = setTimeout(() => {
          setCopyToggle(false);
          copyFeedbackTimeoutRef.current = null;
        }, COPY_FEEDBACK_MS);
      })
      .catch((err) => {
        console.error("Failed to copy link: ", err);
      });
  }, []);

  // Fetch sender info once on mount
  useEffect(() => {
    let cancelled = false;
    const fetchSender = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (cancelled) return;
      if (userError) {
        setLogedin(false);
        return;
      }
      if (userData.user) {
        const { data, error } = await supabase
          .from("users")
          .select("id, username")
          .eq("id", userData.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setLogedin(false);
          return;
        }
        if (!data) {
          setProfileIncomplete(true);
          setLogedin(false);
          return;
        }
        setSender(data);
        setLogedin(true);
      }
    };
    fetchSender();
    return () => { cancelled = true; };
  }, []);

  // Fetch users based on debounced search (reduces API calls, better performance)
  useEffect(() => {
    if (!searchDebounced.trim() || !sender) {
      setUsers([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.resolve(
      supabase
        .from("users")
        .select("id, username")
        .ilike("username", `%${searchDebounced.trim()}%`)
        .neq("id", sender.id)
        .limit(10)
        .order("username", { ascending: true })
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError("Couldn't search users. Try again.");
          setUsers([]);
        } else {
          setUsers(data ?? []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [searchDebounced, sender]);

  // Toggle user selection
  const toggleUserSelection = useCallback(
    (user: User) => {
      if (selectedUsers.some((u) => u.id === user.id)) {
        setSelectedUsers((prev) => prev.filter((u) => u.id !== user.id));
        setWarning(null);
      } else {
        if (selectedUsers.length >= MAX_RECIPIENTS) {
          setWarning(`You can select up to ${MAX_RECIPIENTS} users.`);
          return;
        }
        setSelectedUsers((prev) => [...prev, user]);
        setWarning(null);
      }
    },
    [selectedUsers]
  );

  // Build safe metadata for card shares (validates and normalizes for DB + display)
  const buildCardMetadata = useCallback((): Message["metadata"] => {
    if (!data) return null;
    const { id, displayName, mediaType, posterOrBackdrop } = normalizeShareData(data, media_type);
    const mediaId = id != null ? String(id) : "";
    const mediaImage =
      typeof posterOrBackdrop === "string"
        ? posterOrBackdrop.startsWith("http")
          ? posterOrBackdrop.replace(/^https?:\/\/[^/]+/, "") || posterOrBackdrop
          : posterOrBackdrop
        : "";
    if (!mediaId) return null;
    return {
      media_type: mediaType,
      media_id: mediaId,
      media_name: displayName,
      media_image: mediaImage,
    };
  }, [data, media_type]);

  const sendMessage = useCallback(async () => {
    if (!message?.trim() && !data) {
      setError("Enter a message or attach a movie/TV show.");
      return;
    }
    const content = (message?.trim() ?? "").slice(0, CONTENT_MAX_LENGTH);
    if ((message?.trim() ?? "").length > CONTENT_MAX_LENGTH) {
      setError(`Message is too long. Max ${CONTENT_MAX_LENGTH} characters.`);
      return;
    }

    if (selectedUsers.length === 0) {
      setError("Select at least one recipient.");
      return;
    }

    if (!sender) {
      setError("Session issue. Try refreshing and send again.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const isCard = !!data;
      const metadata = isCard ? buildCardMetadata() : null;
      const messages: Message[] = selectedUsers.map((user) => ({
        sender_id: sender.id,
        recipient_id: user.id,
        content,
        message_type: isCard ? "cardmix" : "text",
        metadata,
      }));

      const { error: insertError } = await supabase.from("messages").insert(messages);

      if (insertError) {
        if (insertError.code === "23503") {
          setError("One or more recipients no longer exist. Try again.");
        } else {
          setError("Failed to send. Try again.");
        }
        return;
      }

      setSuccess("Sent!");
      setMessage("");
      setSelectedUsers([]);
      setCopyToggle(false);
      setSearch("");
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError("Something went wrong. Try again.");
      console.error("Send message error:", err);
    } finally {
      setLoading(false);
    }
  }, [data, message, selectedUsers, sender, buildCardMetadata, onClose]);

  // Reset feedback state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      setWarning(null);
      setCopyToggle(false);
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
        copyFeedbackTimeoutRef.current = null;
      }
    }
  }, [isOpen]);

  // Escape to close; clear copy timeout on unmount/close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
        copyFeedbackTimeoutRef.current = null;
      }
    };
  }, [isOpen, onClose]);

  const handleClose = useCallback(() => {
    if (copyFeedbackTimeoutRef.current) {
      clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = null;
    }
    setCopyToggle(false);
    setSelectedUsers([]);
    setSearch("");
    setMessage("");
    setError(null);
    setSuccess(null);
    setWarning(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const modalContent = !logedin ? (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/60 z-9999"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-neutral-800 w-full h-fit max-w-3xl sm:rounded-lg p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          {profileIncomplete ? (
            <Link
              className="bg-blue-600 hover:bg-blue-700 rounded-md px-3 py-2 text-white text-lg font-semibold"
              href={"/app/profile/setup"}
            >
              Complete Profile
            </Link>
          ) : (
            <Link
              className="bg-blue-600 hover:bg-blue-700 rounded-md px-3 py-2 text-white text-lg font-semibold"
              href={"/login"}
            >
              Log in
            </Link>
          )}
          <button type="button" onClick={onClose} className="text-white hover:text-gray-300 p-1" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-4">
          <p className="text-white">
            {profileIncomplete
              ? "Complete your profile to send messages."
              : "You need to log in to send messages."}
          </p>
        </div>
      </div>
    </div>
  ) : (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/60 z-9999"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="bg-neutral-800 w-full max-w-3xl sm:rounded-lg p-5 shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-neutral-700 shrink-0">
          <h2 id="share-modal-title" className="text-white text-lg font-semibold truncate pr-8">
            {normalized.id != null
              ? `Share: ${normalized.displayName.slice(0, 24)}${normalized.displayName.length > 24 ? "…" : ""}`
              : "Send message"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto min-h-0 flex-1">
          {link && (
          <div className="flex items-center justify-between mb-4">
            <span className="text-white truncate max-w-[200px]">{link}</span>
            <button onClick={() => copyToClipboard(link)} className="shrink-0 p-1" aria-label="Copy link">
              {copyToggle ? <IoIosCopy /> : <MdContentCopy />}
            </button>
          </div>
          )}

          {link && (
          <div className="flex space-x-4 mb-4">
            <button
              onClick={() => shareOnTwitter(link, shareText)}
              className="text-white hover:text-blue-400"
            >
              <FaTwitter size={24} />
            </button>
            <button
              onClick={() => shareOnWhatsApp(link, shareText)}
              className="text-white hover:text-green-400"
            >
              <FaWhatsapp size={24} />
            </button>
            {/* <button
              onClick={() => shareOnInstagram(link, shareText)}
              className="text-white hover:text-pink-400"
            >
              <FaInstagram size={24} />
            </button> */}
          </div>
          )}
          <label className="text-neutral-300 text-sm">Search username</label>
          <input
            type="text"
            placeholder="Search users..."
            className="mt-2 text-gray-600 bg-white w-full border rounded-lg p-2 mb-4"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className=" max-h-40 overflow-y-auto mb-4">
            {loading ? (
              <p className="text-gray-100">Loading users...</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5  gap-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`flex flex-col items-center justify-between p-2 cursor-pointer rounded-full mb-2`}
                    onClick={() => toggleUserSelection(user)}
                  >
                    <img
                      className={`rounded-full w-20 h-20  ${
                        selectedUsers.some((u) => u.id === user.id)
                          ? "border-2 border-blue-500 text-white"
                          : "border-2 border-neutral-600 hover:border-neutral-500"
                      }`}
                      src="/avatar.svg"
                      alt={user.username}
                    />
                    <span className={` `}>{user.username}</span>
                    {/* {selectedUsers.some((u) => u.id === user.id) && <FaCheck />} */}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedUsers.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Selected Users:</p>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm"
                  >
                    {user.username}
                  </div>
                ))}
              </div>
            </div>
          )}

          {warning && <p className="text-yellow-500 text-sm mb-2">{warning}</p>}

          <textarea
            className="w-full rounded-lg border border-neutral-600 bg-neutral-200 text-neutral-900 placeholder-neutral-500 p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Type your message..."
            rows={4}
            maxLength={CONTENT_MAX_LENGTH}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-right text-xs text-neutral-500 mb-2">
            {message.length}/{CONTENT_MAX_LENGTH}
          </p>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {success && <p className="text-green-500 text-sm mb-4">{success}</p>}

          <button
            className="w-full bg-blue-500 text-white p-2 rounded-lg"
            onClick={sendMessage}
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Message"}
          </button>
        </div>
      </div>
    </div>
  );

  return <ShareModalErrorBoundary onClose={handleClose}>{modalContent}</ShareModalErrorBoundary>;
};

export default SendMessageModal;
