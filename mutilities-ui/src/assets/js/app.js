/**
 * Main Application Entry Point
 * Initializes all modules when the DOM is ready
 * 
 * Load order (via script tags in HTML):
 * 1. music-theory.js - Core constants and helper functions
 * 2. piano.js - Piano keyboard module
 * 3. guitar.js - Guitar neck module
 * 4. in-key-assistance.js - Key detection and scale info
 * 5. navigation.js - Page navigation
 * 6. melody-generator.js - Melody API integration
 * 7. key-synth.js - Synthesizer functionality (requires Tone.js)
 * 8. app.js - This file (initialization)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize In Key Assistance (includes piano and guitar)
    initInKeyAssistance();
    
    // Initialize navigation
    initNavigation();
    
    // Initialize melody generator
    initMelodyGenerator();
    
    // Initialize Key Synth when Tone.js is available
    if (typeof Tone !== 'undefined') {
        initKeySynth();
    }
});
