import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

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

    const particles: Particle[] = [];
    const maxParticles = 45;

    const mouse = { x: -100, y: -100 };
    let isHoveringInteractive = false;

    // Helper to spawn a single spark particle
    const spawnParticle = (x: number, y: number, isClickBurst = false) => {
      if (particles.length >= maxParticles && !isClickBurst) {
        // Recycle oldest particle if limit reached
        particles.shift();
      }

      // Random velocities
      let vx = (Math.random() - 0.5) * 0.8;
      let vy = (Math.random() - 0.5) * 0.8 - 0.3; // Slight upward bias by default
      let maxLife = 25 + Math.random() * 15;
      let size = 1.5 + Math.random() * 2.0;

      if (isClickBurst) {
        // Expand outwards in all directions with speed
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 2.2;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
        maxLife = 20 + Math.random() * 10;
        size = 2.0 + Math.random() * 1.8;
      } else if (isHoveringInteractive) {
        // Faster, tighter sparks when hovering over buttons
        vx = (Math.random() - 0.5) * 1.5;
        vy = (Math.random() - 0.5) * 1.5;
        size = 1.0 + Math.random() * 1.5;
      }

      // Golden hues: gold, gold-orange, bright gold-white
      const colors = ['#FFD700', '#FFA500', '#FFFDD0', '#D4AF37'];
      const color = colors[Math.floor(Math.random() * colors.length)];

      particles.push({
        x,
        y,
        vx,
        vy,
        alpha: 1,
        size,
        life: maxLife,
        maxLife,
        color
      });
    };

    // Trigger explosive burst on click
    const handleMouseDown = (e: MouseEvent) => {
      const numSparks = 10 + Math.floor(Math.random() * 6);
      for (let i = 0; i < numSparks; i++) {
        spawnParticle(e.clientX, e.clientY, true);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;

      // Spawn a trail particle
      spawnParticle(e.clientX, e.clientY);

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
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseleave', handleMouseLeave);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. UPDATE AND DRAW PARTICLES
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Apply slight gravity to drift down organically
        p.vy += 0.03;

        // Decelerate velocities (friction)
        p.vx *= 0.98;
        p.vy *= 0.98;

        p.life--;
        p.alpha = Math.max(0, p.life / p.maxLife);

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.shadowBlur = 6 + p.size * 2;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. RENDER THE INTERACTIVE PRECISION DOT
      if (mouse.x > 0 && mouse.y > 0) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#FFD700';

        // Precise micro golden pointer dot
        const dotRadius = isHoveringInteractive ? 1.5 : 2.5;
        ctx.fillStyle = '#FFFFFF'; // Bright core
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        // Secondary ring halo when hovering
        if (isHoveringInteractive) {
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 6, 0, Math.PI * 2);
          ctx.stroke();
          
          // Spawn extra ambient micro sparks when idle/moving on a button
          if (Math.random() < 0.3) {
            spawnParticle(mouse.x, mouse.y);
          }
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseleave', handleMouseLeave);
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
