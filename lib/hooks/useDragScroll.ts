import { useRef, useEffect, RefObject } from 'react';

interface UseDragScrollOptions {
  /**
   * Scroll speed multiplier (default: 2)
   */
  scrollSpeed?: number;
  /**
   * Minimum drag distance to start scrolling (default: 5px)
   */
  dragThreshold?: number;
}

/**
 * Custom hook to enable drag-to-scroll functionality on a container
 * Similar to Trello, Notion, Figma, etc.
 */
export function useDragScroll<T extends HTMLElement>(
  options: UseDragScrollOptions = {}
): RefObject<T> {
  const ref = useRef<T>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const hasMoved = useRef(false);

  const { scrollSpeed = 2, dragThreshold = 5 } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Ignora se clicar em elementos interativos
      if (
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select')
      ) {
        return;
      }

      isDragging.current = true;
      hasMoved.current = false;
      startX.current = e.pageX - element.offsetLeft;
      scrollLeft.current = element.scrollLeft;
    };

    const handleMouseLeave = () => {
      isDragging.current = false;
      hasMoved.current = false;
      element.style.cursor = 'grab';
      element.style.userSelect = '';
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      hasMoved.current = false;
      element.style.cursor = 'grab';
      element.style.userSelect = '';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const x = e.pageX - element.offsetLeft;
      const walk = (x - startX.current) * scrollSpeed;

      // Só começa a arrastar depois de mover um pouco
      if (!hasMoved.current && Math.abs(walk) > dragThreshold) {
        hasMoved.current = true;
        element.style.cursor = 'grabbing';
        element.style.userSelect = 'none';
      }

      if (hasMoved.current) {
        e.preventDefault();
        element.scrollLeft = scrollLeft.current - walk;
      }
    };

    // Set initial cursor
    element.style.cursor = 'grab';

    // Add event listeners
    element.addEventListener('mousedown', handleMouseDown, { passive: true });
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('mousemove', handleMouseMove);

    // Cleanup
    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('mousemove', handleMouseMove);
      element.style.cursor = '';
      element.style.userSelect = '';
    };
  }, [scrollSpeed, dragThreshold]);

  return ref;
}
