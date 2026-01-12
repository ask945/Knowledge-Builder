const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Helper function to get auth token
let getAuthToken: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(tokenGetter: () => Promise<string | null>) {
  getAuthToken = tokenGetter;
}

async function getHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (getAuthToken) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

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
    const res = await fetch(`${API_BASE}/notes`, {
      headers: await getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch notes');
    }
    return data.data;
  },

  getById: async (id: string): Promise<Note> => {
    const res = await fetch(`${API_BASE}/notes/${id}`, {
      headers: await getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch note');
    }
    return data.data;
  },

  create: async (note: NoteInput): Promise<Note> => {
    const res = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: await getHeaders(),
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
      headers: await getHeaders(),
      body: JSON.stringify(note),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update note');
    }
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/notes/${id}`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete note');
    }
  },

  search: async (query: string): Promise<Note[]> => {
    const res = await fetch(`${API_BASE}/notes/search?q=${encodeURIComponent(query)}`, {
      headers: await getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to search notes');
    }
    return data.data;
  },
};

// Topics API
export const topicsApi = {
  getAll: async (): Promise<Topic[]> => {
    const res = await fetch(`${API_BASE}/topics`, {
      headers: await getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch topics');
    }
    return data.data;
  },

  create: async (name: string): Promise<Topic> => {
    const res = await fetch(`${API_BASE}/topics`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create topic');
    }
    return data.data;
  },

  search: async (query: string): Promise<Topic[]> => {
    const res = await fetch(`${API_BASE}/topics/search?q=${encodeURIComponent(query)}`, {
      headers: await getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to search topics');
    }
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/topics/${id}`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete topic');
    }
  },
};

// Links API
export const linksApi = {
  getAll: async (): Promise<Link[]> => {
    const res = await fetch(`${API_BASE}/links`, {
      headers: await getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch links');
    }
    return data.data;
  },

  create: async (link: { source: string; target: string }): Promise<Link> => {
    const res = await fetch(`${API_BASE}/links`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(link),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create link');
    }
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/links/${id}`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete link');
    }
  },
};

// Graph API
export const graphApi = {
  get: async (): Promise<GraphData> => {
    const res = await fetch(`${API_BASE}/graph`, {
      headers: await getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch graph');
    }
    return data.data;
  },

  getTopics: async (): Promise<Topic[]> => {
    const res = await fetch(`${API_BASE}/graph/topics`, {
      headers: await getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch topics');
    }
    return data.data;
  },

  getByTopic: async (topicId: string): Promise<GraphData> => {
    const res = await fetch(`${API_BASE}/graph/${topicId}`, {
      headers: await getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch graph by topic');
    }
    return data.data;
  },

  summarize: async (nodeType: 'topic' | 'note', nodeId: string): Promise<{ summary: string }> => {
    const res = await fetch(`${API_BASE}/graph/summarize`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ nodeType, nodeId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate summary');
    }
    return data.data;
  },
};
