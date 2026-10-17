// Patch files: a tool's settings wrapped with enough labelling to check them
// on the way back in.
//
//   { app: "mutilities", tool: "logical-drums", version: 1, savedAt: "…", settings: {…} }
//
// The same text goes to the clipboard or a .json file, so either can be
// imported from the other.

const APP = 'mutilities';

const TOOL_NAMES = {
    'in-key-assistance': 'In Key Assistance',
    'drone-synth': 'Drone Synth',
    'key-synth': 'Key Synth',
    'logical-drums': 'Logical Drums',
    'twin-turing': 'Twin Turing',
};

export class PatchError extends Error {}

export function patchText(tool, version, settings) {
    const patch = { app: APP, tool, version, savedAt: new Date().toISOString(), settings };
    return JSON.stringify(patch, null, 2);
}

/** Returns the settings, or throws a PatchError with a message fit to show */
export function readPatch(text, tool, version) {
    let patch;
    try {
        patch = JSON.parse(text);
    } catch {
        throw new PatchError("That doesn't look like a mUtilities patch.");
    }
    if (!patch || patch.app !== APP || typeof patch.settings !== 'object' || !patch.settings) {
        throw new PatchError("That doesn't look like a mUtilities patch.");
    }
    if (patch.tool !== tool) {
        const name = TOOL_NAMES[patch.tool] ?? 'another tool';
        throw new PatchError(`That's a ${name} patch. Open ${name} to load it.`);
    }
    if (typeof patch.version !== 'number' || patch.version > version) {
        throw new PatchError('That patch was saved by a newer version. Reload the page and try again.');
    }
    return patch.settings;
}

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Older or locked-down browsers: copy via a temporary selection
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
    }
}

/** Resolves with the clipboard text, or null if the browser won't allow reading it */
export async function readClipboard() {
    try {
        if (!navigator.clipboard?.readText) return null;
        return await navigator.clipboard.readText();
    } catch {
        return null;
    }
}
