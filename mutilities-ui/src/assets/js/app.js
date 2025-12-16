const API_BASE_URL = '/api';

// ===== Music Theory Data =====
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES = {
    'C': 'C', 'C#': 'C#/Db', 'D': 'D', 'D#': 'D#/Eb', 'E': 'E', 'F': 'F',
    'F#': 'F#/Gb', 'G': 'G', 'G#': 'G#/Ab', 'A': 'A', 'A#': 'A#/Bb', 'B': 'B'
};

// Scale intervals (semitones from root)
const SCALES = {
    major: { name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
    minor: { name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
    harmonicMinor: { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
    melodicMinor: { name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
    dorian: { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
    phrygian: { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
    lydian: { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
    mixolydian: { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
    locrian: { name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
    pentatonicMajor: { name: 'Pentatonic Major', intervals: [0, 2, 4, 7, 9] },
    pentatonicMinor: { name: 'Pentatonic Minor', intervals: [0, 3, 5, 7, 10] },
    blues: { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] }
};

// Guitar string tuning (standard tuning: E A D G B E)
const GUITAR_STRINGS = [
    { note: 'E', octave: 4, name: 'e' },  // high E
    { note: 'B', octave: 3, name: 'B' },
    { note: 'G', octave: 3, name: 'G' },
    { note: 'D', octave: 3, name: 'D' },
    { note: 'A', octave: 2, name: 'A' },
    { note: 'E', octave: 2, name: 'E' }   // low E
];

// ===== In Key Assistance State =====
let selectedNotes = new Set();
let isKeySelected = false;
let tempPreviewKey = null; // For temporary key preview when clicking key badges

// MIDI note number mapping (C4 = 60, etc.)
const MIDI_BASE = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };

function getMidiNoteNumber(note, octave) {
    return (octave + 1) * 12 + MIDI_BASE[note];
}

function getMidiNotesForPitchClass(pitchClass) {
    // Returns common MIDI note numbers for a pitch class (octaves 2-5)
    const midiNotes = [];
    for (let octave = 2; octave <= 5; octave++) {
        midiNotes.push(getMidiNoteNumber(pitchClass, octave));
    }
    return midiNotes;
}

// ===== Helper Functions =====
function getNoteIndex(note) {
    return NOTES.indexOf(note);
}

function getNoteAtInterval(rootNote, semitones) {
    const rootIndex = getNoteIndex(rootNote);
    return NOTES[(rootIndex + semitones) % 12];
}

function getScaleNotes(rootNote, scaleType) {
    const scale = SCALES[scaleType];
    if (!scale) return [];
    return scale.intervals.map(interval => getNoteAtInterval(rootNote, interval));
}

function normalizeNote(note) {
    // Convert flats to sharps for consistency
    const flatToSharp = {
        'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#',
        'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B'
    };
    return flatToSharp[note] || note;
}

// Find all possible keys that contain the selected notes
function findPossibleKeys(notes) {
    if (notes.size === 0) return [];
    
    const normalizedNotes = new Set([...notes].map(normalizeNote));
    const possibleKeys = [];
    
    for (const root of NOTES) {
        for (const [scaleType, scale] of Object.entries(SCALES)) {
            const scaleNotes = new Set(getScaleNotes(root, scaleType));
            
            // Check if all selected notes are in this scale
            let allNotesInScale = true;
            for (const note of normalizedNotes) {
                if (!scaleNotes.has(note)) {
                    allNotesInScale = false;
                    break;
                }
            }
            
            if (allNotesInScale) {
                possibleKeys.push({
                    root: root,
                    type: scaleType,
                    name: `${NOTE_NAMES[root]} ${scale.name}`
                });
            }
        }
    }
    
    return possibleKeys;
}

// ===== Piano Keyboard =====
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

// ===== Guitar Neck =====
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

// ===== Info Display Updates =====
function updateInfoDisplays() {
    updateSelectedNotesDisplay();
    updatePossibleKeysDisplay();
    updateTranspositionDisplay();
}

// Get all notes to display (selected + temp preview)
function getAllDisplayNotes() {
    if (tempPreviewKey) {
        const scaleNotes = new Set(getScaleNotes(tempPreviewKey.root, tempPreviewKey.type));
        return { selected: selectedNotes, temp: scaleNotes };
    }
    return { selected: selectedNotes, temp: new Set() };
}

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

function updateScaleInfoDisplay(rootNote, scaleType) {
    const container = document.getElementById('scale-info');
    if (!container) return;
    
    if (!rootNote || !scaleType) {
        container.innerHTML = '<span class="placeholder">Select a key from the dropdowns to see scale information</span>';
        return;
    }
    
    const scale = SCALES[scaleType];
    const scaleNotes = getScaleNotes(rootNote, scaleType);
    
    const intervalNames = ['Root', '2nd', '3rd', '4th', '5th', '6th', '7th'];
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

function clearKeySelection() {
    isKeySelected = false;
    
    const pitchSelect = document.getElementById('pitch-class-select');
    const typeSelect = document.getElementById('key-type-select');
    
    if (pitchSelect) pitchSelect.value = '';
    if (typeSelect) typeSelect.value = '';
    
    updateScaleInfoDisplay(null, null);
}

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

// Navigation handling
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

document.addEventListener('DOMContentLoaded', () => {
    // Initialize In Key Assistance
    initInKeyAssistance();
    
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
    
    // Random Melody Generator functionality
    const generateButton = document.getElementById('generate-melody');
    const resultDiv = document.getElementById('melody-result');
    
    if (generateButton) {
        generateButton.addEventListener('click', async () => {
            try {
                generateButton.disabled = true;
                generateButton.textContent = 'Generating...';
                
                const response = await fetch(`${API_BASE_URL}/melody/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                resultDiv.innerHTML = `
                    <div class="success">
                        <h4>Generated Melody:</h4>
                        <pre>${JSON.stringify(data, null, 2)}</pre>
                    </div>
                `;
                resultDiv.classList.add('show');
                
            } catch (error) {
                resultDiv.innerHTML = `<div class="error">Failed to generate melody: ${error.message}</div>`;
                resultDiv.classList.add('show');
            } finally {
                generateButton.disabled = false;
                generateButton.textContent = 'Generate Melody';
            }
        });
    }
});
