const express = require('express');
const fs = require('fs');
const fetch = require('node-fetch');
const multer = require('multer');
const app = express();
const port = 3000;

// Setup multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Middleware to serve static files
app.use(express.static('public'));
app.use(express.static('uploads'));

// Homepage
app.get('/', async (req, res) => {
  const ipRaw = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ip = ipRaw.split(',')[0].trim().replace('::ffff:', '');

  const userAgent = req.headers['user-agent'];
  const headers = JSON.stringify(req.headers, null, 2);

  // Get location info using ipapi.co
  const geoUrl = `https://ipapi.co/${ip}/json/`;

  let city = 'N/A';
  let region = 'N/A';
  let country = 'N/A';

  try {
    const response = await fetch(geoUrl);
    const geoData = await response.json();
    city = geoData.city || 'N/A';
    region = geoData.region || 'N/A';
    country = geoData.country_name || 'N/A';
  } catch (err) {
    console.error('❌ Error fetching geolocation:', err);
  }

  // Log basic visitor info
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
    else console.log('✅ Visitor info saved to visitors.txt');
  });

  // Send page
  res.send(`
    <h1>🚀 Welcome!</h1>
    <p>Your IP-based location: ${city}, ${region}, ${country}</p>
    
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
          fetch(\`/log-location?lat=\${pos.coords.latitude}&lon=\${pos.coords.longitude}\`)
            .then(response => response.text())
            .then(html => {
              const popup = window.open("", "_blank");
              popup.document.write(html);
            });
        },
        err => {
          console.log("Geolocation error:", err);
        }
      );
    </script>
  `);
});

// Log client browser geolocation and resolve city, state, district
app.get('/log-location', async (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lon;

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
      if (err) console.error('❌ Error saving location:', err);
      else console.log('✅ Client location saved with address');
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

// Handle image upload
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  res.send(`
    <h2>✅ Image Uploaded Successfully</h2>
    <p>File: <strong>${req.file.filename}</strong></p>
    <img src="/${req.file.filename}" alt="Uploaded Image" width="300"/>
    <p><a href="/">Back to Home</a></p>
  `);
});

// Show visitors log
app.get('/visitors', (req, res) => {
  res.sendFile(__dirname + '/visitors.txt');
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
