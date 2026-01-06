const Note = require('../models/Note');
const Topic = require('../models/Topic');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// @desc    Get all topics for graph selection
// @route   GET /api/graph/topics
const getGraphTopics = async (req, res, next) => {
  try {
    const topics = await Topic.find().sort({ name: 1 });
    res.json({ success: true, data: topics });
  } catch (error) {
    next(error);
  }
};

// @desc    Get graph data for a specific topic
// @route   GET /api/graph/:topicId
const getGraphByTopic = async (req, res, next) => {
  try {
    const { topicId } = req.params;

    // Get the topic
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }

    // Get all notes that belong to this topic
    const notes = await Note.find({ topics: topicId })
      .select('_id title prerequisites')
      .populate('prerequisites', '_id title topics');

    // Build initial node set from topic's notes
    const nodeMap = new Map();
    nodeMap.set(topic._id.toString(), { id: topic._id.toString(), name: topic.name, type: 'topic' });

    notes.forEach((note) => {
      nodeMap.set(note._id.toString(), {
        id: note._id.toString(),
        name: note.title,
        type: 'note',
      });
    });

    // Track all note IDs that belong to this topic
    const topicNoteIds = new Set(notes.map((n) => n._id.toString()));

    // Build edges based on prerequisite hierarchy
    const edges = [];

    // For each note, connect to its prerequisites (even if outside this topic)
    notes.forEach((note) => {
      const noteIdStr = note._id.toString();
      const hasAnyPrereq = note.prerequisites.length > 0;

      if (hasAnyPrereq) {
        // Connect from each prerequisite
        note.prerequisites.forEach((prereq) => {
          const prereqIdStr = prereq._id.toString();

          // Add prerequisite node if not already in nodeMap (from outside this topic)
          if (!nodeMap.has(prereqIdStr)) {
            nodeMap.set(prereqIdStr, {
              id: prereqIdStr,
              name: prereq.title,
              type: 'note',
            });
          }

          edges.push({
            id: `${prereq._id}-${note._id}`,
            source: prereqIdStr,
            target: noteIdStr,
          });
        });
      } else {
        // No prerequisites - connect directly to topic
        edges.push({
          id: `${topic._id}-${note._id}`,
          source: topic._id.toString(),
          target: noteIdStr,
        });
      }
    });

    // For prerequisite nodes from outside this topic that have no parent in graph, connect to topic
    nodeMap.forEach((node, nodeId) => {
      if (node.type === 'note' && !topicNoteIds.has(nodeId)) {
        // This is an external prerequisite - check if it has any incoming edges
        const hasIncomingEdge = edges.some((e) => e.target === nodeId);
        if (!hasIncomingEdge) {
          edges.push({
            id: `${topic._id}-${nodeId}`,
            source: topic._id.toString(),
            target: nodeId,
          });
        }
      }
    });

    const nodes = Array.from(nodeMap.values());
    res.json({ success: true, data: { nodes, edges, topic } });
  } catch (error) {
    next(error);
  }
};

// @desc    Get full graph (all topics and notes)
// @route   GET /api/graph
const getGraph = async (req, res, next) => {
  try {
    const topics = await Topic.find();
    const notes = await Note.find()
      .select('_id title topics prerequisites')
      .populate('prerequisites', '_id topics');

    // Build topic nodes
    const nodes = topics.map((topic) => ({
      id: topic._id.toString(),
      name: topic.name,
      type: 'topic',
    }));

    const edges = [];

    // Create a node for each note-topic combination
    // This allows the same note to appear under multiple topics
    notes.forEach((note) => {
      note.topics.forEach((topicId) => {
        const topicIdStr = topicId.toString();
        // Create unique node ID for this note in this topic
        const nodeId = `${note._id.toString()}-${topicIdStr}`;

        nodes.push({
          id: nodeId,
          noteId: note._id.toString(), // Keep original note ID for reference
          name: note.title,
          type: 'note',
        });
      });
    });

    // Build edges
    notes.forEach((note) => {
      const noteIdStr = note._id.toString();

      // Get prerequisites
      const validPrereqs = note.prerequisites.filter((prereq) => prereq._id);

      // For each topic this note belongs to
      note.topics.forEach((topicId) => {
        const topicIdStr = topicId.toString();
        const nodeId = `${noteIdStr}-${topicIdStr}`;

        // Check if any prerequisite also belongs to the same topic
        const prereqsInSameTopic = validPrereqs.filter((prereq) => {
          return prereq.topics && prereq.topics.some((t) => t.toString() === topicIdStr);
        });

        if (prereqsInSameTopic.length > 0) {
          // Connect from prerequisites (using their topic-specific node IDs)
          prereqsInSameTopic.forEach((prereq) => {
            const prereqNodeId = `${prereq._id.toString()}-${topicIdStr}`;
            edges.push({
              id: `prereq-${prereqNodeId}-${nodeId}`,
              source: prereqNodeId,
              target: nodeId,
            });
          });
        } else {
          // No prerequisites in this topic - connect directly to topic
          edges.push({
            id: `topic-${topicIdStr}-${nodeId}`,
            source: topicIdStr,
            target: nodeId,
          });
        }
      });
    });

    res.json({ success: true, data: { nodes, edges } });
  } catch (error) {
    next(error);
  }
};

// @desc    Summarize with AI
// @route   POST /api/graph/summarize
const summarizeWithAI = async (req, res, next) => {
  try {
    const { nodeType, nodeId } = req.body;

    if (!nodeType || !nodeId) {
      return res.status(400).json({ success: false, error: 'nodeType and nodeId are required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: 'Gemini API key is not configured' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use environment variable for model name, fallback to gemini-1.5-flash
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    let prompt = '';
    let contextData = null;

    if (nodeType === 'topic') {
      // For topic nodes: analyze the entire knowledge graph for this topic
      const topic = await Topic.findById(nodeId);
      if (!topic) {
        return res.status(404).json({ success: false, error: 'Topic not found' });
      }

      // Get all notes that belong to this topic (with full content)
      const notes = await Note.find({ topics: nodeId })
        .populate('topics', 'name')
        .populate('prerequisites', '_id title topics');

      // Get all unique prerequisite notes (even if outside this topic)
      const prerequisiteIds = new Set();
      notes.forEach(note => {
        note.prerequisites.forEach(prereq => {
          prerequisiteIds.add(prereq._id.toString());
        });
      });

      const prerequisiteNotes = prerequisiteIds.size > 0
        ? await Note.find({ _id: { $in: Array.from(prerequisiteIds) } })
            .populate('topics', 'name')
        : [];

      // Build context string
      let contextString = `Topic: ${topic.name}\n\n`;
      contextString += `Notes in this topic:\n`;
      notes.forEach((note, index) => {
        contextString += `\n${index + 1}. ${note.title}\n`;
        const textContent = note.blocks
          .filter(block => block.type === 'text')
          .map(block => block.value)
          .join('\n');
        if (textContent) {
          contextString += `   Content: ${textContent}\n`;
        }
        if (note.prerequisites.length > 0) {
          contextString += `   Prerequisites: ${note.prerequisites.map(p => p.title).join(', ')}\n`;
        }
      });

      if (prerequisiteNotes.length > 0) {
        contextString += `\n\nPrerequisite Notes (providing context):\n`;
        prerequisiteNotes.forEach((note, index) => {
          contextString += `\n${index + 1}. ${note.title}\n`;
          const textContent = note.blocks
            .filter(block => block.type === 'text')
            .map(block => block.value)
            .join('\n');
          if (textContent) {
            contextString += `   Content: ${textContent}\n`;
          }
        });
      }

      prompt = `You are analyzing a knowledge graph about "${topic.name}". Below is the complete information from all connected topics, notes, and their relationships.

${contextString}

Please generate a high-level, coherent summary that explains the complete concept represented by this knowledge graph. The summary should:
- Be structured, concise, and suitable as an overview or study guide
- Explain the relationships between concepts
- Focus on the main ideas and their connections
- Be concept-focused and avoid redundancy
- Respect the hierarchy and dependency flow of the graph

Summary:`;

      contextData = { topic, notes, prerequisiteNotes };
    } else if (nodeType === 'note') {
      // For note nodes: focus on the specific note with its prerequisites
      const note = await Note.findById(nodeId)
        .populate('topics', 'name')
        .populate('prerequisites', '_id title topics');
      
      if (!note) {
        return res.status(404).json({ success: false, error: 'Note not found' });
      }

      // Get prerequisite notes with full content
      const prerequisiteNotes = note.prerequisites.length > 0
        ? await Note.find({ _id: { $in: note.prerequisites.map(p => p._id) } })
            .populate('topics', 'name')
        : [];

      // Build context string
      let contextString = `Note: ${note.title}\n`;
      const textContent = note.blocks
        .filter(block => block.type === 'text')
        .map(block => block.value)
        .join('\n');
      if (textContent) {
        contextString += `Content:\n${textContent}\n\n`;
      }
      
      if (note.topics.length > 0) {
        contextString += `Topics: ${note.topics.map(t => t.name).join(', ')}\n\n`;
      }

      if (prerequisiteNotes.length > 0) {
        contextString += `Prerequisite Notes (providing context):\n`;
        prerequisiteNotes.forEach((prereqNote, index) => {
          contextString += `\n${index + 1}. ${prereqNote.title}\n`;
          const prereqTextContent = prereqNote.blocks
            .filter(block => block.type === 'text')
            .map(block => block.value)
            .join('\n');
          if (prereqTextContent) {
            contextString += `   Content: ${prereqTextContent}\n`;
          }
        });
      }

      prompt = `You are analyzing a note titled "${note.title}" from a knowledge graph. Below is the note's content and its prerequisite knowledge.

${contextString}

Please generate a summary focused on this specific note. The summary should:
- Explain the note clearly
- Show how it fits into the prerequisite knowledge
- Include context from parent topics, linked notes, or dependencies
- Avoid unrelated branches of the graph
- Be concise, accurate, and concept-focused
- Respect graph hierarchy and dependency flow

Summary:`;

      contextData = { note, prerequisiteNotes };
    } else {
      return res.status(400).json({ success: false, error: 'Invalid nodeType. Must be "topic" or "note"' });
    }

    // Generate summary using Gemini API
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    res.json({ success: true, data: { summary, context: contextData } });
  } catch (error) {
    console.error('Summarization error:', error);
    // Provide more detailed error information
    const errorMessage = error.message || 'Unknown error occurred';
    const errorDetails = {
      message: errorMessage,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      suggestion: 'Check if the model name is correct and your API key has access to it.'
    };
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to generate summary',
      details: errorDetails
    });
  }
};

// @desc    List available Gemini models for the API key
// @route   GET /api/graph/models
const listAvailableModels = async (req, res, next) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: 'Gemini API key is not configured' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Common Gemini model names to test
    const modelsToTest = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-2.0-flash-exp',
    ];

    // Test models in parallel for faster results
    const modelTests = modelsToTest.map(async (modelName) => {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        // Try a simple test call with minimal prompt to save quota
        const result = await model.generateContent('Hi');
        await result.response;
        return {
          name: modelName,
          status: 'available'
        };
      } catch (error) {
        return {
          name: modelName,
          status: 'unavailable',
          error: error.message || 'Unknown error'
        };
      }
    });

    const results = await Promise.all(modelTests);
    const availableModels = results.filter(r => r.status === 'available');
    const unavailableModels = results.filter(r => r.status === 'unavailable');

    res.json({ 
      success: true, 
      data: {
        available: availableModels,
        unavailable: unavailableModels,
        currentModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        note: 'This endpoint tests common model names. Some models may require specific API access.'
      }
    });
  } catch (error) {
    console.error('Error listing models:', error);
    next(error);
  }
};

module.exports = {
  getGraph,
  getGraphByTopic,
  getGraphTopics,
  summarizeWithAI,
  listAvailableModels,
};
