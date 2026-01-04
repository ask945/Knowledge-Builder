'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import NoteCard from '@/components/NoteCard';
import GraphView from '@/components/GraphView';
import SaveModal from '@/components/SaveModal';
import { notesApi, graphApi, type Note, type GraphData, type Topic } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<'notes' | 'graph'>('notes');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; note: Note } | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Fetch notes and topics
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [notesData, topicsData] = await Promise.all([
          notesApi.getAll(),
          graphApi.getTopics(),
        ]);
        setNotes(notesData);
        setTopics(topicsData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch graph data
  const fetchGraph = useCallback(async () => {
    try {
      let graph: GraphData;
      if (selectedTopic) {
        graph = await graphApi.getByTopic(selectedTopic);
      } else {
        graph = await graphApi.get();
      }
      setGraphData(graph);
    } catch (error) {
      console.error('Failed to fetch graph:', error);
    }
  }, [selectedTopic]);

  // Fetch graph data when topic changes or view changes to graph
  useEffect(() => {
    if (activeView !== 'graph') return;
    fetchGraph();
  }, [activeView, fetchGraph]);

  // Filter notes based on search
  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get first 5 words of content from blocks
  const getPreview = (note: Note) => {
    const textBlocks = note.blocks?.filter(b => b.type === 'text') || [];
    if (textBlocks.length === 0) return '';
    const text = textBlocks.map(b => b.value).join(' ');
    return text.split(' ').slice(0, 5).join(' ') + (text.split(' ').length > 5 ? '...' : '');
  };

  // Get topic names for a note
  const getTopicNames = (note: Note) => {
    if (!note.topics || note.topics.length === 0) return undefined;
    return note.topics.map(t => t.name).join(', ');
  };

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent, note: Note) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, note });
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Handle edit topics/prerequisites from context menu
  const handleEditTopics = () => {
    if (contextMenu) {
      setSelectedNote(contextMenu.note);
      setShowSaveModal(true);
      setContextMenu(null);
    }
  };

  // Save topics/prerequisites from modal
  const handleSaveFromModal = async (newTopics: string[], newPrerequisites: string[]) => {
    if (!selectedNote) return;

    try {
      await notesApi.update(selectedNote._id, {
        title: selectedNote.title,
        blocks: selectedNote.blocks,
        topics: newTopics,
        prerequisites: newPrerequisites,
      });
      // Refresh notes
      const notesData = await notesApi.getAll();
      setNotes(notesData);
    } catch (error) {
      console.error('Failed to update note:', error);
      alert('Failed to update note');
    } finally {
      setShowSaveModal(false);
      setSelectedNote(null);
    }
  };

  // Skip saving topics/prerequisites
  const handleSkipFromModal = () => {
    setShowSaveModal(false);
    setSelectedNote(null);
  };

  // Handle delete from context menu
  const handleDeleteFromMenu = async () => {
    if (!contextMenu) return;

    if (!confirm('Are you sure you want to delete this note?')) {
      setContextMenu(null);
      return;
    }

    try {
      await notesApi.delete(contextMenu.note._id);
      setNotes(notes.filter(n => n._id !== contextMenu.note._id));
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note');
    }
    setContextMenu(null);
  };

  return (
    <div className="flex min-h-screen bg-[#F8F6F4]">
      {/* Sidebar */}
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      {/* Main Content */}
      <main className="flex-1 p-8 flex flex-col">
        {activeView === 'notes' ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="🔍 Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 border border-[#D2E9E9] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#C4DFDF] focus:border-[#C4DFDF] text-gray-700 placeholder-gray-400 shadow-sm"
                />
              </div>
              <button
                onClick={() => router.push('/notes/new')}
                className="px-6 py-3 bg-[#38598b] text-white rounded-xl hover:bg-[#2a4569] transition-all duration-200 font-medium shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <span className="text-lg">+</span>
                <span>New Note</span>
              </button>
            </div>

            {/* Subheader */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#38598b]">
                {searchQuery ? `Search Results (${filteredNotes.length})` : 'All Notes'}
              </h2>
              <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-[#D2E9E9] shadow-sm">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 rounded-md transition-all duration-200 ${
                    viewMode === 'grid' 
                      ? 'bg-[#C4DFDF] text-[#38598b] font-medium' 
                      : 'text-gray-500 hover:text-[#38598b]'
                  }`}
                >
                  <span className="mr-1">☐</span> Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-md transition-all duration-200 ${
                    viewMode === 'list' 
                      ? 'bg-[#C4DFDF] text-[#38598b] font-medium' 
                      : 'text-gray-500 hover:text-[#38598b]'
                  }`}
                >
                  <span className="mr-1">☰</span> List
                </button>
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#38598b] mb-4"></div>
                  <p className="text-gray-500">Loading notes...</p>
                </div>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <p className="text-4xl mb-4">📝</p>
                  <p className="text-gray-600 text-lg font-medium mb-2">
                    {searchQuery ? 'No notes found' : 'No notes yet'}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {searchQuery ? 'Try a different search term' : 'Create your first note to get started!'}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => router.push('/notes/new')}
                      className="mt-4 px-6 py-2 bg-[#C4DFDF] text-[#38598b] rounded-lg hover:bg-[#D2E9E9] transition-colors font-medium"
                    >
                      Create Note
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Notes Grid/List */
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5' : 'flex flex-col gap-3'}>
                {filteredNotes.map((note) => (
                  <div
                    key={note._id}
                    onClick={() => router.push(`/notes/${note._id}`)}
                    onContextMenu={(e) => handleContextMenu(e, note)}
                    className="cursor-pointer"
                  >
                    <NoteCard
                      title={note.title}
                      content={getPreview(note)}
                      linkCount={note.prerequisites?.length || 0}
                      linkedTopic={getTopicNames(note)}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Graph View */
          <div className="flex-1 flex flex-col -m-8">
            {/* Topic Selector */}
            <div className="p-6 bg-white border-b border-[#D2E9E9] flex items-center gap-4 shadow-sm">
              <span className="text-sm font-medium text-[#38598b]">Filter by Topic:</span>
              <select
                value={selectedTopic || ''}
                onChange={(e) => setSelectedTopic(e.target.value || null)}
                className="px-4 py-2.5 border border-[#D2E9E9] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#C4DFDF] focus:border-[#C4DFDF] text-gray-700 shadow-sm"
              >
                <option value="">All Topics</option>
                {topics.map(topic => (
                  <option key={topic._id} value={topic._id}>
                    {topic.name}
                  </option>
                ))}
              </select>
              {selectedTopic && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#E3F4F4] rounded-lg">
                  <span className="text-sm text-[#38598b] font-medium">
                    Showing: {topics.find(t => t._id === selectedTopic)?.name}
                  </span>
                  <button
                    onClick={() => setSelectedTopic(null)}
                    className="text-[#38598b] hover:text-[#2a4569] text-sm"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1">
              <GraphView data={graphData} onGraphChange={fetchGraph} />
            </div>
          </div>
        )}
      </main>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white rounded-xl shadow-2xl border border-[#D2E9E9] py-2 z-50 min-w-[200px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleEditTopics}
            className="w-full px-4 py-2.5 text-left hover:bg-[#E3F4F4] text-sm text-gray-700 transition-colors rounded-t-lg"
          >
            ✏️ Edit Topics & Prerequisites
          </button>
          <button
            onClick={() => {
              router.push(`/notes/${contextMenu.note._id}`);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2.5 text-left hover:bg-[#E3F4F4] text-sm text-gray-700 transition-colors"
          >
            📝 Edit Note
          </button>
          <div className="border-t border-[#E3F4F4] my-1"></div>
          <button
            onClick={handleDeleteFromMenu}
            className="w-full px-4 py-2.5 text-left hover:bg-red-50 text-sm text-red-600 transition-colors rounded-b-lg"
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {/* Save Modal for editing topics/prerequisites */}
      <SaveModal
        isOpen={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setSelectedNote(null);
        }}
        onSave={handleSaveFromModal}
        onSkip={handleSkipFromModal}
        initialTopics={selectedNote?.topics || []}
        initialPrerequisites={selectedNote?.prerequisites || []}
        currentNoteId={selectedNote?._id}
      />
    </div>
  );
}
