const API_BASE_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generate-melody');
    const resultDiv = document.getElementById('melody-result');
    
    if (generateButton) {
        generateButton.addEventListener('click', async () => {
            try {
                generateButton.disabled = true;
                generateButton.textContent = 'Generating...';
                
                const response = await fetch(`${API_BASE_URL}/melody/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                resultDiv.innerHTML = `
                    <div class="success">
                        <h4>Generated Melody:</h4>
                        <pre>${JSON.stringify(data, null, 2)}</pre>
                    </div>
                `;
                resultDiv.classList.add('show');
                
            } catch (error) {
                resultDiv.innerHTML = `<div class="error">Failed to generate melody: ${error.message}</div>`;
                resultDiv.classList.add('show');
            } finally {
                generateButton.disabled = false;
                generateButton.textContent = 'Generate Melody';
            }
        });
    }
});
