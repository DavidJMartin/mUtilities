/**
 * Navigation Module
 * Handles page navigation and URL hash routing
 */

/**
 * Navigate to a specific page
 * @param {string} pageId - The ID of the page to navigate to
 */
function navigateToPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show the selected page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Add active class to the clicked nav link
    const targetLink = document.querySelector(`[href="#${pageId}"]`);
    if (targetLink && targetLink.classList.contains('nav-link')) {
        targetLink.classList.add('active');
    }
    
    // Update URL hash without scrolling
    history.pushState(null, null, `#${pageId}`);
}

/**
 * Initialize navigation event listeners
 */
function initNavigation() {
    // Set up navigation event listeners
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('href').substring(1);
            navigateToPage(pageId);
        });
    });
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
        const pageId = window.location.hash.substring(1) || 'home';
        navigateToPage(pageId);
    });
    
    // Navigate to hash on page load if present
    if (window.location.hash) {
        const pageId = window.location.hash.substring(1);
        navigateToPage(pageId);
    }
}
