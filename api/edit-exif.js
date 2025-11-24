const piexif = require('piexifjs');

// Convert Decimal Degrees to DMS (piexif format)
// Uses higher precision to avoid rounding errors
function convertDDToDMS(dd, isLat) {
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = (minFloat - min) * 60;
    const ref = isLat 
        ? (dd >= 0 ? "N" : "S")
        : (dd >= 0 ? "E" : "W");
    
    // Use higher precision: multiply by 10000 instead of 100 to preserve more decimal places
    // This matches the precision used in EXIF standard
    const secNumerator = Math.round(sec * 10000);
    const secDenominator = 10000;
    
    return [[[deg, 1], [min, 1], [secNumerator, secDenominator]], ref];
}

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
        const { imageUrl, exifData } = req.body;

        // Validate required fields
        if (!imageUrl) {
            return res.status(400).json({ error: 'imageUrl is required' });
        }

        if (!exifData || Object.keys(exifData).length === 0) {
            return res.status(400).json({ error: 'exifData is required with at least one field' });
        }

        // Fetch the image
        console.log('Fetching image from:', imageUrl);
        const imageResponse = await fetch(imageUrl);
        
        if (!imageResponse.ok) {
            return res.status(400).json({ error: `Failed to fetch image: ${imageResponse.statusText}` });
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageArray = new Uint8Array(imageBuffer);
        const imageString = Buffer.from(imageArray).toString('binary');

        // Check if image is JPEG
        if (!imageString.startsWith('\xff\xd8')) {
            return res.status(400).json({ error: 'Only JPEG images are supported' });
        }

        // Load existing EXIF or start fresh
        let exifObj = {};
        try {
            exifObj = piexif.load(imageString);
            console.log('Loaded existing EXIF data');
        } catch (e) {
            console.log('No existing EXIF, starting fresh');
            exifObj = {"0th": {}, "Exif": {}, "GPS": {}, "Interop": {}, "1st": {}, "thumbnail": null};
        }

        // Helper function to ensure proper UTF-8 string encoding
        // piexifjs handles UTF-8 internally, but we need to ensure strings are properly formatted
        function ensureUTF8String(str) {
            if (typeof str !== 'string') {
                str = String(str);
            }
            // Ensure the string is properly encoded - JavaScript strings are already Unicode
            // piexifjs will handle UTF-8 encoding internally
            return str;
        }

        // Apply EXIF modifications with UTF-8 support
        if (exifData.description) {
            exifObj["0th"][piexif.ImageIFD.ImageDescription] = ensureUTF8String(exifData.description);
        }

        if (exifData.keywords) {
            exifObj["0th"][piexif.ImageIFD.DocumentName] = ensureUTF8String(exifData.keywords);
        }

        if (exifData.make) {
            exifObj["0th"][piexif.ImageIFD.Make] = ensureUTF8String(exifData.make);
        }

        if (exifData.model) {
            exifObj["0th"][piexif.ImageIFD.Model] = ensureUTF8String(exifData.model);
        }

        if (exifData.copyright) {
            exifObj["0th"][piexif.ImageIFD.Copyright] = ensureUTF8String(exifData.copyright);
        }

        // Date/Time
        if (exifData.datetime) {
            try {
                const date = new Date(exifData.datetime);
                const year = date.getFullYear();
                if (year >= 1900 && year <= 2100) {
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');
                    const dateStr = `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
                    exifObj["0th"][piexif.ImageIFD.DateTime] = dateStr;
                    exifObj["Exif"][piexif.ExifIFD.DateTimeOriginal] = dateStr;
                }
            } catch (e) {
                console.warn('Invalid date format:', exifData.datetime);
            }
        }

        // GPS Coordinates
        if (exifData.latitude !== undefined && exifData.longitude !== undefined) {
            const lat = parseFloat(exifData.latitude);
            const lon = parseFloat(exifData.longitude);
            
            if (!isNaN(lat) && !isNaN(lon) && 
                lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                const latResult = convertDDToDMS(lat, true);
                const lonResult = convertDDToDMS(lon, false);
                
                exifObj["GPS"][piexif.GPSIFD.GPSLatitude] = latResult[0];
                exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef] = latResult[1];
                exifObj["GPS"][piexif.GPSIFD.GPSLongitude] = lonResult[0];
                exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef] = lonResult[1];
                
                if (exifData.altitude !== undefined) {
                    const altitude = parseFloat(exifData.altitude);
                    if (!isNaN(altitude)) {
                        exifObj["GPS"][piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(altitude) * 100), 100];
                        exifObj["GPS"][piexif.GPSIFD.GPSAltitudeRef] = altitude >= 0 ? 0 : 1;
                    }
                }
            }
        }

        // Ensure all required sections exist
        if (!exifObj['0th']) exifObj['0th'] = {};
        if (!exifObj['Exif']) exifObj['Exif'] = {};
        if (!exifObj['GPS']) exifObj['GPS'] = {};
        if (!exifObj['Interop']) exifObj['Interop'] = {};
        if (!exifObj['1st']) exifObj['1st'] = {};
        if (exifObj['thumbnail'] === undefined) exifObj['thumbnail'] = null;

        // Dump EXIF data
        const exifString = piexif.dump(exifObj);
        
        // Insert EXIF into image
        const newImageString = piexif.insert(exifString, imageString);
        const newImageBuffer = Buffer.from(newImageString, 'binary');

        // Return the modified image
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="edited-image.jpg"');
        return res.status(200).send(newImageBuffer);

    } catch (error) {
        console.error('Error processing image:', error);
        return res.status(500).json({ 
            error: 'Failed to process image', 
            message: error.message 
        });
    }
}

