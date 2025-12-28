/**
 * Guitar Neck Module
 * Handles rendering and interaction with the virtual guitar fretboard
 * 
 * Dependencies: music-theory.js (NOTES, GUITAR_STRINGS, getNoteIndex, normalizeNote)
 * Uses global state: selectedNotes, isKeySelected, tempPreviewKey
 */

/**
 * Create the guitar neck UI
 * Renders a 12-fret guitar neck with standard tuning
 */
function createGuitarNeck() {
    const guitarNeck = document.getElementById('guitar-neck');
    if (!guitarNeck) return;
    
    guitarNeck.innerHTML = '';
    
    // Fret markers row
    const markersRow = document.createElement('div');
    markersRow.className = 'fret-markers';
    for (let fret = 0; fret <= 12; fret++) {
        const marker = document.createElement('div');
        marker.className = 'fret-marker';
        if ([3, 5, 7, 9, 12].includes(fret)) {
            const dot = document.createElement('span');
            dot.className = 'dot';
            marker.appendChild(dot);
            if (fret === 12) {
                marker.classList.add('double');
                const dot2 = document.createElement('span');
                dot2.className = 'dot';
                marker.appendChild(dot2);
            }
        }
        markersRow.appendChild(marker);
    }
    guitarNeck.appendChild(markersRow);
    
    // Create strings
    for (const string of GUITAR_STRINGS) {
        const stringRow = document.createElement('div');
        stringRow.className = 'guitar-string';
        
        // String label
        const label = document.createElement('div');
        label.className = 'string-label';
        label.textContent = string.name;
        stringRow.appendChild(label);
        
        // Fret container
        const fretContainer = document.createElement('div');
        fretContainer.className = 'fret-container';
        
        // Create frets
        for (let fret = 0; fret <= 12; fret++) {
            const fretDiv = document.createElement('div');
            fretDiv.className = 'guitar-fret';
            
            // Calculate note at this fret
            const rootIndex = getNoteIndex(string.note);
            const noteIndex = (rootIndex + fret) % 12;
            const note = NOTES[noteIndex];
            
            fretDiv.dataset.note = note;
            fretDiv.dataset.string = string.name;
            fretDiv.dataset.fret = fret;
            
            const noteSpan = document.createElement('span');
            noteSpan.className = 'fret-note';
            noteSpan.textContent = note;
            fretDiv.appendChild(noteSpan);
            
            fretDiv.addEventListener('click', () => handleGuitarFretClick(fretDiv, note));
            fretContainer.appendChild(fretDiv);
        }
        
        stringRow.appendChild(fretContainer);
        guitarNeck.appendChild(stringRow);
    }
    
    // Fret numbers row
    const numbersRow = document.createElement('div');
    numbersRow.className = 'fret-numbers';
    for (let fret = 0; fret <= 12; fret++) {
        const number = document.createElement('div');
        number.className = 'fret-number';
        number.textContent = fret;
        numbersRow.appendChild(number);
    }
    guitarNeck.appendChild(numbersRow);
}

/**
 * Handle click on a guitar fret
 * @param {HTMLElement} fretElement - The clicked fret element
 * @param {string} note - The note name
 */
function handleGuitarFretClick(fretElement, note) {
    if (isKeySelected) {
        clearKeySelection();
    }
    
    // Clear temp preview if active
    if (tempPreviewKey) {
        clearTempPreview();
    }
    
    const normalizedNote = normalizeNote(note);
    
    if (selectedNotes.has(normalizedNote)) {
        selectedNotes.delete(normalizedNote);
    } else {
        selectedNotes.add(normalizedNote);
    }
    
    syncPianoWithSelection();
    syncGuitarWithSelection();
    updateInfoDisplays();
}

/**
 * Sync guitar display with the current note selection
 * Updates visual highlighting of selected notes on the fretboard
 */
function syncGuitarWithSelection() {
    document.querySelectorAll('.guitar-fret').forEach(fret => {
        const note = normalizeNote(fret.dataset.note);
        fret.classList.remove('temp-selected');
        if (selectedNotes.has(note)) {
            fret.classList.add('selected');
        } else {
            fret.classList.remove('selected');
        }
    });
}
