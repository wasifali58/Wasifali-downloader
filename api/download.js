const axios = require("axios");

// ============================================
// User-specified APIs (Only these three)
// ============================================
const APIS = {
    sbsakib: "https://sbsakib.eu.cc/api/All_v/?download={url}",
    telesocial: "https://tele-social.vercel.app/down?url={url}",
    nepcoder: "https://nepcoderapis.pages.dev/api/v1/video/download?url={url}"
};

// Platform-specific try order (only the three APIs)
const PLATFORM_SOURCES = {
    youtube: [APIS.sbsakib, APIS.nepcoder],
    instagram: [APIS.telesocial, APIS.nepcoder],
    tiktok: [APIS.telesocial, APIS.nepcoder],
    facebook: [APIS.telesocial, APIS.nepcoder]
};

// All-in-One try order (sbsakib first for YouTube)
const ALL_SOURCES = [APIS.sbsakib, APIS.telesocial, APIS.nepcoder];

// ============================================
// Remove foreign credits and clean data
// ============================================
function stripForeignCredits(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => stripForeignCredits(item));
    
    const cleaned = {};
    const keysToRemove = ['credit', 'credits', 'developer', 'creator', 'author', 'source', '_source', '_platform', 'status', 'success', 'error', 'message'];
    
    for (let key in obj) {
        if (!keysToRemove.includes(key.toLowerCase())) {
            cleaned[key] = stripForeignCredits(obj[key]);
        }
    }
    return cleaned;
}

// ============================================
// Extract video URL from any response format
// ============================================
function extractVideoUrl(data) {
    // Direct video URL
    if (typeof data === 'string' && (data.includes('.mp4') || data.includes('video'))) return data;
    
    // Common fields
    const videoFields = ['video', 'url', 'download_url', 'downloadUrl', 'video_url', 'videoUrl', 'source', 'play'];
    for (const field of videoFields) {
        if (data[field] && typeof data[field] === 'string') return data[field];
    }
    
    // Links array (sbsakib format)
    if (data.links && Array.isArray(data.links)) {
        const videoLink = data.links.find(l => l.type === 'video' || l.resolution);
        if (videoLink) return videoLink.download_url || videoLink.url;
    }
    
    // Media array (telesocial/nepcoder format)
    if (data.media && Array.isArray(data.media)) {
        const videoItem = data.media.find(m => m.type === 'video' || m.url?.includes('.mp4'));
        if (videoItem) return videoItem.url || videoItem.video;
    }
    
    // Nested data
    if (data.data) return extractVideoUrl(data.data);
    if (data.result) return extractVideoUrl(data.result);
    
    return null;
}

// ============================================
// Try fetching from a single API
// ============================================
async function tryFetch(apiTemplate, videoUrl) {
    const apiUrl = apiTemplate.replace('{url}', encodeURIComponent(videoUrl));
    const response = await axios.get(apiUrl, { timeout: 15000 });
    let data = response.data;
    
    // Unwrap nested data
    if (data && typeof data === 'object') {
        if (data.data && typeof data.data === 'object') data = data.data;
        if (data.status === "success" && data.data) data = data.data;
        if (data.success === true && data.data) data = data.data;
        if (data.result) data = data.result;
    }
    
    // Clean data
    data = stripForeignCredits(data);
    
    // Ensure video URL is present
    const videoUrl_extracted = extractVideoUrl(data);
    if (!videoUrl_extracted) return null;
    
    // Return with guaranteed video field
    return {
        ...data,
        video: videoUrl_extracted
    };
}

// ============================================
// Try sources sequentially until one succeeds
// ============================================
async function fetchFromSources(sources, videoUrl) {
    for (const source of sources) {
        try {
            const result = await tryFetch(source, videoUrl);
            if (result) return result;
        } catch (err) {
            // Continue to next source
        }
    }
    return null;
}

// ============================================
// Main handler
// ============================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: "URL parameter is required. Example: /api/youtube?url=https://youtu.be/xxx",
            developer: "WASIF ALI",
            telegram: "@FREEHACKS95"
        });
    }

    const path = req.url.split('?')[0];
    let platform = null;
    let sources = ALL_SOURCES;

    if (path.includes('/youtube')) { platform = "youtube"; sources = PLATFORM_SOURCES.youtube; }
    else if (path.includes('/instagram')) { platform = "instagram"; sources = PLATFORM_SOURCES.instagram; }
    else if (path.includes('/tiktok')) { platform = "tiktok"; sources = PLATFORM_SOURCES.tiktok; }
    else if (path.includes('/facebook')) { platform = "facebook"; sources = PLATFORM_SOURCES.facebook; }

    const data = await fetchFromSources(sources, url);
    
    if (!data) {
        return res.status(404).json({
            success: false,
            error: `Could not download media${platform ? ' from ' + platform : ''}. Please check the URL or try again later.`,
            developer: "WASIF ALI",
            telegram: "@FREEHACKS95"
        });
    }

    const response = {
        success: true,
        ...data,
        developer: "WASIF ALI",
        telegram: "@FREEHACKS95"
    };
    
    if (platform) response.platform = platform;
    res.status(200).json(response);
}
