let idCounter = 0;

export function uid(prefix = 'id') {
    idCounter += 1;
    return `${prefix}-${idCounter}`;
}

/**
 * Create an element. Special props: class (string or array, falsy entries
 * dropped), style (object, "--x" keys work), dataset, on (event listeners)
 * and text. Anything else becomes an attribute; null/false props and
 * children are skipped.
 */
export function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);

    for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined || value === false) continue;

        switch (key) {
            case 'class':
                node.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : value);
                break;
            case 'style':
                for (const [prop, v] of Object.entries(value)) {
                    node.style.setProperty(prop, String(v));
                }
                break;
            case 'dataset':
                for (const [name, v] of Object.entries(value)) {
                    if (v !== null && v !== undefined && v !== false) {
                        node.dataset[name] = v === true ? '' : String(v);
                    }
                }
                break;
            case 'on':
                for (const [event, handler] of Object.entries(value)) {
                    node.addEventListener(event, handler);
                }
                break;
            case 'text':
                node.textContent = String(value);
                break;
            default:
                node.setAttribute(key, value === true ? '' : String(value));
        }
    }

    append(node, children);
    return node;
}

function append(parent, children) {
    for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        if (Array.isArray(child)) {
            append(parent, child);
        } else {
            parent.append(child instanceof Node ? child : String(child));
        }
    }
}

/** Collect elements marked data-ref="name" inside root, keyed by name */
export function refs(root) {
    const found = {};
    root.querySelectorAll('[data-ref]').forEach(node => {
        found[node.dataset.ref] = node;
    });
    return found;
}

export function toggleData(node, name, on) {
    if (on) {
        node.dataset[name] = '';
    } else {
        delete node.dataset[name];
    }
}

export function setOptions(select, options, value) {
    select.replaceChildren(...options.map(o => el('option', { value: o.value, text: o.label })));
    if (value !== undefined) select.value = value;
}
