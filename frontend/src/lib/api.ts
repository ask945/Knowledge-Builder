const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface ContentBlock {
  type: 'text' | 'image';
  value: string;
}

export interface Topic {
  _id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Note {
  _id: string;
  title: string;
  blocks: ContentBlock[];
  topics: Topic[];
  prerequisites: { _id: string; title: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Link {
  _id: string;
  source: string;
  target: string;
  createdAt: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type?: 'topic' | 'note';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  topic?: Topic;
}

export interface NoteInput {
  title: string;
  blocks: ContentBlock[];
  topics?: string[];
  prerequisites?: string[];
}

// Notes API
export const notesApi = {
  getAll: async (): Promise<Note[]> => {
    const res = await fetch(`${API_BASE}/notes`);
    const data = await res.json();
    return data.data;
  },

  getById: async (id: string): Promise<Note> => {
    const res = await fetch(`${API_BASE}/notes/${id}`);
    const data = await res.json();
    return data.data;
  },

  create: async (note: NoteInput): Promise<Note> => {
    const res = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create note');
    }
    return data.data;
  },

  update: async (id: string, note: NoteInput): Promise<Note> => {
    const res = await fetch(`${API_BASE}/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update note');
    }
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/notes/${id}`, { method: 'DELETE' });
  },

  search: async (query: string): Promise<Note[]> => {
    const res = await fetch(`${API_BASE}/notes/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.data;
  },
};

// Topics API
export const topicsApi = {
  getAll: async (): Promise<Topic[]> => {
    const res = await fetch(`${API_BASE}/topics`);
    const data = await res.json();
    return data.data;
  },

  create: async (name: string): Promise<Topic> => {
    const res = await fetch(`${API_BASE}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    return data.data;
  },

  search: async (query: string): Promise<Topic[]> => {
    const res = await fetch(`${API_BASE}/topics/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/topics/${id}`, { method: 'DELETE' });
  },
};

// Links API
export const linksApi = {
  getAll: async (): Promise<Link[]> => {
    const res = await fetch(`${API_BASE}/links`);
    const data = await res.json();
    return data.data;
  },

  create: async (link: { source: string; target: string }): Promise<Link> => {
    const res = await fetch(`${API_BASE}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(link),
    });
    const data = await res.json();
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await fetch(`${API_BASE}/links/${id}`, { method: 'DELETE' });
  },
};

// Graph API
export const graphApi = {
  get: async (): Promise<GraphData> => {
    const res = await fetch(`${API_BASE}/graph`);
    const data = await res.json();
    return data.data;
  },

  getTopics: async (): Promise<Topic[]> => {
    const res = await fetch(`${API_BASE}/graph/topics`);
    const data = await res.json();
    return data.data;
  },

  getByTopic: async (topicId: string): Promise<GraphData> => {
    const res = await fetch(`${API_BASE}/graph/${topicId}`);
    const data = await res.json();
    return data.data;
  },

  summarize: async (nodeType: 'topic' | 'note', nodeId: string): Promise<{ summary: string }> => {
    const res = await fetch(`${API_BASE}/graph/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeType, nodeId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate summary');
    }
    return data.data;
  },
};
