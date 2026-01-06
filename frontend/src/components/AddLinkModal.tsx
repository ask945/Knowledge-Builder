'use client';

import { useState, useEffect, useRef } from 'react';
import { notesApi, type Note } from '@/lib/api';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prerequisiteId: string | null, nextId: string | null) => void;
  initialPrerequisites?: { _id: string; title: string }[];
  currentNoteId?: string;
}

export default function AddLinkModal({
  isOpen,
  onClose,
  onSave,
  initialPrerequisites = [],
  currentNoteId,
}: AddLinkModalProps) {
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [selectedPrerequisiteId, setSelectedPrerequisiteId] = useState<string | null>(null);
  const [selectedNextId, setSelectedNextId] = useState<string | null>(null);
  const [prereqSearch, setPrereqSearch] = useState('');
  const [nextSearch, setNextSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const hasInitialized = useRef(false);

  // Only fetch and initialize when modal opens
  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      hasInitialized.current = true;
      setSelectedPrerequisiteId(null);
      setSelectedNextId(null);
      setPrereqSearch('');
      setNextSearch('');
      fetchData();
    }

    if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen, currentNoteId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const notesData = await notesApi.getAll();
      setAllNotes(notesData.filter(n => n._id !== currentNoteId));
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPrerequisite = (noteId: string) => {
    // Toggle selection - if already selected, deselect
    setSelectedPrerequisiteId(prev => prev === noteId ? null : noteId);
  };

  const handleSelectNext = (noteId: string) => {
    // Toggle selection - if already selected, deselect
    setSelectedNextId(prev => prev === noteId ? null : noteId);
  };

  const handleSave = () => {
    if (!selectedPrerequisiteId && !selectedNextId) {
      alert('Please select at least one link (prerequisite or next)');
      return;
    }
    
    // Validate that current note is not selected as its own prerequisite
    if (currentNoteId && selectedPrerequisiteId === currentNoteId) {
      alert('A note cannot be a prerequisite of itself');
      return;
    }
    
    // Validate that current note is not selected as its own next
    if (currentNoteId && selectedNextId === currentNoteId) {
      alert('A note cannot be a next note of itself');
      return;
    }
    
    onSave(selectedPrerequisiteId, selectedNextId);
  };

  // Get IDs of notes that are already prerequisites of the current note
  const existingPrerequisiteIds = initialPrerequisites.map(p => p._id);

  // Get IDs of notes that already have the current note as a prerequisite
  const notesWithCurrentAsPrereqIds = allNotes
    .filter(note => note.prerequisites.some(p => p._id === currentNoteId))
    .map(n => n._id);

  // Get notes that can be prerequisites (exclude current note and existing prerequisites)
  const prerequisiteNotes = allNotes.filter(note => 
    !existingPrerequisiteIds.includes(note._id)
  );

  // Get notes that can be "next" (exclude current note and notes that already have current as prerequisite)
  const nextNotes = allNotes.filter(note => 
    !notesWithCurrentAsPrereqIds.includes(note._id)
  );

  const filteredPrerequisiteNotes = prerequisiteNotes.filter(n =>
    n.title.toLowerCase().includes(prereqSearch.toLowerCase())
  );

  const filteredNextNotes = nextNotes.filter(n =>
    n.title.toLowerCase().includes(nextSearch.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Add Link</h2>
          <p className="text-sm text-gray-500 mt-1">Select one prerequisite and/or one next note</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="p-4 overflow-y-auto max-h-[60vh]">
            {/* Prerequisites Section */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ← Prerequisites
              </label>
              <input
                type="text"
                placeholder="Search notes..."
                value={prereqSearch}
                onChange={(e) => setPrereqSearch(e.target.value)}
                className="w-full px-3 py-2 border border-[#D2E9E9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4DFDF] mb-2"
              />

              {/* Prerequisite notes list */}
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredPrerequisiteNotes.length === 0 ? (
                  <p className="p-3 text-gray-500 text-sm">No notes found</p>
                ) : (
                  filteredPrerequisiteNotes.map(note => (
                    <div
                      key={note._id}
                      onClick={() => handleSelectPrerequisite(note._id)}
                      className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-gray-50 ${
                        selectedPrerequisiteId === note._id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="prerequisite"
                        checked={selectedPrerequisiteId === note._id}
                        onChange={() => handleSelectPrerequisite(note._id)}
                        className="accent-indigo-500"
                      />
                      <span>{note.title}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Next Section */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                → Next
              </label>
              <input
                type="text"
                placeholder="Search notes..."
                value={nextSearch}
                onChange={(e) => setNextSearch(e.target.value)}
                className="w-full px-3 py-2 border border-[#D2E9E9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4DFDF] mb-2"
              />

              {/* Next notes list */}
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredNextNotes.length === 0 ? (
                  <p className="p-3 text-gray-500 text-sm">No notes found</p>
                ) : (
                  filteredNextNotes.map(note => (
                    <div
                      key={note._id}
                      onClick={() => handleSelectNext(note._id)}
                      className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-gray-50 ${
                        selectedNextId === note._id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="next"
                        checked={selectedNextId === note._id}
                        onChange={() => handleSelectNext(note._id)}
                        className="accent-indigo-500"
                      />
                      <span>{note.title}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Selected links indicator */}
            {(selectedPrerequisiteId || selectedNextId) && (
              <div className="mt-4 p-3 bg-indigo-50 rounded-lg space-y-1">
                {selectedPrerequisiteId && (
                  <p className="text-sm text-indigo-700">
                    <span className="font-semibold">Prerequisite:</span>{' '}
                    {allNotes.find(n => n._id === selectedPrerequisiteId)?.title}
                  </p>
                )}
                {selectedNextId && (
                  <p className="text-sm text-indigo-700">
                    <span className="font-semibold">Next:</span>{' '}
                    {allNotes.find(n => n._id === selectedNextId)?.title}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-black transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedPrerequisiteId && !selectedNextId}
            className="px-4 py-2 bg-[#38598b] text-white rounded-lg hover:bg-[#2a4569] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

