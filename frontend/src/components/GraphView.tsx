'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { D3TreeLayoutAdapter, type GraphData, type D3Node, type D3Link } from '@/lib/D3Adapter';
import { useRouter } from 'next/navigation';
import { notesApi, graphApi, type Note, type Topic } from '@/lib/api';
import EditTopicModal from './EditTopicModal';
import AddLinkModal from './AddLinkModal';

interface GraphViewProps {
  data: GraphData;
  onGraphChange?: () => void;
  onSummarize?: (nodeType: 'topic' | 'note', nodeId: string, nodeName: string) => void;
}

const nodeStyles: Record<string, { bg: string; border: string; text: string }> = {
  topic: { bg: '#38598b', border: '#2a4569', text: '#FFFFFF' },
  note: { bg: '#C4DFDF', border: '#A8C8C8', text: '#2D4A4A' },
  default: { bg: '#C4DFDF', border: '#A8C8C8', text: '#2D4A4A' },
};

interface HoverMenu {
  node: D3Node;
  x: number;
  y: number;
  showSubmenu?: boolean;
}

export default function GraphView({ data, onGraphChange, onSummarize }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverMenu, setHoverMenu] = useState<HoverMenu | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });
  const router = useRouter();
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuButtonHoverRef = useRef<string | null>(null);
  const [showEditTopicModal, setShowEditTopicModal] = useState(false);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [currentNoteForEdit, setCurrentNoteForEdit] = useState<Note | null>(null);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const { width, height } = dimensions;

    // Use adapter to convert to D3 format
    const adapter = new D3TreeLayoutAdapter();
    const d3Data = adapter.toD3Tree(data, {
      width,
      height,
      direction: 'left-right',
      nodeSpacing: 100,
      levelSpacing: 220,
    });

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Draw links
    const linkGenerator = d3.linkHorizontal<any, any>()
      .x(d => d.x)
      .y(d => d.y);

    g.selectAll('.link')
      .data(d3Data.links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#D2E9E9')
      .attr('stroke-width', 2.5)
      .attr('d', (d: D3Link) => linkGenerator({ source: d.source, target: d.target }));

    // Drag behavior
    const drag = d3.drag<SVGGElement, D3Node>()
      .on('start', function () {
        d3.select(this).raise();
      })
      .on('drag', function (event, d) {
        d.x = event.x;
        d.y = event.y;
        d3.select(this).attr('transform', `translate(${d.x}, ${d.y})`);

        g.selectAll<SVGPathElement, D3Link>('.link')
          .attr('d', (link: D3Link) => linkGenerator({ source: link.source, target: link.target }));
      });

    // Draw nodes
    const nodes = g.selectAll<SVGGElement, D3Node>('.node')
      .data(d3Data.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'grab')
      .call(drag);

    // Node background
    nodes.append('rect')
      .attr('width', 150)
      .attr('height', 60)
      .attr('x', -75)
      .attr('y', -30)
      .attr('rx', 10)
      .attr('fill', d => nodeStyles[d.type || 'default'].bg)
      .attr('stroke', d => nodeStyles[d.type || 'default'].border)
      .attr('stroke-width', 2.5)
      .on('mouseover', function () {
        d3.select(this).attr('stroke-width', 3.5).attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke-width', 2.5).attr('filter', null);
      });

    // Type label
    nodes.append('text')
      .attr('dy', -8)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', d => d.type === 'topic' ? '#E3F4F4' : '#6B8E8E')
      .attr('font-weight', '600')
      .attr('letter-spacing', '0.5px')
      .text(d => (d.type || 'note').toUpperCase());

    // Node name (truncated)
    nodes.append('text')
      .attr('dy', 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', d => nodeStyles[d.type || 'default'].text)
      .text(d => d.name.length > 20 ? d.name.slice(0, 20) + '...' : d.name);

    // Three dots menu button
    const menuBtn = nodes.append('g')
      .attr('class', 'menu-btn')
      .attr('transform', 'translate(50, -15)')
      .style('cursor', 'pointer');

    // Menu button hover area
    const menuBtnRect = menuBtn.append('rect')
      .attr('x', -12)
      .attr('y', -12)
      .attr('width', 24)
      .attr('height', 24)
      .attr('rx', 4)
      .attr('fill', 'transparent')
      .on('mouseover', function (event, d) {
        event.stopPropagation();
        d3.select(this).attr('fill', 'rgba(0,0,0,0.08)');
        // Show menu for note and topic nodes
        if (d.type === 'note' || d.type === 'topic') {
          menuButtonHoverRef.current = d.id;
          // Clear any existing timeout
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          // Show menu immediately on hover, positioned close to button
          const svgRect = svgRef.current!.getBoundingClientRect();
          const transform = d3.zoomTransform(svg.node()!);
          const x = (d.x * transform.k + transform.x) + svgRect.left + 60;
          const y = (d.y * transform.k + transform.y) + svgRect.top - 10;
          setHoverMenu({ node: d, x, y, showSubmenu: false });
        }
      })
      .on('mouseout', function (event, d) {
        event.stopPropagation();
        d3.select(this).attr('fill', 'transparent');
        // Only clear hover ref if this is the same node
        if (menuButtonHoverRef.current === d.id) {
          menuButtonHoverRef.current = null;
        }
      });

    // Three horizontal dots
    menuBtn.each(function(d) {
      const dotsGroup = d3.select(this);
      [-5, 0, 5].forEach(offset => {
        dotsGroup.append('circle')
          .attr('r', 2.5)
          .attr('cx', offset)
          .attr('cy', 0)
          .attr('fill', d.type === 'topic' ? '#E3F4F4' : '#6B8E8E');
      });
    });

    // Node double-click to view
    nodes.on('dblclick', function (event, d) {
      if (d.type === 'note') {
        // Get the actual note ID (handles composite IDs)
        const noteId = ('noteId' in d && d.noteId) ? d.noteId as string : d.id;
        router.push(`/notes/${noteId}`);
      }
    });

    // Right-click context menu (optional, keeping for compatibility)
    nodes.on('contextmenu', function (event, d) {
      event.preventDefault();
      // Show menu for note and topic nodes
      if (d.type === 'note' || d.type === 'topic') {
        const svgRect = svgRef.current!.getBoundingClientRect();
        const transform = d3.zoomTransform(svg.node()!);
        const x = (d.x * transform.k + transform.x) + svgRect.left;
        const y = (d.y * transform.k + transform.y) + svgRect.top - 15;
        setHoverMenu({ node: d, x, y, showSubmenu: false });
      }
    });

    // Center view
    svg.call(zoom.transform, d3.zoomIdentity.translate(50, 50).scale(0.85));

    // Cleanup timeout on unmount
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [data, dimensions, router]);

  // Get the actual note ID from the node (handles composite IDs)
  const getNoteId = (node: D3Node): string => {
    // If node has noteId property (for composite nodes), use it
    if ('noteId' in node && node.noteId) {
      return node.noteId as string;
    }
    // Otherwise use the id directly
    return node.id;
  };

  // Check if node has prerequisites (previous nodes that are notes)
  const hasPrerequisites = (node: D3Node): boolean => {
    if (node.type !== 'note') return false;
    
    // Check if there are any edges from note nodes pointing to this node
    // An edge from source -> target means target has source as prerequisite
    // But we only count edges from note nodes, not topic nodes
    return data.edges.some(edge => {
      const targetId = edge.target;
      const sourceId = edge.source;
      
      // Check if this edge points to our node
      let matchesTarget = false;
      if (targetId === node.id) {
        matchesTarget = true;
      } else if ('noteId' in node && node.noteId) {
        // Handle composite node IDs (e.g., "noteId-topicId")
        const noteId = node.noteId as string;
        if (targetId.includes(noteId)) {
          matchesTarget = true;
        }
      }
      
      if (!matchesTarget) return false;
      
      // Now check if the source node is a note (not a topic)
      const sourceNode = data.nodes.find(n => n.id === sourceId);
      
      return sourceNode?.type === 'note';
    });
  };

  // Check if node is a topic node
  const isTopicNode = (node: D3Node): boolean => {
    return node.type === 'topic';
  };

  const handleViewEditNote = () => {
    if (!hoverMenu) return;
    const node = hoverMenu.node;
    if (node.type === 'note') {
      const noteId = getNoteId(node);
      router.push(`/notes/${noteId}`);
    }
    setHoverMenu(null);
  };

  const handleAddNote = async () => {
    if (!hoverMenu) return;
    const node = hoverMenu.node;
    if (node.type !== 'note') return;

    setHoverMenu(null);
    
    try {
      const noteId = getNoteId(node);
      // Fetch the current note to get its topics
      const currentNote = await notesApi.getById(noteId);
      
      // Navigate to new note page with topics and prerequisite (current note)
      const topicsParam = currentNote.topics.map(t => typeof t === 'string' ? t : t._id).join(',');
      router.push(`/notes/new?topics=${topicsParam}&prerequisite=${noteId}&fromGraph=true`);
    } catch (error) {
      console.error('Failed to fetch note:', error);
      alert('Failed to fetch note');
    }
  };

  const handleAddNoteFromTopic = async () => {
    if (!hoverMenu) return;
    const node = hoverMenu.node;
    if (node.type !== 'topic') return;

    setHoverMenu(null);
    
    // Navigate to new note page with topic
    router.push(`/notes/new?topics=${node.id}&fromGraph=true`);
  };

  const handleAddNotePrevious = async () => {
    if (!hoverMenu) return;
    const node = hoverMenu.node;
    if (node.type !== 'note') return;

    setHoverMenu(null);
    
    try {
      const noteId = getNoteId(node);
      // Fetch the current note to get its topics
      const currentNote = await notesApi.getById(noteId);
      
      // Navigate to new note page with topics and prerequisiteOf
      const topicsParam = currentNote.topics.map(t => typeof t === 'string' ? t : t._id).join(',');
      router.push(`/notes/new?topics=${topicsParam}&prerequisiteOf=${noteId}&fromGraph=true`);
    } catch (error) {
      console.error('Failed to fetch note:', error);
      alert('Failed to fetch note');
    }
  };

  const handleAddNoteNext = async () => {
    if (!hoverMenu) return;
    const node = hoverMenu.node;
    if (node.type !== 'note') return;

    setHoverMenu(null);
    
    try {
      const noteId = getNoteId(node);
      // Fetch the current note to get its topics
      const currentNote = await notesApi.getById(noteId);
      
      // Navigate to new note page with topics and prerequisite
      const topicsParam = currentNote.topics.map(t => typeof t === 'string' ? t : t._id).join(',');
      router.push(`/notes/new?topics=${topicsParam}&prerequisite=${noteId}&fromGraph=true`);
    } catch (error) {
      console.error('Failed to fetch note:', error);
      alert('Failed to fetch note');
    }
  };

  const handleDeleteNote = async () => {
    if (!hoverMenu) return;
    const node = hoverMenu.node;
    if (node.type !== 'note') return;

    if (!confirm('Are you sure you want to delete this note?')) {
      setHoverMenu(null);
      return;
    }

    setHoverMenu(null);
    
    try {
      const noteId = getNoteId(node);
      await notesApi.delete(noteId);
      // Refresh graph data
      if (onGraphChange) {
        onGraphChange();
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note');
    }
  };

  const handleEditTopic = async () => {
    if (!hoverMenu) return;
    const node = hoverMenu.node;
    if (node.type !== 'note') return;

    try {
      const noteId = getNoteId(node);
      const note = await notesApi.getById(noteId);
      setCurrentNoteForEdit(note);
      setShowEditTopicModal(true);
      setHoverMenu(null);
    } catch (error) {
      console.error('Failed to fetch note:', error);
      alert('Failed to fetch note');
    }
  };

  const handleAddLink = async () => {
    if (!hoverMenu) return;
    const node = hoverMenu.node;
    if (node.type !== 'note') return;

    try {
      const noteId = getNoteId(node);
      const note = await notesApi.getById(noteId);
      setCurrentNoteForEdit(note);
      setShowAddLinkModal(true);
      setHoverMenu(null);
    } catch (error) {
      console.error('Failed to fetch note:', error);
      alert('Failed to fetch note');
    }
  };

  const handleSummarize = () => {
    if (!hoverMenu || !onSummarize) return;
    const node = hoverMenu.node;
    
    setHoverMenu(null);
    
    let nodeId: string;
    if (node.type === 'topic') {
      nodeId = node.id;
    } else {
      nodeId = getNoteId(node);
    }
    
    onSummarize(node.type, nodeId, node.name);
  };

  const handleSaveTopics = async (topics: string[]) => {
    if (!currentNoteForEdit) return;

    try {
      await notesApi.update(currentNoteForEdit._id, {
        title: currentNoteForEdit.title,
        blocks: currentNoteForEdit.blocks,
        topics,
        prerequisites: currentNoteForEdit.prerequisites.map(p => p._id),
      });
      setShowEditTopicModal(false);
      setCurrentNoteForEdit(null);
      // Refresh graph data
      if (onGraphChange) {
        onGraphChange();
      }
    } catch (error) {
      console.error('Failed to update note:', error);
      alert('Failed to update note');
    }
  };

  const handleSaveLinks = async (prerequisiteId: string | null, nextId: string | null) => {
    if (!currentNoteForEdit) return;

    try {
      let updatedCurrentNote = currentNoteForEdit;

      // Handle prerequisite: Add the selected note as a prerequisite to the current note
      if (prerequisiteId) {
        // Validate that current note is not being added as its own prerequisite
        if (prerequisiteId === updatedCurrentNote._id) {
          alert('A note cannot be a prerequisite of itself');
          return;
        }
        
        const existingPrereqIds = updatedCurrentNote.prerequisites.map(p => p._id);
        if (existingPrereqIds.includes(prerequisiteId)) {
          alert('This note is already a prerequisite');
          return;
        }
        const updatedPrerequisites = [...existingPrereqIds, prerequisiteId];
        await notesApi.update(updatedCurrentNote._id, {
          title: updatedCurrentNote.title,
          blocks: updatedCurrentNote.blocks,
          topics: updatedCurrentNote.topics.map(t => typeof t === 'string' ? t : t._id),
          prerequisites: updatedPrerequisites,
        });
        // Refresh current note data after update
        updatedCurrentNote = await notesApi.getById(updatedCurrentNote._id);
      }

      // Handle next: Add the current note as a prerequisite to the selected next note
      if (nextId) {
        // Validate that current note is not being added as its own next
        if (nextId === updatedCurrentNote._id) {
          alert('A note cannot be a next note of itself');
          return;
        }
        
        const nextNote = await notesApi.getById(nextId);
        const existingPrereqIds = nextNote.prerequisites.map(p => p._id);
        if (existingPrereqIds.includes(updatedCurrentNote._id)) {
          alert('This note already has the current note as a prerequisite');
          return;
        }
        
        // Get current note's prerequisites (use updated note if prerequisite was added)
        const currentNotePrereqIds = updatedCurrentNote.prerequisites.map(p => p._id);
        
        // Remove any prerequisites from next note that are also prerequisites of current note
        // This maintains a linear chain: if current note has RNN, and we're adding current note to lstm,
        // then remove RNN from lstm's prerequisites (if it exists) to avoid branching
        const updatedPrerequisites = existingPrereqIds
          .filter(prereqId => !currentNotePrereqIds.includes(prereqId))
          .concat(updatedCurrentNote._id);
        
        await notesApi.update(nextId, {
          title: nextNote.title,
          blocks: nextNote.blocks,
          topics: nextNote.topics.map(t => typeof t === 'string' ? t : t._id),
          prerequisites: updatedPrerequisites,
        });
      }

      setShowAddLinkModal(false);
      setCurrentNoteForEdit(null);
      // Refresh graph data
      if (onGraphChange) {
        onGraphChange();
      }
    } catch (error) {
      console.error('Failed to update note:', error);
      alert('Failed to update note');
    }
  };

  if (data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: '#F8F6F4' }}>
        <p className="text-gray-600 text-lg font-medium">No notes to display. Create some notes first!</p>
      </div>
    );
  }

  // Check if current hover menu node is a note (not topic)
  const isNoteNode = hoverMenu ? hoverMenu.node.type === 'note' : false;

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative"
      style={{ backgroundColor: '#F8F6F4' }}
      onClick={() => setHoverMenu(null)}
    >
      <svg ref={svgRef} className="block" />

      {/* Hover Menu */}
      {hoverMenu && (
        <div
          style={{
            position: 'fixed',
            left: hoverMenu.x,
            top: hoverMenu.y,
            zIndex: 1000,
          }}
          className="bg-white rounded-lg shadow-xl py-1 min-w-[200px] border border-gray-200"
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
            }
            menuButtonHoverRef.current = null; // Clear button hover when menu is hovered
          }}
          onMouseLeave={() => {
            // Only hide menu if button is not being hovered
            if (!menuButtonHoverRef.current) {
              hoverTimeoutRef.current = setTimeout(() => {
                setHoverMenu(null);
              }, 300);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {hoverMenu.node.type === 'note' && (
            <>
              {/* View & Edit Note - only for note nodes */}
              <div
                className="px-4 py-2.5 cursor-pointer flex items-center gap-2.5 text-gray-700 hover:bg-gray-50 transition-colors rounded-t-lg"
                onClick={handleViewEditNote}
              >
                <span className="text-base">✏️</span>
                <span className="text-sm font-medium">View & Edit Note</span>
              </div>

              <div className="border-t border-gray-200 my-1"></div>

              {/* Delete option */}
              <div
                className="px-4 py-2.5 cursor-pointer flex items-center gap-2.5 text-red-600 hover:bg-red-50 transition-colors"
                onClick={handleDeleteNote}
              >
                <span className="text-base">🗑️</span>
                <span className="text-sm font-medium">Delete</span>
              </div>

              <div className="border-t border-gray-200 my-1"></div>

              {/* Edit Topic option */}
              <div
                className="px-4 py-2.5 cursor-pointer flex items-center gap-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={handleEditTopic}
              >
                <span className="text-base">📝</span>
                <span className="text-sm font-medium">Edit Topic</span>
              </div>

              <div className="border-t border-gray-200 my-1"></div>

              {/* Add link option */}
              <div
                className="px-4 py-2.5 cursor-pointer flex items-center gap-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={handleAddLink}
              >
                <span className="text-base">🔗</span>
                <span className="text-sm font-medium">Add link</span>
              </div>

              <div className="border-t border-gray-200 my-1"></div>
            </>
          )}

          {/* Summarize with AI - available for both topic and note nodes */}
          <div
            className={`px-4 py-2.5 cursor-pointer flex items-center gap-2.5 text-gray-700 hover:bg-gray-50 transition-colors ${
              hoverMenu.node.type === 'topic' ? 'rounded-t-lg' : ''
            }`}
            onClick={handleSummarize}
          >
            <span className="text-base">🤖</span>
            <span className="text-sm font-medium">Summarize with AI</span>
          </div>

          {hoverMenu.node.type !== 'topic' && <div className="border-t border-gray-200 my-1"></div>}

          {/* Add note - conditional rendering based on node type */}
          {hoverMenu.node.type === 'topic' ? (
            // Topic node - show direct "Add note" option
            <div
              className="px-4 py-2.5 cursor-pointer flex items-center gap-2.5 text-gray-700 hover:bg-gray-50 transition-colors rounded-b-lg"
              onClick={handleAddNoteFromTopic}
            >
              <span className="text-base">➕</span>
              <span className="text-sm font-medium">Add note</span>
            </div>
          ) : isNoteNode ? (
            // Note node (not topic) - always show submenu with Previous and Next
            <div
              className="relative"
              onMouseEnter={() => setHoverMenu({ ...hoverMenu, showSubmenu: true })}
              onMouseLeave={() => setHoverMenu({ ...hoverMenu, showSubmenu: false })}
            >
              <div className="px-4 py-2.5 cursor-pointer flex items-center justify-between text-gray-700 hover:bg-gray-50 transition-colors rounded-b-lg">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">➕</span>
                  <span className="text-sm font-medium">Add note</span>
                </div>
                <span className="text-xs text-gray-400">▶</span>
              </div>
              {hoverMenu.showSubmenu && (
                <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl py-1 min-w-[150px] border border-gray-200 z-10">
                  <div
                    className="px-4 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 transition-colors rounded-t-lg"
                    onClick={handleAddNotePrevious}
                  >
                    <span className="text-sm font-medium">Previous</span>
                  </div>
                  <div className="border-t border-gray-200 my-1"></div>
                  <div
                    className="px-4 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 transition-colors rounded-b-lg"
                    onClick={handleAddNoteNext}
                  >
                    <span className="text-sm font-medium">Next</span>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Edit Topic Modal */}
      {currentNoteForEdit && (
        <EditTopicModal
          isOpen={showEditTopicModal}
          onClose={() => {
            setShowEditTopicModal(false);
            setCurrentNoteForEdit(null);
          }}
          onSave={handleSaveTopics}
          initialTopics={currentNoteForEdit.topics || []}
        />
      )}

      {/* Add Link Modal */}
      {currentNoteForEdit && (
        <AddLinkModal
          isOpen={showAddLinkModal}
          onClose={() => {
            setShowAddLinkModal(false);
            setCurrentNoteForEdit(null);
          }}
          onSave={handleSaveLinks}
          initialPrerequisites={currentNoteForEdit.prerequisites || []}
          currentNoteId={currentNoteForEdit._id}
        />
      )}

    </div>
  );
}
