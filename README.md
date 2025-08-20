# YouTube Filter Bubble Tracker

A Chrome extension that tracks and visualizes what YouTube recommends to you over time, helping you understand your personalized recommendation patterns.

## Features

- **Automatic Tracking**: Monitors YouTube homepage recommendations without user intervention
- **Smart Categorization**: Uses YouTube Data API v3 to classify videos by category
- **Visual Analytics**: 
  - Pie chart showing category distribution
  - Top 5 most recommended channels
  - Diversity score (0-100) based on category spread
- **Privacy-First**: All data stored locally (unlimited retention, ~5MB limit)
- **Data Export**: Export your data as JSON for further analysis

## Installation

### Loading the Extension in Chrome

1. **Download/Clone** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top-right corner)
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

### Setting up YouTube API (Optional but Recommended)

For category classification, you'll need a YouTube Data API v3 key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **YouTube Data API v3**
4. Create credentials (API Key)
5. **Add the API key** in the extension popup when prompted

> **Note**: Without an API key, videos will be categorized as "Uncategorized"

## How to Use

1. **Visit YouTube.com** - The extension automatically tracks homepage recommendations
2. **Click the extension icon** to view your filter bubble analytics
3. **Refresh data** using the refresh button to see latest changes
4. **Export data** anytime using the export button

## File Structure

```
├── manifest.json          # Extension configuration
├── content_script.js      # YouTube page scraping logic
├── background.js          # Data storage and API management
├── popup.html            # Dashboard interface
├── popup.js              # Dashboard functionality
├── styles.css            # Extension styling
├── icon.svg              # Source icon
└── create_icons.html     # Icon generation utility
```

## Technical Details

### Data Collection
- **Scope**: YouTube homepage only (ignores sidebar, search results)
- **Trigger**: Every visit to youtube.com
- **Method**: DOM scraping with fallback selectors
- **Storage**: Chrome's local storage API

### Data Structure
```javascript
{
  videoId: string,        // YouTube video ID
  title: string,          // Video title
  channel: string,        // Channel name
  timestamp: number,      // Collection time
  position: number,       // Position on homepage (1-indexed)
  category: string        // YouTube category (from API)
}
```

### API Usage
- **Endpoint**: `https://www.googleapis.com/youtube/v3/videos`
- **Quota**: Uses ~10 units per video (well within 10,000/day limit)
- **Batching**: Processes up to 10 videos per API call
- **Caching**: Categories cached permanently by video ID

## Privacy & Security

- **Local Storage Only**: No data sent to external servers (except YouTube API for categories)
- **Unlimited Retention**: Data kept until storage limit reached
- **Size Limits**: Maximum 5MB storage (~10,000 recommendations)
- **No Personal Info**: Only public video metadata collected

## Troubleshooting

### Extension Not Loading
- Ensure all files are in the same directory
- Check Chrome's extension error logs
- Verify manifest.json syntax

### No Data Appearing
- Visit YouTube.com homepage (not search or watch pages)
- Check console logs for JavaScript errors
- Ensure extension has necessary permissions

### Categories Showing as "Uncategorized"
- Add your YouTube Data API v3 key in extension settings
- Check API key has YouTube Data API v3 enabled
- Verify API quota hasn't been exceeded

## Development

### Testing Locally
1. Make code changes
2. Go to `chrome://extensions/`
3. Click refresh icon on the extension
4. Test functionality

### API Key Development
- Use [create_icons.html](create_icons.html) to generate proper PNG icons
- Test with limited API quota first
- Monitor usage in Google Cloud Console

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Disclaimer

This extension is for educational and research purposes. It helps users understand their YouTube recommendation patterns. Always respect YouTube's Terms of Service and API usage policies.