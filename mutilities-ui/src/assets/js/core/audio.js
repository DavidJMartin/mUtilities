// Tone.js is loaded as a classic script before the modules, so it's a global

export const WAVEFORMS = [
    { value: 'sine', label: 'SIN' },
    { value: 'triangle', label: 'TRI' },
    { value: 'sawtooth', label: 'SAW' },
    { value: 'square', label: 'SQR' },
];

export function hasAudio() {
    return typeof window.Tone !== 'undefined';
}

// Browsers only allow audio to start from a user gesture, so call this at
// the start of any handler that makes sound.
export async function ensureAudioRunning() {
    if (window.Tone.context.state !== 'running') {
        await window.Tone.start();
    }
}
