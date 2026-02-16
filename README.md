# LyriFlow
A clean, musician‑friendly scrolling text viewer with HTML/Markdown support, karaoke word‑highlighting, auto‑hide controls, fullscreen mode, and persistent storage. Designed for stage performers, drummers, percussionists, singers, and presenters who need a distraction‑free teleprompter‑style experience

- Smooth bottom‑to‑top auto‑scroll  
- HTML, Markdown, and plain‑text support  
- Automatic HTML cleaning (removes classes, ids, inline styles)  
- Karaoke‑style **word‑by‑word highlighting**  
- Live preview while editing  
- Auto‑hiding control bar  
- Fullscreen mode  
- Persistent storage (localStorage)  
- Adjustable speed and font size  
- Zero dependencies — pure HTML/CSS/JS  

Perfect for:
- Stage performers  
- Percussion ensembles  
- Singers and lyric readers  
- Teleprompter‑style presentations  
- Practice sessions  
- Tamil lyric scrolling (fully Unicode‑safe)  

---

## ✨ Features

### 🎤 Karaoke Word‑Highlighting  
As the text scrolls, the word closest to the center of the screen is automatically highlighted.  
This creates a smooth karaoke‑style reading experience without needing timestamps or cues.

### 📝 HTML / Markdown / Plain Text Support  
Paste any of the following:

- **HTML**  
- **Markdown**  
- **Plain text**

The viewer automatically detects the format and renders it correctly.

### 🧹 Automatic HTML Cleaning  
To prevent CSS collisions and broken rendering:

- All `class=""`, `id=""`, and `style=""` attributes are removed  
- Only clean, safe HTML is rendered  
- Your internal layout stays intact  
- User content never breaks the UI  

### 👀 Live Preview  
While editing text in the popup, a live preview shows exactly how it will render.

### 🎛 Adjustable Controls  
- Speed (slower/faster)  
- Font size (+ / –)  
- Theme (Dark / Light / Neon)  
- Fullscreen toggle  

### 🧭 Auto‑Hiding Menu Bar  
The control bar fades away after a few seconds of inactivity for a cinematic, distraction‑free experience.

### 💾 Persistent Storage  
Your last loaded text is saved automatically using `localStorage`.

---

## 🚀 Getting Started

Clone or download the repository:

```bash
git clone https://github.com/<your-username>/<repo-name>.git
