// Space plays/stops the current page's tool, like a DAW's transport, rather
// than the browser default of pressing whichever button was clicked last.
//
// It listens in the capture phase so it runs before controls with their own
// Space handling (e.g. steppers), and also swallows the matching keyup, which
// is when browsers "click" a focused button.

// Places where Space should still type or open a menu
const isTyping = target => target.matches?.(
    'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), select, textarea, [contenteditable]'
);

const isSpace = event => event.code === 'Space' || event.key === ' ';

export function bindSpaceToPlay(router, pageId, playButton) {
    let swallowKeyUp = false;

    window.addEventListener('keydown', (event) => {
        if (!isSpace(event) || router.current() !== pageId) return;
        if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;

        event.preventDefault();
        event.stopPropagation();
        swallowKeyUp = true;
        if (!event.repeat) playButton.click();
    }, { capture: true });

    window.addEventListener('keyup', (event) => {
        if (!isSpace(event) || !swallowKeyUp) return;
        swallowKeyUp = false;
        event.preventDefault();
        event.stopPropagation();
    }, { capture: true });
}
