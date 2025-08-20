# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the "YouTube Filter Bubble Tracker" - a Chrome extension that monitors and visualizes YouTube homepage recommendations to help users understand their personalized recommendation patterns. It's built using Chrome Extension Manifest V3 with vanilla JavaScript.

## Architecture

### Core Components

- **manifest.json**: Extension configuration with permissions for YouTube and Google APIs
- **content_script.js**: Scrapes YouTube homepage recommendations via DOM parsing
- **background.js**: Service worker handling data storage, YouTube API calls, and analytics
- **popup.html/js**: Dashboard interface showing analytics and visualizations
- **chart.js**: Chart.js library for data visualization

### Data Flow

1. **Content Script** (`content_script.js`) runs on YouTube homepage, scrapes recommendations
2. **Background Script** (`background.js`) receives data, enriches with YouTube API categories, stores locally
3. **Popup Interface** (`popup.js`) fetches analytics and displays charts/statistics

### Key Classes

- `YouTubeRecommendationTracker`: Handles DOM scraping on YouTube pages
- `YouTubeFilterBubbleTracker`: Manages data storage, API calls, and analytics
- `PopupController`: Controls dashboard UI and user interactions

## Development Commands

### Testing the Extension
```bash
# Load extension in Chrome
# 1. Navigate to chrome://extensions/
# 2. Enable Developer Mode
# 3. Click "Load unpacked" and select project directory
# 4. Test by visiting youtube.com
```

### Development Workflow
```bash
# After making code changes:
# 1. Go to chrome://extensions/
# 2. Click refresh icon on the extension
# 3. Test functionality by visiting YouTube homepage
# 4. Check extension popup for data visualization
```

## Technical Details

### Storage
- Uses Chrome's `chrome.storage.local` API (5MB limit)
- No time-based retention - keeps all data until storage limit
- Categories cached permanently by video ID

### YouTube API Integration
- Requires YouTube Data API v3 key for category classification
- Batches up to 10 videos per API call
- Uses ~10 quota units per video classification
- Falls back to "Uncategorized" without API key

### DOM Scraping Strategy
- Multiple selector fallbacks for YouTube's changing DOM structure
- Targets homepage only (ignores sidebar, search results)
- Handles dynamic content loading with MutationObserver
- Filters duplicate videos by ID

## File Structure Notes

- **Icon files**: SVG sources with PNG exports for different sizes
- **create_icons.html**: Utility for generating proper PNG icons from SVG
- **styles.css**: Extension popup styling
- **popup_simple.html/popup_test.html**: Alternative/test UI versions

## API Key Setup

Extension requires YouTube Data API v3 key for full functionality:
1. Google Cloud Console → Enable YouTube Data API v3
2. Create API key credentials
3. Add key through extension popup settings
4. Without key, videos are categorized as "Uncategorized"

## Privacy & Security

- All data stored locally only (except YouTube API calls for categories)
- No personal information collected - only public video metadata
- Respects YouTube's Terms of Service and API policies
- Educational/research purpose tool for understanding recommendation patterns

## Debugging

Extension exposes global `YouTubeTracker` object in console:
```javascript
// Manually trigger scraping
YouTubeTracker.trigger()

// Debug page structure
YouTubeTracker.debug()

// Check processing stats
YouTubeTracker.stats()

// Reset processed videos cache
YouTubeTracker.reset()
```