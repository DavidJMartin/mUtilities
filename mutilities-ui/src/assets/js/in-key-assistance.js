/**
 * In Key Assistance Module
 * Handles key detection, scale display, and transposition calculations
 * 
 * Dependencies: music-theory.js (NOTES, NOTE_NAMES, SCALES, getNoteIndex, getScaleNotes,
 *               normalizeNote, findPossibleKeys)
 * Uses global state: selectedNotes, isKeySelected, tempPreviewKey
 */

// ===== Global State for In Key Assistance =====
let selectedNotes = new Set();
let isKeySelected = false;
let tempPreviewKey = null; // For temporary key preview when clicking key badges

// ===== Info Display Updates =====

/**
 * Update all information displays
 */
function updateInfoDisplays() {
    updateSelectedNotesDisplay();
    updatePossibleKeysDisplay();
    updateTranspositionDisplay();
}

/**
 * Get all notes to display (selected + temp preview)
 * @returns {{selected: Set<string>, temp: Set<string>}} Object with selected and temp note sets
 */
function getAllDisplayNotes() {
    if (tempPreviewKey) {
        const scaleNotes = new Set(getScaleNotes(tempPreviewKey.root, tempPreviewKey.type));
        return { selected: selectedNotes, temp: scaleNotes };
    }
    return { selected: selectedNotes, temp: new Set() };
}

/**
 * Update the selected notes display panel
 */
function updateSelectedNotesDisplay() {
    const container = document.getElementById('selected-notes');
    if (!container) return;
    
    const { selected, temp } = getAllDisplayNotes();
    
    if (selected.size === 0 && temp.size === 0) {
        container.innerHTML = '<span class="placeholder">Click keys or frets to select notes</span>';
        return;
    }
    
    // Combine all notes and sort
    const allNotes = new Set([...selected, ...temp]);
    const sortedNotes = [...allNotes].sort((a, b) => getNoteIndex(a) - getNoteIndex(b));
    
    container.innerHTML = sortedNotes.map(note => {
        const isSelected = selected.has(note);
        const isTemp = temp.has(note) && !isSelected;
        return `<span class="note-badge${isTemp ? ' temp' : ''}">${NOTE_NAMES[note]}</span>`;
    }).join('');
}

/**
 * Update the possible keys display panel
 */
function updatePossibleKeysDisplay() {
    const container = document.getElementById('possible-keys');
    if (!container) return;
    
    // If we're in temp preview mode, don't update (keep showing the key)
    if (tempPreviewKey) return;
    
    if (selectedNotes.size === 0) {
        container.innerHTML = '<span class="placeholder">Select notes to find matching keys</span>';
        return;
    }
    
    const possibleKeys = findPossibleKeys(selectedNotes);
    
    if (possibleKeys.length === 0) {
        container.innerHTML = '<span class="placeholder">No matching keys found for these notes</span>';
    } else if (possibleKeys.length > 26) {
        container.innerHTML = '<span class="placeholder">Press more notes to narrow down keys</span>';
    } else {
        container.innerHTML = possibleKeys.map(key =>
            `<span class="key-badge" data-root="${key.root}" data-type="${key.type}">${key.name}</span>`
        ).join('');
        
        // Add click handlers to key badges
        container.querySelectorAll('.key-badge').forEach(badge => {
            badge.addEventListener('click', () => handleKeyBadgeClick(badge));
        });
    }
}

/**
 * Handle click on a key badge
 * @param {HTMLElement} badge - The clicked badge element
 */
function handleKeyBadgeClick(badge) {
    const root = badge.dataset.root;
    const type = badge.dataset.type;
    
    if (tempPreviewKey && tempPreviewKey.root === root && tempPreviewKey.type === type) {
        // Click again to deselect - restore original selection
        clearTempPreview();
    } else {
        // Preview this key
        setTempPreview(root, type, badge);
    }
}

/**
 * Set temporary preview for a key
 * @param {string} root - The root note of the key
 * @param {string} type - The scale type
 * @param {HTMLElement} badge - The badge element to highlight
 */
function setTempPreview(root, type, badge) {
    // Store the temp preview state
    tempPreviewKey = { root, type };
    
    // Clear all badge active states and set this one
    document.querySelectorAll('#possible-keys .key-badge').forEach(b => b.classList.remove('active'));
    if (badge) badge.classList.add('active');
    
    // Get the scale notes for the preview
    const scaleNotes = new Set(getScaleNotes(root, type));
    
    // Update instruments to show selected notes (green) and temp notes (orange)
    syncInstrumentsWithTempPreview(scaleNotes);
    
    // Update scale info display
    updateScaleInfoDisplay(root, type);
    
    // Update selected notes display to include temp notes
    updateSelectedNotesDisplay();
    updateTranspositionDisplay();
}

/**
 * Clear the temporary preview and restore normal selection display
 */
function clearTempPreview() {
    tempPreviewKey = null;
    
    // Clear active states on badges
    document.querySelectorAll('#possible-keys .key-badge').forEach(b => b.classList.remove('active'));
    
    // Restore normal selection display
    syncPianoWithSelection();
    syncGuitarWithSelection();
    
    // Clear scale info
    updateScaleInfoDisplay(null, null);
    
    // Update displays to remove temp notes
    updateSelectedNotesDisplay();
    updateTranspositionDisplay();
}

/**
 * Sync instruments with temporary preview (showing selected vs temp notes)
 * @param {Set<string>} tempNotes - Set of notes in the previewed key
 */
function syncInstrumentsWithTempPreview(tempNotes) {
    // Piano: show selected as green, temp-only as orange
    document.querySelectorAll('.piano-key').forEach(key => {
        const note = normalizeNote(key.dataset.note);
        key.classList.remove('selected', 'temp-selected');
        
        if (selectedNotes.has(note)) {
            key.classList.add('selected');
        } else if (tempNotes.has(note)) {
            key.classList.add('temp-selected');
        }
    });
    
    // Guitar: show selected as green, temp-only as orange
    document.querySelectorAll('.guitar-fret').forEach(fret => {
        const note = normalizeNote(fret.dataset.note);
        fret.classList.remove('selected', 'temp-selected');
        
        if (selectedNotes.has(note)) {
            fret.classList.add('selected');
        } else if (tempNotes.has(note)) {
            fret.classList.add('temp-selected');
        }
    });
}

/**
 * Update the scale information display
 * @param {string|null} rootNote - The root note of the scale, or null to clear
 * @param {string|null} scaleType - The scale type, or null to clear
 */
function updateScaleInfoDisplay(rootNote, scaleType) {
    const container = document.getElementById('scale-info');
    if (!container) return;
    
    if (!rootNote || !scaleType) {
        container.innerHTML = '<span class="placeholder">Select a key from the dropdowns to see scale information</span>';
        return;
    }
    
    const scale = SCALES[scaleType];
    const scaleNotes = getScaleNotes(rootNote, scaleType);
    
    const degreeLabels = scale.intervals.map((interval, idx) => {
        if (idx === 0) return 'Root';
        const n = idx + 1;
        const suffix = (n === 2) ? 'nd' : (n === 3) ? 'rd' : 'th';
        return `${n}${suffix}`;
    });
    
    container.innerHTML = `
        <div><strong>${NOTE_NAMES[rootNote]} ${scale.name}</strong></div>
        <div class="scale-notes">
            ${scaleNotes.map((note, idx) =>
                `<span class="scale-note ${idx === 0 ? 'root' : ''}" title="${degreeLabels[idx]}">${NOTE_NAMES[note]}</span>`
            ).join('')}
        </div>
        <div class="scale-intervals">
            <strong>Intervals:</strong> ${scale.intervals.map((i, idx) =>
                `${degreeLabels[idx]} (${i})`
            ).join(' → ')}
        </div>
    `;
}

// ===== Transposition Display =====

/**
 * Update the transposition values display
 */
function updateTranspositionDisplay() {
    const container = document.getElementById('transposition-values');
    if (!container) return;
    
    const sampleKeySelect = document.getElementById('sample-key-select');
    const sampleKey = sampleKeySelect ? sampleKeySelect.value : 'C';
    const sampleKeyIndex = getNoteIndex(sampleKey);
    
    const { selected, temp } = getAllDisplayNotes();
    
    if (selected.size === 0 && temp.size === 0) {
        container.innerHTML = '<span class="placeholder">Select notes to see transposition values</span>';
        return;
    }
    
    // Combine all notes and sort
    const allNotes = new Set([...selected, ...temp]);
    const sortedNotes = [...allNotes].sort((a, b) => getNoteIndex(a) - getNoteIndex(b));
    
    // Calculate transposition from sample key for each note - show both directions
    const transDisplay = sortedNotes.map(note => {
        const noteIndex = getNoteIndex(note);
        let semitones = noteIndex - sampleKeyIndex;
        
        // Normalize to positive direction (0 to 11)
        if (semitones < 0) semitones += 12;
        
        // Calculate both up and down transposition
        const transUp = semitones === 0 ? 0 : semitones;
        const transDown = semitones === 0 ? 0 : semitones - 12;
        
        const isTemp = temp.has(note) && !selected.has(note);
        
        // Format: show both negative and positive (e.g., "-5, +7")
        let transValue;
        if (semitones === 0) {
            transValue = '0';
        } else {
            transValue = `${transDown}, +${transUp}`;
        }
        
        return `<span class="transposition-note${isTemp ? ' temp' : ''}"><span class="note-name">${NOTE_NAMES[note]}</span>: <span class="trans-value">${transValue}</span></span>`;
    }).join('');
    
    container.innerHTML = transDisplay;
}

// ===== Key Selection from Dropdowns =====

/**
 * Handle key selection from dropdowns
 */
function handleKeySelection() {
    const pitchSelect = document.getElementById('pitch-class-select');
    const typeSelect = document.getElementById('key-type-select');
    
    if (!pitchSelect || !typeSelect) return;
    
    const rootNote = pitchSelect.value;
    const scaleType = typeSelect.value;
    
    if (rootNote && scaleType) {
        // Clear temp preview if active
        tempPreviewKey = null;
        
        // Clear all temp-selected classes
        document.querySelectorAll('.piano-key, .guitar-fret').forEach(el => {
            el.classList.remove('temp-selected');
        });
        
        // Clear current selection and show scale notes
        selectedNotes.clear();
        isKeySelected = true;
        
        const scaleNotes = getScaleNotes(rootNote, scaleType);
        scaleNotes.forEach(note => selectedNotes.add(note));
        
        syncPianoWithSelection();
        syncGuitarWithSelection();
        updateSelectedNotesDisplay();
        updateScaleInfoDisplay(rootNote, scaleType);
        updateTranspositionDisplay();
        
        // Update possible keys to show the selected key
        const container = document.getElementById('possible-keys');
        if (container) {
            container.innerHTML = `<span class="key-badge">${NOTE_NAMES[rootNote]} ${SCALES[scaleType].name}</span>`;
        }
    } else {
        updateScaleInfoDisplay(null, null);
    }
}

/**
 * Clear the key selection from dropdowns
 */
function clearKeySelection() {
    isKeySelected = false;
    
    const pitchSelect = document.getElementById('pitch-class-select');
    const typeSelect = document.getElementById('key-type-select');
    
    if (pitchSelect) pitchSelect.value = '';
    if (typeSelect) typeSelect.value = '';
    
    updateScaleInfoDisplay(null, null);
}

/**
 * Clear all selections (notes, key, and temp preview)
 */
function clearAllSelections() {
    selectedNotes.clear();
    isKeySelected = false;
    tempPreviewKey = null;
    
    const pitchSelect = document.getElementById('pitch-class-select');
    const typeSelect = document.getElementById('key-type-select');
    
    if (pitchSelect) pitchSelect.value = '';
    if (typeSelect) typeSelect.value = '';
    
    // Clear all selection classes including temp-selected
    document.querySelectorAll('.piano-key').forEach(key => {
        key.classList.remove('selected', 'temp-selected');
    });
    document.querySelectorAll('.guitar-fret').forEach(fret => {
        fret.classList.remove('selected', 'temp-selected');
    });
    
    updateInfoDisplays();
    updateScaleInfoDisplay(null, null);
}

// ===== Initialize In Key Assistance =====

/**
 * Initialize the In Key Assistance feature
 */
function initInKeyAssistance() {
    createPiano();
    createGuitarNeck();
    
    // Set up dropdown listeners
    const pitchSelect = document.getElementById('pitch-class-select');
    const typeSelect = document.getElementById('key-type-select');
    const clearButton = document.getElementById('clear-selection');
    const sampleKeySelect = document.getElementById('sample-key-select');
    
    if (pitchSelect) {
        pitchSelect.addEventListener('change', handleKeySelection);
    }
    
    if (typeSelect) {
        typeSelect.addEventListener('change', handleKeySelection);
    }
    
    if (clearButton) {
        clearButton.addEventListener('click', clearAllSelections);
    }
    
    if (sampleKeySelect) {
        sampleKeySelect.addEventListener('change', updateTranspositionDisplay);
    }
}
