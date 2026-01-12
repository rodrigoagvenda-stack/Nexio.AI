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
  const hasMoved = useRef(false);

  const { scrollSpeed = 2, dragThreshold = 3 } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Ignora cards do kanban e elementos interativos
      if (
        target.closest('.kanban-card') ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.closest('[role="button"]')
      ) {
        return;
      }

      e.preventDefault();
      isDragging.current = true;
      hasMoved.current = false;
      startX.current = e.pageX;
      scrollLeft.current = element.scrollLeft;
      element.style.cursor = 'grabbing';
      element.style.userSelect = 'none';
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      hasMoved.current = false;
      element.style.cursor = 'grab';
      element.style.userSelect = '';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const x = e.pageX;
      const walk = (x - startX.current) * scrollSpeed;

      if (!hasMoved.current && Math.abs(walk) > dragThreshold) {
        hasMoved.current = true;
      }

      if (hasMoved.current) {
        e.preventDefault();
        element.scrollLeft = scrollLeft.current - walk;
      }
    };

    // Set initial cursor
    element.style.cursor = 'grab';

    // Add event listeners
    element.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);

    // Cleanup
    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
      element.style.cursor = '';
      element.style.userSelect = '';
    };
  }, [scrollSpeed, dragThreshold]);

  return ref;
}
