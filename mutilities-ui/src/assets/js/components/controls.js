// Each factory returns { el, set } so callers can push a new value in
// (e.g. after randomising) without rebuilding the control.

import { el, uid, setOptions } from '../core/dom.js';

export function createSlider({ label, min, max, step, value, format, onInput, tone = 'accent' }) {
    const id = uid('slider');
    const output = el('output', { class: 'slider__value', for: id });
    const input = el('input', {
        class: 'slider__input',
        type: 'range',
        id,
        min,
        max,
        step,
    });

    const render = (v) => {
        const pct = Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
        input.style.setProperty('--pct', `${pct}%`);
        output.textContent = format(v);
    };

    input.addEventListener('input', () => {
        const v = Number(input.value);
        render(v);
        onInput(v);
    });

    const set = (v) => {
        input.value = String(v);
        render(v);
    };
    set(value);

    const root = el('div', { class: ['slider', tone !== 'accent' && `slider--${tone}`] },
        el('div', { class: 'slider__head' },
            el('label', { class: 'slider__label', for: id, text: label }),
            output
        ),
        input
    );

    return { el: root, set };
}

export function createSwitch({ label, checked, onChange, small = false }) {
    const button = el('button', {
        class: ['switch', small && 'switch--sm'],
        type: 'button',
        role: 'switch',
        'aria-label': label,
    }, el('span', { class: 'switch__knob', 'aria-hidden': 'true' }));

    const set = (on) => button.setAttribute('aria-checked', String(on));

    button.addEventListener('click', () => {
        const next = button.getAttribute('aria-checked') !== 'true';
        set(next);
        onChange(next);
    });

    set(checked);
    return { el: button, set };
}

/** A group of toggle buttons where exactly one is pressed */
export function createSegmented({ label, options, value, onChange, small = false }) {
    const buttons = options.map(option => el('button', {
        class: 'segmented__option',
        type: 'button',
        dataset: { value: option.value },
        text: option.label,
    }));

    const set = (v) => {
        buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
    };

    const root = el('div', {
        class: ['segmented', small && 'segmented--sm'],
        role: 'group',
        'aria-label': label,
        on: {
            click: (event) => {
                const button = event.target.closest('.segmented__option');
                if (!button || button.getAttribute('aria-pressed') === 'true') return;
                set(button.dataset.value);
                onChange(button.dataset.value);
            },
        },
    }, buttons);

    set(value);
    return { el: root, set };
}

/** layout: 'field' stacks the label above, 'inline' puts it beside */
export function createSelect({ label, options, value, onChange, layout = 'field', size }) {
    const select = el('select', { on: { change: () => onChange(select.value) } });
    setOptions(select, options, value);

    const wrapper = el('span', { class: ['select', size && `select--${size}`] }, select);
    const root = el('label', { class: ['field', layout === 'inline' && 'field--inline'] },
        el('span', { class: 'field__label', text: label }),
        wrapper
    );

    return {
        el: root,
        set: (v) => { select.value = v; },
        setOptions: (opts, v) => setOptions(select, opts, v),
    };
}
