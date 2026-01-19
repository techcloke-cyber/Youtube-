// File: /api/download.js
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET and POST requests
    if (!['GET', 'POST'].includes(req.method)) {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url, quality = '720' } = req.method === 'GET' ? req.query : req.body;
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: 'No URL provided' 
            });
        }

        // Validate YouTube URL
        if (!isValidYouTubeUrl(url)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid YouTube URL' 
            });
        }

        // Get download link from y2mate API (free service)
        const downloadResult = await getDownloadLink(url, quality);
        
        if (downloadResult.success) {
            return res.json({
                success: true,
                title: downloadResult.title || 'YouTube Video',
                downloadUrl: downloadResult.downloadUrl,
                quality: quality,
                format: 'mp4'
            });
        } else {
            // Fallback to savefrom.net
            const fallbackUrl = `https://en.savefrom.net/18/#url=${encodeURIComponent(url)}`;
            return res.json({
                success: true,
                title: 'YouTube Video',
                downloadUrl: fallbackUrl,
                quality: quality,
                format: 'mp4',
                note: 'You will be redirected to download page'
            });
        }

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
}

function isValidYouTubeUrl(url) {
    const patterns = [
        /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+/,
        /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
        /^https?:\/\/youtu\.be\/[\w-]+/,
        /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/
    ];
    return patterns.some(pattern => pattern.test(url));
}

async function getDownloadLink(youtubeUrl, quality) {
    try {
        // Use y2mate API (free service)
        const apiUrl = 'https://y2mate.guru/api/convert';
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                url: youtubeUrl,
                format: 'mp4'
            })
        });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.downloadUrl) {
            return {
                success: true,
                downloadUrl: data.downloadUrl,
                title: data.title || 'YouTube Video'
            };
        } else {
            throw new Error('No download URL in response');
        }
        
    } catch (error) {
        console.log('Y2Mate API failed, using fallback:', error.message);
        return { success: false, error: error.message };
    }
}
