/* =============================================
   PEAR MEDIA AI STUDIO — Frontend Application
   Calls backend proxy at /api/* endpoints
   ============================================= */

// ——— State ———
const state = {
    uploadedImageBase64: null,
    lastGeneratedBlob: null,
    lastCaption: '',
    lastTags: [],
    apiCount: 0,
};

// ——— Init ———
document.addEventListener('DOMContentLoaded', async () => {
    setupDragDrop();
    setupCharCount();
    await checkApiStatus();
});

// =============================================
// API Status
// =============================================
async function checkApiStatus() {
    try {
        const resp = await fetch('/api/status');
        if (resp.ok) {
            const statusEl = document.getElementById('apiStatus');
            statusEl.innerHTML = `<span class="status-dot status-dot-active"></span><span>System Online</span>`;
        }
    } catch (e) {
        console.warn('Status check failed:', e);
        const statusEl = document.getElementById('apiStatus');
        statusEl.innerHTML = `<span class="status-dot status-dot-inactive"></span><span>System Offline</span>`;
    }
}

 

// =============================================
// Tab Navigation
// =============================================
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.workflow-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab${capitalize(tab)}`).classList.add('active');
    document.getElementById(`panel${capitalize(tab)}`).classList.add('active');
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Compresses an image to stay within Vercel's 4.5MB payload limit.
 * Resizes to max 1200px and uses 0.8 JPEG compression.
 */
function compressImage(base64Str) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Export as compressed JPEG
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            
            const oldSize = (base64Str.length / 1024).toFixed(2);
            const newSize = (compressedBase64.length / 1024).toFixed(2);
            console.log(`Image optimized: ${oldSize}KB -> ${newSize}KB`);
            
            resolve(compressedBase64);
        };
        img.onerror = () => resolve(base64Str); // Fallback to original
        img.src = base64Str;
    });
}

// =============================================
// Toast Notifications
// =============================================
function showToast(type, message) {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// =============================================
// Character Count
// =============================================
function setupCharCount() {
    const textarea = document.getElementById('userPrompt');
    const counter = document.getElementById('charCount');
    textarea.addEventListener('input', () => {
        const len = textarea.value.length;
        counter.textContent = len;
        if (len > 500) textarea.value = textarea.value.slice(0, 500);
    });
}

// =============================================
// TEXT WORKFLOW
// =============================================

async function enhancePrompt() {
    const prompt = document.getElementById('userPrompt').value.trim();
    if (!prompt) {
        showToast('warning', 'Please enter a prompt first.');
        return;
    }

    const btn = document.getElementById('enhanceBtn');
    setLoading(btn, true);

    // Initial placeholder for analysis
    ['analysisTone', 'analysisIntent', 'analysisStyle', 'analysisComplexity'].forEach(id => {
        document.getElementById(id).textContent = 'Analyzing...';
    });

    // Start Analysis in background (don't wait for it yet)
    const analysisPromise = fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
    }).then(res => res.json()).catch(err => {
        console.warn('Analysis background failed:', err);
        return { tone: 'Neutral', intent: 'Creative', style: 'Artistic', complexity: 'Medium' };
    });

    try {
        // Priority 1: Enhancement
        const enhanceResp = await fetch('/api/enhance-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });
        const enhance = await enhanceResp.json();

        // Fill in enhanced prompt IMMEDIATELY
        document.getElementById('enhancedPrompt').value = enhance.enhanced;

        // Show step 2 IMMEDIATELY
        document.getElementById('textStep2').classList.remove('hidden');
        document.getElementById('textStep2').scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('success', `Prompt enhanced via ${enhance.provider}!`);

        // Wait for analysis to catch up
        const analysis = await analysisPromise;
        document.getElementById('analysisTone').textContent = capitalize(analysis.tone || 'Neutral');
        document.getElementById('analysisIntent').textContent = capitalize(analysis.intent || 'Creative');
        document.getElementById('analysisStyle').textContent = capitalize(analysis.style || 'Artistic');
        document.getElementById('analysisComplexity').textContent = capitalize(analysis.complexity || 'Medium');

    } catch (err) {
        console.error('Enhancement error:', err);
        showToast('error', `Enhancement failed: ${err.message}`);
    } finally {
        setLoading(btn, false);
    }
}

// ——— Image Generation ———
async function generateImage() {
    const prompt = document.getElementById('enhancedPrompt').value.trim();
    if (!prompt) {
        showToast('warning', 'Enhanced prompt is empty.');
        return;
    }

    const btn = document.getElementById('generateBtn');
    setLoading(btn, true);

    // Show step 3 with loading
    document.getElementById('textStep3').classList.remove('hidden');
    document.getElementById('imageLoading').classList.remove('hidden');
    document.getElementById('generatedImage').classList.add('hidden');
    document.getElementById('resultActions').classList.add('hidden');
    document.getElementById('variationsGallery').classList.add('hidden');
    document.getElementById('textStep3').scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errData.error || `Server error: ${response.status}`);
        }

        const blob = await response.blob();
        state.lastGeneratedBlob = blob;

        const img = document.getElementById('generatedImage');
        img.src = URL.createObjectURL(blob);
        img.classList.remove('hidden');
        document.getElementById('imageLoading').classList.add('hidden');
        document.getElementById('resultActions').classList.remove('hidden');

        showToast('success', 'Image generated successfully!');
    } catch (err) {
        console.error('Image generation error:', err);
        document.getElementById('imageLoading').innerHTML = `
            <div style="color: #ef4444; font-size: 40px;">⚠️</div>
            <p style="color: #ef4444;">Generation failed</p>
            <p class="loading-sub">${err.message}</p>
        `;
        showToast('error', `Image generation failed: ${err.message}`);
    } finally {
        setLoading(btn, false);
    }
}

async function generateVariation() {
    const originalPrompt = document.getElementById('enhancedPrompt').value.trim();
    if (!originalPrompt) return;

    const btn = document.querySelector('#resultActions .btn-primary');
    setLoading(btn, true);

    const modifiers = [
        'different perspective, unique angle',
        'alternative color palette, different mood',
        'different time of day, changed atmosphere',
        'artistic interpretation, stylized version',
        'close-up detailed view, macro perspective',
    ];
    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    const varPrompt = `${originalPrompt}, ${modifier}`;

    try {
        const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: varPrompt }),
        });

        if (!response.ok) throw new Error('Variation generation failed');
        const blob = await response.blob();

        const gallery = document.getElementById('variationsGallery');
        const grid = document.getElementById('galleryGrid');
        gallery.classList.remove('hidden');

        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `
            <img src="${URL.createObjectURL(blob)}" alt="Variation">
            <div class="gallery-label">${modifier.split(',')[0]}</div>
        `;
        item.onclick = () => openLightbox(item.querySelector('img').src);
        grid.appendChild(item);

        showToast('success', 'Variation generated!');
    } catch (err) {
        showToast('error', `Variation failed: ${err.message}`);
    } finally {
        setLoading(btn, false);
    }
}

function downloadImage() {
    if (!state.lastGeneratedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(state.lastGeneratedBlob);
    a.download = `pear-media-${Date.now()}.png`;
    a.click();
}

function resetTextWorkflow() {
    document.getElementById('textStep2').classList.add('hidden');
    document.getElementById('textStep3').classList.add('hidden');
    document.getElementById('userPrompt').value = '';
    document.getElementById('charCount').textContent = '0';
    document.getElementById('galleryGrid').innerHTML = '';
    document.getElementById('imageLoading').innerHTML = `
        <div class="pulse-loader"></div>
        <p>Creating your image...</p>
        <p class="loading-sub">This may take 30–60 seconds</p>
    `;
    state.lastGeneratedBlob = null;
}

// =============================================
// IMAGE WORKFLOW
// =============================================

function setupDragDrop() {
    const zone = document.getElementById('uploadZone');
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            processImageFile(file);
        } else {
            showToast('warning', 'Please drop an image file.');
        }
    });
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) processImageFile(file);
}

function processImageFile(file) {
    if (file.size > 10 * 1024 * 1024) {
        showToast('error', 'Image must be under 10MB.');
        return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
        const originalBase64 = e.target.result;
        state.uploadedImageBase64 = await compressImage(originalBase64);
        showImagePreview(state.uploadedImageBase64);
    };
    reader.readAsDataURL(file);
}

function loadImageFromUrl() {
    const url = document.getElementById('imageUrl').value.trim();
    if (!url) {
        showToast('warning', 'Please enter an image URL.');
        return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const originalBase64 = canvas.toDataURL('image/png');
        state.uploadedImageBase64 = await compressImage(originalBase64);
        showImagePreview(state.uploadedImageBase64);
        showToast('success', 'Image loaded and optimized!');
    };
    img.onerror = () => {
        showToast('error', 'Could not load image. Try downloading and uploading instead.');
    };
    img.src = url;
}

function showImagePreview(src) {
    const preview = document.getElementById('imagePreview');
    document.getElementById('previewImg').src = src;
    preview.classList.remove('hidden');
    setTimeout(() => startImageAnalysis(), 500);
}

function removeImage() {
    document.getElementById('imagePreview').classList.add('hidden');
    document.getElementById('imageUpload').value = '';
    document.getElementById('imageUrl').value = '';
    state.uploadedImageBase64 = null;
    resetImageWorkflow();
}

async function startImageAnalysis() {
    if (!state.uploadedImageBase64) return;

    // Show step 2 loading
    document.getElementById('imgStep2').classList.remove('hidden');
    document.getElementById('analysisLoading').classList.remove('hidden');
    document.getElementById('analysisResults').classList.add('hidden');
    document.getElementById('imgAnalysisActions').classList.add('hidden');
    document.getElementById('imgStep2').scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        const [captionResp, classifyResp] = await Promise.all([
            fetch('/api/caption-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: state.uploadedImageBase64 }),
            }),
            fetch('/api/classify-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: state.uploadedImageBase64 }),
            }),
        ]);

        const captionData = await captionResp.json();
        const classifyData = await classifyResp.json();

        state.lastCaption = captionData.caption || '';
        state.lastTags = classifyData.tags || [];

        // Display caption
        document.getElementById('imgCaption').textContent = state.lastCaption;

        // Display tags
        const tagCloud = document.getElementById('imgTags');
        tagCloud.innerHTML = state.lastTags.map(t => `<span class="tag">${t}</span>`).join('');

        // Style analysis
        const styleHints = guessStyleFromCaption(state.lastCaption, state.lastTags);
        document.getElementById('imgStyle').textContent = styleHints;

        // Show results
        document.getElementById('analysisLoading').classList.add('hidden');
        document.getElementById('analysisResults').classList.remove('hidden');
        document.getElementById('imgAnalysisActions').classList.remove('hidden');

        showToast('success', 'Image analyzed successfully!');
    } catch (err) {
        console.error('Analysis error:', err);
        document.getElementById('analysisLoading').innerHTML = `
            <div style="color: #ef4444; font-size: 40px;">⚠️</div>
            <p style="color: #ef4444;">Analysis failed: ${err.message}</p>
        `;
        showToast('error', `Analysis failed: ${err.message}`);
    }
}

function guessStyleFromCaption(caption, tags) {
    const lower = (caption + ' ' + tags.join(' ')).toLowerCase();
    const styles = [];
    if (lower.match(/photo|camera|lens/)) styles.push('Photography');
    if (lower.match(/paint|canvas|oil|watercolor/)) styles.push('Painting');
    if (lower.match(/cartoon|anime|animation/)) styles.push('Animation');
    if (lower.match(/landscape|mountain|ocean|sky|sunset|nature/)) styles.push('Landscape');
    if (lower.match(/portrait|face|person|people/)) styles.push('Portrait');
    if (lower.match(/city|building|street|urban/)) styles.push('Urban');
    if (lower.match(/food|dish|meal|plate/)) styles.push('Food Photography');
    if (lower.match(/animal|dog|cat|bird/)) styles.push('Wildlife');
    if (styles.length === 0) styles.push('General', 'Digital Art');
    return styles.join(' • ') + ' — Suitable for creative variations and re-imagining';
}

async function generateImageVariations() {
    if (!state.lastCaption) {
        showToast('warning', 'Please analyze an image first.');
        return;
    }

    const btn = document.getElementById('imgVariationBtn');
    setLoading(btn, true);

    document.getElementById('imgStep3').classList.remove('hidden');
    document.getElementById('imgVarLoading').classList.remove('hidden');
    document.getElementById('imgVariationsGallery').classList.add('hidden');
    document.getElementById('imgVarActions').classList.add('hidden');
    document.getElementById('imgStep3').scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        const tagsStr = state.lastTags.length > 0 ? state.lastTags.join(', ') : 'scene';
        const basePrompt = state.lastCaption ? `${state.lastCaption}, ${tagsStr}` : tagsStr;
        const variations = [
            { prompt: `${basePrompt}, photorealistic style, high detail, 8K resolution, professional lighting`, label: 'Photorealistic' },
            { prompt: `${basePrompt}, oil painting style, artistic interpretation, rich colors, dramatic brushstrokes`, label: 'Oil Painting' },
            { prompt: `${basePrompt}, watercolor style, soft ethereal tones, delicate washes`, label: 'Watercolor' },
        ];

        const grid = document.getElementById('imgGalleryGrid');
        grid.innerHTML = '';

        for (let i = 0; i < variations.length; i++) {
            try {
                const response = await fetch('/api/generate-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: variations[i].prompt }),
                });

                if (!response.ok) throw new Error('Generation failed');
                const blob = await response.blob();

                const item = document.createElement('div');
                item.className = 'gallery-item';
                item.innerHTML = `
                    <img src="${URL.createObjectURL(blob)}" alt="${variations[i].label}">
                    <div class="gallery-label">${variations[i].label}</div>
                `;
                item.onclick = () => openLightbox(item.querySelector('img').src);
                grid.appendChild(item);

                if (i === 0) {
                    document.getElementById('imgVarLoading').classList.add('hidden');
                    document.getElementById('imgVariationsGallery').classList.remove('hidden');
                }
                showToast('success', `${variations[i].label} variation created!`);
            } catch (err) {
                console.warn(`Variation ${i + 1} failed:`, err);
                showToast('warning', `${variations[i].label} variation failed, skipping...`);
            }
        }

        document.getElementById('imgVarLoading').classList.add('hidden');
        document.getElementById('imgVariationsGallery').classList.remove('hidden');
        document.getElementById('imgVarActions').classList.remove('hidden');
    } catch (err) {
        showToast('error', `Variation generation failed: ${err.message}`);
    } finally {
        setLoading(btn, false);
    }
}

async function generateMoreVariations() {
    if (!state.lastCaption) return;

    const btn = document.querySelector('#imgVarActions .btn-primary');
    setLoading(btn, true);

    const extraStyles = [
        ['anime illustration style, vibrant colors, detailed linework', 'Anime Style'],
        ['cyberpunk dystopian reimagining, neon lights, futuristic', 'Cyberpunk'],
        ['minimalist flat design, clean lines, modern art', 'Minimalist'],
        ['vintage retro style, warm film grain, nostalgic feel', 'Vintage'],
    ];
    const tagsStr = state.lastTags.length > 0 ? state.lastTags.join(', ') : 'scene';
    const pick = extraStyles[Math.floor(Math.random() * extraStyles.length)];
    const basePrompt = state.lastCaption ? `${state.lastCaption}, ${tagsStr}` : tagsStr;
    const prompt = `${basePrompt}, ${pick[0]}`;

    try {
        const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });
        if (!response.ok) throw new Error('Generation failed');
        const blob = await response.blob();

        const grid = document.getElementById('imgGalleryGrid');
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `
            <img src="${URL.createObjectURL(blob)}" alt="${pick[1]}">
            <div class="gallery-label">${pick[1]}</div>
        `;
        item.onclick = () => openLightbox(item.querySelector('img').src);
        grid.appendChild(item);
        showToast('success', `${pick[1]} variation created!`);
    } catch (err) {
        showToast('error', `Generation failed: ${err.message}`);
    } finally {
        setLoading(btn, false);
    }
}

function resetImageWorkflow() {
    document.getElementById('imgStep2').classList.add('hidden');
    document.getElementById('imgStep3').classList.add('hidden');
    document.getElementById('imgGalleryGrid').innerHTML = '';
    state.lastCaption = '';
    state.lastTags = [];
    document.getElementById('analysisLoading').innerHTML = `
        <div class="pulse-loader"></div>
        <p>Analyzing image...</p>
    `;
}

// =============================================
// Lightbox
// =============================================
function openLightbox(src) {
    let overlay = document.querySelector('.lightbox-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'lightbox-overlay';
        overlay.onclick = () => overlay.classList.remove('show');
        overlay.innerHTML = '<img alt="Full size">';
        document.body.appendChild(overlay);
    }
    overlay.querySelector('img').src = src;
    overlay.classList.add('show');
}

// =============================================
// Utilities
// =============================================
function setLoading(btn, loading) {
    if (loading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}
