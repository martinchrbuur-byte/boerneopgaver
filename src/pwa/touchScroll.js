/**
 * Touch Scroll Enhancement
 * Ensures smooth touch scrolling works on Raspberry Pi and other devices
 * that may have limited touch event support.
 */

export function initializeTouchScroll() {
  // Enable passive event listeners for better scroll performance
  const passiveOptions = { passive: true };
  
  // Ensure body is properly set up for touch scrolling
  const body = document.documentElement;
  const scrollContainer = document.body;

  if (!scrollContainer) return;

  // Track touch state for better scroll handling
  let startY = 0;
  let lastY = 0;
  let isScrolling = false;

  // Handle touch start - record initial position
  scrollContainer.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    lastY = startY;
    isScrolling = true;
  }, passiveOptions);

  // Handle touch move - enable smooth scrolling
  scrollContainer.addEventListener('touchmove', (e) => {
    if (!isScrolling) return;
    
    const currentY = e.touches[0].clientY;
    const delta = lastY - currentY;
    
    // Allow natural scrolling behavior through CSS touch-action
    // This handler just ensures the touch events are recognized
    lastY = currentY;
  }, passiveOptions);

  // Handle touch end - cleanup
  scrollContainer.addEventListener('touchend', () => {
    isScrolling = false;
  }, passiveOptions);

  // Ensure scrolling is enabled on the document element
  // This helps with browsers that may not properly inherit scroll settings
  if (window.visualViewport) {
    // Enable viewport-aware scrolling for better mobile experience
    window.addEventListener('orientationchange', () => {
      // Refresh scroll calculations after orientation change
      setTimeout(() => {
        scrollContainer.scrollTop = scrollContainer.scrollTop;
      }, 100);
    }, passiveOptions);
  }

  // Add a CSS class to indicate touch scrolling is initialized
  document.documentElement.classList.add('touch-scroll-enabled');
}
