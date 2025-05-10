const express = require('express');
const fs = require('fs');
const fetch = require('node-fetch');
const multer = require('multer');
const app = express();
const port = 3000;

// Setup multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// Serve static files
app.use(express.static('public'));
app.use(express.static('uploads'));

// Count current visitors from file
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
    console.error('❌ Error fetching geolocation:', err);
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
          fetch(\`/log-location?lat=\${pos.coords.latitude}&lon=\${pos.coords.longitude}\`);
        },
        err => {
          console.log("Geolocation error:", err);
        }
      );
    </script>
  `);
});

// Log client geolocation
app.get('/log-location', async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const response = await fetch(geoUrl, { headers: { 'User-Agent': 'YourAppName/1.0' } });
    const data = await response.json();

    const address = data.address || {};
    const city = address.city || address.town || address.village || 'N/A';
    const district = address.county || 'N/A';
    const state = address.state || 'N/A';
    const country = address.country || 'N/A';

    const logData = `Client-reported coordinates:
Latitude: ${lat}
Longitude: ${lon}
Resolved Location: City: ${city}, District: ${district}, State: ${state}, Country: ${country}
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
      <p><a href="/">Back to Home</a></p>
    `);
  } catch (err) {
    console.error('❌ Error reverse geocoding:', err);
    res.send('Error getting location info');
  }
});

// Upload image
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  res.send(`
    <h2>✅ Image Uploaded Successfully</h2>
    <p>File: <strong>${req.file.filename}</strong></p>
    <img src="/${req.file.filename}" alt="Uploaded Image" width="300"/>
    <p><a href="/">Back to Home</a></p>
  `);
});

// View visitors log
app.get('/visitors', (req, res) => {
  const visitorCount = getVisitorCount();
  const content = fs.existsSync('visitors.txt') ? fs.readFileSync('visitors.txt', 'utf8') : '';
  res.send(`
    <h1>👀 Visitor Log</h1>
    <p>Total visitors logged: ${visitorCount}</p>
    <pre>${content || 'No visitor data.'}</pre>
    <p><a href="/">Back to Home</a></p>
  `);
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
