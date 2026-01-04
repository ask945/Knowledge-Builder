'use client';

import { useState, useEffect, useRef } from 'react';
import { topicsApi, notesApi, type Topic, type Note } from '@/lib/api';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (topics: string[], prerequisites: string[]) => void;
  onSkip: () => void;
  initialTopics?: Topic[];
  initialPrerequisites?: { _id: string; title: string }[];
  currentNoteId?: string;
}

export default function SaveModal({
  isOpen,
  onClose,
  onSave,
  onSkip,
  initialTopics = [],
  initialPrerequisites = [],
  currentNoteId,
}: SaveModalProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [selectedPrereqs, setSelectedPrereqs] = useState<{ _id: string; title: string }[]>([]);
  const [topicSearch, setTopicSearch] = useState('');
  const [prereqSearch, setPrereqSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const hasInitialized = useRef(false);

  // Only fetch and initialize when modal opens
  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      hasInitialized.current = true;
      setSelectedTopics(initialTopics);
      setSelectedPrereqs(initialPrerequisites);
      fetchData();
    }

    if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [topicsData, notesData] = await Promise.all([
        topicsApi.getAll(),
        notesApi.getAll(),
      ]);
      setTopics(topicsData);
      setNotes(notesData.filter(n => n._id !== currentNoteId));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTopic = async () => {
    if (!topicSearch.trim()) return;

    setCreatingTopic(true);
    try {
      const newTopic = await topicsApi.create(topicSearch.trim());
      setTopics([...topics, newTopic]);
      setSelectedTopics([...selectedTopics, newTopic]);
      setTopicSearch('');
    } catch (error) {
      console.error('Failed to create topic:', error);
      alert('Failed to create topic. It may already exist.');
    } finally {
      setCreatingTopic(false);
    }
  };

  const toggleTopic = (topic: Topic) => {
    if (selectedTopics.some(t => t._id === topic._id)) {
      setSelectedTopics(selectedTopics.filter(t => t._id !== topic._id));
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  const togglePrereq = (note: Note) => {
    if (selectedPrereqs.some(p => p._id === note._id)) {
      setSelectedPrereqs(selectedPrereqs.filter(p => p._id !== note._id));
    } else {
      setSelectedPrereqs([...selectedPrereqs, { _id: note._id, title: note.title }]);
    }
  };

  const handleSave = () => {
    if (selectedTopics.length === 0) {
      alert('Please select at least one parent topic');
      return;
    }
    onSave(
      selectedTopics.map(t => t._id),
      selectedPrereqs.map(p => p._id)
    );
  };

  const filteredTopics = topics.filter(t =>
    t.name.toLowerCase().includes(topicSearch.toLowerCase())
  );

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(prereqSearch.toLowerCase())
  );

  const showCreateTopic = topicSearch.trim() &&
    !topics.some(t => t.name.toLowerCase() === topicSearch.toLowerCase());

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
          <h2 className="text-xl font-bold text-gray-800">Save Note</h2>
          <p className="text-sm text-gray-500 mt-1">Select parent topic(s) and prerequisites (or skip)</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="p-4 overflow-y-auto max-h-[60vh]">
            {/* Parent Topics Section */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ↑ Parent Topic(s)
              </label>
              <input
                type="text"
                placeholder="Search or create topic..."
                value={topicSearch}
                onChange={(e) => setTopicSearch(e.target.value)}
                className="w-full px-3 py-2 border border-[#D2E9E9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4DFDF] mb-2"
              />

              {/* Create new topic option */}
              {showCreateTopic && (
                <button
                  onClick={handleCreateTopic}
                  disabled={creatingTopic}
                  className="w-full text-left px-3 py-2 bg-[#E3F4F4] text-[#38598b] rounded-lg hover:bg-[#D2E9E9] mb-2 flex items-center gap-2 transition-colors"
                >
                  <span>+</span>
                  <span>Create "{topicSearch}"</span>
                </button>
              )}

              {/* Topics list */}
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredTopics.length === 0 ? (
                  <p className="p-3 text-gray-500 text-sm">No topics found. Type to create one.</p>
                ) : (
                  filteredTopics.map(topic => (
                    <div
                      key={topic._id}
                      onClick={() => toggleTopic(topic)}
                      className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-gray-50 ${
                        selectedTopics.some(t => t._id === topic._id) ? 'bg-[#E3F4F4]' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTopics.some(t => t._id === topic._id)}
                        onChange={() => {}}
                        className="accent-[#38598b]"
                      />
                      <span>{topic.name}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Selected topics */}
              {selectedTopics.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedTopics.map(topic => (
                    <span
                      key={topic._id}
                      className="px-2 py-1 bg-[#C4DFDF] text-[#38598b] rounded-full text-sm flex items-center gap-1 font-medium"
                    >
                      {topic.name}
                      <button
                        onClick={() => toggleTopic(topic)}
                        className="hover:text-[#2a4569]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Prerequisites Section */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ← Prerequisites (optional)
              </label>
              <input
                type="text"
                placeholder="Search notes..."
                value={prereqSearch}
                onChange={(e) => setPrereqSearch(e.target.value)}
                className="w-full px-3 py-2 border border-[#D2E9E9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C4DFDF] mb-2"
              />

              {/* Notes list */}
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredNotes.length === 0 ? (
                  <p className="p-3 text-gray-500 text-sm">No notes found</p>
                ) : (
                  filteredNotes.map(note => (
                    <div
                      key={note._id}
                      onClick={() => togglePrereq(note)}
                      className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-gray-50 ${
                        selectedPrereqs.some(p => p._id === note._id) ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPrereqs.some(p => p._id === note._id)}
                        onChange={() => {}}
                        className="accent-indigo-500"
                      />
                      <span>{note.title}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Selected prerequisites */}
              {selectedPrereqs.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedPrereqs.map(prereq => (
                    <span
                      key={prereq._id}
                      className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm flex items-center gap-1"
                    >
                      {prereq.title}
                      <button
                        onClick={() => setSelectedPrereqs(selectedPrereqs.filter(p => p._id !== prereq._id))}
                        className="hover:text-indigo-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
          >
            Skip (save without topics)
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-black transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={selectedTopics.length === 0}
              className="px-4 py-2 bg-[#38598b] text-white rounded-lg hover:bg-[#2a4569] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg"
            >
              Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
