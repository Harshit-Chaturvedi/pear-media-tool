# 🍐 Pear Media — AI Text & Image Studio

A powerful web-based tool that integrates multiple AI APIs to perform **text enhancement** and **image generation** workflows. Built as a static single-page application with a stunning dark-mode glassmorphic UI.

![Pear Media Screenshot](screenshot.png)

---

## ✨ Features

### 📝 Text-to-Image Workflow
1. **Enter a Prompt** — Describe the image you want to create
2. **AI Analysis** — Automatically analyzes tone, intent, style & complexity using NLP
3. **Prompt Enhancement** — AI enhances your prompt with professional photography/art terms
4. **Image Generation** — Generates high-quality images from the enhanced prompt
5. **Variations** — Generate multiple artistic variations of the result

### 🖼️ Image Analysis Workflow
1. **Upload an Image** — Drag & drop, file picker, or paste a URL
2. **AI Analysis** — Automatically generates captions, detects objects/themes, and analyzes style
3. **Variation Generation** — Creates artistic variations (Photorealistic, Oil Painting, Watercolor, Anime, etc.)
4. **Lightbox View** — Click any image for a full-size view

---

## 🔌 API Integrations

| API | Purpose | Type |
|-----|---------|------|
| **Hugging Face** 🤗 | Text generation, image captioning, classification, zero-shot analysis, image generation | Required (Free) |
| **Cohere** 🧠 | Advanced text/prompt enhancement | Optional (Free) |
| **Stability AI** 🎨 | High-quality SDXL image generation | Optional (Free Trial) |

### Models Used
- `mistralai/Mistral-7B-Instruct-v0.3` — Text enhancement
- `facebook/bart-large-mnli` — Zero-shot tone/intent classification
- `Salesforce/blip-image-captioning-large` — Image captioning
- `google/vit-base-patch16-224` — Image classification/tagging
- `stabilityai/stable-diffusion-xl-base-1.0` — Image generation
- `runwayml/stable-diffusion-v1-5` — Fallback image generation

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/pear-media-tool.git
cd pear-media-tool
```

### 2. Get API Keys (Free)

**Hugging Face (Required):**
1. Go to [huggingface.co](https://huggingface.co)
2. Create an account → Settings → Access Tokens
3. Create a new token (Read access is sufficient)

**Cohere (Optional):**
1. Go to [dashboard.cohere.com](https://dashboard.cohere.com)
2. Sign up → API Keys → Copy your trial key

**Stability AI (Optional):**
1. Go to [platform.stability.ai](https://platform.stability.ai)
2. Sign up → Account → API Keys

### 3. Run Locally
Simply open `index.html` in your browser — no build step required!

```bash
# macOS
open index.html

# Windows
start index.html

# Or use any local server
npx serve .
# OR
python -m http.server 8000
```

### 4. Configure API Keys
1. Click the **⚙️ Settings** button in the top-right
2. Enter your Hugging Face API token (required)
3. Optionally add Cohere and Stability AI keys
4. Click **Save Configuration**

Keys are stored in your browser's localStorage and never sent to any third-party server.

---

## 📂 Project Structure

```
pear-media-tool/
├── index.html      # Main HTML structure
├── style.css       # Complete design system & styles
├── app.js          # Application logic & API integrations
└── README.md       # This file
```

---

## 🎨 UI/UX Highlights

- **Dark Mode** — Premium dark theme with glassmorphism effects
- **Animated Background** — Floating gradient orbs for visual depth
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Step-by-Step Workflow** — Clear, guided experience
- **Toast Notifications** — Real-time feedback for all operations
- **Drag & Drop** — Easy image uploads
- **Lightbox** — Full-size image viewing
- **Auto-retry** — Handles model loading delays gracefully

---

## 🌐 Deployment

### GitHub Pages
1. Push code to GitHub
2. Go to Settings → Pages
3. Set source to `main` branch, root directory
4. Your site will be live at `https://YOUR_USERNAME.github.io/pear-media-tool/`

### Netlify
1. Connect your GitHub repo
2. Build command: (leave empty — it's a static site)
3. Publish directory: `.`
4. Deploy!

### Vercel
1. Import your GitHub repo
2. Framework Preset: Other
3. Output Directory: `.`
4. Deploy!

---

## 📋 Project Flow

```
TEXT WORKFLOW:
User Input → NLP Analysis (HF/Cohere) → Enhanced Prompt → User Approval → Image Gen (HF/Stability) → Download/Variations

IMAGE WORKFLOW:
Image Upload → Caption Gen (HF BLIP) → Classification (HF ViT) → Style Analysis → Variation Gen (HF/Stability)
```

---

## ⚠️ Notes

- **Rate Limits**: Free API tiers have rate limits. If you get errors, wait a few seconds and retry.
- **Model Loading**: Hugging Face models may take 20-30 seconds to load on first use (cold start).
- **Image Quality**: Stability AI produces higher quality images than the free HF models.
- **Browser Storage**: API keys are stored only in your browser's localStorage.
- **No Backend Required**: This is a fully client-side application.

---

## 🏗️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Custom CSS with CSS Variables, Glassmorphism, CSS Animations
- **Fonts**: Google Fonts (Inter, JetBrains Mono)
- **APIs**: Hugging Face Inference, Cohere Chat, Stability AI
- **Hosting**: Static deployment (GitHub Pages / Netlify / Vercel)

---

## 📄 License

MIT License — Free for personal and commercial use.

---

Built with 🍐 by **Pear Media**
