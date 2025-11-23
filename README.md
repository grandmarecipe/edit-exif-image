# EXIF Editor Web App

A modern web application for editing EXIF metadata in images, including description, keywords, geotags, and camera information.

## Features

- 📸 **Load images from URL or file upload**
- ✏️ **Edit EXIF data** including:
  - Image description
  - Keywords
  - GPS coordinates (latitude, longitude, altitude)
  - Camera make and model
  - Date/time
  - Copyright information
- 💾 **Save edited EXIF data** to images
- 📥 **Download edited images** with updated metadata

## How to Use

1. **Load an image**:
   - Enter an image URL and click "Load from URL", OR
   - Upload an image file using the file input

2. **Edit EXIF data**:
   - Fill in the form fields with the desired metadata
   - GPS coordinates should be in decimal degrees format (e.g., 40.7128 for latitude)

3. **Save and download**:
   - Click "Save EXIF Data" to apply changes
   - The edited image will automatically download

## Local Development

```bash
# Install dependencies (if needed)
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

You can send HTTP requests to your deployed web app with image URLs as query parameters. The app will automatically load the image when the page opens:

```
https://your-app.vercel.app/?image=https://example.com/image.jpg
```

**Example usage:**
- Make your image publicly accessible (e.g., upload to Imgur, GitHub, or any image hosting service)
- Send a GET request or open the URL: `https://your-app.vercel.app/?image=YOUR_IMAGE_URL`
- The app will automatically load and display the image for editing

## Technologies Used

- **HTML5** - Structure
- **CSS3** - Modern styling with gradients and animations
- **JavaScript (ES6+)** - Core functionality
- **exif-js** - Reading EXIF data
- **piexifjs** - Writing EXIF data

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Modern mobile browsers

## Notes

- **CORS**: When loading images from URLs, the server must allow CORS. Some image hosting services may block cross-origin requests.
- **Image Format**: Best results with JPEG images. PNG support may be limited for EXIF writing.
- **GPS Format**: Enter coordinates in decimal degrees (e.g., 40.7128, -74.0060 for New York City).

## License

MIT

