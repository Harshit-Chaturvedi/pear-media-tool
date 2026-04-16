/* =============================================
   PEAR MEDIA AI STUDIO — Backend Proxy Server
   ============================================= */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API Keys from environment
const API_KEYS = {
    hf: process.env.HF_API_KEY,
    cohere: process.env.COHERE_API_KEY,
    stability: process.env.STABILITY_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
};

// =============================================
// Health Check
// =============================================
app.get('/api/status', (req, res) => {
    const connected = Object.entries(API_KEYS)
        .filter(([, v]) => v)
        .map(([k]) => k);
    res.json({ status: 'ok', apis: connected, count: connected.length });
});

// =============================================
// Text Enhancement (HF Mistral)
// =============================================
app.post('/api/enhance-text', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        // Try Cohere first (more reliable for text generation)
        if (API_KEYS.cohere) {
            try {
                const result = await enhanceWithCohere(prompt);
                return res.json({ enhanced: result, provider: 'Cohere' });
            } catch (e) {
                console.warn('Cohere failed, falling back:', e.message);
            }
        }

        // Try Gemini if available
        if (API_KEYS.gemini) {
            try {
                const result = await enhanceWithGemini(prompt);
                return res.json({ enhanced: result, provider: 'Gemini' });
            } catch (e) {
                console.warn('Gemini failed, falling back:', e.message);
            }
        }

        // Fallback to HF
        const result = await enhanceWithHF(prompt);
        res.json({ enhanced: result, provider: 'Hugging Face' });
    } catch (err) {
        console.error('Enhancement error:', err);
        // Ultimate fallback: manual enhancement
        const manual = manualEnhance(prompt);
        res.json({ enhanced: manual, provider: 'Built-in' });
    }
});

// =============================================
// Text Analysis (HF Zero-Shot)
// =============================================
app.post('/api/analyze-text', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        // Use Cohere for high-speed, multi-factor analysis in one pass
        if (API_KEYS.cohere) {
            const analysisPrompt = `Analyze this image prompt: "${prompt}". 
            Respond with a JSON object containing:
            - tone (e.g., whimsy, formal, dramatic)
            - intent (e.g., landscape, portrait, abstract)
            - style (e.g., oil painting, photorealistic, 3D render)
            - complexity (simple, moderate, or complex)
            Return ONLY the JSON.`;

            const response = await fetch('https://api.cohere.ai/v1/chat', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEYS.cohere}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: analysisPrompt,
                    model: 'command-r-plus-08-2024',
                    max_tokens: 150,
                    temperature: 0,
                }),
            });

            const data = await response.json();
            const jsonMatch = data.text.match(/\{[\s\S]*\}/)?.[0];
            if (jsonMatch) {
                return res.json(JSON.parse(jsonMatch));
            }
        }
        res.json(fallbackAnalysis(prompt));
    } catch (err) {
        console.warn('Analysis optimized failed, using fallback:', err.message);
        res.json(fallbackAnalysis(prompt));
    }
});

// =============================================
// Image Generation (HF / Stability)
// =============================================
app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        // Try Stability AI first (higher quality)
        if (API_KEYS.stability) {
            try {
                const imageBuffer = await stabilityGenerate(prompt);
                res.set('Content-Type', 'image/png');
                return res.send(imageBuffer);
            } catch (e) {
                console.warn('Stability failed, falling back to HF:', e.message);
            }
        }

        // Fallback to HF
        const imageBuffer = await hfImageGen(prompt);
        res.set('Content-Type', 'image/png');
        res.send(imageBuffer);
    } catch (err) {
        console.error('Image generation error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// Image Caption (HF BLIP)
// =============================================
app.post('/api/caption-image', async (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image is required' });

    try {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

        // Try Gemini first if available
        if (API_KEYS.gemini) {
            try {
                console.log("Trying Gemini for captioning...");
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEYS.gemini}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: "Describe this image in one detailed sentence. Focus on the main subject, its appearance, colors, and setting. Output ONLY the description." },
                                { inline_data: { mime_type: "image/png", data: base64Data } }
                            ]
                        }],
                        generationConfig: { temperature: 0.3, maxOutputTokens: 150 }
                    })
                });
                const data = await response.json();
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const caption = data.candidates[0].content.parts[0].text.trim();
                    console.log("Gemini caption:", caption);
                    return res.json({ caption });
                }
            } catch (e) {
                console.warn('Gemini caption failed:', e.message);
            }
        }

        // Fallback: Use HF ViT classification to build a caption from tags
        console.log("Using HF ViT to build caption from classification...");
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const response = await fetchWithRetry(
            'https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEYS.hf}`,
                    'Content-Type': 'application/octet-stream'
                },
                body: imageBuffer,
            }
        );

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        // Build a descriptive caption from the top classification labels
        const topLabels = data
            .filter(d => d.score > 0.02)
            .slice(0, 5)
            .map(d => d.label.split(',')[0].trim());

        const caption = topLabels.length > 0
            ? `A detailed image featuring ${topLabels.join(', ')}`
            : 'An image';

        console.log("ViT-built caption:", caption);
        res.json({ caption });
    } catch (err) {
        console.error('Caption error:', err.message);
        res.json({ caption: '' });
    }
});

// =============================================
// Image Classification (HF ViT)
// =============================================
app.post('/api/classify-image', async (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image is required' });

    try {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

        // Try Gemini First (Better Quality)
        if (API_KEYS.gemini) {
            console.log("Using Gemini for Image Classification");
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEYS.gemini}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: "List exactly 8 keywords that describe the main objects, themes, colors, and style of this image. Return ONLY a comma-separated list, nothing else. Example: shoe, leather, brown, fashion, casual, footwear, modern, studio" },
                                { inline_data: { mime_type: "image/png", data: base64Data } }
                            ]
                        }],
                        generationConfig: { temperature: 0.2, maxOutputTokens: 100 }
                    })
                });

                const data = await response.json();
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const text = data.candidates[0].content.parts[0].text;
                    const tags = text.split(',').map(t => t.trim()).filter(t => t.length > 0).slice(0, 8);
                    console.log("Gemini classification result:", tags);
                    return res.json({ tags });
                }
                if (data.error) {
                    console.warn('Gemini classify API error:', data.error.message);
                    throw new Error(data.error.message);
                }
            } catch (e) {
                console.warn('Gemini classification failed, falling back to HF:', e.message);
            }
        }

        // Fallback to HF ViT
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const response = await fetchWithRetry(
            'https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224',
            {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${API_KEYS.hf}`,
                    'Content-Type': 'application/octet-stream' 
                },
                body: imageBuffer,
            }
        );

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        const tags = data
            .filter(d => d.score > 0.05)
            .slice(0, 8)
            .map(d => d.label.split(',')[0].trim());

        res.json({ tags });
    } catch (err) {
        console.error('Classification error:', err.message);
        res.json({ tags: ['image'] });
    }
});

// =============================================
// Helper: Cohere Enhancement
// =============================================
async function enhanceWithCohere(prompt) {
    const response = await fetch('https://api.cohere.ai/v1/chat', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEYS.cohere}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: `You are an expert prompt engineer for AI image generation. Enhance the following user prompt to create a more detailed, vivid, and visually descriptive prompt suitable for Stable Diffusion image generation. Add details about lighting, composition, style, mood, and artistic techniques. Keep it concise (under 200 words). Only output the enhanced prompt, nothing else.\n\nOriginal prompt: "${prompt}"`,
            model: 'command-r-plus-08-2024',
            temperature: 0.7,
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Cohere error: ${response.status} - ${errText}`);
    }
    const data = await response.json();
    return data.text?.trim() || prompt;
}

// =============================================
// Helper: Gemini Enhancement
// =============================================
async function enhanceWithGemini(prompt) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEYS.gemini}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are an expert prompt engineer for AI image generation. Enhance the following user prompt to create a more detailed, vivid, and visually descriptive prompt suitable for Stable Diffusion image generation. Add details about lighting, composition, style, mood, and artistic techniques. Keep it concise (under 200 words). Only output the enhanced prompt, nothing else.\n\nOriginal prompt: "${prompt}"`
                    }]
                }],
                generationConfig: { temperature: 0.7 },
            }),
        }
    );

    if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || prompt;
}

// =============================================
// Helper: HF Text Enhancement
// =============================================
async function enhanceWithHF(prompt) {
    const systemPrompt = `<s>[INST] You are an expert prompt engineer for AI image generation. Enhance the following user prompt to create a more detailed, vivid, and visually descriptive prompt suitable for Stable Diffusion. Add details about lighting, composition, style, mood, and techniques. Keep it concise (under 150 words). Output ONLY the enhanced prompt, nothing else.

User prompt: "${prompt}" [/INST]`;

    const response = await fetchWithRetry(
        'https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.3',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEYS.hf}`,
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
        }
    );

    const data = await response.json();
    let enhanced = '';
    if (Array.isArray(data) && data[0]?.generated_text) {
        enhanced = data[0].generated_text.trim();
    }

    enhanced = enhanced
        .replace(/^\[\/INST\]\s*/i, '')
        .replace(/^(Enhanced prompt:?\s*)/i, '')
        .replace(/^(Here is.*?:\s*)/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();

    if (!enhanced || enhanced.length < prompt.length) {
        enhanced = manualEnhance(prompt);
    }

    return enhanced;
}

// =============================================
// Helper: HF Zero-Shot Classification
// =============================================
async function hfZeroShot(text, labels) {
    const response = await fetchWithRetry(
        'https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEYS.hf}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: text,
                parameters: { candidate_labels: labels },
            }),
        }
    );

    const data = await response.json();
    return data.labels?.[0] || labels[0];
}

// =============================================
// Helper: Stability AI Image Generation
// =============================================
async function stabilityGenerate(prompt) {
    const response = await fetch(
        'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEYS.stability}`,
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
        }
    );

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Stability error: ${response.status} - ${errText}`);
    }
    const data = await response.json();
    const base64 = data.artifacts?.[0]?.base64;
    if (!base64) throw new Error('No image returned from Stability');
    return Buffer.from(base64, 'base64');
}

// =============================================
// Helper: HF Image Generation
// =============================================
async function hfImageGen(prompt) {
    const models = [
        'stabilityai/stable-diffusion-xl-base-1.0',
        'runwayml/stable-diffusion-v1-5',
    ];

    for (const model of models) {
        try {
            const response = await fetchWithRetry(
                `https://router.huggingface.co/hf-inference/models/${model}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${API_KEYS.hf}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: prompt,
                        parameters: {
                            num_inference_steps: 30,
                            guidance_scale: 7.5,
                        },
                    }),
                }
            );

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('image')) {
                return Buffer.from(await response.arrayBuffer());
            }
            throw new Error('Non-image response');
        } catch (e) {
            console.warn(`HF model ${model} failed:`, e.message);
            continue;
        }
    }
    throw new Error('All image generation models failed');
}

// =============================================
// Helper: Fetch with retry (for 503 model loading)
// =============================================
async function fetchWithRetry(url, opts, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        const resp = await fetch(url, opts);
        if (resp.status === 503) {
            const data = await resp.json().catch(() => ({}));
            const wait = Math.min((data.estimated_time || 20) * 1000, 60000);
            console.log(`Model loading, waiting ${wait / 1000}s... (attempt ${i + 1})`);
            await new Promise(r => setTimeout(r, wait));
            continue;
        }
        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`API error ${resp.status}: ${errText}`);
        }
        return resp;
    }
    throw new Error('Max retries exceeded - model still loading');
}

// =============================================
// Helper: Manual Enhancement (fallback)
// =============================================
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

// =============================================
// Helper: Fallback Analysis
// =============================================
function fallbackAnalysis(prompt) {
    const lower = prompt.toLowerCase();
    const tone = lower.match(/dark|horror/) ? 'Dramatic' :
                 lower.match(/cute|fun/) ? 'Whimsical' :
                 lower.match(/elegant|serene/) ? 'Serene' : 'Neutral';
    const intent = lower.match(/landscape|mountain|ocean/) ? 'Landscape' :
                   lower.match(/person|portrait/) ? 'Portrait' :
                   lower.match(/abstract/) ? 'Abstract' : 'Creative';
    const style = lower.match(/photo|realistic/) ? 'Photorealistic' :
                  lower.match(/paint|watercolor/) ? 'Artistic' :
                  lower.match(/anime|cartoon/) ? 'Anime' : 'Digital Art';
    const words = prompt.split(/\s+/).length;
    const complexity = words < 10 ? 'Simple' : words < 25 ? 'Moderate' : 'Complex';
    return { tone, intent, style, complexity };
}

// =============================================
// Start Server
// =============================================
app.listen(PORT, () => {
    console.log(`\n🍐 Pear Media AI Studio server running at http://localhost:${PORT}`);
    console.log(`   APIs configured: ${Object.entries(API_KEYS).filter(([,v]) => v).map(([k]) => k).join(', ')}\n`);
});
