import { useRef, useEffect, RefObject } from 'react';

interface UseDragScrollOptions {
  /**
   * CSS selector for elements that should be excluded from drag scrolling
   * (e.g., '.card, button, a, input')
   */
  excludeSelectors?: string;
  /**
   * Scroll speed multiplier (default: 2)
   */
  scrollSpeed?: number;
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

  const { excludeSelectors = '.card, button, a, input, textarea, select', scrollSpeed = 2 } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Check if the target element or its parent matches excluded selectors
      if (excludeSelectors) {
        const target = e.target as HTMLElement;
        if (target.closest(excludeSelectors)) {
          return; // Don't start drag on excluded elements
        }
      }

      isDragging.current = true;
      startX.current = e.pageX - element.offsetLeft;
      scrollLeft.current = element.scrollLeft;
      element.style.cursor = 'grabbing';
      element.style.userSelect = 'none';
    };

    const handleMouseLeave = () => {
      if (isDragging.current) {
        isDragging.current = false;
        element.style.cursor = 'grab';
        element.style.userSelect = '';
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      element.style.cursor = 'grab';
      element.style.userSelect = '';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const x = e.pageX - element.offsetLeft;
      const walk = (x - startX.current) * scrollSpeed;
      element.scrollLeft = scrollLeft.current - walk;
    };

    // Set initial cursor
    element.style.cursor = 'grab';

    // Add event listeners
    element.addEventListener('mousedown', handleMouseDown);
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
  }, [excludeSelectors, scrollSpeed]);

  return ref;
}
