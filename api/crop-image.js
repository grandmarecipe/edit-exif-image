// Crop image from specified edges
// Uses sharp for server-side image processing

const sharp = require('sharp');

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    try {
        const { imageUrl, imageData, cropOptions } = req.body;

        // Validate required fields
        if (!imageUrl && !imageData) {
            return res.status(400).json({ error: 'Either imageUrl or imageData (base64) is required' });
        }

        if (!cropOptions || typeof cropOptions !== 'object') {
            return res.status(400).json({ error: 'cropOptions is required with at least one crop value' });
        }

        // Validate crop options
        const { top, bottom, left, right } = cropOptions;
        const hasCrop = (top && top > 0) || (bottom && bottom > 0) || 
                       (left && left > 0) || (right && right > 0);

        if (!hasCrop) {
            return res.status(400).json({ error: 'At least one crop value (top, bottom, left, or right) must be greater than 0' });
        }

        let buffer;

        // Handle base64 image data
        if (imageData) {
            try {
                // Remove data URL prefix if present
                const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
                buffer = Buffer.from(base64Data, 'base64');
                console.log('Using base64 image data');
            } catch (e) {
                return res.status(400).json({ error: 'Invalid base64 image data' });
            }
        } else {
            // Fetch the image from URL
            console.log('Fetching image from:', imageUrl);
            const imageResponse = await fetch(imageUrl);
            
            if (!imageResponse.ok) {
                return res.status(400).json({ error: `Failed to fetch image: ${imageResponse.statusText}` });
            }

            const imageBuffer = await imageResponse.arrayBuffer();
            buffer = Buffer.from(imageBuffer);
        }

        // Get image metadata to calculate crop dimensions
        const metadata = await sharp(buffer).metadata();
        const originalWidth = metadata.width;
        const originalHeight = metadata.height;

        console.log(`Original image size: ${originalWidth}x${originalHeight}`);
        console.log('Crop options:', cropOptions);

        // Calculate crop dimensions
        let cropLeft = left || 0;
        let cropTop = top || 0;
        let cropWidth = originalWidth - (left || 0) - (right || 0);
        let cropHeight = originalHeight - (top || 0) - (bottom || 0);

        // Validate crop dimensions
        if (cropWidth <= 0 || cropHeight <= 0) {
            return res.status(400).json({ 
                error: 'Invalid crop dimensions. The crop area would result in zero or negative dimensions.',
                originalSize: { width: originalWidth, height: originalHeight },
                cropOptions: cropOptions,
                calculatedSize: { width: cropWidth, height: cropHeight }
            });
        }

        if (cropLeft < 0 || cropTop < 0 || cropLeft + cropWidth > originalWidth || cropTop + cropHeight > originalHeight) {
            return res.status(400).json({ 
                error: 'Crop area exceeds image boundaries.',
                originalSize: { width: originalWidth, height: originalHeight },
                cropArea: { left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight }
            });
        }

        // Perform the crop
        const croppedBuffer = await sharp(buffer)
            .extract({
                left: cropLeft,
                top: cropTop,
                width: cropWidth,
                height: cropHeight
            })
            .jpeg({ quality: 95 }) // Convert to JPEG with high quality
            .toBuffer();

        console.log(`Cropped image size: ${cropWidth}x${cropHeight}`);

        // Return the cropped image
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="cropped-image.jpg"');
        return res.status(200).send(croppedBuffer);

    } catch (error) {
        console.error('Error cropping image:', error);
        return res.status(500).json({ 
            error: 'Failed to crop image', 
            message: error.message 
        });
    }
}

