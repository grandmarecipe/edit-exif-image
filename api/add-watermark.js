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
        const { imageData, logoData, position = 'top-right', size = 15 } = req.body;

        if (!imageData) {
            return res.status(400).json({ error: 'imageData (base64) is required' });
        }

        if (!logoData) {
            return res.status(400).json({ error: 'logoData (base64) is required' });
        }

        // Parse size (should be percentage of image width, 5-50%)
        const sizePercent = Math.max(5, Math.min(50, parseFloat(size) || 15));

        // Decode base64 images
        const imageBase64 = imageData.split(',')[1] || imageData;
        const logoBase64 = logoData.split(',')[1] || logoData;
        
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        const logoBuffer = Buffer.from(logoBase64, 'base64');

        // Get image dimensions
        const imageMetadata = await sharp(imageBuffer).metadata();
        const imageWidth = imageMetadata.width;
        const imageHeight = imageMetadata.height;

        // Calculate logo size based on percentage of image width
        const logoWidth = Math.round(imageWidth * (sizePercent / 100));
        
        // Resize logo while maintaining aspect ratio
        const resizedLogo = await sharp(logoBuffer)
            .resize(logoWidth, null, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .toBuffer();

        const logoMetadata = await sharp(resizedLogo).metadata();
        const finalLogoWidth = logoMetadata.width;
        const finalLogoHeight = logoMetadata.height;

        // Calculate position
        const padding = Math.round(imageWidth * 0.02); // 2% padding from edges
        let left, top;

        if (position === 'top-right') {
            left = imageWidth - finalLogoWidth - padding;
            top = padding;
        } else if (position === 'bottom-right') {
            left = imageWidth - finalLogoWidth - padding;
            top = imageHeight - finalLogoHeight - padding;
        } else {
            // Default to top-right
            left = imageWidth - finalLogoWidth - padding;
            top = padding;
        }

        // Composite logo onto image
        const finalImage = await sharp(imageBuffer)
            .composite([
                {
                    input: resizedLogo,
                    left: left,
                    top: top
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

