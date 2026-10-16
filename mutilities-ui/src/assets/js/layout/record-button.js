// Header Record button: tap to start recording everything the site plays, tap
// again to stop. The take isn't saved automatically: a small menu offers
// Save WAV or Discard, so a take that didn't go to plan can just be thrown
// away. It lives in the header so recording carries on while you switch tools.

import { el } from '../core/dom.js';
import { ensureAudioRunning } from '../core/audio.js';
import { isRecording, recordingSupported, saveTake, startRecording, stopRecording } from '../core/recorder.js';
import { showToast } from '../components/toast.js';

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function initRecordButton(button) {
    if (!recordingSupported()) {
        button.hidden = true;
        return;
    }

    const label = button.querySelector('.record-toggle__label');
    let timer = null;
    let startedAt = 0;
    let take = null; // the last recording, until it's saved or discarded

    // Save / Discard menu, anchored under the button
    const menu = el('div', { class: 'record-menu', role: 'menu', hidden: true },
        el('p', { class: 'record-menu__title' }),
        el('button', { class: 'record-menu__item', type: 'button', role: 'menuitem', text: 'Save WAV', on: { click: () => save() } }),
        el('button', { class: 'record-menu__item', type: 'button', role: 'menuitem', text: 'Discard', on: { click: () => discard() } })
    );
    const anchor = el('div', { class: 'record-anchor' });
    button.replaceWith(anchor);
    anchor.append(button, menu);

    const showMenu = (open) => {
        menu.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
    };

    const render = (state) => {
        button.dataset.state = state;
        button.setAttribute('aria-pressed', String(state === 'recording'));
        button.disabled = state === 'saving';
        if (state === 'idle') {
            label.textContent = 'Rec';
            button.setAttribute('aria-label', 'Start recording');
            button.removeAttribute('aria-haspopup');
            showMenu(false);
        } else if (state === 'saving') {
            label.textContent = '…';
        } else if (state === 'take') {
            label.textContent = formatTime(take.duration);
            menu.querySelector('.record-menu__title').textContent = `Recording · ${formatTime(take.duration)}`;
            button.setAttribute('aria-label', `Recording of ${label.textContent}: save or discard`);
            button.setAttribute('aria-haspopup', 'true');
        } else {
            label.textContent = formatTime((performance.now() - startedAt) / 1000);
            button.setAttribute('aria-label', `Stop recording (${label.textContent})`);
        }
    };

    const save = () => {
        saveTake(take);
        showToast(`Saved ${formatTime(take.duration)} recording`);
        take = null;
        render('idle');
    };

    const discard = () => {
        take = null;
        showToast('Recording discarded');
        render('idle');
    };

    button.addEventListener('click', async () => {
        // A take is waiting: the button reopens its menu
        if (take) {
            showMenu(menu.hidden);
            return;
        }

        if (!isRecording()) {
            await ensureAudioRunning();
            await startRecording();
            startedAt = performance.now();
            render('recording');
            timer = setInterval(() => render('recording'), 500);
            return;
        }

        clearInterval(timer);
        render('saving');
        try {
            take = await stopRecording();
            render('take');
            showMenu(true);
        } catch {
            showToast("Couldn't finish the recording.", { error: true });
            render('idle');
        }
    });

    // Clicking elsewhere closes the menu but keeps the take
    document.addEventListener('pointerdown', (event) => {
        if (!menu.hidden && !anchor.contains(event.target)) showMenu(false);
    });
    document.addEventListener('keydown', (event) => {
        if (!menu.hidden && event.key === 'Escape') showMenu(false);
    });

    render('idle');
}
