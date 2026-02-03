// ===== State Management =====
const state = {
    selectedFiles: [],
    selectedPreset: '9:16',
    customWidth: 1920,
    customHeight: 1080,
    quality: 95,
    upscaleMode: 'free', // 'free' or 'ai'
    apiKey: localStorage.getItem('fal_api_key') || ''
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
    // New elements
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
    modeOptions: document.querySelectorAll('.mode-option'),
    apiWarning: document.getElementById('apiWarning'),
    openSettingsLink: document.getElementById('openSettingsLink')
};

// ===== Toast Notification =====
function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('show'), 10);

    // Hide and remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== Settings Modal =====
function openSettings() {
    elements.settingsModal.style.display = 'flex';
    elements.apiKeyInput.value = state.apiKey;
}

function closeSettings() {
    elements.settingsModal.style.display = 'none';
}

function saveApiKey() {
    const key = elements.apiKeyInput.value.trim();
    state.apiKey = key;
    localStorage.setItem('fal_api_key', key);
    closeSettings();
    showToast('Đã lưu API Key!', 'success');
    updateApiWarning();
}

function updateApiWarning() {
    if (state.upscaleMode === 'ai' && !state.apiKey) {
        elements.apiWarning.style.display = 'flex';
    } else {
        elements.apiWarning.style.display = 'none';
    }
}

// ===== Event Listeners =====
elements.selectImagesBtn.addEventListener('click', () => {
    elements.imageInput.click();
});

elements.imageInput.addEventListener('change', (e) => {
    state.selectedFiles = Array.from(e.target.files);
    updateFileCount();
    updateProcessButton();
});

elements.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        elements.presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const preset = btn.dataset.preset;
        state.selectedPreset = preset;

        if (preset === 'custom') {
            elements.customDimensions.style.display = 'grid';
        } else {
            elements.customDimensions.style.display = 'none';
        }
    });
});

elements.customWidth.addEventListener('input', (e) => {
    state.customWidth = parseInt(e.target.value) || 1920;
});

elements.customHeight.addEventListener('input', (e) => {
    state.customHeight = parseInt(e.target.value) || 1080;
});

elements.qualitySlider.addEventListener('input', (e) => {
    state.quality = parseInt(e.target.value);
    elements.qualityValue.textContent = `${state.quality}%`;
});

elements.processBtn.addEventListener('click', processImages);
elements.resetBtn.addEventListener('click', resetApp);

// Settings modal
elements.settingsBtn.addEventListener('click', openSettings);
elements.closeSettingsBtn.addEventListener('click', closeSettings);
elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) closeSettings();
});

// Mode selector
elements.modeOptions.forEach(option => {
    option.addEventListener('click', () => {
        elements.modeOptions.forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        state.upscaleMode = option.dataset.mode;
        updateApiWarning();
    });
});

// Open settings link in warning
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

    // Check if AI mode requires API key
    if (state.upscaleMode === 'ai' && !state.apiKey) {
        showToast('Vui lòng nhập API Key để sử dụng chế độ AI', 'warning');
        openSettings();
        return;
    }

    // Hide process button and show progress
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
            if (state.upscaleMode === 'ai') {
                try {
                    await processWithAI(file);
                } catch (aiError) {
                    console.warn('AI upscale failed, falling back to free mode:', aiError);
                    usedFallback = true;
                    await processWithFree(file);
                }
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

    // Show results
    setTimeout(() => {
        elements.progressContainer.style.display = 'none';
        elements.resultsContainer.style.display = 'block';
        let resultMessage = `Đã xử lý thành công ${processedFiles} ảnh`;
        if (usedFallback) {
            resultMessage += ' (Đã dùng chế độ Free do AI không khả dụng)';
            showToast('AI không khả dụng, đã chuyển sang chế độ Free', 'warning');
        }
        elements.resultsText.textContent = resultMessage;
    }, 500);
}

// ===== Free Mode: Browser-based sharpening =====
async function processWithFree(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target.result;
        };

        img.onload = () => {
            try {
                const dimensions = calculateDimensions(img.width, img.height);

                // Create canvas for resizing
                const canvas = document.createElement('canvas');
                canvas.width = dimensions.width;
                canvas.height = dimensions.height;
                const ctx = canvas.getContext('2d');

                // High-quality rendering
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // Calculate cover crop
                const scale = Math.max(
                    dimensions.width / img.width,
                    dimensions.height / img.height
                );
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                const offsetX = (dimensions.width - scaledWidth) / 2;
                const offsetY = (dimensions.height - scaledHeight) / 2;

                // Fill background
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, dimensions.width, dimensions.height);

                // Draw image
                ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

                // Apply sharpening (Unsharp Mask)
                applySharpening(ctx, dimensions.width, dimensions.height);

                // Generate filename
                const originalName = file.name.replace(/\.[^/.]+$/, '');
                const presetSuffix = getPresetSuffix();
                const fileName = `${originalName}_${presetSuffix}_enhanced.jpg`;

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

// ===== AI Mode: Fal.ai Real-ESRGAN =====
async function processWithAI(file) {
    return new Promise(async (resolve, reject) => {
        try {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = async (e) => {
                img.src = e.target.result;
            };

            img.onload = async () => {
                try {
                    // First resize to target dimensions
                    const dimensions = calculateDimensions(img.width, img.height);
                    const canvas = document.createElement('canvas');
                    canvas.width = dimensions.width;
                    canvas.height = dimensions.height;
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    const scale = Math.max(
                        dimensions.width / img.width,
                        dimensions.height / img.height
                    );
                    const scaledWidth = img.width * scale;
                    const scaledHeight = img.height * scale;
                    const offsetX = (dimensions.width - scaledWidth) / 2;
                    const offsetY = (dimensions.height - scaledHeight) / 2;

                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
                    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

                    // Convert to base64
                    const base64Image = canvas.toDataURL('image/jpeg', 0.95);

                    // Call Fal.ai API
                    const response = await fetch('https://fal.run/fal-ai/real-esrgan', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Key ${state.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            image_url: base64Image,
                            scale: 2
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || `API Error: ${response.status}`);
                    }

                    const result = await response.json();

                    if (result.image && result.image.url) {
                        // Download the upscaled image
                        const upscaledResponse = await fetch(result.image.url);
                        const blob = await upscaledResponse.blob();

                        const originalName = file.name.replace(/\.[^/.]+$/, '');
                        const presetSuffix = getPresetSuffix();
                        const fileName = `${originalName}_${presetSuffix}_AI_upscaled.jpg`;

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

// ===== Sharpening Filter (Unsharp Mask) =====
function applySharpening(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Copy original data
    const original = new Uint8ClampedArray(data);

    // Sharpening kernel (Unsharp Mask approximation)
    const amount = 0.5; // Sharpening strength

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            for (let c = 0; c < 3; c++) { // RGB channels
                // Get neighboring pixels for edge detection
                const center = original[idx + c];
                const left = original[idx - 4 + c];
                const right = original[idx + 4 + c];
                const top = original[(idx - width * 4) + c];
                const bottom = original[(idx + width * 4) + c];

                // Calculate Laplacian edge
                const laplacian = 4 * center - left - right - top - bottom;

                // Apply sharpening
                data[idx + c] = Math.max(0, Math.min(255, center + amount * laplacian));
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function calculateDimensions(originalWidth, originalHeight) {
    let targetWidth, targetHeight;

    if (state.selectedPreset === '9:16') {
        const baseWidth = 1080;
        targetWidth = baseWidth;
        targetHeight = Math.round((baseWidth * 16) / 9);
    } else if (state.selectedPreset === '16:9') {
        const baseWidth = 1920;
        targetWidth = baseWidth;
        targetHeight = Math.round((baseWidth * 9) / 16);
    } else {
        targetWidth = state.customWidth;
        targetHeight = state.customHeight;
    }

    return { width: targetWidth, height: targetHeight };
}

function getPresetSuffix() {
    if (state.selectedPreset === '9:16') {
        return '9x16';
    } else if (state.selectedPreset === '16:9') {
        return '16x9';
    } else {
        return `${state.customWidth}x${state.customHeight}`;
    }
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
    state.selectedPreset = '9:16';
    state.quality = 95;

    elements.imageInput.value = '';
    updateFileCount();
    updateProcessButton();

    elements.presetBtns.forEach(btn => btn.classList.remove('active'));
    elements.presetBtns[0].classList.add('active');

    elements.customDimensions.style.display = 'none';

    elements.qualitySlider.value = 95;
    elements.qualityValue.textContent = '95%';

    elements.processBtn.style.display = 'flex';
    elements.progressContainer.style.display = 'none';
    elements.resultsContainer.style.display = 'none';

    elements.progressFill.style.width = '0%';
    elements.progressPercentage.textContent = '0%';
}

// ===== Initialize =====
updateProcessButton();
updateApiWarning();

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(err => console.log('Service Worker registration failed:', err));
}
