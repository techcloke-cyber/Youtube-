// Main Application Script
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const urlInput = document.getElementById('urlInput');
    const pasteBtn = document.getElementById('pasteBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const qualityOptions = document.querySelectorAll('.quality-option');
    const progressSection = document.getElementById('progressSection');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const statusText = document.getElementById('statusText');
    const speedText = document.getElementById('speedText');
    const etaText = document.getElementById('etaText');
    const cancelBtn = document.getElementById('cancelBtn');
    const resultSection = document.getElementById('resultSection');
    const resultMessage = document.getElementById('resultMessage');
    const downloadLink = document.getElementById('downloadLink');
    const newDownloadBtn = document.getElementById('newDownloadBtn');
    const urlStatus = document.getElementById('urlStatus');

    // State
    let currentQuality = '720';
    let isDownloading = false;
    let currentDownloadId = null;

    // Initialize
    initializeEventListeners();
    loadSettings();

    // Event Listeners
    function initializeEventListeners() {
        // Paste button
        pasteBtn.addEventListener('click', handlePaste);
        
        // URL validation
        urlInput.addEventListener('input', validateUrl);
        urlInput.addEventListener('blur', validateUrl);
        
        // Quality selection
        qualityOptions.forEach(option => {
            option.addEventListener('click', () => {
                setActiveQuality(option.dataset.quality);
                saveSettings();
            });
        });
        
        // Download button
        downloadBtn.addEventListener('click', handleDownload);
        
        // Cancel button
        cancelBtn.addEventListener('click', cancelDownload);
        
        // New download button
        newDownloadBtn.addEventListener('click', resetForm);
        
        // Modal controls
        document.getElementById('faqBtn').addEventListener('click', (e) => {
            e.preventDefault();
            showModal('faqModal');
        });
        
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
            });
        });
        
        // Close modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'v' && document.activeElement !== urlInput) {
                e.preventDefault();
                handlePaste();
            }
            
            if (e.key === 'Enter' && document.activeElement === urlInput) {
                handleDownload();
            }
        });
    }

    // Functions
    async function handlePaste() {
        try {
            const text = await navigator.clipboard.readText();
            urlInput.value = text;
            validateUrl();
            
            // Auto-select quality based on URL type
            if (text.includes('/shorts/')) {
                setActiveQuality('best');
            }
        } catch (err) {
            console.error('Failed to paste:', err);
            showNotification('Unable to paste. Please paste manually.', 'error');
        }
    }

    function validateUrl() {
        const url = urlInput.value.trim();
        
        if (!url) {
            urlStatus.textContent = 'Enter a valid YouTube URL';
            urlStatus.style.color = '#718096';
            return false;
        }
        
        if (isValidYouTubeUrl(url)) {
            urlStatus.textContent = '✓ Valid YouTube URL';
            urlStatus.style.color = '#48bb78';
            return true;
        } else {
            urlStatus.textContent = '✗ Invalid YouTube URL';
            urlStatus.style.color = '#e53e3e';
            return false;
        }
    }

    function isValidYouTubeUrl(url) {
        const patterns = [
            /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+/,
            /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
            /^https?:\/\/youtu\.be\/[\w-]+/,
            /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
            /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
            /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[\w-]+/
        ];
        
        return patterns.some(pattern => pattern.test(url));
    }

    function setActiveQuality(quality) {
        qualityOptions.forEach(option => {
            if (option.dataset.quality === quality) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
        currentQuality = quality;
    }

    async function handleDownload() {
        const url = urlInput.value.trim();
        
        // Validation
        if (!url) {
            showNotification('Please enter a YouTube URL', 'error');
            return;
        }
        
        if (!isValidYouTubeUrl(url)) {
            showNotification('Please enter a valid YouTube URL', 'error');
            return;
        }
        
        if (isDownloading) {
            showNotification('A download is already in progress', 'error');
            return;
        }
        
        // Start download
        isDownloading = true;
        currentDownloadId = Date.now().toString();
        
        // Update UI
        downloadBtn.disabled = true;
        progressSection.style.display = 'block';
        resultSection.style.display = 'none';
        
        // Reset progress
        updateProgress(0, 'Starting download...', '--', '--');
        
        try {
            // Get video info first
            updateProgress(5, 'Getting video information...', '--', '--');
            const videoInfo = await getVideoInfo(url);
            
            if (!videoInfo.success) {
                throw new Error(videoInfo.error || 'Failed to get video information');
            }
            
            // Start download
            updateProgress(10, 'Preparing download...', '--', '--');
            const downloadResult = await startDownload(url, currentQuality);
            
            if (!downloadResult.success) {
                throw new Error(downloadResult.error || 'Download failed');
            }
            
            // Show success
            updateProgress(100, 'Download complete!', '--', '--');
            showResult(videoInfo.title, downloadResult.downloadUrl);
            
        } catch (error) {
            console.error('Download error:', error);
            updateProgress(0, `Error: ${error.message}`, '--', '--');
            
            // Try alternative method
            setTimeout(async () => {
                try {
                    updateProgress(10, 'Trying alternative method...', '--', '--');
                    const fallbackResult = await tryFallbackDownload(url);
                    
                    if (fallbackResult.success) {
                        updateProgress(100, 'Download complete!', '--', '--');
                        showResult('YouTube Video', fallbackResult.downloadUrl);
                    } else {
                        throw new Error('All download methods failed');
                    }
                } catch (fallbackError) {
                    updateProgress(0, `Failed: ${fallbackError.message}`, '--', '--');
                    showNotification('Download failed. Please try another video.', 'error');
                }
            }, 2000);
            
        } finally {
            // Reset download state after delay
            setTimeout(() => {
                isDownloading = false;
                downloadBtn.disabled = false;
            }, 3000);
        }
    }

    async function getVideoInfo(url) {
        try {
            // Simulate API call (in real implementation, this would call your backend)
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        success: true,
                        title: 'YouTube Video',
                        duration: '0:00',
                        quality: currentQuality + 'p'
                    });
                }, 1000);
            });
            
            // Actual implementation would be:
            // const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
            // return await response.json();
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function startDownload(url, quality) {
        return new Promise((resolve) => {
            // Simulate download progress
            let progress = 10;
            let speed = '1.2 MB/s';
            let eta = '00:45';
            
            const interval = setInterval(() => {
                if (!isDownloading) {
                    clearInterval(interval);
                    return;
                }
                
                progress += Math.random() * 15;
                
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    
                    // Generate mock download URL
                    const mockDownloadUrl = `https://example.com/download/${Date.now()}.mp4`;
                    
                    setTimeout(() => {
                        resolve({
                            success: true,
                            downloadUrl: mockDownloadUrl,
                            filename: `youtube_video_${Date.now()}.mp4`
                        });
                    }, 1000);
                }
                
                // Update progress display
                updateProgress(
                    Math.min(progress, 99),
                    `Downloading... ${Math.floor(progress)}%`,
                    speed,
                    eta
                );
                
                // Randomize speed and ETA occasionally
                if (Math.random() > 0.8) {
                    speed = `${(Math.random() * 2 + 0.5).toFixed(1)} MB/s`;
                    eta = `00:${Math.floor(Math.random() * 30 + 15).toString().padStart(2, '0')}`;
                }
                
            }, 500);
        });
    }

    async function tryFallbackDownload(url) {
        // This would use a different API/service as fallback
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    downloadUrl: `https://fallback-service.com/download/${Date.now()}`,
                    filename: 'youtube_video.mp4'
                });
            }, 2000);
        });
    }

    function updateProgress(percent, status, speed, eta) {
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `${Math.floor(percent)}%`;
        statusText.textContent = status;
        speedText.textContent = `Speed: ${speed}`;
        etaText.textContent = `ETA: ${eta}`;
    }

    function showResult(title, downloadUrl) {
        resultMessage.textContent = `"${title}" has been converted to a single MP4 file.`;
        downloadLink.href = downloadUrl;
        downloadLink.download = `${title.replace(/[^\w\s]/gi, '')}.mp4`;
        
        progressSection.style.display = 'none';
        resultSection.style.display = 'block';
        
        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function cancelDownload() {
        if (isDownloading) {
            isDownloading = false;
            updateProgress(0, 'Download canceled', '--', '--');
            showNotification('Download canceled', 'info');
            
            setTimeout(() => {
                progressSection.style.display = 'none';
                downloadBtn.disabled = false;
            }, 1500);
        }
    }

    function resetForm() {
        urlInput.value = '';
        resultSection.style.display = 'none';
        progressSection.style.display = 'none';
        urlStatus.textContent = 'Enter a valid YouTube URL';
        urlStatus.style.color = '#718096';
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show with animation
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Remove after delay
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        // Add notification styles if not already present
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 10000;
                    transform: translateX(100%);
                    opacity: 0;
                    transition: all 0.3s ease;
                    max-width: 400px;
                }
                .notification.show {
                    transform: translateX(0);
                    opacity: 1;
                }
                .notification-error {
                    border-left: 4px solid #e53e3e;
                }
                .notification-info {
                    border-left: 4px solid #3182ce;
                }
                .notification i {
                    font-size: 1.2rem;
                }
                .notification-error i {
                    color: #e53e3e;
                }
                .notification-info i {
                    color: #3182ce;
                }
            `;
            document.head.appendChild(style);
        }
    }

    function saveSettings() {
        const settings = {
            quality: currentQuality
        };
        localStorage.setItem('youtubeDownloaderSettings', JSON.stringify(settings));
    }

    function loadSettings() {
        const saved = localStorage.getItem('youtubeDownloaderSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                if (settings.quality) {
                    setActiveQuality(settings.quality);
                }
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }
    }
});
