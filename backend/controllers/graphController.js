const Note = require('../models/Note');
const Topic = require('../models/Topic');

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

module.exports = {
  getGraph,
  getGraphByTopic,
  getGraphTopics,
};
