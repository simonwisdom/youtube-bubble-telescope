export default async function handler(req, res) {
  // Enable CORS for Chrome extension
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoIds } = req.body;
  
  if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
    return res.json({ items: [] });
  }

  const API_KEY = process.env.YOUTUBE_API_KEY;
  
  if (!API_KEY) {
    console.error('YouTube API key not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Limit to 10 videos per request (same as original batch size)
  const limitedVideoIds = videoIds.slice(0, 10);
  const videoIdString = limitedVideoIds.join(',');
  
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIdString}&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`YouTube API error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `YouTube API error: ${response.status}`,
        items: []
      });
    }

    const data = await response.json();
    
    // Log usage for monitoring
    console.log(`YouTube API call: ${limitedVideoIds.length} videos, ${data.items?.length || 0} results`);
    
    return res.json(data);
    
  } catch (error) {
    console.error('API call failed:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch video categories',
      items: []
    });
  }
}