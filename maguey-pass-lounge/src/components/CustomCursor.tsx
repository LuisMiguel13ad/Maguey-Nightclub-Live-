import { useEffect, useState } from 'react';

export function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if device supports hover (i.e., has a mouse)
    const hasHover = window.matchMedia('(hover: hover)').matches;
    if (!hasHover) return;

    setIsVisible(true);

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseEnter = () => {
      setIsHovering(true);
    };

    const handleMouseLeave = () => {
      setIsHovering(false);
    };

    document.addEventListener('mousemove', handleMouseMove);

    // Add hover listeners to interactive elements
    const interactiveElements = document.querySelectorAll('a, button, [role="button"], .cursor-pointer, .group');
    interactiveElements.forEach((el) => {
      el.addEventListener('mouseenter', handleMouseEnter);
      el.addEventListener('mouseleave', handleMouseLeave);
    });

    // Re-attach listeners when DOM changes
    const observer = new MutationObserver(() => {
      const newElements = document.querySelectorAll('a, button, [role="button"], .cursor-pointer, .group');
      newElements.forEach((el) => {
        el.addEventListener('mouseenter', handleMouseEnter);
        el.addEventListener('mouseleave', handleMouseLeave);
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      interactiveElements.forEach((el) => {
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mouseleave', handleMouseLeave);
      });
      observer.disconnect();
    };
  }, []);

  if (!isVisible) return null;

  return (
    <>
      {/* Glow */}
      <div
        id="cursor-glow"
        style={{
          left: position.x,
          top: position.y,
          width: isHovering ? 400 : 300,
          height: isHovering ? 400 : 300,
          background: isHovering
            ? 'radial-gradient(circle, rgba(212, 163, 115, 0.15) 0%, rgba(212, 163, 115, 0) 70%)'
            : 'radial-gradient(circle, rgba(94, 234, 212, 0.1) 0%, rgba(94, 234, 212, 0) 70%)',
        }}
      />
      {/* Dot */}
      <div
        id="cursor-dot"
        style={{
          left: position.x,
          top: position.y,
          transform: `translate(-50%, -50%) scale(${isHovering ? 1.5 : 1})`,
        }}
      />
    </>
  );
}

