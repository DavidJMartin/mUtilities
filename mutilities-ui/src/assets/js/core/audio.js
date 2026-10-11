import * as Tone from 'tone';

export const WAVEFORMS = [
    { value: 'sine', label: 'SIN' },
    { value: 'triangle', label: 'TRI' },
    { value: 'sawtooth', label: 'SAW' },
    { value: 'square', label: 'SQR' },
];

// Browsers only allow audio to start from a user gesture, so call this at
// the start of any handler that makes sound.
export async function ensureAudioRunning() {
    // iOS treats web audio as "ambient", which the silent switch mutes;
    // "playback" routes it through the media volume instead.
    if ('audioSession' in navigator) {
        navigator.audioSession.type = 'playback';
    }

    if (Tone.getContext().state !== 'running') {
        await Tone.start();
    }
}
