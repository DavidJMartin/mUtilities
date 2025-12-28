/**
 * Piano Keyboard Module
 * Handles rendering and interaction with the virtual piano keyboard
 * 
 * Dependencies: music-theory.js (NOTES, normalizeNote, getNoteIndex)
 * Uses global state: selectedNotes, isKeySelected, tempPreviewKey
 */

/**
 * Create the piano keyboard UI
 * Renders 2 octaves of piano keys starting from C3
 */
function createPiano() {
    const piano = document.getElementById('piano');
    if (!piano) return;
    
    piano.innerHTML = '';
    
    // 2 octaves starting from C3
    const octaves = [3, 4];
    const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const blackKeys = { 'C': 'C#', 'D': 'D#', 'F': 'F#', 'G': 'G#', 'A': 'A#' };
    
    for (const octave of octaves) {
        for (const note of whiteKeys) {
            // Create white key
            const whiteKey = document.createElement('div');
            whiteKey.className = 'piano-key white';
            whiteKey.dataset.note = note;
            whiteKey.dataset.octave = octave;
            whiteKey.innerHTML = `<span>${note}${octave}</span>`;
            whiteKey.addEventListener('click', () => handlePianoKeyClick(whiteKey, note));
            piano.appendChild(whiteKey);
            
            // Create black key if applicable
            if (blackKeys[note]) {
                const blackKey = document.createElement('div');
                blackKey.className = 'piano-key black';
                blackKey.dataset.note = blackKeys[note];
                blackKey.dataset.octave = octave;
                blackKey.innerHTML = `<span>${blackKeys[note]}</span>`;
                blackKey.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handlePianoKeyClick(blackKey, blackKeys[note]);
                });
                piano.appendChild(blackKey);
            }
        }
    }
}

/**
 * Handle click on a piano key
 * @param {HTMLElement} keyElement - The clicked key element
 * @param {string} note - The note name
 */
function handlePianoKeyClick(keyElement, note) {
    if (isKeySelected) {
        // If a key is selected via dropdown, clicking clears that selection
        clearKeySelection();
    }
    
    // Clear temp preview if active
    if (tempPreviewKey) {
        clearTempPreview();
    }
    
    const normalizedNote = normalizeNote(note);
    
    if (selectedNotes.has(normalizedNote)) {
        selectedNotes.delete(normalizedNote);
        // Remove selected class from all keys with this note
        document.querySelectorAll(`.piano-key[data-note="${note}"]`).forEach(el => {
            el.classList.remove('selected');
        });
    } else {
        selectedNotes.add(normalizedNote);
        // Add selected class to all keys with this note
        document.querySelectorAll(`.piano-key[data-note="${note}"]`).forEach(el => {
            el.classList.add('selected');
        });
    }
    
    syncGuitarWithSelection();
    updateInfoDisplays();
}

/**
 * Sync piano display with the current note selection
 * Updates visual highlighting of selected notes
 */
function syncPianoWithSelection() {
    document.querySelectorAll('.piano-key').forEach(key => {
        const note = normalizeNote(key.dataset.note);
        key.classList.remove('temp-selected');
        if (selectedNotes.has(note)) {
            key.classList.add('selected');
        } else {
            key.classList.remove('selected');
        }
    });
}
