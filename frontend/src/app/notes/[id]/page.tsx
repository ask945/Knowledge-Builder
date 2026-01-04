'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { notesApi, ContentBlock, Topic } from '@/lib/api';
import SaveModal from '@/components/SaveModal';

export default function NoteViewPage() {
  const router = useRouter();
  const params = useParams();
  const noteId = params.id as string;

  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([{ type: 'text', value: '' }]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [prerequisites, setPrerequisites] = useState<{ _id: string; title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch note data
  useEffect(() => {
    const fetchNote = async () => {
      try {
        const note = await notesApi.getById(noteId);
        setTitle(note.title);
        setBlocks(note.blocks.length > 0 ? note.blocks : [{ type: 'text', value: '' }]);
        setTopics(note.topics || []);
        setPrerequisites(note.prerequisites || []);
      } catch (error) {
        console.error('Failed to fetch note:', error);
        alert('Note not found');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [noteId, router]);

  // Auto-resize textarea
  const autoResize = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  // Auto-resize all textareas on load
  useEffect(() => {
    textareaRefs.current.forEach(textarea => {
      if (textarea) autoResize(textarea);
    });
  }, [blocks, loading]);

  const updateBlock = (index: number, value: string) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], value };
    setBlocks(newBlocks);
  };

  const handleTextareaChange = (index: number, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateBlock(index, e.target.value);
    autoResize(e.target);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, { type: 'text', value: '' });
      setBlocks(newBlocks);
      setFocusedIndex(index + 1);
    }

    if (e.key === 'Backspace' && blocks[index].value === '' && blocks.length > 1) {
      e.preventDefault();
      const newBlocks = blocks.filter((_, i) => i !== index);
      setBlocks(newBlocks);
      setFocusedIndex(Math.max(0, index - 1));
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              const newBlocks = [...blocks];
              newBlocks.splice(index + 1, 0, { type: 'image', value: event.target.result as string });
              newBlocks.splice(index + 2, 0, { type: 'text', value: '' });
              setBlocks(newBlocks);
              setFocusedIndex(index + 2);
            }
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  };

  const insertImageAfter = (index: number) => {
    setFocusedIndex(index);
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newBlocks = [...blocks];
          newBlocks.splice(focusedIndex + 1, 0, { type: 'image', value: event.target.result as string });
          newBlocks.splice(focusedIndex + 2, 0, { type: 'text', value: '' });
          setBlocks(newBlocks);
          setFocusedIndex(focusedIndex + 2);
        }
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeBlock = (index: number) => {
    if (blocks.length > 1) {
      const newBlocks = blocks.filter((_, i) => i !== index);
      setBlocks(newBlocks);
      setFocusedIndex(Math.max(0, index - 1));
    }
  };

  const handleSaveClick = () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }
    setShowSaveModal(true);
  };

  const handleSkip = async () => {
    const filteredBlocks = blocks.filter((block) => {
      if (block.type === 'image') return true;
      if (block.value.trim()) return true;
      return false;
    });

    setSaving(true);
    setShowSaveModal(false);

    try {
      await notesApi.update(noteId, {
        title,
        blocks: filteredBlocks.length > 0 ? filteredBlocks : [{ type: 'text', value: '' }],
        topics: [],
        prerequisites: [],
      });
      router.push('/');
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (newTopics: string[], newPrerequisites: string[]) => {
    const filteredBlocks = blocks.filter((block) => {
      if (block.type === 'image') return true;
      if (block.value.trim()) return true;
      return false;
    });

    setSaving(true);
    setShowSaveModal(false);

    try {
      await notesApi.update(noteId, {
        title,
        blocks: filteredBlocks.length > 0 ? filteredBlocks : [{ type: 'text', value: '' }],
        topics: newTopics,
        prerequisites: newPrerequisites,
      });
      router.push('/');
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await notesApi.delete(noteId);
      router.push('/');
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#F8F6F4] items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#38598b] mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8F6F4]">
      {/* Sidebar */}
      <aside className="w-56 bg-[#E3F4F4] p-6 flex flex-col gap-4 border-r border-[#D2E9E9] shadow-sm">
        <button
          onClick={() => router.push('/')}
          className="text-left px-4 py-2 text-[#38598b] hover:bg-[#D2E9E9] rounded-lg transition-colors font-medium mb-4"
        >
          ← Back to Notes
        </button>

        {/* Show current topics */}
        {topics.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-[#38598b] mb-3 uppercase tracking-wide">Topics</p>
            <div className="flex flex-wrap gap-2">
              {topics.map(topic => (
                <span key={topic._id} className="px-3 py-1.5 bg-[#38598b] text-white rounded-full text-xs font-medium shadow-sm">
                  {topic.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Show current prerequisites */}
        {prerequisites.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-[#38598b] mb-3 uppercase tracking-wide">Prerequisites</p>
            <div className="flex flex-col gap-2">
              {prerequisites.map(prereq => (
                <div key={prereq._id} className="px-3 py-2 bg-white rounded-lg border border-[#D2E9E9] shadow-sm">
                  <span className="text-xs text-gray-700 flex items-center gap-1">
                    <span>←</span>
                    <span className="font-medium">{prereq.title}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Editor */}
      <main className="flex-1 p-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#D2E9E9]">
          <input
            type="text"
            placeholder="Note Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl font-bold border-none outline-none bg-transparent placeholder-gray-400 flex-1 text-[#38598b]"
          />
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              Delete
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-600 hover:text-[#38598b] hover:bg-[#E3F4F4] rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className="px-6 py-2 bg-[#38598b] text-white rounded-lg hover:bg-[#2a4569] transition-colors disabled:opacity-50 font-medium shadow-md hover:shadow-lg"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />

        {/* Content Blocks */}
        <div className="space-y-2">
          {blocks.map((block, index) => (
            <div key={index} className="group relative">
              {block.type === 'text' ? (
                <div className="flex items-start gap-2">
                  <textarea
                    ref={(el) => { textareaRefs.current[index] = el; }}
                    value={block.value}
                    onChange={(e) => handleTextareaChange(index, e)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={(e) => handlePaste(index, e)}
                    onFocus={() => setFocusedIndex(index)}
                    placeholder={index === 0 ? "Start writing..." : ""}
                    className="w-full p-2 border-none outline-none bg-transparent resize-none overflow-hidden min-h-[32px] placeholder-gray-400"
                    rows={1}
                  />
                  <button
                    onClick={() => insertImageAfter(index)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-[#38598b] hover:bg-[#E3F4F4] rounded transition-all"
                    title="Add image"
                  >
                    📷
                  </button>
                </div>
              ) : (
                <div className="relative inline-block">
                  <img
                    src={block.value}
                    alt={`Image ${index}`}
                    className="max-w-full h-auto rounded-lg border border-gray-200"
                  />
                  <button
                    onClick={() => removeBlock(index)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Save Modal */}
      <SaveModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSave}
        onSkip={handleSkip}
        initialTopics={topics}
        initialPrerequisites={prerequisites}
        currentNoteId={noteId}
      />
    </div>
  );
}
