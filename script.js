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
                            filename: `youtube_video_
