// Saving files from the browser: timestamped names so repeated exports never
// clash, and a download helper.

/** Local time as 20261012-193045 */
export function timestamp(date = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
        + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ask for a file and resolve with its text, or null if the picker is cancelled */
export function pickTextFile(accept) {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) return resolve(null);
            file.text().then(resolve, reject);
        });
        // Fires in current browsers when the picker is closed without a file
        input.addEventListener('cancel', () => resolve(null));
        input.click();
    });
}
