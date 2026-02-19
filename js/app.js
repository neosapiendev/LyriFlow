// Mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Core variables
let speed = 1;
let fontSize = isMobile ? 24 : 32;
let position = 0;
let playing = true;
let menuCollapsed = false;
let hideTimer = null;
let isMouseOverMenu = false;
let totalScrollDistance = 0;
let animationFrame = null;
let controlsTimeout = null;

// Recording variables
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let canvasStream = null;
let captureInterval = null;
let recordedFrames = 0;
let recordingStartTime = 0;

// Add these variables after existing declarations
let contentDropdown;
let themeDropdown;
let fileInput;
let videoPlayer;
let fontDisplay;

// Initialize in DOMContentLoaded or after DOM elements are ready
document.addEventListener('DOMContentLoaded', function() {
    contentDropdown = document.getElementById('contentDropdown');
    themeDropdown = document.getElementById('themeDropdown');
    fileInput = document.getElementById('fileInput');
    videoPlayer = document.querySelector('.video-player');
    fontDisplay = document.getElementById('fontDisplay');
    
    // Update font display
    if (fontDisplay) fontDisplay.textContent = fontSize + 'px';
    
    // File input change handler
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.dropdown-container')) {
            if (contentDropdown) contentDropdown.classList.remove('show');
            if (themeDropdown) themeDropdown.classList.remove('show');
        }
    });
});

// Toggle content dropdown
function toggleContentDropdown() {
    if (contentDropdown) {
        contentDropdown.classList.toggle('show');
        if (themeDropdown) themeDropdown.classList.remove('show');
    }
}

// Toggle theme dropdown
function toggleThemeDropdown() {
    if (themeDropdown) {
        themeDropdown.classList.toggle('show');
        if (contentDropdown) contentDropdown.classList.remove('show');
    }
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        localStorage.setItem("scrollTextContent", content);
        renderContent(content);
        if (viewer && scrollEl) {
            position = viewer.offsetHeight;
            scrollEl.style.top = position + "px";
        }
        calculateTotalScrollDistance();
        
        // Close dropdown
        if (contentDropdown) contentDropdown.classList.remove('show');
    };
    reader.readAsText(file);
}

// Load sample content
function loadSampleContent() {
    const sample = `[00:02] Welcome to Scrolling Karaoke!
[00:05] This is a sample text with timestamps
[00:08] You can add your own content by:
[00:12] • Clicking "Edit Text" to paste
[00:15] • Browsing for a local file
[00:18] • Or loading this sample again
[00:22] 
[00:22] Features:
[00:24] • YouTube-style controls
[00:27] • Adjustable font size
[00:30] • Multiple themes
[00:33] • Video recording
[00:36] • File browser support
[00:40] 🎵 Enjoy!`;
    
    localStorage.setItem("scrollTextContent", sample);
    renderContent(sample);
    if (viewer && scrollEl) {
        position = viewer.offsetHeight;
        scrollEl.style.top = position + "px";
    }
    calculateTotalScrollDistance();
    
    if (contentDropdown) contentDropdown.classList.remove('show');
}

// Update video player class based on playing state
function updateVideoPlayerState() {
    if (videoPlayer) {
        if (playing) {
            videoPlayer.classList.add('playing');
        } else {
            videoPlayer.classList.remove('playing');
        }
    }
}

// Update togglePlay function
function togglePlay() {
    playing = !playing;
    
    // Update all play/pause buttons
    if (playPauseBtn) {
        playPauseBtn.innerHTML = playing ? '⏸️' : '▶️';
    }
    if (playBtn) {
        playBtn.innerHTML = playing ? '⏸️' : '▶️';
    }
    if (centerPlayBtn) {
        centerPlayBtn.style.animation = playing ? 'none' : 'fadeIn 0.3s ease';
    }
    
    updateVideoPlayerState();
    
    if (playing) {
        // Auto-hide controls after 3 seconds
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            // Controls auto-hide handled by CSS
        }, 3000);
    }
}

// Update changeFont function
function changeFont(delta) {
    fontSize = Math.max(12, Math.min(72, fontSize + delta));
    scrollEl.style.fontSize = fontSize + "px";
    if (fontDisplay) fontDisplay.textContent = fontSize + 'px';
    calculateTotalScrollDistance();
}

// Update setTheme function
function setTheme(theme) {
    document.body.className = theme;
    if (themeDropdown) themeDropdown.classList.remove('show');
    
    // Update theme button text
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
        const icons = {
            'dark': '🌙',
            'light': '☀️',
            'neon': '💡'
        };
        themeBtn.innerHTML = icons[theme] + ' Theme';
    }
}

// Update toggleFullscreen function
function toggleFullscreen() {
    if (!isRecording) {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
}

// Update changeSpeed function
function changeSpeed(delta) {
    speed = Math.max(0.25, Math.min(3, speed + delta));
    if (speedDisplay) {
        speedDisplay.textContent = speed.toFixed(2) + 'x';
    }
    updateProgress();
    calculateTotalScrollDistance();
}

// Update progress calculation
function updateProgress() {
    if (!scrollEl || !viewer) return;
    
    const scrollPercent = (Math.abs(position) / totalScrollDistance) * 100;
    const progress = Math.min(100, Math.max(0, scrollPercent));
    
    if (progressFill) progressFill.style.width = progress + '%';
    if (progressHandle) progressHandle.style.left = progress + '%';
    
    // Calculate time
    const elapsedSeconds = Math.abs(position) / (Math.abs(speed) * 60);
    const totalSeconds = totalScrollDistance / (Math.abs(speed) * 60);
    
    const formatTime = (seconds) => {
        if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    if (timeDisplay) {
        timeDisplay.textContent = `${formatTime(elapsedSeconds)} / ${formatTime(totalSeconds)}`;
    }
}

// Update seekFromProgress function
function seekFromProgress(event) {
    if (!progressContainer || !scrollEl) return;
    
    const rect = progressContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    position = -((percentage / 100) * totalScrollDistance);
    scrollEl.style.top = position + "px";
    updateProgress();
    
    // Show controls briefly after seeking
    showControls();
}

// Add keyboard shortcut handler
document.addEventListener('keydown', (e) => {
    if (isRecording) return;
    
    if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
    } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        position += speed * 60; // Seek back
        position = Math.min(0, Math.max(-totalScrollDistance, position));
        scrollEl.style.top = position + "px";
        updateProgress();
        showControls();
    } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        position -= speed * 60; // Seek forward
        position = Math.min(0, Math.max(-totalScrollDistance, position));
        scrollEl.style.top = position + "px";
        updateProgress();
        showControls();
    } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
    } else if (e.code === 'BracketLeft') { // [ for slower
        e.preventDefault();
        changeSpeed(-0.25);
    } else if (e.code === 'BracketRight') { // ] for faster
        e.preventDefault();
        changeSpeed(0.25);
    }
});

// Initialize
updateVideoPlayerState();

// DOM Elements
const scrollEl = document.getElementById("scrollText");
const viewer = document.getElementById("viewer");
const previewBox = document.getElementById("previewBox");
const header = document.querySelector("header");
const menuToggle = document.querySelector(".menu-toggle");
const playPauseBtn = document.getElementById("playPauseBtn");
const playBtn = document.getElementById("playBtn");
const centerPlayBtn = document.getElementById("centerPlayBtn");
const speedDisplay = document.getElementById("speedDisplay");
const timeDisplay = document.getElementById("timeDisplay");
const progressFill = document.getElementById("progressFill");
const progressHandle = document.getElementById("progressHandle");
const progressContainer = document.getElementById("progressContainer");
const videoControls = document.getElementById("videoControls");
const recordBtn = document.getElementById("recordBtn");
const recordingIndicator = document.getElementById("recordingIndicator");
const recordingOptions = document.getElementById("recordingOptions");
const recordingOverlay = document.getElementById("recordingOverlay");
const recordingInfoCard = document.getElementById("recordingInfoCard");


// After DOM elements declaration, add click handler for video screen
if (viewer) {
    // Click on video screen toggles play/pause
    viewer.addEventListener('click', (e) => {
        // Don't toggle if clicking on controls or if recording
        if (isRecording) return;
        
        // Check if click target is not a control button
        const isControl = e.target.closest('.control-btn') || 
                         e.target.closest('.center-play-btn') ||
                         e.target.closest('.progress-container');
        
        if (!isControl) {
            togglePlay();
            // Show controls briefly when toggled
            showControls();
        }
    });
    
    // Double-click on video screen toggles fullscreen (like YouTube)
    viewer.addEventListener('dblclick', (e) => {
        if (isRecording) return;
        toggleFullscreen();
    });
    
    // Touch events for mobile
    let touchTimeout;
    viewer.addEventListener('touchstart', (e) => {
        if (isRecording) return;
        
        // Clear existing timeout
        if (touchTimeout) clearTimeout(touchTimeout);
        
        // Set timeout to detect single tap
        touchTimeout = setTimeout(() => {
            const isControl = e.target.closest('.control-btn') || 
                             e.target.closest('.center-play-btn') ||
                             e.target.closest('.progress-container');
            
            if (!isControl) {
                togglePlay();
                showControls();
            }
        }, 200);
    }, { passive: true });
    
    viewer.addEventListener('touchend', (e) => {
        // Prevent double tap zoom
        e.preventDefault();
    }, { passive: false });
}

// Update the togglePlay function to handle center button visibility
function togglePlay() {
    playing = !playing;
    
    // Update all play/pause buttons
    if (playPauseBtn) {
        playPauseBtn.innerHTML = playing ? '⏸️ Pause' : '▶️ Play';
    }
    if (playBtn) {
        playBtn.innerHTML = playing ? '⏸️' : '▶️';
    }
    if (centerPlayBtn) {
        // Show center play button when paused, hide when playing
        centerPlayBtn.style.display = playing ? 'none' : 'flex';
        // Add animation class when showing
        if (!playing) {
            centerPlayBtn.style.animation = 'fadeIn 0.3s ease';
            setTimeout(() => {
                centerPlayBtn.style.animation = '';
            }, 300);
        }
    }
    
    if (playing) {
        showControls();
    }
}

// Add fade-in animation for center button
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
`;
document.head.appendChild(style);

// Update the showControls function to ensure center button doesn't block clicks
function showControls() {
    if (videoControls) {
        videoControls.classList.add('show');
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if (playing && !isRecording) {
                videoControls.classList.remove('show');
            }
        }, 3000);
    }
}

// Make sure center play button doesn't trigger video screen click
if (centerPlayBtn) {
    centerPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from reaching video screen
        togglePlay();
    });
}

// Update progress container click to not toggle play
if (progressContainer) {
    progressContainer.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent togglePlay from being triggered
        seekFromProgress(e);
    });
    
    // Add mousedown for better seeking experience
    progressContainer.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
}

// Handle control buttons to not trigger video screen click
document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
    });
});

// Add keyboard shortcut for play/pause (already exists, but ensure it works)
document.addEventListener('keydown', (e) => {
    if (isRecording) return;
    
    if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
    } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        position += speed * 60; // Seek back 1 second worth of scroll
        scrollEl.style.top = position + "px";
        updateProgress();
        showControls(); // Show controls when seeking
    } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        position -= speed * 60; // Seek forward 1 second worth of scroll
        scrollEl.style.top = position + "px";
        updateProgress();
        showControls(); // Show controls when seeking
    } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
    }
});

// Add fullscreen change listener to update UI
document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        videoPlayer?.classList.add('fullscreen');
    } else {
        videoPlayer?.classList.remove('fullscreen');
    }
});

// Get all buttons for disabling during recording
const allButtons = document.querySelectorAll('button:not(#recordBtn):not(.recording-stop-btn)');
const allSelects = document.querySelectorAll('select');

// Create hidden canvas for recording
const recordCanvas = document.createElement('canvas');
recordCanvas.style.display = 'none';
document.body.appendChild(recordCanvas);
const ctx = recordCanvas.getContext('2d');

// ---------- Markdown → HTML ----------
function mdToHtml(md) {
    let html = md;

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/gim, "<pre>$1</pre>");

    // Headings
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

    // Bold / Italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/gim, "<b><i>$1</i></b>");
    html = html.replace(/\*\*(.*?)\*\*/gim, "<b>$1</b>");
    html = html.replace(/\*(.*?)\*/gim, "<i>$1</i>");

    // Inline code
    html = html.replace(/`([^`]+)`/gim, "<code>$1</code>");

    // Lists
    html = html.replace(/^\- (.*$)/gim, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>");

    // Line breaks
    html = html.replace(/\n/g, "<br>");

    return html.trim();
}

// ---------- Format detection ----------
function detectFormat(text) {
    if (!text) return "text";
    const hasHtml = /<\/?[a-z][\s\S]*>/i.test(text);
    const hasMarkdown =
        /(^# )|(^## )|(^### )|(\*\*)|(\*)|(```)|(`)/m.test(text);

    if (hasHtml) return "html";
    if (hasMarkdown) return "markdown";
    return "text";
}

// ---------- Clean HTML elements (remove attributes) ----------
function cleanElement(element) {
    if (element.nodeType === 3) return;
    
    const tagName = element.tagName ? element.tagName.toLowerCase() : '';
    const preserveTags = ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'ul', 'ol', 'li'];
    
    if (preserveTags.includes(tagName)) {
        while (element.attributes.length > 0) {
            element.removeAttribute(element.attributes[0].name);
        }
    } else {
        const parent = element.parentNode;
        while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
        return;
    }
    
    Array.from(element.childNodes).forEach(child => {
        if (child.nodeType === 1) {
            cleanElement(child);
        }
    });
}

// ---------- Render content to main viewer ----------
function renderContent(raw) {
    const format = detectFormat(raw);
    let html = "";

    if (format === "html") {
        html = raw;
    } else if (format === "markdown") {
        html = mdToHtml(raw);
    } else {
        html = `<pre>${raw}</pre>`;
    }

    const temp = document.createElement("div");
    temp.innerHTML = html;
    
    const existingScrollText = temp.querySelector('.scroll-text');
    
    let contentToProcess;
    if (existingScrollText) {
        contentToProcess = existingScrollText.innerHTML;
        const contentTemp = document.createElement("div");
        contentTemp.innerHTML = contentToProcess;
        Array.from(contentTemp.children).forEach(child => cleanElement(child));
        contentToProcess = contentTemp.innerHTML;
    } else {
        Array.from(temp.children).forEach(child => cleanElement(child));
        contentToProcess = temp.innerHTML;
    }
    
    const lines = contentToProcess.split(/<br\s*\/?>/i);
    
    if (scrollEl) {
        scrollEl.innerHTML = lines
            .map(line => {
                const lineWithSimpleTags = line.replace(/<([a-z][a-z0-9]*)[^>]*>/gi, '<$1>')
                                              .replace(/<\/([a-z][a-z0-9]*)[^>]*>/gi, '</$1>');
                
                const parts = lineWithSimpleTags.split(/(<[^>]+>)/g).filter(p => p.length > 0);
                
                let result = '';
                parts.forEach(part => {
                    if (part.startsWith('<') && part.endsWith('>')) {
                        result += part;
                    } else {
                        const words = part.split(/\s+/).filter(w => w.trim().length > 0);
                        result += words.map(w => `<span class="karaoke-word">${w}</span>`).join(' ');
                    }
                });
                
                return `<div>${result}</div>`;
            })
            .join("<br>");
    }
    
    // Recalculate total scroll distance after content change
    calculateTotalScrollDistance();
}

// Calculate total scroll distance
function calculateTotalScrollDistance() {
    if (scrollEl && viewer) {
        totalScrollDistance = scrollEl.offsetHeight + viewer.offsetHeight;
        const estDurEl = document.getElementById('estDuration');
        const totalDistEl = document.getElementById('totalScrollDist');
        
        if (estDurEl && totalDistEl) {
            totalDistEl.textContent = totalScrollDistance;
            estDurEl.textContent = Math.round(totalScrollDistance / (Math.abs(speed) * 60));
        }
    }
    return totalScrollDistance;
}

// ---------- Live preview in popup ----------
function updatePreview() {
    const raw = document.getElementById("newText").value;
    const format = detectFormat(raw);

    if (format === "html") {
        previewBox.innerHTML = raw;
    } else if (format === "markdown") {
        previewBox.innerHTML = mdToHtml(raw);
    } else {
        previewBox.innerHTML = `<pre>${raw}</pre>`;
    }
}

// ---------- Load saved text ----------
const saved = localStorage.getItem("scrollTextContent");
renderContent(saved || "Your scrolling text goes here...\n\nClick 'Load Text' to add your own content.\n\n✨ Features:\n• Smooth scrolling\n• Word highlighting\n• Multiple themes\n• Video recording\n• YouTube-style player\n• Mobile friendly");
if (scrollEl) {
    scrollEl.style.fontSize = fontSize + "px";
    position = viewer.offsetHeight;
    scrollEl.style.top = position + "px";
}
calculateTotalScrollDistance();

// ---------- Karaoke word highlighting ----------
function highlightKaraokeWord() {
    const words = [...document.querySelectorAll(".karaoke-word")];
    if (!viewer) return;
    
    const mid = viewer.getBoundingClientRect().top + viewer.offsetHeight / 2;

    words.forEach(word => {
        const rect = word.getBoundingClientRect();
        const center = rect.top + rect.height / 2;

        if (center > mid - 15 && center < mid + 15) {
            word.classList.add("karaoke-word-active");
        } else {
            word.classList.remove("karaoke-word-active");
        }
    });
}

// Update progress and time display
function updateProgress() {
    if (!scrollEl || !viewer) return;
    
    const scrollPercent = (Math.abs(position) / totalScrollDistance) * 100;
    const progress = Math.min(100, Math.max(0, scrollPercent));
    
    if (progressFill) progressFill.style.width = progress + '%';
    if (progressHandle) progressHandle.style.left = progress + '%';
    
    // Calculate time
    const elapsedSeconds = Math.abs(position) / (Math.abs(speed) * 60);
    const totalSeconds = totalScrollDistance / (Math.abs(speed) * 60);
    
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    if (timeDisplay) {
        timeDisplay.textContent = `${formatTime(elapsedSeconds)} / ${formatTime(totalSeconds)}`;
    }
}

// ---------- Animation loop ----------
function animate() {
    if (playing && scrollEl) {
        position -= speed;
        scrollEl.style.top = position + "px";

        // Loop the text
        if (position < -scrollEl.offsetHeight) {
            position = viewer.offsetHeight;
        }
        
        updateProgress();
    }

    highlightKaraokeWord();
    
    // Update recording info if recording
    if (isRecording) {
        updateRecordingInfo();
    }
    
    animationFrame = requestAnimationFrame(animate);
}
animate();

// Show/hide video controls
function showControls() {
    if (videoControls) {
        videoControls.classList.add('show');
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if (playing && !isRecording) {
                videoControls.classList.remove('show');
            }
        }, 3000);
    }
}

function hideControls() {
    if (videoControls && playing && !isRecording) {
        videoControls.classList.remove('show');
    }
}

viewer.addEventListener('mousemove', showControls);
viewer.addEventListener('touchstart', showControls);
viewer.addEventListener('mouseleave', hideControls);

// Seek from progress bar
function seekFromProgress(event) {
    if (!progressContainer || !scrollEl) return;
    
    const rect = progressContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    position = -((percentage / 100) * totalScrollDistance);
    scrollEl.style.top = position + "px";
    updateProgress();
}

// ---------- Menu Functions ----------
function toggleMenuCollapse() {
    if (isRecording || !header || !menuToggle) return;
    
    menuCollapsed = !menuCollapsed;
    if (menuCollapsed) {
        header.classList.add("collapsed");
        menuToggle.innerHTML = "▲";
        menuToggle.style.top = "0";
    } else {
        header.classList.remove("collapsed");
        menuToggle.innerHTML = "▼";
        menuToggle.style.top = "10px";
        resetMenuTimer();
    }
}

function resetMenuTimer() {
    if (menuCollapsed || isRecording || !header) return;
    
    clearTimeout(hideTimer);
    header.classList.remove("auto-hide");
    
    hideTimer = setTimeout(() => {
        if (!isMouseOverMenu && !menuCollapsed && !isRecording && header) {
            header.classList.add("auto-hide");
        }
    }, 3000);
}

if (header) {
    header.addEventListener("mouseenter", () => {
        isMouseOverMenu = true;
        if (!menuCollapsed && !isRecording && header) {
            header.classList.remove("auto-hide");
            clearTimeout(hideTimer);
        }
    });

    header.addEventListener("mouseleave", () => {
        isMouseOverMenu = false;
        if (!menuCollapsed && !isRecording) {
            resetMenuTimer();
        }
    });
}

document.addEventListener("mousemove", resetMenuTimer);
document.addEventListener("touchstart", resetMenuTimer);
resetMenuTimer();

// ---------- Controls ----------
function togglePlay() {
    playing = !playing;
    
    if (playPauseBtn) {
        playPauseBtn.innerHTML = playing ? '⏸️ Pause' : '▶️ Play';
    }
    if (playBtn) {
        playBtn.innerHTML = playing ? '⏸️' : '▶️';
    }
    if (centerPlayBtn) {
        centerPlayBtn.style.display = playing ? 'none' : 'flex';
    }
    
    if (playing) {
        showControls();
    }
}

function changeSpeed(delta) {
    speed = Math.max(0.1, Math.min(10, speed + delta));
    if (speedDisplay) {
        speedDisplay.textContent = speed.toFixed(1) + 'x';
    }
    updateProgress();
    calculateTotalScrollDistance();
}

function changeFont(delta) {
    fontSize = Math.max(12, Math.min(72, fontSize + delta));
    scrollEl.style.fontSize = fontSize + "px";
    calculateTotalScrollDistance();
}

function openPopup() {
    if (isRecording) return;
    const popup = document.getElementById("popup");
    if (popup) {
        const raw = localStorage.getItem("scrollTextContent") || "";
        const newText = document.getElementById("newText");
        if (newText) newText.value = raw;
        updatePreview();
        popup.classList.add('show');
    }
}

function closePopup() {
    const popup = document.getElementById("popup");
    if (popup) popup.classList.remove('show');
}

function saveText() {
    const text = document.getElementById("newText").value;
    localStorage.setItem("scrollTextContent", text);
    renderContent(text);
    if (viewer && scrollEl) {
        position = viewer.offsetHeight;
        scrollEl.style.top = position + "px";
    }
    calculateTotalScrollDistance();
    closePopup();
}

function setTheme(theme) {
    document.body.className = theme;
}

function toggleFullscreen() {
    if (!isRecording) {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
}

// ---------- Recording Functions ----------
function showRecordingOptions() {
    if (isRecording || !recordingOptions) return;
    recordingOptions.classList.add('show');
}

function hideRecordingOptions() {
    if (recordingOptions) {
        recordingOptions.classList.remove('show');
    }
}

function applySocialPreset() {
    const preset = document.getElementById('socialPreset').value;
    const customSettings = document.getElementById('customSettings');
    const resolutionSelect = document.getElementById('recordResolution');
    const framerateSelect = document.getElementById('recordFramerate');
    const qualitySelect = document.getElementById('recordQuality');
    
    if (preset === 'custom') {
        customSettings.style.display = 'block';
        return;
    } else {
        customSettings.style.display = 'none';
    }
    
    // Apply presets
    switch(preset) {
        case 'instagram_story':
        case 'instagram_reel':
        case 'whatsapp_status':
        case 'tiktok':
        case 'facebook_story':
        case 'youtube_shorts':
        case 'snapchat':
            resolutionSelect.value = '1080x1920';
            framerateSelect.value = '30';
            qualitySelect.value = '8000000';
            break;
            
        case 'instagram_post':
            resolutionSelect.value = '1080x1080';
            framerateSelect.value = '30';
            qualitySelect.value = '8000000';
            break;
            
        case 'linkedin':
            resolutionSelect.value = '1920x1080';
            framerateSelect.value = '30';
            qualitySelect.value = '5000000';
            break;
            
        case 'twitter':
            resolutionSelect.value = '1280x720';
            framerateSelect.value = '30';
            qualitySelect.value = '5000000';
            break;
            
        default:
            return;
    }
}

async function captureFrame() {
    try {
        if (!viewer || !ctx || !recordCanvas) return false;
        
        const canvas = await html2canvas(viewer, {
            scale: 2,
            backgroundColor: null,
            allowTaint: false,
            useCORS: true,
            logging: false,
            windowWidth: viewer.offsetWidth,
            windowHeight: viewer.offsetHeight
        });
        
        ctx.clearRect(0, 0, recordCanvas.width, recordCanvas.height);
        ctx.fillStyle = getComputedStyle(viewer).backgroundColor || '#111';
        ctx.fillRect(0, 0, recordCanvas.width, recordCanvas.height);
        ctx.drawImage(canvas, 0, 0, recordCanvas.width, recordCanvas.height);
        
        recordedFrames++;
        return true;
        
    } catch (error) {
        console.error('Frame capture error:', error);
        return false;
    }
}

async function startRecording() {
    try {
        const resolutionEl = document.getElementById('recordResolution');
        const framerateEl = document.getElementById('recordFramerate');
        const qualityEl = document.getElementById('recordQuality');
        const formatMP4 = document.getElementById('formatMP4')?.checked || false;
        
        if (!resolutionEl || !framerateEl || !qualityEl) {
            throw new Error('Recording settings elements not found');
        }
        
        const resolution = resolutionEl.value.split('x');
        const framerate = parseInt(framerateEl.value);
        const bitrate = parseInt(qualityEl.value);
        
        const width = parseInt(resolution[0]);
        const height = parseInt(resolution[1]);
        
        // Setup canvas
        recordCanvas.width = width;
        recordCanvas.height = height;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        console.log(`Recording at ${framerate}fps, Resolution: ${width}x${height}`);
        
        // Create canvas stream
        canvasStream = recordCanvas.captureStream(framerate);
        
        // Try to use MP4-compatible codec if requested
        let mimeType = 'video/webm;codecs=vp9';
        let fileExtension = 'webm';
        
        if (formatMP4) {
            const mp4Codecs = [
                'video/mp4;codecs=h264',
                'video/mp4;codecs=avc1',
                'video/mp4'
            ];
            
            for (const codec of mp4Codecs) {
                if (MediaRecorder.isTypeSupported(codec)) {
                    mimeType = codec;
                    fileExtension = 'mp4';
                    break;
                }
            }
        }
        
        // Create MediaRecorder
        mediaRecorder = new MediaRecorder(canvasStream, {
            mimeType: mimeType,
            videoBitsPerSecond: bitrate
        });
        
        // Clear previous chunks
        recordedChunks = [];
        recordedFrames = 0;
        recordingStartTime = Date.now();
        
        // Collect data chunks
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        // Handle recording stop
        mediaRecorder.onstop = () => {
            if (recordingOverlay) recordingOverlay.classList.remove('show');
            if (recordingInfoCard) recordingInfoCard.classList.remove('show');
            
            // Re-enable controls
            setControlsDisabled(false);
            
            // Create video file from chunks
            const blob = new Blob(recordedChunks, { type: mimeType });
            
            if (blob.size === 0) {
                alert('Recording failed - no data captured.');
                return;
            }
            
            // Calculate final stats
            const finalElapsed = (Date.now() - recordingStartTime) / 1000;
            const mins = Math.floor(finalElapsed / 60);
            const secs = Math.floor(finalElapsed % 60);
            
            // Get preset name for filename
            const preset = document.getElementById('socialPreset').value;
            const presetName = preset ? preset.replace('_', '-') : 'custom';
            
            const filename = `karaoke-${presetName}-${width}x${height}-${mins}m${secs}s.${fileExtension}`;
            
            // Download the video
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            
            // Stop capture interval
            if (captureInterval) {
                clearInterval(captureInterval);
                captureInterval = null;
            }
            
            // Update UI
            isRecording = false;
            if (recordBtn) {
                recordBtn.classList.remove('recording');
                recordBtn.innerHTML = '⏺ Record';
            }
            if (recordingIndicator) recordingIndicator.classList.remove('visible');
            
            // Clean up stream
            if (canvasStream) {
                canvasStream.getTracks().forEach(track => track.stop());
            }
            
            // Show success message
            alert(`✅ Recording complete!\n• Duration: ${mins}:${secs.toString().padStart(2, '0')}\n• Resolution: ${width}x${height}\n• Format: ${fileExtension.toUpperCase()}\n• Frames: ${recordedFrames}\n• File size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        };
        
        // Handle recording error
        mediaRecorder.onerror = (error) => {
            console.error('MediaRecorder error:', error);
            stopRecording();
            alert('Recording error occurred. Please try again.');
        };
        
        // Start recording
        mediaRecorder.start(100);
        
        // Start frame capture interval
        const frameInterval = 1000 / framerate;
        captureInterval = setInterval(async () => {
            if (isRecording) {
                await captureFrame();
            }
        }, frameInterval);
        
        // Update UI
        isRecording = true;
        if (recordBtn) {
            recordBtn.classList.add('recording');
            recordBtn.innerHTML = '⏹ Stop';
        }
        if (recordingIndicator) recordingIndicator.classList.add('visible');
        if (recordingInfoCard) recordingInfoCard.classList.add('show');
        hideRecordingOptions();
        
        // Disable all other controls
        setControlsDisabled(true);
        
        // Ensure menu is collapsed
        if (!menuCollapsed) {
            toggleMenuCollapse();
        }
        
    } catch (error) {
        console.error('Recording error:', error);
        alert('Failed to start recording: ' + error.message);
        if (recordingOverlay) recordingOverlay.classList.remove('show');
        setControlsDisabled(false);
    }
}

function stopRecording() {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        if (recordingOverlay) recordingOverlay.classList.add('show');
        mediaRecorder.stop();
    }
}

function setControlsDisabled(disabled) {
    allButtons.forEach(btn => {
        if (btn && btn.id !== 'recordBtn' && btn.id !== 'playPauseBtn' && btn.id !== 'playBtn') {
            btn.disabled = disabled;
        }
    });
    allSelects.forEach(select => {
        if (select) select.disabled = disabled;
    });
    
    if (menuToggle) {
        menuToggle.style.pointerEvents = disabled ? 'none' : 'auto';
        menuToggle.style.opacity = disabled ? '0.3' : '1';
    }
}

function updateRecordingInfo() {
    if (!recordingInfoCard) return;
    
    const elapsed = (Date.now() - recordingStartTime) / 1000;
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    
    const elapsedEl = document.getElementById('elapsedTime');
    const progressPercentEl = document.getElementById('progressPercent');
    const recordingProgressFill = document.getElementById('recordingProgressFill');
    const scrollDistanceEl = document.getElementById('scrollDistance');
    const recordingSpeedEl = document.getElementById('recordingSpeed');
    const framesCapturedEl = document.getElementById('framesCaptured');
    
    if (elapsedEl) elapsedEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    const scrollPercent = (Math.abs(position) / totalScrollDistance) * 100;
    const progress = Math.min(100, Math.max(0, scrollPercent));
    
    if (progressPercentEl) progressPercentEl.textContent = Math.round(progress) + '%';
    if (recordingProgressFill) recordingProgressFill.style.width = progress + '%';
    if (scrollDistanceEl) scrollDistanceEl.textContent = Math.abs(position) + ' px';
    if (recordingSpeedEl) recordingSpeedEl.textContent = speed.toFixed(1) + 'x';
    if (framesCapturedEl) framesCapturedEl.textContent = recordedFrames;
}

// Handle window resize
window.addEventListener('resize', () => {
    if (viewer && scrollEl) {
        position = viewer.offsetHeight;
        scrollEl.style.top = position + "px";
    }
    calculateTotalScrollDistance();
});

// Touch events for mobile
let touchStartY = 0;
if (viewer) {
    viewer.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    viewer.addEventListener('touchmove', (e) => {
        if (!playing && !isRecording && scrollEl) {
            const touchY = e.touches[0].clientY;
            const deltaY = touchY - touchStartY;
            position += deltaY;
            scrollEl.style.top = position + "px";
            touchStartY = touchY;
            updateProgress();
        }
    }, { passive: true });
}

// Live preview input listener
const newText = document.getElementById("newText");
if (newText) {
    newText.addEventListener("input", updatePreview);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (isRecording) return;
    
    if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
    } else if (e.code === 'ArrowLeft') {
        position += speed * 60; // Seek back 1 second worth of scroll
        scrollEl.style.top = position + "px";
        updateProgress();
    } else if (e.code === 'ArrowRight') {
        position -= speed * 60; // Seek forward 1 second worth of scroll
        scrollEl.style.top = position + "px";
        updateProgress();
    }
});

// Handle before unload to stop recording
window.addEventListener('beforeunload', () => {
    if (isRecording) {
        stopRecording();
    }
});

// Initialize
if (speedDisplay) speedDisplay.textContent = speed.toFixed(1) + 'x';
if (centerPlayBtn) centerPlayBtn.style.display = playing ? 'none' : 'flex';
