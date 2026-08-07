import Link from "next/link";

function Topic({ topic }) {
  // Format ISO date string into a readable format (e.g., "Aug 7, 2026")
  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateString));
  };

  return (
    <Link
      href={`/vocabulary/${topic._id}`}
      className="block p-6 border border-slate-800 bg-slate-900/80 hover:bg-slate-900 rounded-2xl border-slate-800/80 hover:border-blue-500/40 transition-all group shadow-sm hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-slate-100 text-xl group-hover:text-blue-400 transition-colors">
          {topic.name}
        </h3>
        {topic.createdAt && (
          <span className="text-xs text-slate-500 shrink-0 mt-1">
            {formatDate(topic.createdAt)}
          </span>
        )}
      </div>

      <p className="text-slate-400 text-sm line-clamp-2 min-h-[2.5rem]">
        {topic.description || "There is no description"}
      </p>

      <div className="text-slate-300 flex items-center justify-between mt-6 pt-4 border-t border-slate-800/80">
        <span className="text-sm text-slate-400 font-medium">
          {topic.words?.length || 0} words
        </span>
        <span className="bg-blue-600 hover:bg-blue-500 text-white text-sm py-1.5 px-4 rounded-lg font-medium transition-colors">
          Learn
        </span>
      </div>
    </Link>
  );
}

export default Topic;