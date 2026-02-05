// ===== State Management =====
const state = {
    selectedFiles: [],
    selectedPreset: '9:16',
    customWidth: 1920,
    customHeight: 1080,
    quality: 100,
    upscaleMode: 'free', // 'free', 'leonardo', or 'fal'
    leonardoKey: localStorage.getItem('leonardo_api_key') || '',
    falKey: localStorage.getItem('fal_api_key') || ''
};

// ===== DOM Elements =====
const elements = {
    imageInput: document.getElementById('imageInput'),
    selectImagesBtn: document.getElementById('selectImagesBtn'),
    fileCount: document.getElementById('fileCount'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    customDimensions: document.getElementById('customDimensions'),
    customWidth: document.getElementById('customWidth'),
    customHeight: document.getElementById('customHeight'),
    qualitySlider: document.getElementById('quality'),
    qualityValue: document.getElementById('qualityValue'),
    processBtn: document.getElementById('processBtn'),
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    progressPercentage: document.getElementById('progressPercentage'),
    resultsContainer: document.getElementById('resultsContainer'),
    resultsText: document.getElementById('resultsText'),
    resetBtn: document.getElementById('resetBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    leonardoKeyInput: document.getElementById('leonardoKeyInput'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
    modeOptions: document.querySelectorAll('.mode-option'),
    apiWarning: document.getElementById('apiWarning'),
    openSettingsLink: document.getElementById('openSettingsLink')
};

// ===== Toast Notification =====
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== Settings Modal =====
function openSettings() {
    elements.settingsModal.style.display = 'flex';
    elements.leonardoKeyInput.value = state.leonardoKey;
    elements.apiKeyInput.value = state.falKey;
}

function closeSettings() {
    elements.settingsModal.style.display = 'none';
}

function saveApiKeys() {
    const leonardoKey = elements.leonardoKeyInput.value.trim();
    const falKey = elements.apiKeyInput.value.trim();

    state.leonardoKey = leonardoKey;
    state.falKey = falKey;

    localStorage.setItem('leonardo_api_key', leonardoKey);
    localStorage.setItem('fal_api_key', falKey);

    closeSettings();
    showToast('Đã lưu API Keys!', 'success');
    updateApiWarning();
}

function updateApiWarning() {
    const needsKey = (state.upscaleMode === 'leonardo' && !state.leonardoKey) ||
        (state.upscaleMode === 'fal' && !state.falKey);
    elements.apiWarning.style.display = needsKey ? 'flex' : 'none';
}

// ===== Event Listeners =====
elements.selectImagesBtn.addEventListener('click', () => elements.imageInput.click());

elements.imageInput.addEventListener('change', (e) => {
    state.selectedFiles = Array.from(e.target.files);
    updateFileCount();
    updateProcessButton();
});

elements.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        elements.presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedPreset = btn.dataset.preset;
        elements.customDimensions.style.display = btn.dataset.preset === 'custom' ? 'grid' : 'none';
    });
});

elements.customWidth.addEventListener('input', (e) => state.customWidth = parseInt(e.target.value) || 1920);
elements.customHeight.addEventListener('input', (e) => state.customHeight = parseInt(e.target.value) || 1080);

elements.qualitySlider.addEventListener('input', (e) => {
    state.quality = parseInt(e.target.value);
    elements.qualityValue.textContent = `${state.quality}%`;
});

elements.processBtn.addEventListener('click', processImages);
elements.resetBtn.addEventListener('click', resetApp);

elements.settingsBtn.addEventListener('click', openSettings);
elements.closeSettingsBtn.addEventListener('click', closeSettings);
elements.saveApiKeyBtn.addEventListener('click', saveApiKeys);
elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) closeSettings();
});

elements.modeOptions.forEach(option => {
    option.addEventListener('click', () => {
        elements.modeOptions.forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        state.upscaleMode = option.dataset.mode;
        updateApiWarning();
    });
});

if (elements.openSettingsLink) {
    elements.openSettingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        openSettings();
    });
}

// ===== Functions =====
function updateFileCount() {
    const count = state.selectedFiles.length;
    if (count === 0) {
        elements.fileCount.textContent = 'Chưa chọn ảnh nào';
    } else if (count === 1) {
        elements.fileCount.textContent = `Đã chọn 1 ảnh: ${state.selectedFiles[0].name}`;
    } else {
        elements.fileCount.textContent = `Đã chọn ${count} ảnh`;
    }
}

function updateProcessButton() {
    elements.processBtn.disabled = state.selectedFiles.length === 0;
}

async function processImages() {
    if (state.selectedFiles.length === 0) return;

    if (state.upscaleMode === 'leonardo' && !state.leonardoKey) {
        showToast('Vui lòng nhập Leonardo API Key', 'warning');
        openSettings();
        return;
    }
    if (state.upscaleMode === 'fal' && !state.falKey) {
        showToast('Vui lòng nhập Fal.ai API Key', 'warning');
        openSettings();
        return;
    }

    elements.processBtn.style.display = 'none';
    elements.progressContainer.style.display = 'block';
    elements.resultsContainer.style.display = 'none';

    const totalFiles = state.selectedFiles.length;
    let processedFiles = 0;
    let usedFallback = false;

    for (let i = 0; i < state.selectedFiles.length; i++) {
        const file = state.selectedFiles[i];
        elements.progressText.textContent = `Đang xử lý: ${file.name}`;

        try {
            if (state.upscaleMode === 'fal') {
                try {
                    await processWithFal(file);
                } catch (err) {
                    console.warn('Fal failed:', err);
                    usedFallback = true;
                    await processWithFree(file);
                }
            } else if (state.upscaleMode === 'leonardo') {
                // Leonardo không hỗ trợ browser, dùng Free với thông báo
                showToast('Leonardo chỉ hỗ trợ server-side, đang dùng Free mode', 'warning');
                await processWithFree(file);
                usedFallback = true;
            } else {
                await processWithFree(file);
            }
            processedFiles++;
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
        }

        const percentage = Math.round(((i + 1) / totalFiles) * 100);
        elements.progressFill.style.width = `${percentage}%`;
        elements.progressPercentage.textContent = `${percentage}%`;
    }

    setTimeout(() => {
        elements.progressContainer.style.display = 'none';
        elements.resultsContainer.style.display = 'block';
        let resultMessage = `Đã xử lý thành công ${processedFiles} ảnh`;
        if (usedFallback) {
            resultMessage += ' (Đã dùng chế độ Free do AI không khả dụng)';
        }
        elements.resultsText.textContent = resultMessage;
    }, 500);
}

// ===== Free Mode: Enhanced Browser Sharpening =====
async function processWithFree(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => { img.src = e.target.result; };

        img.onload = () => {
            try {
                const dimensions = calculateDimensions(img.width, img.height);
                const canvas = document.createElement('canvas');
                canvas.width = dimensions.width;
                canvas.height = dimensions.height;
                const ctx = canvas.getContext('2d');

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                const scale = Math.max(dimensions.width / img.width, dimensions.height / img.height);
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                const offsetX = (dimensions.width - scaledWidth) / 2;
                const offsetY = (dimensions.height - scaledHeight) / 2;

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, dimensions.width, dimensions.height);
                ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

                // Apply enhanced sharpening
                applyEnhancedSharpening(ctx, dimensions.width, dimensions.height);

                const originalName = file.name.replace(/\.[^/.]+$/, '');
                const fileName = `${originalName}_${getPresetSuffix()}_enhanced.jpg`;

                canvas.toBlob((blob) => {
                    if (blob) {
                        downloadFile(blob, fileName);
                        resolve();
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                }, 'image/jpeg', state.quality / 100);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        reader.readAsDataURL(file);
    });
}

// ===== Fal.ai Mode using fal client =====
async function processWithFal(file) {
    return new Promise(async (resolve, reject) => {
        try {
            // Check if fal client is available
            if (typeof fal === 'undefined') {
                throw new Error('Fal client not loaded');
            }

            const img = new Image();
            const reader = new FileReader();

            reader.onload = async (e) => { img.src = e.target.result; };

            img.onload = async () => {
                try {
                    const dimensions = calculateDimensions(img.width, img.height);
                    const canvas = document.createElement('canvas');
                    canvas.width = dimensions.width;
                    canvas.height = dimensions.height;
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    const scale = Math.max(dimensions.width / img.width, dimensions.height / img.height);
                    const scaledWidth = img.width * scale;
                    const scaledHeight = img.height * scale;
                    const offsetX = (dimensions.width - scaledWidth) / 2;
                    const offsetY = (dimensions.height - scaledHeight) / 2;

                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
                    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

                    const base64Image = canvas.toDataURL('image/jpeg', 0.95);

                    // Configure fal client
                    fal.config({
                        credentials: state.falKey
                    });

                    // Use fal.subscribe for the request
                    const result = await fal.subscribe('fal-ai/real-esrgan', {
                        input: {
                            image_url: base64Image,
                            scale: 2
                        }
                    });

                    if (result.image?.url) {
                        const upscaledResponse = await fetch(result.image.url);
                        const blob = await upscaledResponse.blob();

                        const originalName = file.name.replace(/\.[^/.]+$/, '');
                        const fileName = `${originalName}_${getPresetSuffix()}_AI_upscaled.jpg`;

                        downloadFile(blob, fileName);
                        resolve();
                    } else {
                        throw new Error('Invalid API response');
                    }
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            reader.readAsDataURL(file);
        } catch (error) {
            reject(error);
        }
    });
}

// ===== Enhanced Sharpening (Unsharp Mask + Contrast) =====
function applyEnhancedSharpening(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const original = new Uint8ClampedArray(data);

    // Stronger sharpening
    const sharpenAmount = 0.6;
    const contrastAmount = 1.1;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            for (let c = 0; c < 3; c++) {
                const center = original[idx + c];
                const left = original[idx - 4 + c];
                const right = original[idx + 4 + c];
                const top = original[(idx - width * 4) + c];
                const bottom = original[(idx + width * 4) + c];

                // Laplacian edge detection
                const laplacian = 4 * center - left - right - top - bottom;

                // Apply sharpening
                let value = center + sharpenAmount * laplacian;

                // Apply slight contrast boost
                value = ((value - 128) * contrastAmount) + 128;

                data[idx + c] = Math.max(0, Math.min(255, value));
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function calculateDimensions(originalWidth, originalHeight) {
    if (state.selectedPreset === '9:16') {
        return { width: 1080, height: 1920 };
    } else if (state.selectedPreset === '16:9') {
        return { width: 1920, height: 1080 };
    } else {
        return { width: state.customWidth, height: state.customHeight };
    }
}

function getPresetSuffix() {
    if (state.selectedPreset === '9:16') return '9x16';
    if (state.selectedPreset === '16:9') return '16x9';
    return `${state.customWidth}x${state.customHeight}`;
}

function downloadFile(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function resetApp() {
    state.selectedFiles = [];
    // Keep the same preset, don't reset
    state.quality = 100;

    elements.imageInput.value = '';
    updateFileCount();
    updateProcessButton();

    // Don't reset preset selection

    elements.qualitySlider.value = 100;
    elements.qualityValue.textContent = '100%';

    elements.processBtn.style.display = 'flex';
    elements.progressContainer.style.display = 'none';
    elements.resultsContainer.style.display = 'none';

    elements.progressFill.style.width = '0%';
    elements.progressPercentage.textContent = '0%';

    // Directly open file picker
    setTimeout(() => elements.imageInput.click(), 100);
}

// ===== Initialize =====
updateProcessButton();
updateApiWarning();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(err => console.log('SW registration failed:', err));
}
