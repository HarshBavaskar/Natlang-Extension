(function() {
    const vscode = acquireVsCodeApi();
    const streamCard = document.getElementById('stream-card');
    const streamContent = document.getElementById('code-content');
    const languageButtons = document.querySelectorAll('.lang-btn');
    const providerButtons = document.querySelectorAll('.core-btn');
    const systemState = document.getElementById('system-state');
    const progressContainer = document.getElementById('progress-container');
    const progressBarFill = document.getElementById('progress-bar-fill');

    let isProcessing = false;
    let tokensReceived = 0;

    languageButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            languageButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            vscode.postMessage({ type: 'changeLanguage', language: btn.dataset.value });
        });
    });

    providerButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            providerButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            vscode.postMessage({ type: 'changeProvider', provider: btn.dataset.value });
        });
    });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'token':
                if (!isProcessing) {
                    startProcessing();
                }
                tokensReceived++;
                updateProgress(tokensReceived);
                streamContent.textContent += message.text;
                // Auto scroll
                const streamBox = streamCard.querySelector('.stream-box');
                streamBox.scrollTop = streamBox.scrollHeight;
                break;
            case 'done':
                finishProcessing();
                break;
            case 'error':
                handleError(message.message);
                break;
            case 'clear':
                resetUI();
                break;
        }
    });

    function startProcessing() {
        isProcessing = true;
        tokensReceived = 0;
        systemState.textContent = 'TRANSFORMING';
        systemState.style.color = '#fff';
        progressBarFill.style.width = '0%';
        streamCard.style.display = 'flex';
        streamContent.textContent = '';
        updateProgress(0);
    }

    function updateProgress(tokens) {
        const percent = Math.min(99, Math.floor((1 - Math.pow(0.99, tokens / 5)) * 100));
        progressBarFill.style.width = percent + '%';
    }

    function finishProcessing() {
        isProcessing = false;
        systemState.textContent = 'COMPLETED';
        systemState.style.color = '#52525b';
        progressBarFill.style.width = '100%';
        setTimeout(() => {
            if (!isProcessing) {
                systemState.textContent = 'READY';
                progressBarFill.style.width = '0%';
            }
        }, 3000);
        highlightAll();
    }

    function handleError(msg) {
        isProcessing = false;
        systemState.textContent = 'ERROR';
        systemState.style.color = '#ff4444';
        streamCard.style.display = 'flex';
        streamContent.innerHTML = `<span style="color: #ff4444; font-size: 10px;">${msg}</span>`;
    }

    function resetUI() {
        isProcessing = false;
        systemState.textContent = 'READY';
        streamCard.style.display = 'none';
        streamContent.textContent = '';
    }

    function highlightAll() {
        if (window.hljs) {
            document.querySelectorAll('pre code').forEach((el) => {
                hljs.highlightElement(el);
            });
        }
    }
}());
