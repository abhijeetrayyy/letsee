"use client";

import { Share2, X, Twitter, MessageCircle, LinkIcon, Check, Send } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import SendMessageModal from "@components/message/sendCard";
import { useAuth } from "@/app/contextAPI/AuthProvider";

interface ShareModalProps {
  title: string;
  mediaType: string;
  itemId: string | number;
  /** Poster path or URL, so the chat card has artwork. */
  posterPath?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({
  title,
  mediaType,
  itemId,
  posterPath,
  isOpen,
  onClose,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  // Keep the send sheet mounted after the share sheet closes, otherwise
  // picking "Send to a friend" would unmount it immediately.
  if (!isOpen) {
    return sendOpen ? (
      <SendMessageModal
        isOpen
        onClose={() => setSendOpen(false)}
        data={{ id: String(itemId), name: title, poster_path: posterPath ?? null }}
        media_type={mediaType}
      />
    ) : null;
  }
  const url = typeof window !== "undefined" ? window.location.href : "";
  const hasShare = typeof window !== "undefined" && "share" in navigator;

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success("Link copied!"); setTimeout(() => setCopied(false), 2000); }
    catch { toast.error("Failed to copy"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-surface-700 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Share2 className="size-5 text-brand-400" /> Share</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-surface-400 hover:text-white"><X className="size-4" /></button>
        </div>
        <p className="text-sm text-surface-400 mb-4 truncate">{title}</p>
        <div className="space-y-2">
          {/* Sharing to someone here is the point of the product, so it leads
              — the external options are the fallback, not the default. */}
          {isAuthenticated && (
            <button
              onClick={() => {
                setSendOpen(true);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-500 text-surface-950 hover:bg-brand-400 text-sm font-semibold transition-colors"
            >
              <Send className="size-4" /> Send to a friend
            </button>
          )}
          {hasShare && (
            <button onClick={async () => { try { await navigator.share({ title, url, text: `Check out ${title} on LetSee` }); } catch {} }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 border border-brand-500/20 text-sm font-medium transition-colors">
              <Share2 className="size-4" /> Share via...
            </button>
          )}
          <button onClick={copy} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-800/60 text-surface-300 hover:text-white border border-surface-700/50 text-sm font-medium transition-colors">
            {copied ? <Check className="size-4 text-emerald-400" /> : <LinkIcon className="size-4" />} {copied ? "Copied!" : "Copy link"}
          </button>
          <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,"_blank")} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1DA1F2]/10 text-[#1DA1F2] hover:bg-[#1DA1F2]/20 border border-[#1DA1F2]/20 text-sm font-medium transition-colors">
            <Twitter className="size-4" /> Share on X
          </button>
          <button onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(title+" "+url)}`,"_blank")} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/20 text-sm font-medium transition-colors">
            <MessageCircle className="size-4" /> Share on WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
