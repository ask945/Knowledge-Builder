'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notesApi, ContentBlock, type Note } from '@/lib/api';
import SaveModal from '@/components/SaveModal';

export default function NewNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([{ type: 'text', value: '' }]);
  const [saving, setSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [initialPrerequisites, setInitialPrerequisites] = useState<{ _id: string; title: string }[]>([]);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load prerequisite note from query params
  useEffect(() => {
    const prerequisiteId = searchParams.get('prerequisite');
    const prerequisiteOfId = searchParams.get('prerequisiteOf');
    
    const loadPrerequisite = async () => {
      try {
        // For "next": current note is prerequisite to new note
        if (prerequisiteId) {
          const note = await notesApi.getById(prerequisiteId);
          setInitialPrerequisites([{ _id: note._id, title: note.title }]);
        }
        // For "previous": The new note should inherit the existing note's prerequisites
        if (prerequisiteOfId) {
          const existingNote = await notesApi.getById(prerequisiteOfId);
          // Set the existing note's prerequisites as initial prerequisites for the new note
          setInitialPrerequisites(existingNote.prerequisites || []);
        }
      } catch (error) {
        console.error('Failed to load prerequisite note:', error);
      }
    };

    if (prerequisiteId || prerequisiteOfId) {
      loadPrerequisite();
    }
  }, [searchParams]);

  // Auto-resize textarea
  const autoResize = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  // Focus on a specific textarea
  useEffect(() => {
    const textarea = textareaRefs.current[focusedIndex];
    if (textarea) {
      textarea.focus();
      autoResize(textarea);
    }
  }, [focusedIndex, blocks.length]);

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

  const handleSaveClick = async () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }
    
    // If coming from graph view, save directly without modal
    const fromGraph = searchParams.get('fromGraph') === 'true';
    if (fromGraph) {
      await handleSaveDirect();
      return;
    }
    
    setShowSaveModal(true);
  };

  const handleSaveDirect = async () => {
    const filteredBlocks = blocks.filter((block) => {
      if (block.type === 'image') return true;
      if (block.value.trim()) return true;
      return false;
    });

    setSaving(true);

    try {
      // Get topics from query params
      const topicsParam = searchParams.get('topics');
      const topics = topicsParam ? topicsParam.split(',').filter(Boolean) : [];
      
      // Get prerequisites from query params or initial prerequisites
      const prerequisiteId = searchParams.get('prerequisite');
      const prerequisiteOfId = searchParams.get('prerequisiteOf');
      
      let prerequisites: string[];
      if (prerequisiteId) {
        // For "next": use the prerequisite from query params
        prerequisites = [prerequisiteId];
      } else if (prerequisiteOfId) {
        // For "previous": use the existing note's prerequisites (inherited via initialPrerequisites)
        prerequisites = initialPrerequisites.map(p => p._id);
      } else {
        // Default: use initial prerequisites if available
        prerequisites = initialPrerequisites.map(p => p._id);
      }

      const newNote = await notesApi.create({
        title,
        blocks: filteredBlocks.length > 0 ? filteredBlocks : [{ type: 'text', value: '' }],
        topics,
        prerequisites,
      });

      // Handle "previous" case: Update the existing note to have the new note as a prerequisite
      // The new note replaces the existing note's prerequisites in the chain
      if (prerequisiteOfId) {
        try {
          const existingNote = await notesApi.getById(prerequisiteOfId);
          // Replace existing prerequisites with just the new note to maintain linear chain
          await notesApi.update(prerequisiteOfId, {
            title: existingNote.title,
            blocks: existingNote.blocks,
            topics: existingNote.topics.map(t => typeof t === 'string' ? t : t._id),
            prerequisites: [newNote._id],
          });
        } catch (error) {
          console.error('Failed to update existing note with prerequisite:', error);
          // Continue even if this fails
        }
      }

      router.push('/');
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note');
    } finally {
      setSaving(false);
    }
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
      const newNote = await notesApi.create({
        title,
        blocks: filteredBlocks.length > 0 ? filteredBlocks : [{ type: 'text', value: '' }],
        topics: [],
        prerequisites: [],
      });

      // Handle "previous" case: Update the existing note to have the new note as a prerequisite
      const prerequisiteOfId = searchParams.get('prerequisiteOf');
      if (prerequisiteOfId) {
        try {
          const existingNote = await notesApi.getById(prerequisiteOfId);
          const updatedPrerequisites = [
            ...(existingNote.prerequisites || []).map(p => p._id),
            newNote._id
          ];
          await notesApi.update(prerequisiteOfId, {
            title: existingNote.title,
            blocks: existingNote.blocks,
            topics: existingNote.topics.map(t => typeof t === 'string' ? t : t._id),
            prerequisites: updatedPrerequisites,
          });
        } catch (error) {
          console.error('Failed to update existing note with prerequisite:', error);
          // Continue even if this fails
        }
      }

      router.push('/');
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (topics: string[], prerequisites: string[]) => {
    const filteredBlocks = blocks.filter((block) => {
      if (block.type === 'image') return true;
      if (block.value.trim()) return true;
      return false;
    });

    setSaving(true);
    setShowSaveModal(false);

    try {
      const newNote = await notesApi.create({
        title,
        blocks: filteredBlocks.length > 0 ? filteredBlocks : [{ type: 'text', value: '' }],
        topics,
        prerequisites,
      });

      // Handle "previous" case: Update the existing note to have the new note as a prerequisite
      const prerequisiteOfId = searchParams.get('prerequisiteOf');
      if (prerequisiteOfId) {
        try {
          const existingNote = await notesApi.getById(prerequisiteOfId);
          const updatedPrerequisites = [
            ...(existingNote.prerequisites || []).map(p => p._id),
            newNote._id
          ];
          await notesApi.update(prerequisiteOfId, {
            title: existingNote.title,
            blocks: existingNote.blocks,
            topics: existingNote.topics.map(t => typeof t === 'string' ? t : t._id),
            prerequisites: updatedPrerequisites,
          });
        } catch (error) {
          console.error('Failed to update existing note with prerequisite:', error);
          // Continue even if this fails
        }
      }

      router.push('/');
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8F6F4]">
      {/* Sidebar */}
      <aside className="w-56 bg-[#E3F4F4] p-6 flex flex-col gap-4 border-r border-[#D2E9E9] shadow-sm">
        <button
          onClick={() => router.push('/')}
          className="text-left px-4 py-2 text-[#38598b] hover:bg-[#D2E9E9] rounded-lg transition-colors font-medium"
        >
          ← Back to Notes
        </button>
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
        initialPrerequisites={initialPrerequisites}
      />
    </div>
  );
}
