// YouTube Filter Bubble Tracker - Content Script
// Scrapes homepage recommendations and sends to background script

class YouTubeRecommendationTracker {
  constructor() {
    this.selectors = {
      // Modern YouTube containers
      primary: 'ytd-rich-item-renderer',
      fallback1: 'ytd-video-renderer', 
      fallback2: 'ytd-compact-video-renderer',
      // Video link selectors (more specific)
      videoLinks: [
        'a#video-title-link',
        'a[href*="/watch"]',
        '#video-title-link'
      ],
      // Title selectors
      titles: [
        '#video-title',
        'h3 a',
        '.ytd-video-meta h3',
        'yt-formatted-string#video-title'
      ],
      // Channel selectors  
      channels: [
        '#channel-name a',
        '.ytd-channel-name a',
        'ytd-channel-name a',
        '#text a'
      ]
    };
    
    this.processedVideos = new Set();
    this.init();
  }

  init() {
    // Only track on YouTube homepage
    if (window.location.pathname !== '/') {
      console.log('YouTube Tracker: Not on homepage, skipping tracking');
      return;
    }

    console.log('YouTube Tracker: Initializing on homepage');

    // Wait for page to load, then track recommendations with multiple attempts
    this.initializeTracking();

    // Set up observer for dynamic content loading
    this.setupMutationObserver();
  }
  
  async initializeTracking() {
    // Try immediately if DOM is ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }
    
    // Try multiple times with delays to handle dynamic loading
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`YouTube Tracker: Tracking attempt ${attempt}/${maxAttempts}`);
      
      this.trackRecommendations();
      
      // Wait before next attempt (except on last attempt)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  trackRecommendations() {
    console.log('YouTube Tracker: Starting recommendation tracking...');
    const recommendations = this.extractRecommendations();
    
    if (recommendations.length > 0) {
      console.log(`YouTube Tracker: Found ${recommendations.length} recommendations`, recommendations);
      
      // Send to background script for storage and processing
      chrome.runtime.sendMessage({
        action: 'storeRecommendations',
        data: recommendations
      }, (response) => {
        if (response && response.success) {
          console.log('YouTube Tracker: Data stored successfully');
        } else {
          console.error('YouTube Tracker: Failed to store data', response);
        }
      });
    } else {
      console.log('YouTube Tracker: No recommendations found');
    }
  }

  extractRecommendations() {
    const videos = [];
    let videoElements = [];

    console.log('YouTube Tracker: Trying selectors...');
    
    // Try primary selector first
    videoElements = document.querySelectorAll(this.selectors.primary);
    console.log(`YouTube Tracker: Primary selector "${this.selectors.primary}" found ${videoElements.length} elements`);
    
    // Fallback selectors if primary fails
    if (videoElements.length === 0) {
      videoElements = document.querySelectorAll(this.selectors.fallback1);
      console.log(`YouTube Tracker: Fallback1 selector "${this.selectors.fallback1}" found ${videoElements.length} elements`);
    }
    if (videoElements.length === 0) {
      videoElements = document.querySelectorAll(this.selectors.fallback2);
      console.log(`YouTube Tracker: Fallback2 selector "${this.selectors.fallback2}" found ${videoElements.length} elements`);
    }
    
    // Debug: Log all video-like elements we can find
    const allVideoLinks = document.querySelectorAll('a[href*="/watch"]');
    console.log(`YouTube Tracker: Found ${allVideoLinks.length} total video links on page`);
    
    if (videoElements.length === 0) {
      console.log('YouTube Tracker: No container elements found, trying direct video link approach...');
      
      // Fallback: Extract directly from video links
      const directVideoLinks = document.querySelectorAll('a[href*="/watch"]');
      console.log(`YouTube Tracker: Found ${directVideoLinks.length} direct video links`);
      
      if (directVideoLinks.length > 0) {
        // Filter to only homepage recommendations (not sidebar, etc.)
        const filteredLinks = Array.from(directVideoLinks).filter(link => {
          // Skip if it's in a sidebar, player, or other non-recommendation areas
          const container = link.closest('ytd-watch-next-secondary-results-renderer, ytd-player, ytd-compact-autoplay-renderer');
          return !container;
        });
        
        console.log(`YouTube Tracker: Filtered to ${filteredLinks.length} recommendation links`);
        videoElements = filteredLinks.slice(0, 20); // Limit to first 20 to avoid spam
      }
      
      if (videoElements.length === 0) {
        console.log('YouTube Tracker: Still no elements found, investigating page structure...');
        this.debugPageStructure();
      }
    }

    videoElements.forEach((element, index) => {
      try {
        console.log(`YouTube Tracker: Processing element ${index + 1}/${videoElements.length}`, element);
        const videoData = this.extractVideoData(element, index);
        if (videoData && !this.processedVideos.has(videoData.videoId)) {
          videos.push(videoData);
          this.processedVideos.add(videoData.videoId);
          console.log(`YouTube Tracker: Successfully extracted video data:`, videoData);
        } else if (videoData) {
          console.log(`YouTube Tracker: Skipping already processed video: ${videoData.videoId}`);
        }
      } catch (error) {
        console.warn('YouTube Tracker: Error extracting video data:', error, element);
      }
    });

    return videos;
  }

  extractVideoData(element, position) {
    console.log('YouTube Tracker: Extracting data from element:', element);
    
    let titleElement = null;
    let channelElement = null; 
    let linkElement = null;

    // Try to find video link first using multiple selectors
    for (const selector of this.selectors.videoLinks) {
      linkElement = element.querySelector(selector);
      if (linkElement) {
        console.log(`YouTube Tracker: Found video link with selector: ${selector}`);
        break;
      }
    }
    
    // If this element IS a video link, use it directly
    if (!linkElement && element.matches('a[href*="/watch"]')) {
      linkElement = element;
      console.log('YouTube Tracker: Element itself is a video link');
    }

    // Try to find title element
    for (const selector of this.selectors.titles) {
      titleElement = element.querySelector(selector);
      if (titleElement) {
        console.log(`YouTube Tracker: Found title with selector: ${selector}`);
        break;
      }
    }
    
    // If no title found, try using the link element's text or title attribute
    if (!titleElement && linkElement) {
      if (linkElement.textContent?.trim()) {
        titleElement = linkElement;
        console.log('YouTube Tracker: Using link element text as title');
      } else if (linkElement.title) {
        titleElement = { textContent: linkElement.title };
        console.log('YouTube Tracker: Using link title attribute');
      }
    }

    // Try to find channel element
    for (const selector of this.selectors.channels) {
      channelElement = element.querySelector(selector);
      if (channelElement) {
        console.log(`YouTube Tracker: Found channel with selector: ${selector}`);
        break;
      }
    }

    // Validation
    if (!linkElement) {
      console.log('YouTube Tracker: No video link found in element');
      return null;
    }
    
    if (!titleElement) {
      console.log('YouTube Tracker: No title found in element');
      return null;
    }

    const title = titleElement.textContent?.trim();
    const href = linkElement.href;
    const channel = channelElement?.textContent?.trim() || 'Unknown Channel';

    console.log('YouTube Tracker: Extracted raw data:', { title, href, channel });

    if (!title || !href) {
      console.log('YouTube Tracker: Missing title or href');
      return null;
    }

    // Extract video ID from URL
    const videoId = this.extractVideoId(href);
    if (!videoId) {
      console.log('YouTube Tracker: Could not extract video ID from:', href);
      return null;
    }

    const videoData = {
      videoId,
      title,
      channel,
      timestamp: Date.now(),
      position: position + 1,
      category: null // Will be filled by background script via YouTube API
    };
    
    console.log('YouTube Tracker: Final video data:', videoData);
    return videoData;
  }

  extractVideoId(url) {
    try {
      // Handle relative URLs
      if (url.startsWith('/watch')) {
        const urlObj = new URL(url, 'https://www.youtube.com');
        return urlObj.searchParams.get('v');
      } else if (url.startsWith('/shorts/')) {
        return url.split('/shorts/')[1].split('?')[0]; // Remove query params
      }
      
      const urlObj = new URL(url);
      
      // Handle different YouTube URL formats
      if (urlObj.pathname === '/watch') {
        return urlObj.searchParams.get('v');
      } else if (urlObj.pathname.startsWith('/shorts/')) {
        return urlObj.pathname.split('/shorts/')[1].split('?')[0];
      }
      
      // Handle embedded URLs like /embed/VIDEO_ID
      if (urlObj.pathname.startsWith('/embed/')) {
        return urlObj.pathname.split('/embed/')[1].split('?')[0];
      }
      
      return null;
    } catch (error) {
      console.warn('YouTube Tracker: Error extracting video ID from URL:', url, error);
      return null;
    }
  }

  setupMutationObserver() {
    // Watch for new content being loaded dynamically
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldCheck = true;
        }
      });
      
      if (shouldCheck) {
        // Debounce the tracking to avoid excessive calls
        clearTimeout(this.trackingTimeout);
        this.trackingTimeout = setTimeout(() => {
          this.trackRecommendations();
        }, 1000);
      }
    });

    // Observe the main content area
    const targetNode = document.querySelector('ytd-page-manager, #content, #primary') || document.body;
    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });
  }

  debugPageStructure() {
    console.log('YouTube Tracker: === PAGE STRUCTURE DEBUG ===');
    
    // Check common container elements
    const containers = [
      'ytd-app',
      'ytd-page-manager', 
      'ytd-browse',
      'ytd-two-column-browse-results-renderer',
      'ytd-rich-grid-renderer',
      'ytd-rich-section-renderer',
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-compact-video-renderer'
    ];
    
    containers.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      console.log(`YouTube Tracker: ${selector}: ${elements.length} elements`);
    });
    
    // Check for video thumbnails and titles
    const videoSelectors = [
      'a[href*="/watch"]',
      'img[src*="ytimg.com"]',
      '[title*=""]', // Any element with a title
      'h3',
      'h4',
      '.ytd-rich-item-renderer',
      '.ytd-video-renderer'
    ];
    
    videoSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      console.log(`YouTube Tracker: Video-related ${selector}: ${elements.length} elements`);
      if (elements.length > 0 && elements.length < 10) {
        console.log('YouTube Tracker: Sample elements:', Array.from(elements).slice(0, 3));
      }
    });
    
    console.log('YouTube Tracker: === END DEBUG ===');
  }
  
  // Manual trigger for testing (can be called from console)
  manualTrigger() {
    console.log('YouTube Tracker: Manual trigger activated');
    this.trackRecommendations();
  }
  
  // Get current stats
  getStats() {
    return {
      processedVideos: this.processedVideos.size,
      processedVideoIds: Array.from(this.processedVideos)
    };
  }
}

// Initialize the tracker and expose it globally for testing
const tracker = new YouTubeRecommendationTracker();

// Expose for console debugging
window.YouTubeTracker = {
  trigger: () => tracker.manualTrigger(),
  debug: () => tracker.debugPageStructure(),
  stats: () => tracker.getStats(),
  reset: () => {
    tracker.processedVideos.clear();
    console.log('YouTube Tracker: Reset processed videos cache');
  }
};