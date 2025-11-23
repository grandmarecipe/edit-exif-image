# EXIF Editor Web App

A modern web application for editing EXIF metadata in images, including description, keywords, geotags, and camera information.

## Features

- 📸 **Load images from URL or file upload**
- ✏️ **Edit EXIF data** including:
  - Image description
  - Keywords (stored in DocumentName field)
  - GPS coordinates (latitude, longitude, altitude)
  - Camera make and model
  - Date/time
  - Copyright information
- 💾 **Save edited EXIF data** to images
- 📥 **Download edited images** with updated metadata
- 🔄 **REST API endpoint** for programmatic EXIF editing

## How to Use

### Web Interface

1. **Load an image**:
   - Enter an image URL and click "Load from URL", OR
   - Upload an image file using the file input

2. **Edit EXIF data**:
   - Fill in the form fields with the desired metadata
   - GPS coordinates should be in decimal degrees format (e.g., 40.7128 for latitude)

3. **Save and download**:
   - Click "Save EXIF Data" to apply changes
   - The edited image will automatically download

### API Endpoint

You can also edit EXIF data programmatically via HTTP POST request:

**Endpoint:** `https://your-app.vercel.app/api/edit-exif`

**Method:** POST

**Request Body:**
```json
{
  "imageUrl": "https://example.com/image.jpg",
  "exifData": {
    "description": "Image description",
    "keywords": "keyword1, keyword2, keyword3",
    "make": "Canon",
    "model": "EOS 5D Mark IV",
    "copyright": "Copyright 2025",
    "datetime": "2025-02-02T14:30:00",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "altitude": 100
  }
}
```

**Response:**
- Success: Returns the modified JPEG image (binary)
- Error: Returns JSON with error message

**Example using cURL:**
```bash
curl -X POST https://your-app.vercel.app/api/edit-exif \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/image.jpg",
    "exifData": {
      "description": "My edited image",
      "keywords": "nature, landscape, photography",
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  }' \
  --output edited-image.jpg
```

**Example using JavaScript (fetch):**
```javascript
const response = await fetch('https://your-app.vercel.app/api/edit-exif', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    imageUrl: 'https://example.com/image.jpg',
    exifData: {
      description: 'My edited image',
      keywords: 'nature, landscape',
      make: 'Canon',
      model: 'EOS 5D',
      latitude: 40.7128,
      longitude: -74.0060
    }
  })
});

const blob = await response.blob();
// Use the blob (e.g., create download link or display image)
```

## Local Development

```bash
# Install dependencies
npm install

# Run local server
npm start
```

Or simply open `index.html` in a modern web browser.

## Deployment to Vercel

### Option 1: Deploy via GitHub

1. **Create a GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/exif-editor.git
   git push -u origin main
   ```

2. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign in with your GitHub account
   - Click "New Project"
   - Import your repository
   - Vercel will automatically detect the configuration and deploy

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## Using with Public Image URLs

You can send HTTP requests to your deployed web app with image URLs as query parameters:

```
https://your-app.vercel.app/?image=https://example.com/image.jpg
```

The app will automatically load the image when the page opens.

## Technologies Used

- **HTML5** - Structure
- **CSS3** - Modern styling with gradients and animations
- **JavaScript (ES6+)** - Core functionality
- **exif-js** - Reading EXIF data
- **piexifjs** - Writing EXIF data
- **Node.js** - Serverless API functions
- **Vercel** - Hosting and serverless functions

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Modern mobile browsers

## Notes

- **CORS**: When loading images from URLs, the server must allow CORS. Some image hosting services may block cross-origin requests.
- **Image Format**: Best results with JPEG images. PNG support may be limited for EXIF writing.
- **GPS Format**: Enter coordinates in decimal degrees (e.g., 40.7128, -74.0060 for New York City).
- **API Rate Limits**: Vercel has rate limits on serverless functions. Check Vercel's documentation for current limits.

## License

MIT
