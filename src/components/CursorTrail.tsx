import React, { useEffect, useRef } from 'react';

export const CursorTrail: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    interface Point {
      x: number;
      y: number;
    }

    // Number of points in the fluid tail. 16 provides a highly liquid, sleek stretch.
    const numPoints = 16;
    const points: Point[] = Array.from({ length: numPoints }, () => ({
      x: -100,
      y: -100,
    }));

    const mouse = { x: -100, y: -100 };
    let isHoveringInteractive = false;

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;

      // Check if hovering over clickable/interactive elements
      const target = e.target as HTMLElement | null;
      if (target) {
        const isClickable =
          target.tagName === 'BUTTON' ||
          target.tagName === 'A' ||
          target.tagName === 'INPUT' ||
          target.closest('button') !== null ||
          target.closest('a') !== null ||
          target.classList.contains('cursor-pointer') ||
          window.getComputedStyle(target).cursor === 'pointer';
        
        isHoveringInteractive = isClickable;
      } else {
        isHoveringInteractive = false;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      if (mouse.x > 0 && mouse.y > 0) {
        // Initialize points if offscreen
        if (points[0].x === -100) {
          for (let i = 0; i < numPoints; i++) {
            points[i].x = mouse.x;
            points[i].y = mouse.y;
          }
        }

        // Leader point eases toward target mouse position
        points[0].x += (mouse.x - points[0].x) * 0.45;
        points[0].y += (mouse.y - points[0].y) * 0.45;

        // Tail points follow preceding points with organic delay (fluid drag)
        for (let i = 1; i < numPoints; i++) {
          const p = points[i];
          const prev = points[i - 1];
          p.x += (prev.x - p.x) * 0.35;
          p.y += (prev.y - p.y) * 0.35;
        }

        // Render the fluid body by drawing overlapping tangential capsules
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#FFD700'; // Glowing golden aura

        // Base max radius: smaller when hovering to act as a precision dot, larger when dragging
        const maxRadius = isHoveringInteractive ? 5 : 8.5;

        for (let i = 0; i < numPoints - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];

          // Compute distance and angle
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          // Taper radius down the tail using power scaling for a teardrop profile
          const r1 = maxRadius * Math.pow(1 - i / numPoints, 1.2);
          const r2 = maxRadius * Math.pow(1 - (i + 1) / numPoints, 1.2);

          // Calculate perpendicular angles for boundary tangent offsets
          const angle = Math.atan2(dy, dx);
          const perp = angle + Math.PI / 2;

          const x1_l = p1.x + r1 * Math.cos(perp);
          const y1_l = p1.y + r1 * Math.sin(perp);
          const x1_r = p1.x - r1 * Math.cos(perp);
          const y1_r = p1.y - r1 * Math.sin(perp);

          const x2_l = p2.x + r2 * Math.cos(perp);
          const y2_l = p2.y + r2 * Math.sin(perp);

          // Create a golden gradient for the fluid segment
          const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
          const alpha = 1 - (i / numPoints) * 0.7; // Fades out slightly at tail end
          
          grad.addColorStop(0, `rgba(255, 215, 0, ${alpha})`);     // Bright Gold
          grad.addColorStop(0.5, `rgba(255, 165, 0, ${alpha})`);   // Orange Gold
          grad.addColorStop(1, `rgba(212, 175, 55, ${alpha})`);    // Obsidian Gold

          ctx.fillStyle = grad;

          // Draw tangential fluid capsule wrapping segment
          ctx.beginPath();
          ctx.moveTo(x1_l, y1_l);
          ctx.lineTo(x2_l, y2_l);
          ctx.arc(p2.x, p2.y, r2, perp, perp + Math.PI);
          ctx.lineTo(x1_r, y1_r);
          ctx.arc(p1.x, p1.y, r1, perp + Math.PI, perp);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 mix-blend-screen"
    />
  );
};
