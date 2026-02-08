'use client';

import { useEffect, useRef } from 'react';

export function OrbEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;

    const orbs = [
      {
        x: canvas.width / 2 + 300,
        y: canvas.height / 2,
        targetX: canvas.width / 2 + 300,
        targetY: canvas.height / 2,
        radius: 350,
        color: '#30184C',
        blur: 200
      },
      {
        x: canvas.width / 2 + 250,
        y: canvas.height / 2 - 100,
        targetX: canvas.width / 2 + 250,
        targetY: canvas.height / 2 - 100,
        radius: 280,
        color: '#C084FC',
        blur: 180
      },
    ];

    function animate() {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      orbs.forEach((orb) => {
        // Smooth movement towards mouse
        orb.targetX = mouseX + (orb.x - canvas.width / 2) * 0.1;
        orb.targetY = mouseY + (orb.y - canvas.height / 2) * 0.1;

        orb.x += (orb.targetX - orb.x) * 0.05;
        orb.y += (orb.targetY - orb.y) * 0.05;

        const gradient = ctx.createRadialGradient(
          orb.x, orb.y, 0,
          orb.x, orb.y, orb.radius
        );
        gradient.addColorStop(0, orb.color + '60');
        gradient.addColorStop(0.5, orb.color + '30');
        gradient.addColorStop(1, orb.color + '00');

        ctx.save();
        ctx.filter = `blur(${orb.blur}px)`;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      requestAnimationFrame(animate);
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', setCanvasSize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  );
}
