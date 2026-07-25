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

    // Number of points in the liquid trail
    const numPoints = 12;
    const points = Array.from({ length: numPoints }, () => ({ x: -100, y: -100 }));
    
    const mouse = { x: -100, y: -100 };
    let isHoveringInteractive = false;
    let lastMoveTime = Date.now();

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      lastMoveTime = Date.now();

      // Check hovering state for cursor style overrides
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

    const handleMouseLeave = () => {
      mouse.x = -100;
      mouse.y = -100;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseleave', handleMouseLeave);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const idleTime = Date.now() - lastMoveTime;

      // Fade out trail if idle for more than 1.5 seconds or off-screen
      if (mouse.x > 0 && mouse.y > 0 && idleTime < 1800) {
        if (points[0].x === -100) {
          for (let i = 0; i < numPoints; i++) {
            points[i].x = mouse.x;
            points[i].y = mouse.y;
          }
        }

        // Leader point tracks mouse with dynamic spring ease
        const easeLeader = isHoveringInteractive ? 0.2 : 0.35;
        points[0].x += (mouse.x - points[0].x) * easeLeader;
        points[0].y += (mouse.y - points[0].y) * easeLeader;

        // Tail points drag behind preceding points smoothly
        const easeTail = isHoveringInteractive ? 0.38 : 0.48;
        for (let i = 1; i < numPoints; i++) {
          points[i].x += (points[i - 1].x - points[i].x) * easeTail;
          points[i].y += (points[i - 1].y - points[i].y) * easeTail;
        }

        // Calculate dynamic opacity
        let opacity = 1;
        if (idleTime > 1000) {
          opacity = Math.max(0, 1 - (idleTime - 1000) / 800);
        }

        ctx.save();
        ctx.globalAlpha = opacity;

        // 1. Draw Outer Liquid Glow (Gold)
        const outerMaxRadius = isHoveringInteractive ? 6.5 : 10.0;
        for (let i = 0; i < numPoints; i++) {
          const p = points[i];
          const radius = outerMaxRadius * Math.pow(1 - i / numPoints, 0.85);
          if (radius <= 0) continue;

          ctx.fillStyle = '#FFD700'; // Bright Gold
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. Draw Inner Core (Bright White-Gold)
        const innerMaxRadius = isHoveringInteractive ? 3.5 : 5.8;
        for (let i = 0; i < numPoints; i++) {
          const p = points[i];
          const radius = innerMaxRadius * Math.pow(1 - i / numPoints, 0.85);
          if (radius <= 0) continue;

          ctx.fillStyle = '#FFFFFF'; // White-gold core
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
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
      window.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* SVG Gooey Filter Definitions */}
      <svg xmlns="http://www.w3.org/2000/svg" className="hidden absolute w-0 h-0">
        <defs>
          <filter id="cursor-gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" 
              result="goo" 
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <canvas
        ref={canvasRef}
        style={{ filter: "url(#cursor-gooey)" }}
        className="fixed inset-0 pointer-events-none z-50 mix-blend-screen"
      />
    </>
  );
};
