// Mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Core variables
let speed = 1;
let fontSize = isMobile ? 24 : 28;
let position = 0;
let playing = true;
let menuCollapsed = false;
let hideTimer = null;
let isMouseOverMenu = false;

// Recording variables
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let canvasStream = null;
let captureInterval = null;
let recordedFrames = 0;
let recordingStartTime = 0;
let totalScrollDistance = 0;
let initialPosition = 0;

// DOM Elements
const scrollEl = document.getElementById("scrollText");
const viewer = document.getElementById("viewer");
const previewBox = document.getElementById("previewBox");
const header = document.querySelector("header");
const menuToggle = document.querySelector(".menu-toggle");
const recordBtn = document.getElementById("recordBtn");
const recordingIndicator = document.getElementById("recordingIndicator");
const recordingOptions = document.getElementById("recordingOptions");
const recordingOverlay = document.getElementById("recordingOverlay");
const recordingInfoCard = document.getElementById("recordingInfoCard");

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
        // Update estimated duration if elements exist
        const estDurEl = document.getElementById('estDuration');
        const totalDistEl = document.getElementById('totalScrollDist');
        const speedEl = document.getElementById('recordSpeed');
        
        if (estDurEl && totalDistEl && speedEl) {
            const speed = parseFloat(speedEl.value) || 1;
            const estimatedSeconds = Math.round(totalScrollDistance / (Math.abs(speed) * 60));
            totalDistEl.textContent = totalScrollDistance;
            estDurEl.textContent = estimatedSeconds;
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
renderContent(saved || "Your scrolling text goes here...\n\nClick 'Load Text' to add your own content.\n\n✨ Features:\n• Smooth scrolling\n• Word highlighting\n• Multiple themes\n• Video recording\n• MP4 direct recording\n• Mobile friendly");
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

// ---------- Animation loop ----------
function animate() {
    if (playing && scrollEl) {
        position -= speed;
        scrollEl.style.top = position + "px";

        // Loop the text
        if (position < -scrollEl.offsetHeight) {
            position = viewer.offsetHeight;
        }
    }

    highlightKaraokeWord();
    
    // Update recording info if recording
    if (isRecording) {
        updateRecordingInfo();
    }
    
    requestAnimationFrame(animate);
}
animate();

// Update recording info card
function updateRecordingInfo() {
    if (!recordingInfoCard) return;
    
    const elapsed = (Date.now() - recordingStartTime) / 1000;
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    
    const elapsedEl = document.getElementById('elapsedTime');
    const progressPercentEl = document.getElementById('progressPercent');
    const progressFillEl = document.getElementById('progressFill');
    const scrollDistanceEl = document.getElementById('scrollDistance');
    const currentSpeedEl = document.getElementById('currentSpeed');
    const framesCapturedEl = document.getElementById('framesCaptured');
    
    if (elapsedEl) elapsedEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    // Calculate progress based on scroll position
    if (totalScrollDistance > 0) {
        const scrolledDistance = initialPosition - position;
        const progress = Math.min(100, (scrolledDistance / totalScrollDistance) * 100);
        if (progressPercentEl) progressPercentEl.textContent = `${Math.round(progress)}%`;
        if (progressFillEl) progressFillEl.style.width = `${progress}%`;
        if (scrollDistanceEl) scrollDistanceEl.textContent = `${Math.round(scrolledDistance)} px`;
    }
    
    if (currentSpeedEl) currentSpeedEl.textContent = `${speed.toFixed(1)}x`;
    if (framesCapturedEl) framesCapturedEl.textContent = recordedFrames;
}

// Disable all controls during recording
function setControlsDisabled(disabled) {
    allButtons.forEach(btn => {
        if (btn && btn.id !== 'recordBtn') {
            btn.disabled = disabled;
        }
    });
    allSelects.forEach(select => {
        if (select) select.disabled = disabled;
    });
    
    // Also disable menu toggle during recording
    if (menuToggle) {
        if (disabled) {
            menuToggle.style.pointerEvents = 'none';
            menuToggle.style.opacity = '0.3';
        } else {
            menuToggle.style.pointerEvents = 'auto';
            menuToggle.style.opacity = '1';
        }
    }
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

// ---------- Recording Functions ----------
function showRecordingOptions() {
    if (isRecording || !recordingOptions) return;
    recordingOptions.classList.add('show');
    updateEstimatedDuration();
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
    const speedSelect = document.getElementById('recordSpeed');
    
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
            speedSelect.value = '1';
            break;
            
        case 'instagram_post':
            resolutionSelect.value = '1920x1920';
            framerateSelect.value = '30';
            qualitySelect.value = '8000000';
            speedSelect.value = '1';
            break;
            
        case 'linkedin':
            resolutionSelect.value = '1920x1080';
            framerateSelect.value = '30';
            qualitySelect.value = '5000000';
            speedSelect.value = '0.75';
            break;
            
        case 'twitter':
            resolutionSelect.value = '1280x720';
            framerateSelect.value = '30';
            qualitySelect.value = '5000000';
            speedSelect.value = '1';
            break;
            
        default:
            return;
    }
    
    setTimeout(updateEstimatedDuration, 100);
}

function updateEstimatedDuration() {
    const speed = parseFloat(document.getElementById('recordSpeed').value);
    const distance = calculateTotalScrollDistance();
    const estimatedSeconds = Math.round(distance / (Math.abs(speed) * 60));
    
    document.getElementById('totalScrollDist').textContent = distance;
    document.getElementById('estDuration').textContent = estimatedSeconds;
}

 // Updated captureFrame function with proper text scaling
async function captureFrame() {
    try {
        if (!viewer || !ctx || !recordCanvas) return false;
        
        // Get the actual viewer dimensions
        const viewerRect = viewer.getBoundingClientRect();
        
        // Calculate scaling factors
        const scaleX = recordCanvas.width / viewerRect.width;
        const scaleY = recordCanvas.height / viewerRect.height;
        
        // Use a temporary canvas for better quality
        const tempCanvas = await html2canvas(viewer, {
            scale: 2, // Capture at 2x for better quality
            backgroundColor: null,
            allowTaint: false,
            useCORS: true,
            logging: false,
            windowWidth: viewer.offsetWidth,
            windowHeight: viewer.offsetHeight,
            onclone: (clonedDoc) => {
                // Style the cloned element for better rendering
                const clonedViewer = clonedDoc.getElementById('viewer');
                const clonedText = clonedDoc.getElementById('scrollText');
                if (clonedText && clonedViewer) {
                    clonedText.style.top = position + 'px';
                    clonedText.style.fontSize = fontSize + 'px';
                    clonedText.style.lineHeight = '1.5';
                    clonedText.style.letterSpacing = 'normal';
                    clonedText.style.wordBreak = 'normal';
                    clonedText.style.whiteSpace = 'normal';
                }
            }
        });
        
        // Clear the canvas
        ctx.clearRect(0, 0, recordCanvas.width, recordCanvas.height);
        
        // Fill with background color
        ctx.fillStyle = getComputedStyle(viewer).backgroundColor || '#111';
        ctx.fillRect(0, 0, recordCanvas.width, recordCanvas.height);
        
        // Draw the captured image with proper scaling
        ctx.drawImage(
            tempCanvas, 
            0, 0, tempCanvas.width, tempCanvas.height,
            0, 0, recordCanvas.width, recordCanvas.height
        );
        
        recordedFrames++;
        return true;
        
    } catch (error) {
        console.error('Frame capture error:', error);
        return false;
    }
}

 // Update the canvas setup in startRecording function
async function startRecording() {
    try {
        // Get recording settings
        const resolutionEl = document.getElementById('recordResolution');
        const framerateEl = document.getElementById('recordFramerate');
        const qualityEl = document.getElementById('recordQuality');
        const speedEl = document.getElementById('recordSpeed');
        const formatMP4 = document.getElementById('formatMP4').checked;
        
        if (!resolutionEl || !framerateEl || !qualityEl || !speedEl) {
            throw new Error('Recording settings elements not found');
        }
        
        const resolution = resolutionEl.value.split('x');
        const framerate = parseInt(framerateEl.value);
        const bitrate = parseInt(qualityEl.value);
        const recordingSpeed = parseFloat(speedEl.value);
        
        // Set the actual scroll speed for recording
        speed = recordingSpeed;
        
        const width = parseInt(resolution[0]);
        const height = parseInt(resolution[1]);
        
        // Setup canvas with proper dimensions
        recordCanvas.width = width;
        recordCanvas.height = height;
        
        // Set canvas rendering context for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        console.log(`Recording at speed: ${recordingSpeed}x, Framerate: ${framerate}fps, Resolution: ${width}x${height}`);
        
        // Create canvas stream
        canvasStream = recordCanvas.captureStream(framerate);
        
        // Try to use MP4-compatible codec if requested
        let mimeType = 'video/webm;codecs=vp9';
        let fileExtension = 'webm';
        
        if (formatMP4) {
            // Try to find a compatible MP4 codec
            const mp4Codecs = [
                'video/mp4;codecs=h264',
                'video/mp4;codecs=avc1',
                'video/mp4'
            ];
            
            for (const codec of mp4Codecs) {
                if (MediaRecorder.isTypeSupported(codec)) {
                    mimeType = codec;
                    fileExtension = 'mp4';
                    console.log('Using MP4 codec:', codec);
                    break;
                }
            }
            
            if (fileExtension !== 'mp4') {
                console.log('MP4 recording not supported, falling back to WebM');
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
        
        // Store initial position
        initialPosition = position;
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
            const blob = new Blob(recordedChunks, {
                type: mimeType
            });
            
            if (blob.size === 0) {
                alert('Recording failed - no data captured. Please try again with different settings.');
                return;
            }
            
            // Calculate final stats
            const finalElapsed = (Date.now() - recordingStartTime) / 1000;
            const mins = Math.floor(finalElapsed / 60);
            const secs = Math.floor(finalElapsed % 60);
            
            // Get preset name for filename
            const preset = document.getElementById('socialPreset').value;
            const presetName = preset ? preset.replace('_', '-') : 'custom';
            
            // Determine file extension based on actual recording
            const actualExtension = blob.type.includes('mp4') ? 'mp4' : 'webm';
            const filename = `karaoke-${presetName}-${recordingSpeed}x-${width}x${height}-${mins}m${secs}s.${actualExtension}`;
            
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
            alert(`✅ Recording complete!\n• Duration: ${mins}:${secs.toString().padStart(2, '0')}\n• Speed: ${recordingSpeed}x\n• Resolution: ${width}x${height}\n• Format: ${actualExtension.toUpperCase()}\n• File size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
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
                
                // Auto-stop if scroll completed
                if (scrollEl && position < -scrollEl.offsetHeight + 100) {
                    stopRecording();
                }
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
        
        // Auto-play if not already playing
        if (!playing) {
            togglePlay();
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

// ---------- Controls ----------
function togglePlay() {
    if (!isRecording) {
        playing = !playing;
    }
}

function changeSpeed(delta) {
    if (!isRecording) {
        speed = Math.max(0.1, Math.min(10, speed + delta));
    }
}

function changeFont(delta) {
    if (!isRecording && scrollEl) {
        fontSize = Math.max(12, Math.min(72, fontSize + delta));
        scrollEl.style.fontSize = fontSize + "px";
        calculateTotalScrollDistance();
    }
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
    if (!isRecording) {
        document.body.className = theme;
    }
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

// Add this function to adjust text size based on preset
function adjustTextSizeForPreset(preset) {
    if (!scrollEl) return;
    
    const baseFontSize = fontSize;
    let scaleFactor = 1;
    
    switch(preset) {
        case 'instagram_story':
        case 'instagram_reel':
        case 'whatsapp_status':
        case 'tiktok':
        case 'facebook_story':
        case 'youtube_shorts':
        case 'snapchat':
            // Portrait mode - slightly smaller text
            scaleFactor = 0.9;
            break;
            
        case 'instagram_post':
            // Square - medium text
            scaleFactor = 1;
            break;
            
        case 'linkedin':
            // Landscape - larger text
            scaleFactor = 1.2;
            break;
            
        case 'twitter':
            // Landscape - slightly larger
            scaleFactor = 1.1;
            break;
            
        default:
            scaleFactor = 1;
    }
    
    scrollEl.style.fontSize = (baseFontSize * scaleFactor) + 'px';
}

// Update the applySocialPreset function to include text scaling
function applySocialPreset() {
    const preset = document.getElementById('socialPreset').value;
    const customSettings = document.getElementById('customSettings');
    const resolutionSelect = document.getElementById('recordResolution');
    const framerateSelect = document.getElementById('recordFramerate');
    const qualitySelect = document.getElementById('recordQuality');
    const speedSelect = document.getElementById('recordSpeed');
    
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
            speedSelect.value = '1';
            break;
            
        case 'instagram_post':
            resolutionSelect.value = '1920x1920';
            framerateSelect.value = '30';
            qualitySelect.value = '8000000';
            speedSelect.value = '1';
            break;
            
        case 'linkedin':
            resolutionSelect.value = '1920x1080';
            framerateSelect.value = '30';
            qualitySelect.value = '5000000';
            speedSelect.value = '0.75';
            break;
            
        case 'twitter':
            resolutionSelect.value = '1280x720';
            framerateSelect.value = '30';
            qualitySelect.value = '5000000';
            speedSelect.value = '1';
            break;
            
        default:
            return;
    }
    
    // Adjust text size for the preset
    adjustTextSizeForPreset(preset);
    
    setTimeout(updateEstimatedDuration, 100);
}

// Handle orientation change on mobile
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
        }
    }, { passive: true });
}

// Live preview input listener
const newText = document.getElementById("newText");
if (newText) {
    newText.addEventListener("input", updatePreview);
}

// Handle before unload to stop recording
window.addEventListener('beforeunload', () => {
    if (isRecording) {
        stopRecording();
    }
});

// Add event listener for speed changes to update duration
document.addEventListener('DOMContentLoaded', function() {
    const speedSelect = document.getElementById('recordSpeed');
    if (speedSelect) {
        speedSelect.addEventListener('change', updateEstimatedDuration);
    }
    
    setTimeout(updateEstimatedDuration, 500);
});