(function() {
    const vscode = acquireVsCodeApi();
    const languageButtons = document.querySelectorAll('.lang-btn');
    const providerButtons = document.querySelectorAll('.core-btn');
    const collapseToggles = document.querySelectorAll('.collapse-toggle');
    const systemState = document.getElementById('system-state');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const agenticInsert = document.getElementById('agentic-insert');
    const agenticCode = document.getElementById('agentic-code');
    const agenticEmpty = document.getElementById('agentic-empty');
    const optimizedSection = document.getElementById('optimized-section');
    const summarySection = document.getElementById('summary-section');
    const betterSection = document.getElementById('better-section');
    const summaryContent = document.getElementById('summary-content');
    const betterContent = document.getElementById('better-content');
    const agenticTime = document.getElementById('agentic-time');
    const agenticSpace = document.getElementById('agentic-space');
    const agenticActionButtons = document.querySelectorAll('.agentic-action-btn');
    const providerRuntimeList = document.getElementById('provider-runtime-list');
    const providerRuntimeMessage = document.getElementById('provider-runtime-message');
    const providerRuntimeRefresh = document.getElementById('provider-runtime-refresh');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const xtermBox = document.querySelector('.xterm-box');

    let isProcessing = false;
    let tokensReceived = 0;
    let lastAgenticAction = 'auto';

    languageButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            languageButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            vscode.postMessage({ type: 'changeLanguage', language: btn.dataset.value });
        });
    });

    collapseToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            const panel = document.getElementById(btn.dataset.target);
            if (!panel) {
                return;
            }
            const isOpen = panel.classList.toggle('open');
            const chevron = btn.querySelector('.chevron');
            if (chevron) {
                chevron.textContent = isOpen ? '▾' : '▸';
            }
        });
    });

    agenticActionButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            lastAgenticAction = btn.dataset.action || 'auto';
            setActiveActionButton(lastAgenticAction);
            vscode.postMessage({
                type: 'runAgentic',
                action: lastAgenticAction,
                prompt: ''
            });
        });
    });

    if (agenticInsert) {
        agenticInsert.addEventListener('click', () => {
            vscode.postMessage({ type: 'insertAgenticCode' });
        });
    }

    if (providerRuntimeRefresh) {
        providerRuntimeRefresh.addEventListener('click', () => {
            if (providerRuntimeMessage) {
                providerRuntimeMessage.textContent = 'Refreshing provider status...';
            }
            vscode.postMessage({ type: 'refreshProviderRuntime' });
        });
    }

    if (settingsToggle && settingsPanel) {
        settingsToggle.addEventListener('click', () => {
            const isOpen = settingsPanel.classList.contains('open');
            if (isOpen) {
                settingsPanel.classList.remove('open');
                settingsToggle.classList.remove('active');
                setTimeout(() => {
                    if (!settingsPanel.classList.contains('open')) {
                        settingsPanel.classList.add('hidden');
                    }
                }, 260);
                return;
            }

            settingsPanel.classList.remove('hidden');
            requestAnimationFrame(() => {
                settingsPanel.classList.add('open');
                settingsToggle.classList.add('active');
            });
        });
    }

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
                appendTokenOutput(message.text || '');
                break;
            case 'done':
                finishProcessing();
                break;
            case 'agenticStart':
                hideAgenticSections();
                if (agenticEmpty) {
                    agenticEmpty.textContent = 'Agentic AI is processing...';
                }
                if (agenticTime) {
                    agenticTime.textContent = 'Time: -';
                }
                if (agenticSpace) {
                    agenticSpace.textContent = 'Space: -';
                }
                break;
            case 'agenticDone':
                renderAgenticResult(message.result);
                break;
            case 'agenticError':
                hideAgenticSections();
                if (summaryContent) {
                    summaryContent.textContent = message.message || 'Agentic AI failed.';
                }
                showSection(summarySection);
                break;
            case 'selectionState':
                renderSelectionState(message);
                break;
            case 'providerRuntime':
                renderProviderRuntime(message.runtime);
                break;
            case 'providerRuntimeError':
                if (providerRuntimeMessage) {
                    providerRuntimeMessage.textContent = message.message || 'Provider runtime unavailable.';
                }
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
        setGeneratingState(true);
        systemState.textContent = 'TRANSFORMING';
        systemState.style.color = '#fff';
        progressBarFill.style.width = '0%';
        hideAgenticSections();
        if (agenticCode) {
            agenticCode.textContent = '';
        }
        showSection(optimizedSection);
        updateProgress(0);
    }

    function updateProgress(tokens) {
        const percent = Math.min(99, Math.floor((1 - Math.pow(0.99, tokens / 5)) * 100));
        progressBarFill.style.width = percent + '%';
    }

    function finishProcessing() {
        isProcessing = false;
        setGeneratingState(false);
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

    function renderAgenticResult(result) {
        if (!result) {
            return;
        }
        const normalizedCode = decodeEscapedSymbols(result.finalCode || result.optimizedCode || '');
        const hasCodeOutput = Boolean(normalizedCode);
        const explanation = (result.explanation || '').trim();
        const suggestions = (result.suggestions || '').trim();

        hideAgenticSections();

        if (agenticCode) {
            agenticCode.textContent = normalizedCode;
        }

        if (hasCodeOutput) {
            showSection(optimizedSection);
        }

        if (lastAgenticAction === 'summarize') {
            if (summaryContent) {
                summaryContent.textContent = explanation || 'No summary generated.';
            }
            showSection(summarySection);
        } else if (lastAgenticAction === 'better') {
            if (betterContent) {
                betterContent.textContent = explanation || suggestions || 'No better-code guidance generated.';
            }
            showSection(betterSection);
        }

        if (agenticTime) {
            agenticTime.textContent = `Time: ${result.timeComplexity || '-'}`;
        }
        if (agenticSpace) {
            agenticSpace.textContent = `Space: ${result.spaceComplexity || '-'}`;
        }
        highlightAll();
    }

    function handleError(msg) {
        isProcessing = false;
        setGeneratingState(false);
        systemState.textContent = 'ERROR';
        systemState.style.color = '#ff4444';
        hideAgenticSections();
        if (summaryContent) {
            summaryContent.textContent = msg || 'Request failed.';
        }
        showSection(summarySection);
    }

    function renderSelectionState(message) {
        return;
    }

    function renderProviderRuntime(runtime) {
        if (!providerRuntimeList) {
            return;
        }

        providerRuntimeList.innerHTML = '';
        if (providerRuntimeMessage) {
            providerRuntimeMessage.textContent = runtime && runtime.length ? 'Runtime loaded.' : 'No providers reported.';
        }

        if (!runtime || !runtime.length) {
            providerRuntimeList.innerHTML = '<div class="provider-runtime-empty">No provider runtime data.</div>';
            return;
        }

        runtime.forEach(item => {
            const row = document.createElement('div');
            row.className = `provider-runtime-row ${item.reachable ? 'ok' : 'bad'}`;
            row.innerHTML = `
                <div class="provider-runtime-main">
                    <span class="provider-runtime-name">${item.provider}</span>
                    <span class="provider-runtime-model">${item.model || 'n/a'}</span>
                </div>
                <div class="provider-runtime-status">${item.configured ? 'configured' : 'missing key'} · ${item.reachable ? 'reachable' : 'down'}</div>
                <div class="provider-runtime-detail">${item.detail || ''}</div>
            `;
            providerRuntimeList.appendChild(row);
        });
    }

    function resetUI() {
        isProcessing = false;
        setGeneratingState(false);
        systemState.textContent = 'READY';
        if (agenticCode) {
            agenticCode.textContent = '';
        }
        if (agenticTime) {
            agenticTime.textContent = 'Time: -';
        }
        if (agenticSpace) {
            agenticSpace.textContent = 'Space: -';
        }
        hideAgenticSections();
    }

    function appendTokenOutput(text) {
        if (!text) {
            return;
        }
        if (agenticCode) {
            if (optimizedSection && optimizedSection.classList.contains('hidden')) {
                showSection(optimizedSection);
            }
            agenticCode.textContent += decodeEscapedSymbols(text);
            const container = agenticCode.closest('.stream-box');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }
    }

    function decodeEscapedSymbols(text) {
        return (text || '')
            .replace(/\\u003c/gi, '<')
            .replace(/\\u003e/gi, '>')
            .replace(/\\u003d/gi, '=')
            .replace(/\\u0026/gi, '&')
            .replace(/u003c/gi, '<')
            .replace(/u003e/gi, '>')
            .replace(/u003d/gi, '=')
            .replace(/u0026/gi, '&');
    }

    function hideAgenticSections() {
        if (agenticEmpty) {
            agenticEmpty.textContent = 'Run an action to see output.';
            agenticEmpty.classList.remove('hidden');
        }
        if (optimizedSection) {
            optimizedSection.classList.add('hidden');
        }
        if (summarySection) {
            summarySection.classList.add('hidden');
        }
        if (betterSection) {
            betterSection.classList.add('hidden');
        }
        if (summaryContent) {
            summaryContent.textContent = '';
        }
        if (betterContent) {
            betterContent.textContent = '';
        }
    }

    function showSection(section) {
        if (!section) {
            return;
        }
        section.classList.remove('hidden');
        if (agenticEmpty) {
            agenticEmpty.classList.add('hidden');
        }
    }

    function setActiveActionButton(action) {
        agenticActionButtons.forEach((button) => {
            const active = (button.dataset.action || 'auto') === action;
            button.classList.toggle('active', active);
        });
    }

    function setGeneratingState(active) {
        document.body.classList.toggle('is-generating', active);
        if (xtermBox) {
            xtermBox.classList.toggle('is-generating', active);
        }
    }

    function highlightAll() {
        if (window.hljs) {
            document.querySelectorAll('pre code').forEach((el) => {
                hljs.highlightElement(el);
            });
        }
    }
}());
