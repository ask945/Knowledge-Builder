interface NoteCardProps {
  title: string;
  content: string;
  linkCount?: number;
  linkedTopic?: string;
}

export default function NoteCard({ title, content, linkCount = 0, linkedTopic }: NoteCardProps) {
  return (
    <div className="border border-[#D2E9E9] rounded-xl p-5 bg-white hover:shadow-lg hover:border-[#C4DFDF] transition-all duration-200 cursor-pointer group">
      <h3 className="font-semibold text-[#38598b] text-lg mb-2 group-hover:text-[#2a4569] transition-colors">
        {title}
      </h3>
      <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
        {content || 'No content'}
      </p>
      {(linkedTopic || linkCount > 0) && (
        <div className="mt-3 pt-3 border-t border-[#E3F4F4] flex items-center gap-2 flex-wrap">
          {linkedTopic && (
            <span className="px-2.5 py-1 bg-[#E3F4F4] text-[#38598b] rounded-full text-xs font-medium">
              {linkedTopic}
            </span>
          )}
          {linkCount > 0 && (
            <span className="text-xs text-[#6B8E8E] flex items-center gap-1">
              <span>🔗</span>
              <span>{linkCount} {linkCount === 1 ? 'link' : 'links'}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
