import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Network, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'note' | 'todo' | 'tag';
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

export default function Graph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { files, notes, todos } = useAppStore();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    // Build graph data
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeMap = new Map<string, GraphNode>();
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    // Add nodes
    const allTags = new Set<string>();

    files.forEach((f, i) => {
      const angle = (i / files.length) * Math.PI * 2;
      const r = 150;
      const node: GraphNode = {
        id: f.id,
        label: f.name.slice(0, 12),
        type: 'file',
        x: w / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 50,
        y: h / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
      };
      nodes.push(node);
      nodeMap.set(f.id, node);
      f.tags.forEach((t) => allTags.add(t));
    });

    notes.forEach((n, i) => {
      const angle = (i / notes.length) * Math.PI * 2 + Math.PI / 3;
      const r = 180;
      const node: GraphNode = {
        id: n.id,
        label: n.title.slice(0, 12),
        type: 'note',
        x: w / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 50,
        y: h / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
      };
      nodes.push(node);
      nodeMap.set(n.id, node);
      n.tags.forEach((t) => allTags.add(t));
    });

    todos.forEach((t, i) => {
      const angle = (i / todos.length) * Math.PI * 2 + (Math.PI * 2) / 3;
      const r = 200;
      const node: GraphNode = {
        id: t.id,
        label: t.title.slice(0, 12),
        type: 'todo',
        x: w / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 50,
        y: h / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
      };
      nodes.push(node);
      nodeMap.set(t.id, node);
      t.tags.forEach((tag) => allTags.add(tag));
    });

    // Add edges based on references and shared tags
    notes.forEach((n) => {
      n.linkedFileIds.forEach((fid) => {
        if (nodeMap.has(fid)) edges.push({ source: n.id, target: fid });
      });
      n.linkedTodoIds.forEach((tid) => {
        if (nodeMap.has(tid)) edges.push({ source: n.id, target: tid });
      });
    });

    todos.forEach((t) => {
      t.fileIds.forEach((fid) => {
        if (nodeMap.has(fid)) edges.push({ source: t.id, target: fid });
      });
      t.noteIds.forEach((nid) => {
        if (nodeMap.has(nid)) edges.push({ source: t.id, target: nid });
      });
    });

    // Add tag-based edges
    const tagNodes = new Map<string, GraphNode>();
    const tagsArray = Array.from(allTags);
    tagsArray.forEach((tag, i) => {
      const angle = (i / tagsArray.length) * Math.PI * 2;
      const r = 280;
      const node: GraphNode = {
        id: `tag-${tag}`,
        label: `#${tag}`,
        type: 'tag',
        x: w / 2 + Math.cos(angle) * r,
        y: h / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
      nodes.push(node);
      tagNodes.set(tag, node);
    });

    // Connect nodes with shared tags
    files.forEach((f) => {
      f.tags.forEach((tag) => {
        const tagNode = tagNodes.get(tag);
        if (tagNode) edges.push({ source: f.id, target: tagNode.id });
      });
    });
    notes.forEach((n) => {
      n.tags.forEach((tag) => {
        const tagNode = tagNodes.get(tag);
        if (tagNode) edges.push({ source: n.id, target: tagNode.id });
      });
    });

    // Simple force simulation
    const simulate = () => {
      // Center gravity
      nodes.forEach((n) => {
        const dx = w / 2 - n.x;
        const dy = h / 2 - n.y;
        n.vx += dx * 0.001;
        n.vy += dy * 0.001;
      });

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 500 / (dist * dist);
          nodes[i].vx -= (dx / dist) * force;
          nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force;
          nodes[j].vy += (dy / dist) * force;
        }
      }

      // Attraction along edges
      edges.forEach((e) => {
        const source = nodeMap.get(e.source) || tagNodes.get(e.source.replace('tag-', ''));
        const target = nodeMap.get(e.target) || tagNodes.get(e.target.replace('tag-', ''));
        if (!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.005;
        source.vx += (dx / dist) * force;
        source.vy += (dy / dist) * force;
        target.vx -= (dx / dist) * force;
        target.vy -= (dy / dist) * force;
      });

      // Update positions
      nodes.forEach((n) => {
        n.vx *= 0.9;
        n.vy *= 0.9;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(50, Math.min(w - 50, n.x));
        n.y = Math.max(50, Math.min(h - 50, n.y));
      });
    };

    // Color map
    const colors: Record<string, string> = {
      file: '#3b82f6',
      note: '#d4a853',
      todo: '#22c55e',
      tag: '#8b5cf6',
    };

    const glowColors: Record<string, string> = {
      file: 'rgba(59, 130, 246, 0.3)',
      note: 'rgba(212, 168, 83, 0.3)',
      todo: 'rgba(34, 197, 94, 0.3)',
      tag: 'rgba(139, 92, 246, 0.2)',
    };

    // Draw
    const draw = () => {
      simulate();

      ctx.clearRect(0, 0, w, h);

      // Draw edges
      edges.forEach((e) => {
        const source = nodeMap.get(e.source) || tagNodes.get(e.source.replace('tag-', ''));
        const target = nodeMap.get(e.target) || tagNodes.get(e.target.replace('tag-', ''));
        if (!source || !target) return;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach((n) => {
        const isHovered = hoveredNode === n.id;
        const radius = n.type === 'tag' ? 6 : 10;

        // Glow
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius + 10, 0, Math.PI * 2);
          ctx.fillStyle = glowColors[n.type];
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = colors[n.type];
        ctx.fill();

        if (isHovered) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Label
        ctx.font = n.type === 'tag' ? '10px "Noto Sans SC"' : '11px "Noto Sans SC"';
        ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(245, 240, 232, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y + radius + 14);
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    // Mouse interaction
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let found: string | null = null;
      for (const n of nodes) {
        const dx = n.x - mx;
        const dy = n.y - my;
        if (Math.sqrt(dx * dx + dy * dy) < 15) {
          found = n.id;
          break;
        }
      }
      setHoveredNode(found);
      canvas.style.cursor = found ? 'pointer' : 'default';
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [files, notes, todos, hoveredNode]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-parchment-100">知识图谱</h1>
          <p className="text-sm text-parchment-400 mt-1">可视化展示实体关联关系</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 mr-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-xs text-parchment-400">文件</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gold-400" />
              <span className="text-xs text-parchment-400">笔记</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-xs text-parchment-400">待办</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-xs text-parchment-400">标签</span>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ background: 'radial-gradient(ellipse at center, rgba(26, 46, 26, 0.3) 0%, transparent 70%)' }}
        />
        {hoveredNode && (
          <div className="absolute bottom-4 left-4 glass-card px-3 py-2 text-sm text-parchment-200 animate-fade-in">
            <Network className="w-4 h-4 inline mr-2 text-gold-400" />
            {hoveredNode}
          </div>
        )}
      </div>
    </div>
  );
}
