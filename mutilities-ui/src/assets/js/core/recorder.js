// Records everything the site plays. All tools share one audio context, so
// tapping the master output catches drones, drums and synths together. No
// mic, no syncing: it records from when you press record to when you stop.
//
// Stopping gives a take you can save or throw away. Browsers record to a
// compressed format (webm, or mp4 on Safari), so a saved take is written out
// as a 16-bit stereo WAV, which drops straight into any DAW.

import * as Tone from 'tone';
import { downloadBlob, timestamp } from './files.js';

let recorder = null;

export const recordingSupported = () => Tone.Recorder.supported;

export function isRecording() {
    return recorder?.state === 'started';
}

export async function startRecording() {
    if (!recorder) {
        recorder = new Tone.Recorder();
        Tone.getDestination().connect(recorder);
    }
    await recorder.start();
}

/** Stops and resolves with the take (decoded audio). Nothing is saved until saveTake(). */
export async function stopRecording() {
    const compressed = await recorder.stop();
    return Tone.getContext().rawContext.decodeAudioData(await compressed.arrayBuffer());
}

export function saveTake(audio) {
    downloadBlob(encodeWav(audio), `mutilities-${timestamp()}.wav`);
}

function encodeWav(audio) {
    const channels = Math.min(2, audio.numberOfChannels);
    const frames = audio.length;
    const bytesPerSample = 2;
    const dataSize = frames * channels * bytesPerSample;
    const view = new DataView(new ArrayBuffer(44 + dataSize));

    const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    text(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, channels, true);
    view.setUint32(24, audio.sampleRate, true);
    view.setUint32(28, audio.sampleRate * channels * bytesPerSample, true);
    view.setUint16(32, channels * bytesPerSample, true);
    view.setUint16(34, 8 * bytesPerSample, true);
    text(36, 'data');
    view.setUint32(40, dataSize, true);

    const data = Array.from({ length: channels }, (_, c) => audio.getChannelData(c));
    let offset = 44;
    for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channels; c++) {
            const s = Math.max(-1, Math.min(1, data[c][i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            offset += bytesPerSample;
        }
    }
    return new Blob([view], { type: 'audio/wav' });
}
