import { useEffect, useRef } from "react";

export const AnimatedBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Line configuration
    const lines: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      speed: number;
      opacity: number;
      hue: number;
    }> = [];

    // Create initial lines
    for (let i = 0; i < 30; i++) {
      lines.push({
        x1: Math.random() * canvas.width,
        y1: Math.random() * canvas.height,
        x2: Math.random() * canvas.width,
        y2: Math.random() * canvas.height,
        speed: Math.random() * 0.5 + 0.1,
        opacity: Math.random() * 0.3 + 0.1,
        hue: Math.random() * 60 + 200, // Blue/purple range
      });
    }

    let animationFrame: number;

    const animate = () => {
      // Clear canvas
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw lines
      lines.forEach((line) => {
        // Update position
        line.x1 += Math.sin(line.x1 * 0.01) * line.speed;
        line.y1 += Math.cos(line.y1 * 0.01) * line.speed;
        line.x2 += Math.sin(line.x2 * 0.01) * line.speed;
        line.y2 += Math.cos(line.y2 * 0.01) * line.speed;

        // Wrap around edges
        if (line.x1 < 0) line.x1 = canvas.width;
        if (line.x1 > canvas.width) line.x1 = 0;
        if (line.y1 < 0) line.y1 = canvas.height;
        if (line.y1 > canvas.height) line.y1 = 0;
        if (line.x2 < 0) line.x2 = canvas.width;
        if (line.x2 > canvas.width) line.x2 = 0;
        if (line.y2 < 0) line.y2 = canvas.height;
        if (line.y2 > canvas.height) line.y2 = 0;

        // Draw line with glow effect
        const gradient = ctx.createLinearGradient(line.x1, line.y1, line.x2, line.y2);
        gradient.addColorStop(0, `hsla(${line.hue}, 70%, 60%, ${line.opacity})`);
        gradient.addColorStop(0.5, `hsla(${line.hue + 20}, 80%, 70%, ${line.opacity * 1.5})`);
        gradient.addColorStop(1, `hsla(${line.hue}, 70%, 60%, ${line.opacity})`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = `hsla(${line.hue}, 70%, 60%, 0.8)`;
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();

        // Draw glow effect
        ctx.strokeStyle = `hsla(${line.hue}, 70%, 60%, ${line.opacity * 0.3})`;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
      });

      // Reset shadow
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ background: "transparent" }}
    />
  );
};

