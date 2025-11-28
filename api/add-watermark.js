const sharp = require('sharp');

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    try {
        const { imageData, logoData, position = 'top-right', size = 15, offsetX = 0, offsetY = 0 } = req.body;

        if (!imageData) {
            return res.status(400).json({ error: 'imageData (base64) is required' });
        }

        if (!logoData) {
            return res.status(400).json({ error: 'logoData (base64) is required' });
        }

        // Parse size (should be percentage of image width, 5-50%)
        const sizePercent = Math.max(5, Math.min(50, parseFloat(size) || 15));
        
        // Parse offsets (pixels)
        const offsetXPixels = parseInt(offsetX) || 0;
        const offsetYPixels = parseInt(offsetY) || 0;

        // Decode base64 images
        const imageBase64 = imageData.split(',')[1] || imageData;
        const logoBase64 = logoData.split(',')[1] || logoData;
        
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        const logoBuffer = Buffer.from(logoBase64, 'base64');

        // Get image dimensions
        const imageMetadata = await sharp(imageBuffer).metadata();
        const imageWidth = imageMetadata.width;
        const imageHeight = imageMetadata.height;

        // Get original logo dimensions to calculate aspect ratio
        const originalLogoMetadata = await sharp(logoBuffer).metadata();
        const originalLogoWidth = originalLogoMetadata.width;
        const originalLogoHeight = originalLogoMetadata.height;
        const logoAspectRatio = originalLogoWidth / originalLogoHeight;

        // Calculate logo size based on percentage of image width
        // This will scale both width and height proportionally
        const logoWidth = Math.round(imageWidth * (sizePercent / 100));
        const logoHeight = Math.round(logoWidth / logoAspectRatio);
        
        // Resize logo while preserving PNG transparency
        // Ensure we maintain the alpha channel and scale the entire image properly
        const resizedLogo = await sharp(logoBuffer)
            .ensureAlpha() // Ensure alpha channel exists for transparency
            .resize(logoWidth, logoHeight, {
                fit: 'contain', // Maintain aspect ratio, fit within dimensions
                background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
            })
            .png() // Keep as PNG to preserve transparency
            .toBuffer();

        const logoMetadata = await sharp(resizedLogo).metadata();
        const finalLogoWidth = logoMetadata.width;
        const finalLogoHeight = logoMetadata.height;

        // Calculate base position with padding
        const padding = Math.round(imageWidth * 0.02); // 2% padding from edges
        let left, top;

        if (position === 'top-right') {
            left = imageWidth - finalLogoWidth - padding;
            top = padding;
        } else if (position === 'top-left') {
            left = padding;
            top = padding;
        } else if (position === 'bottom-right') {
            left = imageWidth - finalLogoWidth - padding;
            top = imageHeight - finalLogoHeight - padding;
        } else if (position === 'bottom-left') {
            left = padding;
            top = imageHeight - finalLogoHeight - padding;
        } else {
            // Default to top-right
            left = imageWidth - finalLogoWidth - padding;
            top = padding;
        }

        // Apply pixel offsets
        left += offsetXPixels;
        top += offsetYPixels;

        // Ensure logo stays within image bounds
        left = Math.max(0, Math.min(left, imageWidth - finalLogoWidth));
        top = Math.max(0, Math.min(top, imageHeight - finalLogoHeight));

        // Composite logo onto image with proper transparency handling
        // Use 'over' blend mode to respect alpha channel (transparency)
        const finalImage = await sharp(imageBuffer)
            .composite([
                {
                    input: resizedLogo,
                    left: left,
                    top: top,
                    blend: 'over' // Preserves transparency from PNG
                }
            ])
            .jpeg({ quality: 95 })
            .toBuffer();

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="watermarked-image.jpg"');
        return res.status(200).send(finalImage);

    } catch (error) {
        console.error('Error adding watermark:', error);
        return res.status(500).json({
            error: 'Failed to add watermark',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

