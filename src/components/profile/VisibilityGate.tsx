type VisibilityGateProps = {
  username: string;
  avatarSrc: string;
  followButton?: React.ReactNode;
  loginPrompt?: React.ReactNode;
};

export default function VisibilityGate({
  username,
  avatarSrc,
  followButton,
  loginPrompt,
}: VisibilityGateProps) {
  return (
    <section className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl border-2 border-dashed border-neutral-700 bg-neutral-800/30 text-center max-w-md mx-auto">
      <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-neutral-600 mb-6 shadow-xl">
        <img
          src={avatarSrc}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
      <h2 className="text-xl font-bold text-white tracking-tight mb-2">
        Follow @{username} to see more
      </h2>
      <p className="text-neutral-400 text-sm leading-relaxed mb-8">
        Their watchlist, favorites, watched titles, and recommendations are only visible to followers.
      </p>
      <div className="flex justify-center">
        {followButton ?? loginPrompt}
      </div>
    </section>
  );
}
