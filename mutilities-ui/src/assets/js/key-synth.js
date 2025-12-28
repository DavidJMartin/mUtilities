/**
 * Key Synth Module
 * Handles the keyboard synthesizer functionality using Tone.js
 * 
 * Dependencies: Tone.js (external library)
 */

// ===== Key Synth State =====
let synth = null;
let filter = null;
const activeNotes = new Map(); // Track which keys are currently pressed

// Keyboard to note mapping (QWERTY layout)
const KEY_TO_NOTE = {
    'a': 'C4',
    'w': 'C#4',
    's': 'D4',
    'e': 'D#4',
    'd': 'E4',
    'f': 'F4',
    't': 'F#4',
    'g': 'G4',
    'y': 'G#4',
    'h': 'A4',
    'u': 'A#4',
    'j': 'B4',
    'k': 'C5',
    'o': 'C#5',
    'l': 'D5'
};

/**
 * Initialize the key synth with default settings
 */
function initKeySynth() {
    // Create filter
    filter = new Tone.Filter({
        type: 'lowpass',
        frequency: 2000,
        Q: 1
    }).toDestination();
    
    // Create synth with ADSR envelope
    synth = new Tone.AMSynth(Tone.Synth, {
        oscillator: {
            type: 'sawtooth'
        },
        envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.5,
            release: 0.8
        }
    }).connect(filter);
    
    // Set up control listeners
    setupSynthControls();
    setupKeyboardHandlers();
}

/**
 * Set up event listeners for synth control sliders and selects
 */
function setupSynthControls() {
    // Waveform control
    const waveformSelect = document.getElementById('waveform');
    if (waveformSelect) {
        waveformSelect.addEventListener('change', (e) => {
            if (synth) {
                synth.set({
                    oscillator: { type: e.target.value }
                });
            }
        });
    }
    
    // Filter cutoff control
    const cutoffSlider = document.getElementById('cutoff');
    const cutoffValue = document.getElementById('cutoff-value');
    if (cutoffSlider && cutoffValue) {
        cutoffSlider.addEventListener('input', (e) => {
            const freq = parseFloat(e.target.value);
            cutoffValue.textContent = Math.round(freq);
            if (filter) {
                filter.frequency.value = freq;
            }
        });
    }
    
    // Filter resonance control
    const resonanceSlider = document.getElementById('resonance');
    const resonanceValue = document.getElementById('resonance-value');
    if (resonanceSlider && resonanceValue) {
        resonanceSlider.addEventListener('input', (e) => {
            const q = parseFloat(e.target.value);
            resonanceValue.textContent = q.toFixed(1);
            if (filter) {
                filter.Q.value = q;
            }
        });
    }
    
    // ADSR controls
    const attackSlider = document.getElementById('attack');
    const attackValue = document.getElementById('attack-value');
    if (attackSlider && attackValue) {
        attackSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            attackValue.textContent = val.toFixed(3);
            if (synth) {
                synth.set({ envelope: { attack: val } });
            }
        });
    }
    
    const decaySlider = document.getElementById('decay');
    const decayValue = document.getElementById('decay-value');
    if (decaySlider && decayValue) {
        decaySlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            decayValue.textContent = val.toFixed(3);
            if (synth) {
                synth.set({ envelope: { decay: val } });
            }
        });
    }
    
    const sustainSlider = document.getElementById('sustain');
    const sustainValue = document.getElementById('sustain-value');
    if (sustainSlider && sustainValue) {
        sustainSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            sustainValue.textContent = val.toFixed(2);
            if (synth) {
                synth.set({ envelope: { sustain: val } });
            }
        });
    }
    
    const releaseSlider = document.getElementById('release');
    const releaseValue = document.getElementById('release-value');
    if (releaseSlider && releaseValue) {
        releaseSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            releaseValue.textContent = val.toFixed(3);
            if (synth) {
                synth.set({ envelope: { release: val } });
            }
        });
    }
}

/**
 * Set up keyboard event handlers for playing notes
 */
function setupKeyboardHandlers() {
    document.addEventListener('keydown', async (e) => {
        // Only handle if on key-synth page
        const keySynthPage = document.getElementById('key-synth');
        if (!keySynthPage || !keySynthPage.classList.contains('active')) {
            return;
        }
        
        const key = e.key.toLowerCase();
        const note = KEY_TO_NOTE[key];
        
        // Ignore if not a synth key or already pressed (key repeat)
        if (!note || activeNotes.has(key)) {
            return;
        }
        
        // Prevent default behavior
        e.preventDefault();
        
        // Start Tone.js audio context if needed
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        // Track active note
        activeNotes.set(key, note);
        
        // Trigger note
        if (synth) {
            synth.triggerAttack(note);
        }
    });
    
    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        const note = activeNotes.get(key);
        
        if (!note) {
            return;
        }
        
        // Remove from active notes
        activeNotes.delete(key);
        
        // Release note
        if (synth) {
            synth.triggerRelease(note);
        }
    });
    
    // Clean up when leaving page or window loses focus
    window.addEventListener('blur', () => {
        if (synth && activeNotes.size > 0) {
            const notes = Array.from(activeNotes.values());
            synth.triggerRelease(notes);
            activeNotes.clear();
        }
    });
}
