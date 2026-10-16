import * as Tone from 'tone';

/**
 * Master bus on the site's final output, shared by every tool and the
 * recorder: a gentle glue compressor, then a limiter just under 0 dB so
 * several tools (and stacked drum hits) can't clip. Call once at start-up.
 */
export function setupMasterBus() {
    const compressor = new Tone.Compressor({ threshold: -14, ratio: 2.5, knee: 10, attack: 0.01, release: 0.25 });
    const limiter = new Tone.Limiter(-0.5);
    Tone.getDestination().chain(compressor, limiter);
}

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
