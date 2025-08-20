// YouTube Filter Bubble Tracker - Background Script
// Handles data storage, YouTube API calls, and data management

class YouTubeFilterBubbleTracker {
  constructor() {
    this.STORAGE_KEY = 'youtube_recommendations';
    this.CATEGORY_CACHE_KEY = 'youtube_categories';
    this.RETENTION_DAYS = null; // No retention limit
    this.MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
    this.API_BATCH_SIZE = 10;
    this.API_ENDPOINT = 'https://your-app.vercel.app/api/youtube-categories'; // Replace with your Vercel URL
    
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Clean up old data periodically
    this.scheduleCleanup();
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'storeRecommendations':
          await this.storeRecommendations(message.data);
          sendResponse({ success: true });
          break;
          
        case 'getAnalytics':
          const analytics = await this.getAnalytics();
          sendResponse({ success: true, data: analytics });
          break;
          
          
        case 'exportData':
          const exportData = await this.exportData();
          sendResponse({ success: true, data: exportData });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async storeRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) {
      return;
    }

    // Get existing data
    const result = await chrome.storage.local.get([this.STORAGE_KEY]);
    const existingData = result[this.STORAGE_KEY] || [];

    // Add new recommendations
    const newData = [...existingData, ...recommendations];

    // No time-based filtering (keep all data)
    const filteredData = newData;

    // Check storage size and remove oldest if necessary
    const finalData = this.enforceStorageLimit(filteredData);

    // Store the data
    await chrome.storage.local.set({
      [this.STORAGE_KEY]: finalData
    });

    console.log(`Stored ${recommendations.length} new recommendations, total: ${finalData.length}`);

    // Fetch categories for new videos
    await this.enrichWithCategories(recommendations);
  }

  enforceStorageLimit(data) {
    const dataString = JSON.stringify(data);
    if (dataString.length <= this.MAX_STORAGE_SIZE) {
      return data;
    }

    // Remove oldest entries until under size limit
    const sortedData = data.sort((a, b) => b.timestamp - a.timestamp);
    let currentSize = 0;
    const limitedData = [];

    for (const item of sortedData) {
      const itemSize = JSON.stringify(item).length;
      if (currentSize + itemSize <= this.MAX_STORAGE_SIZE) {
        limitedData.push(item);
        currentSize += itemSize;
      } else {
        break;
      }
    }

    console.log(`Enforced storage limit: ${data.length} -> ${limitedData.length} items`);
    return limitedData;
  }

  async enrichWithCategories(recommendations) {
    // Get cached categories
    const categoryCache = await this.getCategoryCache();
    
    // Find videos that need category data
    const videosNeedingCategories = recommendations.filter(video => 
      !categoryCache[video.videoId]
    );

    if (videosNeedingCategories.length === 0) {
      return;
    }

    // Process in batches to respect API limits
    const batches = this.chunkArray(videosNeedingCategories, this.API_BATCH_SIZE);
    
    for (const batch of batches) {
      try {
        await this.fetchCategoriesForBatch(batch, categoryCache);
        // Add delay between batches to respect rate limits
        await this.sleep(100);
      } catch (error) {
        console.error('Error fetching categories for batch:', error);
      }
    }
  }

  async fetchCategoriesForBatch(videos, categoryCache) {
    const videoIds = videos.map(v => v.videoId);

    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ videoIds })
      });

      if (!response.ok) {
        throw new Error(`Server API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Update cache with new category data
      for (const item of data.items || []) {
        const categoryId = item.snippet.categoryId;
        const category = this.getCategoryName(categoryId);
        categoryCache[item.id] = category;
      }

      // Save updated cache
      await chrome.storage.local.set({
        [this.CATEGORY_CACHE_KEY]: categoryCache
      });

      // Update stored recommendations with categories
      await this.updateStoredRecommendationsWithCategories(categoryCache);

    } catch (error) {
      console.error('Failed to fetch categories from server:', error);
    }
  }

  async updateStoredRecommendationsWithCategories(categoryCache) {
    const result = await chrome.storage.local.get([this.STORAGE_KEY]);
    const recommendations = result[this.STORAGE_KEY] || [];

    let updated = false;
    recommendations.forEach(recommendation => {
      if (!recommendation.category && categoryCache[recommendation.videoId]) {
        recommendation.category = categoryCache[recommendation.videoId];
        updated = true;
      }
    });

    if (updated) {
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: recommendations
      });
    }
  }

  getCategoryName(categoryId) {
    // YouTube's standard categories
    const categories = {
      '1': 'Film & Animation',
      '2': 'Autos & Vehicles',
      '10': 'Music',
      '15': 'Pets & Animals',
      '17': 'Sports',
      '18': 'Short Movies',
      '19': 'Travel & Events',
      '20': 'Gaming',
      '21': 'Videoblogging',
      '22': 'People & Blogs',
      '23': 'Comedy',
      '24': 'Entertainment',
      '25': 'News & Politics',
      '26': 'Howto & Style',
      '27': 'Education',
      '28': 'Science & Technology',
      '29': 'Nonprofits & Activism'
    };
    
    return categories[categoryId] || 'Other';
  }

  async getAnalytics() {
    const result = await chrome.storage.local.get([this.STORAGE_KEY]);
    const recommendations = result[this.STORAGE_KEY] || [];

    if (recommendations.length === 0) {
      return {
        totalVideos: 0,
        categoryDistribution: {},
        topChannels: [],
        diversityScore: 0,
        dateRange: null
      };
    }

    // Calculate analytics
    const categoryDistribution = {};
    const channelCounts = {};
    let oldestTimestamp = recommendations[0].timestamp;
    let newestTimestamp = recommendations[0].timestamp;

    recommendations.forEach(rec => {
      // Category distribution
      const category = rec.category || 'Uncategorized';
      categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;

      // Channel counts
      channelCounts[rec.channel] = (channelCounts[rec.channel] || 0) + 1;

      // Date range
      if (rec.timestamp < oldestTimestamp) oldestTimestamp = rec.timestamp;
      if (rec.timestamp > newestTimestamp) newestTimestamp = rec.timestamp;
    });

    // Top 5 channels
    const topChannels = Object.entries(channelCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([channel, count]) => ({ channel, count }));

    // Diversity score (0-100 based on category spread)
    const categoryCount = Object.keys(categoryDistribution).length;
    const maxCategories = 15; // YouTube's standard categories
    const diversityScore = Math.round((categoryCount / maxCategories) * 100);

    return {
      totalVideos: recommendations.length,
      categoryDistribution,
      topChannels,
      diversityScore,
      dateRange: {
        start: new Date(oldestTimestamp).toLocaleDateString(),
        end: new Date(newestTimestamp).toLocaleDateString(),
        days: Math.ceil((newestTimestamp - oldestTimestamp) / (24 * 60 * 60 * 1000)) + 1
      }
    };
  }

  async exportData() {
    const result = await chrome.storage.local.get([this.STORAGE_KEY]);
    return result[this.STORAGE_KEY] || [];
  }

  async getCategoryCache() {
    const result = await chrome.storage.local.get([this.CATEGORY_CACHE_KEY]);
    return result[this.CATEGORY_CACHE_KEY] || {};
  }


  scheduleCleanup() {
    // No automatic cleanup needed since we're not using time-based retention
    // Only size-based cleanup is performed when storing new data
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize the background tracker
new YouTubeFilterBubbleTracker();