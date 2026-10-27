// With no saved preference the page follows the OS via color-scheme in CSS.
// Choosing a theme pins it with data-theme on <html> and saves it; an inline
// script in index.html re-applies it before first paint to avoid a flash.

const STORAGE_KEY = 'mutilities-theme';
// The browser bar colour (phones) per theme, matching --page in tokens.css
const THEME_COLOURS = { light: '#fbfbfa', dark: '#151515' };

function syncThemeColour() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLOURS[currentTheme()];
}
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function storeTheme(theme) {
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // Storage can be unavailable (private mode, blocked site data); the
        // choice then just lasts for this page view.
    }
}

export function currentTheme() {
    const pinned = document.documentElement.dataset.theme;
    if (pinned === 'light' || pinned === 'dark') return pinned;
    return systemDark.matches ? 'dark' : 'light';
}

export function initTheme() {
    const toggles = document.querySelectorAll('[data-theme-toggle]');

    const render = () => {
        const theme = currentTheme();
        const next = theme === 'dark' ? 'light' : 'dark';
        const nextLabel = next === 'dark' ? 'Dark' : 'Light';

        toggles.forEach(button => {
            button.setAttribute('aria-label', `Switch to ${next} theme`);
            const label = button.querySelector('[data-theme-label]');
            if (label) label.textContent = nextLabel;
        });

        syncThemeColour();
    };

    toggles.forEach(button => {
        button.addEventListener('click', () => {
            const next = currentTheme() === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            storeTheme(next);
            render();
        });
    });

    // Keep the label right if the OS theme changes while we're following it
    systemDark.addEventListener('change', render);

    render();
}
