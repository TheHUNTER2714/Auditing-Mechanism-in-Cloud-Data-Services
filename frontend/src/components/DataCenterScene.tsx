import React, { useEffect, useRef } from 'react';

interface DataCenterSceneProps {
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  hashText?: string;
  hashLife?: number;
}

export const DataCenterScene: React.FC<DataCenterSceneProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle setup
    const isMobile = width < 768;
    const particleCount = isMobile ? 35 : 75;
    const particles: Particle[] = [];
    const hashSnippets = ['a3f9...', '7c2b...', 'e810...', '99d4...', 'b10c...', '4e6a...', 'd52f...'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 0.8,
        alpha: Math.random() * 0.5 + 0.2,
        hashText: Math.random() > 0.8 ? hashSnippets[Math.floor(Math.random() * hashSnippets.length)] : undefined,
        hashLife: Math.random() * 100,
      });
    }

    let isTabVisible = true;
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const render = () => {
      if (!isTabVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Draw faint connections between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 90) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(34, 211, 238, ${0.12 * (1 - dist / 90)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Draw and update particles
      const centerX = width / 2;
      const centerY = height / 2;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Slight drift towards center vanishing point
        const toCenterX = (centerX - p.x) * 0.0001;
        const toCenterY = (centerY - p.y) * 0.0001;
        p.vx += toCenterX;
        p.vy += toCenterY;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Draw particle dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 211, 238, ${p.alpha})`;
        ctx.fill();

        // Draw occasional hash strings fading in and out
        if (p.hashText) {
          p.hashLife = (p.hashLife || 0) + 0.5;
          const textAlpha = Math.sin(p.hashLife * 0.05) * 0.35;
          if (textAlpha > 0.05) {
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.fillStyle = `rgba(59, 130, 246, ${textAlpha})`;
            ctx.fillText(p.hashText, p.x + 4, p.y - 4);
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className={`relative w-full h-full overflow-hidden pointer-events-none select-none ${className}`}>
      {/* 1. Deep Navy Canvas Background */}
      <div className="absolute inset-0 bg-[#050816]" />

      {/* 2. SVG Perspective Corridor of Server Racks (Vanishing Point at Center) */}
      <svg
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full opacity-65"
      >
        <defs>
          <linearGradient id="rackGradLeft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0B132B" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#050816" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="rackGradRight" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#0B132B" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#050816" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="corridorCeiling" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#07111F" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#050816" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="corridorFloor" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#07111F" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#050816" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Floor and Ceiling Perspective Lines */}
        <polygon points="0,0 1000,0 550,300 450,300" fill="url(#corridorCeiling)" />
        <polygon points="0,600 1000,600 550,300 450,300" fill="url(#corridorFloor)" />

        {/* Floor Guide Lines */}
        <line x1="150" y1="600" x2="470" y2="300" stroke="#1E293B" strokeWidth="1" strokeDasharray="4 6" opacity="0.4" />
        <line x1="350" y1="600" x2="490" y2="300" stroke="#22D3EE" strokeWidth="1" strokeDasharray="3 5" opacity="0.3" />
        <line x1="650" y1="600" x2="510" y2="300" stroke="#22D3EE" strokeWidth="1" strokeDasharray="3 5" opacity="0.3" />
        <line x1="850" y1="600" x2="530" y2="300" stroke="#1E293B" strokeWidth="1" strokeDasharray="4 6" opacity="0.4" />

        {/* Left Server Rack 1 (Foreground) */}
        <polygon points="0,50 160,140 160,460 0,550" fill="url(#rackGradLeft)" stroke="#1E3A8A" strokeWidth="1.2" opacity="0.8" />
        {/* Left Server Shelves & LEDs */}
        {[180, 220, 260, 300, 340, 380, 420].map((y, idx) => (
          <g key={`rackL1-${idx}`}>
            <line x1="20" y1={y + 15} x2="150" y2={y} stroke="#1E293B" strokeWidth="1.2" />
            {/* Blinking Cyan LEDs */}
            <circle cx="45" cy={y + 10} r="2.2" fill="#22D3EE" className="led-blink-cyan" style={{ animationDelay: `${(idx * 0.35) % 2}s` }} />
            <circle cx="60" cy={y + 8} r="2" fill="#3B82F6" className="led-blink-blue" style={{ animationDelay: `${(idx * 0.5) % 2.5}s` }} />
            <circle cx="75" cy={y + 6} r="1.8" fill="#22C55E" opacity="0.8" />
          </g>
        ))}

        {/* Left Server Rack 2 (Midground) */}
        <polygon points="180,150 290,210 290,390 180,450" fill="url(#rackGradLeft)" stroke="#1E3A8A" strokeWidth="1" opacity="0.65" />
        {[230, 260, 290, 320, 350].map((y, idx) => (
          <g key={`rackL2-${idx}`}>
            <line x1="195" y1={y + 8} x2="280" y2={y} stroke="#1E293B" strokeWidth="1" />
            <circle cx="215" cy={y + 5} r="1.5" fill="#22D3EE" className="led-blink-cyan" style={{ animationDelay: `${(idx * 0.4) % 2}s` }} />
            <circle cx="230" cy={y + 4} r="1.5" fill="#3B82F6" className="led-blink-blue" style={{ animationDelay: `${(idx * 0.6) % 2.5}s` }} />
          </g>
        ))}

        {/* Right Server Rack 1 (Foreground) */}
        <polygon points="1000,50 840,140 840,460 1000,550" fill="url(#rackGradRight)" stroke="#1E3A8A" strokeWidth="1.2" opacity="0.8" />
        {[180, 220, 260, 300, 340, 380, 420].map((y, idx) => (
          <g key={`rackR1-${idx}`}>
            <line x1="980" y1={y + 15} x2="850" y2={y} stroke="#1E293B" strokeWidth="1.2" />
            <circle cx="955" cy={y + 10} r="2.2" fill="#3B82F6" className="led-blink-blue" style={{ animationDelay: `${(idx * 0.45) % 2.5}s` }} />
            <circle cx="940" cy={y + 8} r="2" fill="#22D3EE" className="led-blink-cyan" style={{ animationDelay: `${(idx * 0.3) % 2}s` }} />
            <circle cx="925" cy={y + 6} r="1.8" fill="#22C55E" opacity="0.8" />
          </g>
        ))}

        {/* Right Server Rack 2 (Midground) */}
        <polygon points="820,150 710,210 710,390 820,450" fill="url(#rackGradRight)" stroke="#1E3A8A" strokeWidth="1" opacity="0.65" />
        {[230, 260, 290, 320, 350].map((y, idx) => (
          <g key={`rackR2-${idx}`}>
            <line x1="805" y1={y + 8} x2="720" y2={y} stroke="#1E293B" strokeWidth="1" />
            <circle cx="785" cy={y + 5} r="1.5" fill="#3B82F6" className="led-blink-blue" style={{ animationDelay: `${(idx * 0.5) % 2.5}s` }} />
            <circle cx="770" cy={y + 4} r="1.5" fill="#22D3EE" className="led-blink-cyan" style={{ animationDelay: `${(idx * 0.35) % 2}s` }} />
          </g>
        ))}

        {/* Center Vanishing Cloud Node */}
        <circle cx="500" cy="300" r="14" fill="#07111F" stroke="#22D3EE" strokeWidth="1.5" filter="drop-shadow(0 0 8px #22D3EE)" />
        <circle cx="500" cy="300" r="6" fill="#22D3EE" opacity="0.8" />
      </svg>

      {/* 3. HTML5 Canvas Dynamic Particle Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 opacity-75" />

      {/* 4. Slow Moving Grid Overlay */}
      <div className="absolute inset-0 grid-perspective opacity-25 z-20 pointer-events-none" />

      {/* 5. Gradient Lighting Overlay (Dark Navy -> Transparent -> Near-Black) */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050816]/70 via-transparent to-[#050816] z-30 pointer-events-none" />
    </div>
  );
};
