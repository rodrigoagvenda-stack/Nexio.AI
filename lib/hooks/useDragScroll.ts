import { useRef, useEffect, RefObject } from 'react';

interface UseDragScrollOptions {
  scrollSpeed?: number;
  dragThreshold?: number;
}

export function useDragScroll<T extends HTMLElement>(
  options: UseDragScrollOptions = {}
): RefObject<T> {
  const ref = useRef<T>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const { scrollSpeed = 1.5, dragThreshold = 10 } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let hasMoved = false;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Ignora cards do kanban e elementos interativos
      if (
        target.closest('[data-kanban-card]') ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      isDragging.current = true;
      hasMoved = false;
      startX.current = e.pageX;
      scrollLeft.current = element.scrollLeft;
      element.style.userSelect = 'none';
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        hasMoved = false;
        element.style.cursor = 'grab';
        element.style.userSelect = '';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const x = e.pageX;
      const walk = (x - startX.current) * scrollSpeed;

      if (!hasMoved && Math.abs(walk) > dragThreshold) {
        hasMoved = true;
        element.style.cursor = 'grabbing';
      }

      if (hasMoved) {
        e.preventDefault();
        element.scrollLeft = scrollLeft.current - walk;
      }
    };

    const handleMouseLeave = () => {
      if (isDragging.current) {
        isDragging.current = false;
        hasMoved = false;
        element.style.cursor = 'grab';
        element.style.userSelect = '';
      }
    };

    // Set initial cursor
    element.style.cursor = 'grab';

    // Add event listeners
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);

    // Cleanup
    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
      element.style.cursor = '';
      element.style.userSelect = '';
    };
  }, [scrollSpeed, dragThreshold]);

  return ref;
}
