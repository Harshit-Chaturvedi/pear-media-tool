/* =============================================
   PEAR MEDIA AI STUDIO — Application Logic
   ============================================= */

// ——— State ———
const state = {
    hfApiKey: localStorage.getItem('hf_api_key') || '',
    cohereApiKey: localStorage.getItem('cohere_api_key') || '',
    stabilityApiKey: localStorage.getItem('stability_api_key') || '',
    uploadedImageBase64: null,
    uploadedImageBlob: null,
    lastGeneratedBlob: null,
    lastCaption: '',
    lastTags: [],
};

// ——— HF Model endpoints ———
const MODELS = {
    // Text generation / enhancement
    textGen: 'mistralai/Mistral-7B-Instruct-v0.3',
    // Image generation
    imageGen: 'stabilityai/stable-diffusion-xl-base-1.0',
    imageGenFallback: 'runwayml/stable-diffusion-v1-5',
    // Image captioning
    imageCaption: 'Salesforce/blip-image-captioning-large',
    // Image classification / object detection
    imageClassify: 'google/vit-base-patch16-224',
    // Zero-shot classification for tone analysis
    zeroShot: 'facebook/bart-large-mnli',
};

// ——— Init ———
document.addEventListener('DOMContentLoaded', () => {
    updateApiStatus();
    setupDragDrop();
    setupCharCount();

    // Auto-open settings if no API key
    if (!state.hfApiKey) {
        setTimeout(() => openSettings(), 600);
    }

    // Load saved keys into inputs
    document.getElementById('hfApiKey').value = state.hfApiKey;
    document.getElementById('cohereApiKey').value = state.cohereApiKey;
    document.getElementById('stabilityApiKey').value = state.stabilityApiKey;
});

// =============================================
// Settings
// =============================================
function openSettings() {
    document.getElementById('settingsModal').classList.add('show');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('show');
}

function saveSettings() {
    state.hfApiKey = document.getElementById('hfApiKey').value.trim();
    state.cohereApiKey = document.getElementById('cohereApiKey').value.trim();
    state.stabilityApiKey = document.getElementById('stabilityApiKey').value.trim();

    localStorage.setItem('hf_api_key', state.hfApiKey);
    localStorage.setItem('cohere_api_key', state.cohereApiKey);
    localStorage.setItem('stability_api_key', state.stabilityApiKey);

    updateApiStatus();
    closeSettings();
    showToast('success', 'API keys saved successfully!');
}

function updateApiStatus() {
    const statusEl = document.getElementById('apiStatus');
    const count = [state.hfApiKey, state.cohereApiKey, state.stabilityApiKey].filter(Boolean).length;

    if (count > 0) {
        statusEl.innerHTML = `<span class="status-dot status-dot-active"></span><span>${count} API${count > 1 ? 's' : ''} Connected</span>`;
    } else {
        statusEl.innerHTML = `<span class="status-dot status-dot-inactive"></span><span>No API Keys</span>`;
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
    if (!state.hfApiKey) {
        showToast('error', 'Please add your Hugging Face API key in Settings.');
        openSettings();
        return;
    }

    const btn = document.getElementById('enhanceBtn');
    setLoading(btn, true);

    try {
        // Step 1: Analyze tone/intent using zero-shot classification
        const analysisPromise = analyzePrompt(prompt);
        // Step 2: Enhance the prompt using text generation
        const enhancePromise = callTextEnhancement(prompt);

        const [analysis, enhanced] = await Promise.all([analysisPromise, enhancePromise]);

        // Fill in analysis
        document.getElementById('analysisTone').textContent = analysis.tone || 'Neutral';
        document.getElementById('analysisIntent').textContent = analysis.intent || 'Creative';
        document.getElementById('analysisStyle').textContent = analysis.style || 'Artistic';
        document.getElementById('analysisComplexity').textContent = analysis.complexity || 'Medium';

        // Fill in enhanced prompt
        document.getElementById('enhancedPrompt').value = enhanced;

        // Show step 2
        document.getElementById('textStep2').classList.remove('hidden');
        document.getElementById('textStep2').scrollIntoView({ behavior: 'smooth', block: 'center' });

        showToast('success', 'Prompt analyzed and enhanced!');
    } catch (err) {
        console.error('Enhancement error:', err);
        showToast('error', `Enhancement failed: ${err.message}`);
    } finally {
        setLoading(btn, false);
    }
}

async function analyzePrompt(prompt) {
    try {
        // Use zero-shot classification for tone analysis
        const toneLabels = ['formal', 'casual', 'poetic', 'technical', 'humorous', 'dramatic', 'whimsical', 'dark', 'serene'];
        const intentLabels = ['landscape', 'portrait', 'abstract', 'fantasy', 'realistic', 'surreal', 'sci-fi', 'nature', 'urban'];
        const styleLabels = ['photorealistic', 'oil painting', 'watercolor', 'digital art', 'anime', 'sketch', 'minimalist', 'vintage', '3D render'];
        const complexityLabels = ['simple', 'moderate', 'complex', 'highly detailed'];

        const [toneRes, intentRes, styleRes, complexRes] = await Promise.all([
            hfZeroShot(prompt, toneLabels),
            hfZeroShot(prompt, intentLabels),
            hfZeroShot(prompt, styleLabels),
            hfZeroShot(prompt, complexityLabels),
        ]);

        return {
            tone: capitalize(toneRes),
            intent: capitalize(intentRes),
            style: capitalize(styleRes),
            complexity: capitalize(complexRes),
        };
    } catch (e) {
        console.warn('Analysis fallback:', e);
        // Fallback analysis based on keywords
        return fallbackAnalysis(prompt);
    }
}

function fallbackAnalysis(prompt) {
    const lower = prompt.toLowerCase();
    const tone = lower.includes('dark') || lower.includes('horror') ? 'Dramatic' :
                 lower.includes('cute') || lower.includes('fun') ? 'Whimsical' :
                 lower.includes('elegant') || lower.includes('serene') ? 'Serene' : 'Neutral';
    const intent = lower.includes('landscape') || lower.includes('mountain') || lower.includes('ocean') ? 'Landscape' :
                   lower.includes('person') || lower.includes('portrait') ? 'Portrait' :
                   lower.includes('abstract') ? 'Abstract' : 'Creative';
    const style = lower.includes('photo') || lower.includes('realistic') ? 'Photorealistic' :
                  lower.includes('paint') || lower.includes('watercolor') ? 'Artistic' :
                  lower.includes('anime') || lower.includes('cartoon') ? 'Anime' : 'Digital Art';
    const words = prompt.split(/\s+/).length;
    const complexity = words < 10 ? 'Simple' : words < 25 ? 'Moderate' : 'Complex';

    return { tone, intent, style, complexity };
}

async function hfZeroShot(text, labels) {
    const response = await fetch(`https://api-inference.huggingface.co/models/${MODELS.zeroShot}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.hfApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inputs: text,
            parameters: { candidate_labels: labels },
        }),
    });

    if (!response.ok) throw new Error('Zero-shot API error');
    const data = await response.json();
    return data.labels?.[0] || labels[0];
}

async function callTextEnhancement(prompt) {
    // Try Cohere first if available
    if (state.cohereApiKey) {
        try {
            return await enhanceWithCohere(prompt);
        } catch (e) {
            console.warn('Cohere fallback to HF:', e);
        }
    }

    // Use Hugging Face text generation
    return await enhanceWithHF(prompt);
}

async function enhanceWithCohere(prompt) {
    const response = await fetch('https://api.cohere.ai/v1/chat', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.cohereApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: `You are an expert prompt engineer for AI image generation. Enhance the following user prompt to create a more detailed, vivid, and visually descriptive prompt suitable for Stable Diffusion image generation. Add details about lighting, composition, style, mood, and artistic techniques. Keep it concise (under 200 words). Only output the enhanced prompt, nothing else.\n\nOriginal prompt: "${prompt}"`,
            model: 'command-r-plus',
            temperature: 0.7,
        }),
    });

    if (!response.ok) throw new Error('Cohere API error');
    const data = await response.json();
    return data.text?.trim() || prompt;
}

async function enhanceWithHF(prompt) {
    const systemPrompt = `<s>[INST] You are an expert prompt engineer for AI image generation. Enhance the following user prompt to create a more detailed, vivid, and visually descriptive prompt suitable for Stable Diffusion. Add details about lighting, composition, style, mood, and techniques. Keep it concise (under 150 words). Output ONLY the enhanced prompt, nothing else.

User prompt: "${prompt}" [/INST]`;

    const response = await fetch(`https://api-inference.huggingface.co/models/${MODELS.textGen}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.hfApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inputs: systemPrompt,
            parameters: {
                max_new_tokens: 250,
                temperature: 0.7,
                top_p: 0.9,
                do_sample: true,
                return_full_text: false,
            },
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HF API error: ${errText}`);
    }
    const data = await response.json();

    let enhanced = '';
    if (Array.isArray(data) && data[0]?.generated_text) {
        enhanced = data[0].generated_text.trim();
    } else if (typeof data === 'string') {
        enhanced = data.trim();
    }

    // Clean up the response — remove any system/instruction artifacts
    enhanced = enhanced
        .replace(/^\[\/INST\]\s*/i, '')
        .replace(/^(Enhanced prompt:?\s*)/i, '')
        .replace(/^(Here is.*?:\s*)/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();

    // If enhancement failed or is too short, create a manual enhancement
    if (!enhanced || enhanced.length < prompt.length) {
        enhanced = manualEnhance(prompt);
    }

    return enhanced;
}

function manualEnhance(prompt) {
    const enhancements = [
        'highly detailed, 8K resolution',
        'professional photography',
        'dramatic lighting with volumetric rays',
        'cinematic composition',
        'rich color palette with vibrant tones',
        'sharp focus, depth of field',
        'award-winning quality',
    ];
    const styleHints = ['trending on artstation', 'masterpiece', 'best quality'];
    const selected = enhancements.sort(() => Math.random() - 0.5).slice(0, 4);
    const style = styleHints.sort(() => Math.random() - 0.5).slice(0, 2);

    return `${prompt}, ${selected.join(', ')}, ${style.join(', ')}`;
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

    // Show step 3
    document.getElementById('textStep3').classList.remove('hidden');
    document.getElementById('imageLoading').classList.remove('hidden');
    document.getElementById('generatedImage').classList.add('hidden');
    document.getElementById('resultActions').classList.add('hidden');
    document.getElementById('variationsGallery').classList.add('hidden');
    document.getElementById('textStep3').scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        const blob = await generateImageFromPrompt(prompt);
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

async function generateImageFromPrompt(prompt) {
    // Try Stability AI first if key is available
    if (state.stabilityApiKey) {
        try {
            return await stabilityGenerate(prompt);
        } catch (e) {
            console.warn('Stability AI fallback to HF:', e);
        }
    }

    // Use Hugging Face
    return await hfImageGen(prompt, MODELS.imageGen);
}

async function stabilityGenerate(prompt) {
    const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.stabilityApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            text_prompts: [{ text: prompt, weight: 1 }],
            cfg_scale: 7,
            height: 1024,
            width: 1024,
            steps: 30,
            samples: 1,
        }),
    });

    if (!response.ok) throw new Error('Stability API error');
    const data = await response.json();
    const base64 = data.artifacts?.[0]?.base64;
    if (!base64) throw new Error('No image returned');

    // Convert base64 to blob
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
}

async function hfImageGen(prompt, model) {
    let response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.hfApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                num_inference_steps: 30,
                guidance_scale: 7.5,
            },
        }),
    });

    // If model is loading, wait and retry
    if (response.status === 503) {
        const retryData = await response.json();
        const waitTime = retryData.estimated_time || 30;
        showToast('info', `Model loading... retrying in ${Math.ceil(waitTime)}s`);
        await sleep(waitTime * 1000);

        response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.hfApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    num_inference_steps: 30,
                    guidance_scale: 7.5,
                },
            }),
        });
    }

    if (!response.ok) {
        // Try fallback model
        if (model !== MODELS.imageGenFallback) {
            showToast('info', 'Trying fallback model...');
            return await hfImageGen(prompt, MODELS.imageGenFallback);
        }
        throw new Error(`Image generation API error: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('image')) {
        return await response.blob();
    }

    throw new Error('Unexpected response format');
}

async function generateVariation() {
    const originalPrompt = document.getElementById('enhancedPrompt').value.trim();
    if (!originalPrompt) return;

    const btn = document.querySelector('#resultActions .btn-primary');
    setLoading(btn, true);

    // Add variation modifiers
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
        const blob = await generateImageFromPrompt(varPrompt);
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

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
    });

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
    reader.onload = (e) => {
        state.uploadedImageBase64 = e.target.result;
        showImagePreview(e.target.result);

        // Also store as blob
        fetch(e.target.result)
            .then(r => r.blob())
            .then(b => { state.uploadedImageBlob = b; });
    };
    reader.readAsDataURL(file);
}

function loadImageFromUrl() {
    const url = document.getElementById('imageUrl').value.trim();
    if (!url) {
        showToast('warning', 'Please enter an image URL.');
        return;
    }

    // Use a proxy or direct fetch
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        state.uploadedImageBase64 = canvas.toDataURL('image/png');
        canvas.toBlob(blob => { state.uploadedImageBlob = blob; }, 'image/png');

        showImagePreview(state.uploadedImageBase64);
        showToast('success', 'Image loaded from URL!');
    };
    img.onerror = () => {
        showToast('error', 'Could not load image from URL. Try downloading and uploading instead.');
    };
    img.src = url;
}

function showImagePreview(src) {
    const preview = document.getElementById('imagePreview');
    document.getElementById('previewImg').src = src;
    preview.classList.remove('hidden');

    // Auto start analysis
    setTimeout(() => startImageAnalysis(), 500);
}

function removeImage() {
    document.getElementById('imagePreview').classList.add('hidden');
    document.getElementById('imageUpload').value = '';
    document.getElementById('imageUrl').value = '';
    state.uploadedImageBase64 = null;
    state.uploadedImageBlob = null;
    resetImageWorkflow();
}

async function startImageAnalysis() {
    if (!state.hfApiKey) {
        showToast('error', 'Please add your Hugging Face API key in Settings.');
        openSettings();
        return;
    }

    // Show step 2
    document.getElementById('imgStep2').classList.remove('hidden');
    document.getElementById('analysisLoading').classList.remove('hidden');
    document.getElementById('analysisResults').classList.add('hidden');
    document.getElementById('imgAnalysisActions').classList.add('hidden');
    document.getElementById('imgStep2').scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        const [caption, tags] = await Promise.all([
            analyzeImageCaption(),
            analyzeImageTags(),
        ]);

        state.lastCaption = caption;
        state.lastTags = tags;

        // Display caption
        document.getElementById('imgCaption').textContent = caption;

        // Display tags
        const tagCloud = document.getElementById('imgTags');
        tagCloud.innerHTML = tags.map(t => `<span class="tag">${t}</span>`).join('');

        // Style analysis from caption
        const styleHints = guessStyleFromCaption(caption, tags);
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

async function analyzeImageCaption() {
    const blob = state.uploadedImageBlob;
    if (!blob) throw new Error('No image loaded');

    const response = await fetch(`https://api-inference.huggingface.co/models/${MODELS.imageCaption}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.hfApiKey}`,
        },
        body: blob,
    });

    if (response.status === 503) {
        const data = await response.json();
        showToast('info', `Caption model loading... retrying in ${Math.ceil(data.estimated_time || 20)}s`);
        await sleep((data.estimated_time || 20) * 1000);
        return analyzeImageCaption();
    }

    if (!response.ok) throw new Error(`Caption API error: ${response.status}`);
    const data = await response.json();
    return data[0]?.generated_text || 'Unable to generate caption';
}

async function analyzeImageTags() {
    const blob = state.uploadedImageBlob;
    if (!blob) return ['image'];

    try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${MODELS.imageClassify}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.hfApiKey}`,
            },
            body: blob,
        });

        if (response.status === 503) {
            const data = await response.json();
            await sleep((data.estimated_time || 20) * 1000);
            return analyzeImageTags();
        }

        if (!response.ok) return ['image'];
        const data = await response.json();

        // Get top labels
        return data
            .filter(d => d.score > 0.05)
            .slice(0, 8)
            .map(d => d.label.split(',')[0].trim());
    } catch {
        return ['image'];
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

    // Show step 3
    document.getElementById('imgStep3').classList.remove('hidden');
    document.getElementById('imgVarLoading').classList.remove('hidden');
    document.getElementById('imgVariationsGallery').classList.add('hidden');
    document.getElementById('imgVarActions').classList.add('hidden');
    document.getElementById('imgStep3').scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        // Generate variations based on caption and tags
        const basePrompt = `${state.lastCaption}, ${state.lastTags.join(', ')}`;
        const variations = [
            `${basePrompt}, photorealistic style, high detail, 8K resolution, professional lighting`,
            `${basePrompt}, oil painting style, artistic interpretation, rich colors, dramatic brushstrokes`,
            `${basePrompt}, watercolor style, soft ethereal tones, delicate washes, artistic interpretation`,
        ];

        const grid = document.getElementById('imgGalleryGrid');
        grid.innerHTML = '';

        const styleNames = ['Photorealistic', 'Oil Painting', 'Watercolor'];

        // Generate variations sequentially to avoid rate limits
        for (let i = 0; i < variations.length; i++) {
            try {
                const blob = await generateImageFromPrompt(variations[i]);
                const item = document.createElement('div');
                item.className = 'gallery-item';
                item.innerHTML = `
                    <img src="${URL.createObjectURL(blob)}" alt="Variation ${i + 1}">
                    <div class="gallery-label">${styleNames[i]}</div>
                `;
                item.onclick = () => openLightbox(item.querySelector('img').src);
                grid.appendChild(item);

                // Show gallery after first image
                if (i === 0) {
                    document.getElementById('imgVarLoading').classList.add('hidden');
                    document.getElementById('imgVariationsGallery').classList.remove('hidden');
                }

                showToast('success', `${styleNames[i]} variation created!`);
            } catch (err) {
                console.warn(`Variation ${i + 1} failed:`, err);
                showToast('warning', `${styleNames[i]} variation failed, skipping...`);
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

    const pick = extraStyles[Math.floor(Math.random() * extraStyles.length)];
    const prompt = `${state.lastCaption}, ${state.lastTags.join(', ')}, ${pick[0]}`;

    try {
        const blob = await generateImageFromPrompt(prompt);
        const grid = document.getElementById('imgGalleryGrid');
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `
            <img src="${URL.createObjectURL(blob)}" alt="Extra Variation">
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

    // Reset loading states
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
