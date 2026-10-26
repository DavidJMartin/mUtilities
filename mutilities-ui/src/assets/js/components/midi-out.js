// MIDI out controls for a melodic tool: pick an output, a channel, and whether
// the tool's own synth keeps playing. The same three controls on every tool;
// the tool's engine sends notes through its MidiSender (core/midi-out.js).

import { el } from '../core/dom.js';
import { midiOut } from '../core/midi-out.js';
import { createSelect, createStepper, createSwitch } from './controls.js';
import { showToast } from './toast.js';

const OFF = 'off';

/**
 * sender: the tool's MidiSender. channelHint: shown by Channel, e.g. "B on the
 * next" for a tool with a second melody.
 */
export function createMidiOutControls(sender, { channelHint } = {}) {
    const root = el('div', { class: 'midi-out' });

    if (!midiOut.supported) {
        root.append(el('p', { class: 'midi-out__note meta', text: 'MIDI out works in Chrome, Edge and Firefox (not Safari).' }));
        return root;
    }

    const connect = el('button', {
        class: 'btn btn--outline midi-out__connect',
        type: 'button',
        text: 'Connect MIDI',
        on: {
            click: async () => {
                const ok = await midiOut.enable();
                if (!ok) showToast("MIDI wasn't allowed. Check the site's permissions in the browser.", { error: true });
            },
        },
    });

    const device = createSelect({
        label: 'MIDI out',
        options: [],
        value: OFF,
        onChange: v => sender.set({ outputId: v === OFF ? null : v }),
    });

    const channel = createStepper({
        label: 'Channel',
        hint: channelHint,
        onStep: (dir) => {
            const next = sender.settings.channel + dir;
            if (next >= 1 && next <= 16) sender.set({ channel: next });
        },
    });

    const synth = createSwitch({
        label: 'Keep playing the built-in synth as well',
        checked: sender.settings.synth,
        small: true,
        onChange: on => sender.set({ synth: on }),
    });
    const synthField = el('label', { class: 'field midi-out__synth' },
        el('span', { class: 'field__label', text: 'Synth too' }),
        synth.el
    );

    const empty = el('p', { class: 'midi-out__note meta', text: 'No MIDI outputs found. Connect a device, or on a Mac turn on the IAC Driver in Audio MIDI Setup.' });

    root.append(connect, device.el, channel.el, synthField, empty);

    function render() {
        const enabled = midiOut.enabled;
        const outputs = midiOut.outputs();
        connect.hidden = enabled;
        device.el.hidden = !enabled;
        empty.hidden = !enabled || outputs.length > 0;
        if (enabled) {
            const chosen = outputs.some(o => o.id === sender.settings.outputId) ? sender.settings.outputId : OFF;
            device.setOptions([{ value: OFF, label: 'Off' }, ...outputs.map(o => ({ value: o.id, label: o.name }))], chosen);
        }
        // Channel and synth only matter while sending
        channel.el.hidden = !sender.active;
        synthField.hidden = !sender.active;
        channel.set(String(sender.settings.channel));
        synth.set(sender.settings.synth);
    }

    midiOut.onChange(render);
    sender.onChange(render);
    render();

    // Already allowed on an earlier visit: reconnect without a prompt
    navigator.permissions?.query({ name: 'midi' })
        .then((status) => { if (status.state === 'granted') midiOut.enable(); })
        .catch(() => {});

    return root;
}
