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

    interface Particle {
      x: number;
      y: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
      vx: number;
      vy: number;
    }

    const particles: Particle[] = [];
    const colors = ['#D4AF37', '#FFD700', '#FFF8DC', '#FFA500', '#FF8C00'];

    const mouse = { x: -100, y: -100 };
    // Smoothed coordinates for the spring-ring
    const ring = { x: -100, y: -100 };
    let isHoveringInteractive = false;
    let currentRingRadius = 8;
    let targetRingRadius = 8;

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;

      // Check if hovering over a clickable/interactive element
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

      // Spawn retro gold particles
      if (Math.random() < 0.6) {
        particles.push({
          x: mouse.x,
          y: mouse.y,
          size: Math.random() * 2.5 + 0.8,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 0.9,
          decay: Math.random() * 0.025 + 0.015,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      if (mouse.x > 0 && mouse.y > 0) {
        // 1. Lerp/Ease the ring coordinates toward the mouse position (spring effect)
        const lerpFactor = 0.15;
        ring.x += (mouse.x - ring.x) * lerpFactor;
        ring.y += (mouse.y - ring.y) * lerpFactor;

        // 2. Adjust ring size dynamically on hover
        targetRingRadius = isHoveringInteractive ? 20 : 8;
        currentRingRadius += (targetRingRadius - currentRingRadius) * 0.2;

        // 3. Draw radial aura under the pointer
        const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, isHoveringInteractive ? 70 : 45);
        grad.addColorStop(0, isHoveringInteractive ? 'rgba(212, 175, 55, 0.08)' : 'rgba(212, 175, 55, 0.04)');
        grad.addColorStop(1, 'rgba(212, 175, 55, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, isHoveringInteractive ? 70 : 45, 0, Math.PI * 2);
        ctx.fill();

        // 4. Draw Smoothed Spring Ring (gold outline circle)
        ctx.strokeStyle = isHoveringInteractive ? 'rgba(255, 215, 0, 0.6)' : 'rgba(212, 175, 55, 0.35)';
        ctx.lineWidth = isHoveringInteractive ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, currentRingRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 5. Draw solid gold center core dot
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, isHoveringInteractive ? 2 : 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. Update and render particle trail
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
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
