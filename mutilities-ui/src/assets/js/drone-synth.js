/**
 * Drone Synth Module
 * Handles continuous drone oscillators with in-key note selection, filters, LFOs, and reverb
 * 
 * Dependencies: Tone.js (external library)
 */

// ===== Drone Synth State =====
let isPlaying = false;
let currentKey = { root: 'C', scale: 'major' };
let oscillators = [];
let reverb = null;
let distortion = null;
let reverbEnabled = true;
let distortionEnabled = true;

// Each oscillator has: synth, filter, filterLFO, ampLFO, volume, enabled
const NUM_OSCILLATORS = 4;

// Default volume for voices
const DEFAULT_VOLUME = -30;

/**
 * Generate random value in range
 */
function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Initialize the drone synth with 4 oscillators and reverb
 */
function initDroneSynth() {
    // Create distortion (global effect)
    distortion = new Tone.Distortion({
        distortion: 0.8,
        wet: 0.5
    }).toDestination();
    
    // Create reverb (global effect) - connects to distortion
    reverb = new Tone.Reverb({
        decay: 10,
        wet: 1.0,
        preDelay: 0.01
    }).connect(distortion);
    
    // Create 4 oscillators with their signal chains
    for (let i = 0; i < NUM_OSCILLATORS; i++) {
        // Generate random LFO parameters
        const filterLFOFreq = randomInRange(0.001, 0.4);
        const filterLFODepth = randomInRange(20, 80);
        const ampLFOFreq = randomInRange(0.001, 0.4);
        const ampLFODepth = randomInRange(6, 18);
        
        // Generate random filter frequency
        const randomFilterFreq = randomInRange(300, 1000);
        
        // Create volume control - connects to reverb
        const volume = new Tone.Volume(DEFAULT_VOLUME).connect(reverb);
        
        // Create filter with randomized frequency
        const filter = new Tone.Filter({
            type: 'lowpass',
            frequency: randomFilterFreq,
            Q: 1
        }).connect(volume);
        
        // Create filter LFO with random values
        const filterLFO = new Tone.LFO({
            frequency: filterLFOFreq,
            min: randomFilterFreq * (1 - filterLFODepth / 100),
            max: randomFilterFreq * (1 + filterLFODepth / 100)
        });
        
        // Create amplitude LFO with random values
        const ampLFO = new Tone.LFO({
            frequency: ampLFOFreq,
            min: -ampLFODepth,
            max: 0
        });
        
        // Create synth
        const synth = new Tone.Synth({
            oscillator: {
                type: 'sine'
            },
            envelope: {
                attack: 2,
                decay: 0,
                sustain: 1,
                release: 2
            }
        }).connect(filter);
        
        oscillators.push({
            synth,
            filter,
            filterLFO,
            ampLFO,
            volume,
            enabled: true, // All oscillators enabled by default
            currentNote: 'C4',
            filterLFOEnabled: true,
            filterLFOFreq: filterLFOFreq,
            filterLFODepth: filterLFODepth,
            ampLFOEnabled: true,
            ampLFOFreq: ampLFOFreq,
            ampLFODepth: ampLFODepth
        });
    }
    
    setupDroneSynthControls();
}

/**
 * Get notes in the current key across multiple octaves
 */
function getInKeyNotes() {
    const scaleNotes = getScaleNotes(currentKey.root, currentKey.scale);
    const notes = [];
    
    // Generate notes across octaves 2-5
    for (let octave = 2; octave <= 5; octave++) {
        scaleNotes.forEach(note => {
            notes.push({ 
                value: `${note}${octave}`,
                display: `${note}${octave}`
            });
        });
    }
    
    return notes;
}

/**
 * Update all note selectors with in-key notes
 * @param {boolean} randomize - If true, randomize all notes regardless of current value
 */
function updateNoteSelectors(randomize = false) {
    const notes = getInKeyNotes();
    
    for (let i = 0; i < NUM_OSCILLATORS; i++) {
        const selector = document.getElementById(`drone-note-${i}`);
        if (!selector) continue;
        
        const currentValue = selector.value || oscillators[i].currentNote;
        selector.innerHTML = '';
        
        notes.forEach(note => {
            const option = document.createElement('option');
            option.value = note.value;
            option.textContent = note.display;
            selector.appendChild(option);
        });
        
        // Randomize or try to maintain current note if it's in the new key
        if (randomize) {
            // Pick a random note from different octaves for each oscillator
            const randomNote = notes[Math.floor(Math.random() * notes.length)];
            selector.value = randomNote.value;
        } else if (notes.some(n => n.value === currentValue)) {
            selector.value = currentValue;
        } else {
            // Current note not in key, select a random one
            const randomNote = notes[Math.floor(Math.random() * notes.length)];
            selector.value = randomNote.value;
        }
        
        // Update oscillator's current note
        oscillators[i].currentNote = selector.value;
    }
}

/**
 * Set up event listeners for all drone synth controls
 */
function setupDroneSynthControls() {
    // Key selection
    const rootSelect = document.getElementById('drone-key-root');
    const scaleSelect = document.getElementById('drone-key-scale');
    
    if (rootSelect && scaleSelect) {
        const updateKey = () => {
            currentKey.root = rootSelect.value;
            currentKey.scale = scaleSelect.value;
            updateNoteSelectors();
        };
        
        rootSelect.addEventListener('change', updateKey);
        scaleSelect.addEventListener('change', updateKey);
    }
    
    // Play/Stop button
    const playButton = document.getElementById('drone-play-stop');
    if (playButton) {
        playButton.addEventListener('click', togglePlayback);
    }
    
    // Randomise button
    const randomiseButton = document.getElementById('drone-randomise');
    if (randomiseButton) {
        randomiseButton.addEventListener('click', randomiseAllParameters);
    }
    
    // Reverb controls
    setupReverbControls();
    
    // Distortion controls
    setupDistortionControls();
    
    // Set up controls for each oscillator
    for (let i = 0; i < NUM_OSCILLATORS; i++) {
        setupOscillatorControls(i);
    }
    
    // Initialize note selectors with random notes
    updateNoteSelectors(true);
    
    // Initialize LFO UI values to show randomized values
    initializeLFODisplayValues();
    
    // Initialize UI state
    updateUIState();
}

/**
 * Set up reverb control listeners
 */
function setupReverbControls() {
    // Reverb enable/disable
    const reverbEnable = document.getElementById('reverb-enable');
    if (reverbEnable) {
        reverbEnable.checked = reverbEnabled;
        reverbEnable.addEventListener('change', (e) => {
            reverbEnabled = e.target.checked;
            if (reverb) {
                reverb.wet.value = reverbEnabled ? parseFloat(document.getElementById('reverb-mix')?.value || 1.0) : 0;
            }
        });
    }
    
    // Reverb decay
    const reverbDecay = document.getElementById('reverb-decay');
    const reverbDecayValue = document.getElementById('reverb-decay-value');
    if (reverbDecay && reverbDecayValue && reverb) {
        reverbDecay.addEventListener('input', (e) => {
            const decay = parseFloat(e.target.value);
            reverbDecayValue.textContent = decay.toFixed(1);
            reverb.decay = decay;
        });
    }
    
    // Reverb mix (wet)
    const reverbMix = document.getElementById('reverb-mix');
    const reverbMixValue = document.getElementById('reverb-mix-value');
    if (reverbMix && reverbMixValue && reverb) {
        reverbMix.addEventListener('input', (e) => {
            const mix = parseFloat(e.target.value);
            reverbMixValue.textContent = Math.round(mix * 100);
            if (reverbEnabled) {
                reverb.wet.value = mix;
            }
        });
    }
}

/**
 * Set up distortion control listeners
 */
function setupDistortionControls() {
    // Distortion enable/disable
    const distortionEnable = document.getElementById('distortion-enable');
    if (distortionEnable) {
        distortionEnable.checked = distortionEnabled;
        distortionEnable.addEventListener('change', (e) => {
            distortionEnabled = e.target.checked;
            if (distortion) {
                distortion.wet.value = distortionEnabled ? parseFloat(document.getElementById('distortion-mix')?.value || 0.5) : 0;
            }
        });
    }
    
    // Distortion amount
    const distortionAmount = document.getElementById('distortion-amount');
    const distortionAmountValue = document.getElementById('distortion-amount-value');
    if (distortionAmount && distortionAmountValue && distortion) {
        distortionAmount.addEventListener('input', (e) => {
            const amount = parseFloat(e.target.value);
            distortionAmountValue.textContent = amount.toFixed(2);
            distortion.distortion = amount;
        });
    }
    
    // Distortion mix (wet)
    const distortionMix = document.getElementById('distortion-mix');
    const distortionMixValue = document.getElementById('distortion-mix-value');
    if (distortionMix && distortionMixValue && distortion) {
        distortionMix.addEventListener('input', (e) => {
            const mix = parseFloat(e.target.value);
            distortionMixValue.textContent = Math.round(mix * 100);
            if (distortionEnabled) {
                distortion.wet.value = mix;
            }
        });
    }
}

/**
 * Initialize LFO display values to show randomized values
 */
function initializeLFODisplayValues() {
    for (let i = 0; i < NUM_OSCILLATORS; i++) {
        const osc = oscillators[i];
        
        // Update filter frequency UI to show randomized value
        const filterFreqSlider = document.getElementById(`drone-filter-freq-${i}`);
        const filterFreqValue = document.getElementById(`drone-filter-freq-value-${i}`);
        if (filterFreqSlider && filterFreqValue) {
            filterFreqSlider.value = osc.filter.frequency.value;
            filterFreqValue.textContent = Math.round(osc.filter.frequency.value);
        }
        
        // Update filter LFO UI
        const filterLFOFreq = document.getElementById(`filter-lfo-freq-${i}`);
        const filterLFOFreqValue = document.getElementById(`filter-lfo-freq-value-${i}`);
        if (filterLFOFreq && filterLFOFreqValue) {
            filterLFOFreq.value = osc.filterLFOFreq;
            filterLFOFreqValue.textContent = osc.filterLFOFreq.toFixed(3);
        }
        
        const filterLFODepth = document.getElementById(`filter-lfo-depth-${i}`);
        const filterLFODepthValue = document.getElementById(`filter-lfo-depth-value-${i}`);
        if (filterLFODepth && filterLFODepthValue) {
            filterLFODepth.value = osc.filterLFODepth;
            filterLFODepthValue.textContent = osc.filterLFODepth.toFixed(1);
        }
        
        // Update amplitude LFO UI
        const ampLFOFreq = document.getElementById(`amp-lfo-freq-${i}`);
        const ampLFOFreqValue = document.getElementById(`amp-lfo-freq-value-${i}`);
        if (ampLFOFreq && ampLFOFreqValue) {
            ampLFOFreq.value = osc.ampLFOFreq;
            ampLFOFreqValue.textContent = osc.ampLFOFreq.toFixed(3);
        }
        
        const ampLFODepth = document.getElementById(`amp-lfo-depth-${i}`);
        const ampLFODepthValue = document.getElementById(`amp-lfo-depth-value-${i}`);
        if (ampLFODepth && ampLFODepthValue) {
            ampLFODepth.value = osc.ampLFODepth;
            ampLFODepthValue.textContent = osc.ampLFODepth.toFixed(1);
        }
        
        // Update volume UI to show -30dB default
        const volumeSlider = document.getElementById(`drone-volume-${i}`);
        const volumeValue = document.getElementById(`drone-volume-value-${i}`);
        if (volumeSlider && volumeValue) {
            volumeSlider.value = DEFAULT_VOLUME;
            volumeValue.textContent = DEFAULT_VOLUME.toFixed(1);
        }
    }
    
    // Update reverb UI to show actual default values
    const reverbDecayValue = document.getElementById('reverb-decay-value');
    if (reverbDecayValue && reverb) {
        reverbDecayValue.textContent = reverb.decay.toFixed(1);
    }
    
    const reverbMixValue = document.getElementById('reverb-mix-value');
    if (reverbMixValue && reverb) {
        reverbMixValue.textContent = Math.round(reverb.wet.value * 100);
    }
    
    // Update distortion UI to show actual default values
    const distortionAmountValue = document.getElementById('distortion-amount-value');
    if (distortionAmountValue && distortion) {
        distortionAmountValue.textContent = distortion.distortion.toFixed(2);
    }
    
    const distortionMixValue = document.getElementById('distortion-mix-value');
    if (distortionMixValue && distortion) {
        distortionMixValue.textContent = Math.round(distortion.wet.value * 100);
    }
}

/**
 * Set up controls for a specific oscillator
 */
function setupOscillatorControls(index) {
    const osc = oscillators[index];
    
    // Enable/disable toggle
    const enableToggle = document.getElementById(`drone-enable-${index}`);
    if (enableToggle) {
        enableToggle.checked = osc.enabled;
        enableToggle.addEventListener('change', (e) => {
            osc.enabled = e.target.checked;
            if (isPlaying && osc.enabled) {
                startOscillator(index);
            } else if (isPlaying && !osc.enabled) {
                stopOscillator(index);
            }
            updateUIState();
        });
    }
    
    // Note selector
    const noteSelect = document.getElementById(`drone-note-${index}`);
    if (noteSelect) {
        noteSelect.addEventListener('change', (e) => {
            osc.currentNote = e.target.value;
            if (isPlaying && osc.enabled) {
                stopOscillator(index);
                startOscillator(index);
            }
        });
    }
    
    // Shape selector
    const shapeSelect = document.getElementById(`drone-shape-${index}`);
    if (shapeSelect) {
        shapeSelect.addEventListener('change', (e) => {
            osc.synth.oscillator.type = e.target.value;
        });
    }
    
    // Volume slider
    const volumeSlider = document.getElementById(`drone-volume-${index}`);
    const volumeValue = document.getElementById(`drone-volume-value-${index}`);
    if (volumeSlider && volumeValue) {
        volumeSlider.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value);
            volumeValue.textContent = vol.toFixed(1);
            osc.volume.volume.value = vol;
        });
    }
    
    // Filter type
    const filterTypeSelect = document.getElementById(`drone-filter-type-${index}`);
    if (filterTypeSelect) {
        filterTypeSelect.addEventListener('change', (e) => {
            osc.filter.type = e.target.value;
        });
    }
    
    // Filter frequency
    const filterFreqSlider = document.getElementById(`drone-filter-freq-${index}`);
    const filterFreqValue = document.getElementById(`drone-filter-freq-value-${index}`);
    if (filterFreqSlider && filterFreqValue) {
        filterFreqSlider.addEventListener('input', (e) => {
            const freq = parseFloat(e.target.value);
            filterFreqValue.textContent = Math.round(freq);
            osc.filter.frequency.value = freq;
            // Update LFO range to center around this frequency
            const depth = osc.filterLFODepth / 100;
            osc.filterLFO.min = freq * (1 - depth);
            osc.filterLFO.max = freq * (1 + depth);
        });
    }
    
    // Filter resonance
    const filterResSlider = document.getElementById(`drone-filter-res-${index}`);
    const filterResValue = document.getElementById(`drone-filter-res-value-${index}`);
    if (filterResSlider && filterResValue) {
        filterResSlider.addEventListener('input', (e) => {
            const q = parseFloat(e.target.value);
            filterResValue.textContent = q.toFixed(1);
            osc.filter.Q.value = q;
        });
    }
    
    // Filter LFO controls
    const filterLFOEnable = document.getElementById(`filter-lfo-enable-${index}`);
    if (filterLFOEnable) {
        filterLFOEnable.checked = osc.filterLFOEnabled;
        filterLFOEnable.addEventListener('change', (e) => {
            osc.filterLFOEnabled = e.target.checked;
            if (isPlaying && osc.enabled) {
                if (osc.filterLFOEnabled) {
                    osc.filterLFO.connect(osc.filter.frequency);
                    if (osc.filterLFO.state !== 'started') {
                        osc.filterLFO.start();
                    }
                } else {
                    osc.filterLFO.disconnect();
                }
            }
        });
    }
    
    const filterLFOFreq = document.getElementById(`filter-lfo-freq-${index}`);
    const filterLFOFreqValue = document.getElementById(`filter-lfo-freq-value-${index}`);
    if (filterLFOFreq && filterLFOFreqValue) {
        filterLFOFreq.addEventListener('input', (e) => {
            const freq = parseFloat(e.target.value);
            filterLFOFreqValue.textContent = freq.toFixed(3);
            osc.filterLFOFreq = freq;
            osc.filterLFO.frequency.value = freq;
        });
    }
    
    const filterLFODepth = document.getElementById(`filter-lfo-depth-${index}`);
    const filterLFODepthValue = document.getElementById(`filter-lfo-depth-value-${index}`);
    if (filterLFODepth && filterLFODepthValue) {
        filterLFODepth.addEventListener('input', (e) => {
            const depth = parseFloat(e.target.value);
            filterLFODepthValue.textContent = depth.toFixed(1);
            osc.filterLFODepth = depth;
            const baseFreq = osc.filter.frequency.value;
            const depthRatio = depth / 100;
            osc.filterLFO.min = baseFreq * (1 - depthRatio);
            osc.filterLFO.max = baseFreq * (1 + depthRatio);
        });
    }
    
    // Amplitude LFO controls
    const ampLFOEnable = document.getElementById(`amp-lfo-enable-${index}`);
    if (ampLFOEnable) {
        ampLFOEnable.checked = osc.ampLFOEnabled;
        ampLFOEnable.addEventListener('change', (e) => {
            osc.ampLFOEnabled = e.target.checked;
            if (isPlaying && osc.enabled) {
                if (osc.ampLFOEnabled) {
                    osc.ampLFO.connect(osc.volume.volume);
                    if (osc.ampLFO.state !== 'started') {
                        osc.ampLFO.start();
                    }
                } else {
                    osc.ampLFO.disconnect();
                }
            }
        });
    }
    
    const ampLFOFreq = document.getElementById(`amp-lfo-freq-${index}`);
    const ampLFOFreqValue = document.getElementById(`amp-lfo-freq-value-${index}`);
    if (ampLFOFreq && ampLFOFreqValue) {
        ampLFOFreq.addEventListener('input', (e) => {
            const freq = parseFloat(e.target.value);
            ampLFOFreqValue.textContent = freq.toFixed(3);
            osc.ampLFOFreq = freq;
            osc.ampLFO.frequency.value = freq;
        });
    }
    
    const ampLFODepth = document.getElementById(`amp-lfo-depth-${index}`);
    const ampLFODepthValue = document.getElementById(`amp-lfo-depth-value-${index}`);
    if (ampLFODepth && ampLFODepthValue) {
        ampLFODepth.addEventListener('input', (e) => {
            const depth = parseFloat(e.target.value);
            ampLFODepthValue.textContent = depth.toFixed(1);
            osc.ampLFODepth = depth;
            osc.ampLFO.min = -depth;
            osc.ampLFO.max = 0;
        });
    }
}

/**
 * Randomise all oscillator parameters
 */
function randomiseAllParameters() {
    const waveShapes = ['sine', 'triangle', 'sawtooth', 'square'];
    
    // Randomise each oscillator
    for (let i = 0; i < NUM_OSCILLATORS; i++) {
        const osc = oscillators[i];
        
        // Randomise note
        const noteSelector = document.getElementById(`drone-note-${i}`);
        if (noteSelector && noteSelector.options.length > 0) {
            const randomIndex = Math.floor(Math.random() * noteSelector.options.length);
            noteSelector.value = noteSelector.options[randomIndex].value;
            osc.currentNote = noteSelector.value;
        }
        
        // Randomise wave shape
        const randomShape = waveShapes[Math.floor(Math.random() * waveShapes.length)];
        const shapeSelect = document.getElementById(`drone-shape-${i}`);
        if (shapeSelect) {
            shapeSelect.value = randomShape;
            osc.synth.oscillator.type = randomShape;
        }
        
        // Randomise filter frequency (between 300 and 1000 Hz)
        const randomFilterFreq = randomInRange(300, 1000);
        const filterFreqSlider = document.getElementById(`drone-filter-freq-${i}`);
        const filterFreqValue = document.getElementById(`drone-filter-freq-value-${i}`);
        if (filterFreqSlider && filterFreqValue) {
            filterFreqSlider.value = randomFilterFreq;
            filterFreqValue.textContent = Math.round(randomFilterFreq);
            osc.filter.frequency.value = randomFilterFreq;
        }
        
        // Randomise filter LFO frequency (0.001 to 0.4 Hz)
        const randomFilterLFOFreq = randomInRange(0.001, 0.4);
        const filterLFOFreq = document.getElementById(`filter-lfo-freq-${i}`);
        const filterLFOFreqValue = document.getElementById(`filter-lfo-freq-value-${i}`);
        if (filterLFOFreq && filterLFOFreqValue) {
            filterLFOFreq.value = randomFilterLFOFreq;
            filterLFOFreqValue.textContent = randomFilterLFOFreq.toFixed(3);
            osc.filterLFOFreq = randomFilterLFOFreq;
            osc.filterLFO.frequency.value = randomFilterLFOFreq;
        }
        
        // Randomise filter LFO depth (20 to 80%)
        const randomFilterLFODepth = randomInRange(20, 80);
        const filterLFODepth = document.getElementById(`filter-lfo-depth-${i}`);
        const filterLFODepthValue = document.getElementById(`filter-lfo-depth-value-${i}`);
        if (filterLFODepth && filterLFODepthValue) {
            filterLFODepth.value = randomFilterLFODepth;
            filterLFODepthValue.textContent = randomFilterLFODepth.toFixed(1);
            osc.filterLFODepth = randomFilterLFODepth;
            const depthRatio = randomFilterLFODepth / 100;
            osc.filterLFO.min = randomFilterFreq * (1 - depthRatio);
            osc.filterLFO.max = randomFilterFreq * (1 + depthRatio);
        }
        
        // Randomise amplitude LFO frequency (0.001 to 0.4 Hz)
        const randomAmpLFOFreq = randomInRange(0.001, 0.4);
        const ampLFOFreq = document.getElementById(`amp-lfo-freq-${i}`);
        const ampLFOFreqValue = document.getElementById(`amp-lfo-freq-value-${i}`);
        if (ampLFOFreq && ampLFOFreqValue) {
            ampLFOFreq.value = randomAmpLFOFreq;
            ampLFOFreqValue.textContent = randomAmpLFOFreq.toFixed(3);
            osc.ampLFOFreq = randomAmpLFOFreq;
            osc.ampLFO.frequency.value = randomAmpLFOFreq;
        }
        
        // Randomise amplitude LFO depth (6 to 18 dB)
        const randomAmpLFODepth = randomInRange(6, 18);
        const ampLFODepth = document.getElementById(`amp-lfo-depth-${i}`);
        const ampLFODepthValue = document.getElementById(`amp-lfo-depth-value-${i}`);
        if (ampLFODepth && ampLFODepthValue) {
            ampLFODepth.value = randomAmpLFODepth;
            ampLFODepthValue.textContent = randomAmpLFODepth.toFixed(1);
            osc.ampLFODepth = randomAmpLFODepth;
            osc.ampLFO.min = -randomAmpLFODepth;
            osc.ampLFO.max = 0;
        }
    }
    
    // If playing, restart oscillators to apply changes
    if (isPlaying) {
        oscillators.forEach((osc, i) => {
            if (osc.enabled) {
                stopOscillator(i);
                startOscillator(i);
            }
        });
    }
}

/**
 * Toggle playback of all enabled oscillators
 */
async function togglePlayback() {
    if (!isPlaying) {
        await startPlayback();
    } else {
        stopPlayback();
    }
}

/**
 * Start playback of all enabled oscillators
 */
async function startPlayback() {
    // Start Tone.js audio context if needed
    if (Tone.context.state !== 'running') {
        await Tone.start();
    }
    
    isPlaying = true;
    
    // Start each enabled oscillator
    oscillators.forEach((osc, i) => {
        if (osc.enabled) {
            startOscillator(i);
        }
    });
    
    updateUIState();
}

/**
 * Stop playback of all oscillators
 */
function stopPlayback() {
    isPlaying = false;
    
    oscillators.forEach((osc, i) => {
        stopOscillator(i);
    });
    
    updateUIState();
}

/**
 * Start a specific oscillator
 */
function startOscillator(index) {
    const osc = oscillators[index];
    
    // Start the synth
    osc.synth.triggerAttack(osc.currentNote);
    
    // Start and connect filter LFO if enabled
    if (osc.filterLFOEnabled) {
        osc.filterLFO.connect(osc.filter.frequency);
        if (osc.filterLFO.state !== 'started') {
            osc.filterLFO.start();
        }
    }
    
    // Start and connect amplitude LFO if enabled
    if (osc.ampLFOEnabled) {
        osc.ampLFO.connect(osc.volume.volume);
        if (osc.ampLFO.state !== 'started') {
            osc.ampLFO.start();
        }
    }
}

/**
 * Stop a specific oscillator
 */
function stopOscillator(index) {
    const osc = oscillators[index];
    
    // Release the synth
    osc.synth.triggerRelease();
    
    // Disconnect LFOs
    osc.filterLFO.disconnect();
    osc.ampLFO.disconnect();
}

/**
 * Update UI state (button text, disable states, etc.)
 */
function updateUIState() {
    const playButton = document.getElementById('drone-play-stop');
    if (playButton) {
        playButton.textContent = isPlaying ? 'Stop' : 'Play';
        playButton.classList.toggle('playing', isPlaying);
    }
    
    // Update oscillator panel states
    oscillators.forEach((osc, i) => {
        const panel = document.querySelector(`.oscillator-panel[data-oscillator="${i}"]`);
        if (panel) {
            panel.classList.toggle('enabled', osc.enabled);
        }
    });
}
