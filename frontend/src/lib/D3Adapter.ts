import * as d3 from 'd3';

export interface GraphNode {
  id: string;
  name: string;
  type?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface D3Node extends GraphNode {
  x: number;
  y: number;
  children?: D3Node[];
}

export interface D3Link {
  source: D3Node;
  target: D3Node;
}

export interface LayoutOptions {
  width: number;
  height: number;
  direction: 'left-right' | 'top-bottom';
  rootId?: string;
  nodeSpacing?: number;
  levelSpacing?: number;
}

export interface D3TreeData {
  nodes: D3Node[];
  links: D3Link[];
}

export class D3TreeLayoutAdapter {
  toD3Tree(data: GraphData, options: LayoutOptions): D3TreeData {
    const {
      height,
      nodeSpacing = 100,
      levelSpacing = 220,
    } = options;

    if (data.nodes.length === 0) {
      return { nodes: [], links: [] };
    }

    // Build adjacency maps
    const childrenMap = new Map<string, string[]>();
    const parentsMap = new Map<string, string[]>();

    data.edges.forEach(edge => {
      if (!childrenMap.has(edge.source)) {
        childrenMap.set(edge.source, []);
      }
      childrenMap.get(edge.source)!.push(edge.target);

      if (!parentsMap.has(edge.target)) {
        parentsMap.set(edge.target, []);
      }
      parentsMap.get(edge.target)!.push(edge.source);
    });

    // Find root nodes (nodes with no parents) - these are topics
    const rootNodes = data.nodes.filter(n =>
      !parentsMap.has(n.id) || parentsMap.get(n.id)!.length === 0
    );

    const nodeMap = new Map(data.nodes.map(n => [n.id, { ...n }]));
    const nodes: D3Node[] = [];
    const positionedNodes = new Set<string>(); // Track which nodes have been positioned

    // Process each root (topic) and its tree separately
    let currentY = 100;

    rootNodes.forEach((rootNode) => {
      // BFS to get all nodes in this tree and their levels
      const treeNodes = new Map<string, number>(); // nodeId -> level
      const queue: { id: string; level: number }[] = [{ id: rootNode.id, level: 0 }];
      const visitedInThisTree = new Set<string>();

      while (queue.length > 0) {
        const { id, level } = queue.shift()!;

        if (visitedInThisTree.has(id)) continue;
        visitedInThisTree.add(id);
        treeNodes.set(id, level);

        const children = childrenMap.get(id) || [];
        children.forEach(childId => {
          if (!visitedInThisTree.has(childId)) {
            queue.push({ id: childId, level: level + 1 });
          }
        });
      }

      // Group nodes by level within this tree
      const levelGroups = new Map<number, string[]>();
      treeNodes.forEach((level, nodeId) => {
        if (!levelGroups.has(level)) {
          levelGroups.set(level, []);
        }
        levelGroups.get(level)!.push(nodeId);
      });

      // Calculate max nodes in any level for this tree (for height calculation)
      let maxNodesInLevel = 0;
      levelGroups.forEach(nodeIds => {
        maxNodesInLevel = Math.max(maxNodesInLevel, nodeIds.length);
      });

      const treeHeight = Math.max(maxNodesInLevel * nodeSpacing, nodeSpacing);
      const treeStartY = currentY;

      // Position nodes in this tree (only if not already positioned)
      let nodesAddedInThisTree = 0;
      levelGroups.forEach((nodeIds, level) => {
        const count = nodeIds.length;
        const totalHeight = (count - 1) * nodeSpacing;
        const startY = treeStartY + (treeHeight - totalHeight) / 2;

        nodeIds.forEach((nodeId, index) => {
          // Skip if already positioned in another tree
          if (positionedNodes.has(nodeId)) return;

          positionedNodes.add(nodeId);
          nodesAddedInThisTree++;

          const originalNode = nodeMap.get(nodeId)!;
          const x = 100 + level * levelSpacing;
          const y = startY + index * nodeSpacing;

          nodes.push({
            ...originalNode,
            x,
            y,
          });
        });
      });

      // Move Y position for next tree (only if we added nodes)
      if (nodesAddedInThisTree > 0) {
        currentY += treeHeight + 80; // 80px gap between trees
      }
    });

    // Create links with actual node references
    const nodeLookup = new Map(nodes.map(n => [n.id, n]));
    const links: D3Link[] = data.edges
      .map(e => ({
        source: nodeLookup.get(e.source)!,
        target: nodeLookup.get(e.target)!,
      }))
      .filter(l => l.source && l.target);

    return { nodes, links };
  }
}
