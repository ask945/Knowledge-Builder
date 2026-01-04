'use client';

interface SidebarProps {
  activeView: 'notes' | 'graph';
  onViewChange: (view: 'notes' | 'graph') => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-56 bg-[#E3F4F4] p-6 flex flex-col gap-2 border-r border-[#D2E9E9] shadow-sm">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[#38598b] mb-1">Knowledge</h1>
        <h2 className="text-lg font-semibold text-[#38598b]">Builder</h2>
      </div>
      <button
        onClick={() => onViewChange('notes')}
        className={`text-left px-4 py-3 rounded-lg transition-all duration-200 ${
          activeView === 'notes' 
            ? 'bg-[#C4DFDF] text-[#38598b] font-semibold shadow-sm' 
            : 'text-[#6B8E8E] hover:bg-[#D2E9E9] hover:text-[#38598b]'
        }`}
      >
        📝 All Notes
      </button>
      <button
        onClick={() => onViewChange('graph')}
        className={`text-left px-4 py-3 rounded-lg transition-all duration-200 ${
          activeView === 'graph' 
            ? 'bg-[#C4DFDF] text-[#38598b] font-semibold shadow-sm' 
            : 'text-[#6B8E8E] hover:bg-[#D2E9E9] hover:text-[#38598b]'
        }`}
      >
        🗺️ Graph View
      </button>
    </aside>
  );
}
