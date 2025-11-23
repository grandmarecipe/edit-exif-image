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
- 🖼️ **Crop images** from top, bottom, left, or right edges
- 💾 **Save edited EXIF data** to images
- 📥 **Download edited/cropped images** with updated metadata
- 🔄 **REST API endpoints** for programmatic EXIF editing and image cropping
- 📍 **Plus Code to Coordinates** conversion API

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
      "description": "My image",
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  }' \
  --output edited-image.jpg
```

## Image Cropping API

You can crop images programmatically via HTTP POST request:

**Endpoint:** `https://your-app.vercel.app/api/crop-image`

**Method:** POST

**Request Body:**
```json
{
  "imageUrl": "https://example.com/image.jpg",
  "cropOptions": {
    "top": 100,
    "bottom": 50,
    "left": 75,
    "right": 25
  }
}
```

**OR using base64 image data:**
```json
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "cropOptions": {
    "top": 100,
    "bottom": 0,
    "left": 50,
    "right": 0
  }
}
```

**Crop Options:**
- `top` (optional): Number of pixels to crop from the top edge
- `bottom` (optional): Number of pixels to crop from the bottom edge
- `left` (optional): Number of pixels to crop from the left edge
- `right` (optional): Number of pixels to crop from the right edge
- At least one crop value must be greater than 0

**Response:**
- Success: Returns the cropped JPEG image (binary)
- Error: Returns JSON with error message

**Example using cURL:**
```bash
curl -X POST https://your-app.vercel.app/api/crop-image \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/image.jpg",
    "cropOptions": {
      "top": 100,
      "left": 50
    }
  }' \
  --output cropped-image.jpg
```

**Example using JavaScript (fetch):**
```javascript
const response = await fetch('https://your-app.vercel.app/api/crop-image', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    imageUrl: 'https://example.com/image.jpg',
    cropOptions: {
      top: 100,    // Remove 100 pixels from top
      bottom: 0,   // Don't crop from bottom
      left: 50,   // Remove 50 pixels from left
      right: 0    // Don't crop from right
    }
  })
});

const blob = await response.blob();
// Use the blob (e.g., create object URL, download, etc.)
```

**Example using Make.com (Integromat):**
```json
{
  "imageUrl": "https://i.ibb.co/PZfhz3Tc/image.jpg",
  "cropOptions": {
    "top": 100,
    "bottom": 50,
    "left": 75,
    "right": 25
  }
}
```

## Plus Code to Coordinates API

Convert Plus Codes to latitude and longitude coordinates:

**Endpoint:** `https://your-app.vercel.app/api/pluscode-to-coords`

**Method:** GET or POST

**Query Parameters (GET):**
```
?pluscode=CC2C+8X Agadir, Maroc
```

**Request Body (POST):**
```json
{
  "pluscode": "CC2C+8X Agadir, Maroc"
}
```

**Response:**
```json
{
  "plusCode": "CC2C+8X",
  "latitude": 30.4008209,
  "longitude": -9.5775943,
  "formatted": "30.4008209, -9.5775943",
  "address": "CC2C+8X, Agadir 80000, Morocco",
  "source": "Google Maps Place Details API (exact coordinates)",
  "queryUsed": "CC2C+8X, Agadir, Maroc",
  "locationType": "GEOMETRIC_CENTER",
  "placeId": "Eh5DQzJDKzhYLCBBZ2FkaXIgODAwMDAsIE1vcm9jY28iJjokCgoNvcseEhV3lEr6EAoaFAoSCckcrdrptrMNEXSE9Iu30Pi8"
}
```

**Note:** Requires `GOOGLE_MAPS_API_KEY` environment variable in Vercel.

---

**Original EXIF API example:**
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
