const express = require('express');
const fs = require('fs');
const fetch = require('node-fetch');
const app = express();
const port = 3000;

// Middleware to serve static files (images, docs, etc.)
app.use(express.static('public'));

app.get('/', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const headers = JSON.stringify(req.headers, null, 2);

  // Use ipapi.co (free, no API key required for basic info)
  const geoUrl = `https://ipapi.co/${ip}/json/`;

  let latitude = 'N/A';
  let longitude = 'N/A';
  let city = 'N/A';
  let region = 'N/A';
  let country = 'N/A';

  try {
    const response = await fetch(geoUrl);
    const geoData = await response.json();
    latitude = geoData.latitude || 'N/A';
    longitude = geoData.longitude || 'N/A';
    city = geoData.city || 'N/A';
    region = geoData.region || 'N/A';
    country = geoData.country_name || 'N/A';
  } catch (err) {
    console.error('❌ Error fetching geolocation:', err);
  }

  // Log visitor info to visitors.txt
  const logData = `=========================
New Visitor:
Time: ${new Date().toISOString()}
IP Address: ${ip}
User-Agent: ${userAgent}
Location: ${city}, ${region}, ${country}
Latitude: ${latitude}
Longitude: ${longitude}
Headers: ${headers}
=========================\n`;

  fs.appendFile('visitors.txt', logData, (err) => {
    if (err) {
      console.error('❌ Error saving visitor info:', err);
    } else {
      console.log('✅ Visitor info saved to visitors.txt');
    }
  });

  // Send response with location info, and links to documents/images/Youtube
  res.send(`
    🚀 Thanks for visiting! Your location: ${city}, ${region}, ${country}
    
    📄 Download our document: <a href="/files/sample-doc.pdf" target="_blank">Download PDF</a>
    
    🖼️ View our image: <a href="/images/sample-image.jpg" target="_blank">View Image</a>
    
    🎥 Check this YouTube video: <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank">YouTube Video</a>
  `);
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
