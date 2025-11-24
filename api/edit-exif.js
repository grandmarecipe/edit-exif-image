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

        // Helper function to encode UTF-8 strings properly for EXIF UserComment
        // piexifjs has issues with UTF-8 in standard fields, so we use UserComment for UTF-8 text
        // UserComment format: [encoding byte][null byte][text in specified encoding]
        // Encoding: 0x01 = UTF-8, 0x00 = ASCII
        function encodeUTF8String(str) {
            if (typeof str !== 'string') {
                str = String(str);
            }
            // Convert string to UTF-8 bytes
            const utf8Bytes = Buffer.from(str, 'utf8');
            // Create UserComment with UTF-8 encoding identifier
            const userComment = Buffer.concat([
                Buffer.from([0x01, 0x00]), // UTF-8 encoding identifier (0x01) + null terminator (0x00)
                utf8Bytes
            ]);
            // Convert to binary string format that piexifjs expects
            return userComment.toString('binary');
        }

        // Apply EXIF modifications with UTF-8 support
        if (exifData.description) {
            // Try standard field first, but also use UserComment for UTF-8 support
            const desc = String(exifData.description);
            exifObj["0th"][piexif.ImageIFD.ImageDescription] = desc;
            // Also store in UserComment for better UTF-8 support
            exifObj["Exif"][piexif.ExifIFD.UserComment] = encodeUTF8String(desc);
        }

        if (exifData.keywords) {
            const keywords = String(exifData.keywords);
            
            // piexifjs has a known limitation: it doesn't properly support UTF-8 in standard text fields
            // The library treats strings as binary and doesn't encode them as UTF-8
            // Solution: Use UserComment which explicitly supports UTF-8 encoding
            
            // 1. UserComment with proper UTF-8 encoding (this is the correct way)
            exifObj["Exif"][piexif.ExifIFD.UserComment] = encodeUTF8String("Keywords: " + keywords);
            
            // 2. For DocumentName, we need to work around piexifjs limitation
            // The issue is that piexifjs will re-encode any string we give it
            // We'll store it as-is and hope some viewers can handle it
            // Note: This will likely show ?? in most viewers, but UserComment will be correct
            exifObj["0th"][piexif.ImageIFD.DocumentName] = keywords;
            
            // 3. Also try storing in XPKeywords with UTF-16LE (Windows-specific but better support)
            // XPKeywords uses UTF-16LE encoding which some viewers handle better
            try {
                // Convert to UTF-16LE: each character becomes 2 bytes (little-endian)
                const utf16le = Buffer.allocUnsafe(keywords.length * 2 + 4);
                utf16le[0] = 0xFF; // UTF-16LE BOM byte 1
                utf16le[1] = 0xFE; // UTF-16LE BOM byte 2
                for (let i = 0; i < keywords.length; i++) {
                    const charCode = keywords.charCodeAt(i);
                    utf16le[i * 2 + 2] = charCode & 0xFF;        // Low byte
                    utf16le[i * 2 + 3] = (charCode >> 8) & 0xFF; // High byte
                }
                utf16le[keywords.length * 2 + 2] = 0x00; // Null terminator
                utf16le[keywords.length * 2 + 3] = 0x00;
                exifObj["0th"][piexif.ImageIFD.XPKeywords] = utf16le.toString('binary');
            } catch (e) {
                console.log('XPKeywords encoding failed:', e);
            }
        }

        if (exifData.make) {
            exifObj["0th"][piexif.ImageIFD.Make] = String(exifData.make);
        }

        if (exifData.model) {
            exifObj["0th"][piexif.ImageIFD.Model] = String(exifData.model);
        }

        if (exifData.copyright) {
            exifObj["0th"][piexif.ImageIFD.Copyright] = String(exifData.copyright);
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

