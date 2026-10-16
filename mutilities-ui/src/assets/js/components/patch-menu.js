// Export ▾ / Import ▾ for a tool's settings. Export copies the patch to the
// clipboard or saves a .json file; Import reads either back.
//
// Reading the clipboard needs the browser's permission (Chrome asks once,
// Safari and Firefox show a small "Paste" bubble). If that's refused, a small
// paste dialog opens instead: the one place a text box is used, as a fallback.

import { el } from '../core/dom.js';
import { downloadBlob, pickTextFile, timestamp } from '../core/files.js';
import { PatchError, copyText, patchText, readClipboard, readPatch } from '../core/patch-io.js';
import { showToast } from './toast.js';

/**
 * tool: id used in the file and filename (e.g. "logical-drums")
 * version: bump when the settings shape changes incompatibly
 * getSettings(): plain object for the current state
 * applySettings(settings): load them; throw if they can't be used
 */
export function createPatchMenu({ tool, version, getSettings, applySettings }) {
    let openMenu = null;

    const close = () => {
        if (!openMenu) return;
        openMenu.button.setAttribute('aria-expanded', 'false');
        openMenu.list.hidden = true;
        openMenu = null;
    };

    const menu = (label, items) => {
        const list = el('div', { class: 'patch-menu__list', role: 'menu', hidden: true },
            items.map(([text, action]) => el('button', {
                class: 'patch-menu__item',
                type: 'button',
                role: 'menuitem',
                text,
                on: { click: () => { close(); action(); } },
            }))
        );
        const button = el('button', {
            class: 'patch-menu__button',
            type: 'button',
            'aria-haspopup': 'true',
            'aria-expanded': 'false',
            on: {
                click: () => {
                    const wasOpen = openMenu?.list === list;
                    close();
                    if (wasOpen) return;
                    list.hidden = false;
                    button.setAttribute('aria-expanded', 'true');
                    openMenu = { button, list };
                },
            },
        }, el('span', { text: label }), el('span', { 'aria-hidden': 'true', text: '↓' }));
        return el('div', { class: 'patch-menu__anchor' }, button, list);
    };

    const text = () => patchText(tool, version, getSettings());

    const load = (raw) => {
        try {
            applySettings(readPatch(raw, tool, version));
            showToast('Patch loaded');
        } catch (error) {
            showToast(error instanceof PatchError ? error.message : "Couldn't load that patch.", { error: true });
        }
    };

    const root = el('div', { class: 'patch-menu', role: 'group', 'aria-label': 'Save or load settings' },
        menu('Export', [
            ['Copy to clipboard', async () => {
                const ok = await copyText(text());
                showToast(ok ? 'Copied to clipboard' : "Couldn't copy. Try saving a file instead.", { error: !ok });
            }],
            ['Save as file', () => {
                downloadBlob(new Blob([text()], { type: 'application/json' }), `${tool}-${timestamp()}.json`);
            }],
        ]),
        menu('Import', [
            ['Paste from clipboard', async () => {
                const raw = await readClipboard();
                if (raw === null) {
                    openPasteDialog(load);
                } else {
                    load(raw);
                }
            }],
            ['Open file…', async () => {
                try {
                    const raw = await pickTextFile('.json,application/json');
                    if (raw !== null) load(raw);
                } catch {
                    showToast("Couldn't read that file.", { error: true });
                }
            }],
        ])
    );

    document.addEventListener('pointerdown', (event) => {
        if (openMenu && !root.contains(event.target)) close();
    });
    document.addEventListener('keydown', (event) => {
        if (openMenu && event.key === 'Escape') close();
    });

    return root;
}

// Fallback when the clipboard can't be read directly
let dialog = null;

function openPasteDialog(onLoad) {
    if (!dialog) {
        const area = el('textarea', {
            class: 'paste-dialog__area',
            'aria-label': 'Patch',
            rows: 6,
            spellcheck: 'false',
        });
        const load = el('button', { class: 'btn btn--ink', type: 'submit', text: 'Load patch' });
        const cancel = el('button', { class: 'btn btn--outline', type: 'button', text: 'Cancel', on: { click: () => dialog.close() } });

        dialog = el('dialog', { class: 'paste-dialog' },
            el('form', {
                method: 'dialog',
                class: 'paste-dialog__form',
                on: {
                    submit: () => {
                        if (area.value.trim()) dialog.onLoad(area.value);
                    },
                },
            },
                el('h2', { class: 'panel__title', text: 'Paste a patch' }),
                el('p', { class: 'paste-dialog__hint', text: 'Your browser didn’t allow reading the clipboard. Paste the patch here instead.' }),
                area,
                el('div', { class: 'paste-dialog__actions' }, cancel, load)
            )
        );
        dialog.area = area;
        document.body.append(dialog);
    }
    dialog.onLoad = onLoad;
    dialog.area.value = '';
    dialog.showModal();
    dialog.area.focus();
}
