const piexif = require('piexifjs');
const exifr = require('exifr');
const sharp = require('sharp');
const ExifTool = require('exiftool-vendored').ExifTool;

/**
 * Convert Decimal Degrees to DMS (Degrees, Minutes, Seconds) for EXIF GPS
 * Uses high precision (10000 denominator) to minimize rounding errors
 * @param {number} dd - Decimal degrees
 * @param {boolean} isLat - True for latitude, false for longitude
 * @returns {Array} [[[deg, 1], [min, 1], [sec*10000, 10000]], ref]
 */
function convertDDToDMS(dd, isLat) {
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = (minFloat - min) * 60;
    const ref = isLat 
        ? (dd >= 0 ? "N" : "S")
        : (dd >= 0 ? "E" : "W");
    
    // Use high precision: multiply by 10000 to preserve decimal places
    const secNumerator = Math.round(sec * 10000);
    const secDenominator = 10000;
    
    return [[[deg, 1], [min, 1], [secNumerator, secDenominator]], ref];
}

/**
 * Main API handler for editing image metadata
 * Supports EXIF (GPS), IPTC, and XMP metadata with proper UTF-8 encoding
 */
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
        // Accept new format: title, description, keywords[], city, country, latitude, longitude
        // Also support legacy format: exifData object for backward compatibility
        const { imageUrl, imageData, title, description, keywords, city, country, latitude, longitude, altitude, exifData } = req.body;

        // Validate required fields
        if (!imageUrl && !imageData) {
            return res.status(400).json({ error: 'Either imageUrl or imageData (base64) is required' });
        }

        // Check if we have any metadata to write
        const hasNewFormat = title || description || (keywords && keywords.length > 0) || city || country || latitude !== undefined || longitude !== undefined;
        const hasLegacyFormat = exifData && Object.keys(exifData).length > 0;
        
        if (!hasNewFormat && !hasLegacyFormat) {
            return res.status(400).json({ error: 'At least one metadata field is required' });
        }

        // Fetch or decode the image
        let imageBuffer;
        if (imageUrl) {
            console.log('Fetching image from:', imageUrl);
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                return res.status(400).json({ error: `Failed to fetch image: ${imageResponse.statusText}` });
            }
            imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        } else if (imageData) {
            console.log('Decoding base64 image data');
            const base64 = imageData.split(',')[1] || imageData;
            imageBuffer = Buffer.from(base64, 'base64');
        }

        // Verify it's a JPEG
        if (!imageBuffer || imageBuffer[0] !== 0xFF || imageBuffer[1] !== 0xD8) {
            return res.status(400).json({ error: 'Only JPEG images are supported' });
        }

        // Prepare XMP/IPTC metadata tags for ExifTool
        // ExifTool properly handles UTF-8 encoding for XMP and IPTC
        const exifToolTags = {};

        // Handle new format (preferred)
        if (hasNewFormat) {
            // Title -> XMP dc:title and IPTC ObjectName
            if (title) {
                const titleStr = String(title);
                exifToolTags['XMP:Title'] = titleStr;
                exifToolTags['IPTC:ObjectName'] = titleStr;
            }

            // Description -> XMP dc:description and IPTC Caption/Abstract
            if (description) {
                const descStr = String(description);
                exifToolTags['XMP:Description'] = descStr;
                exifToolTags['IPTC:Caption-Abstract'] = descStr;
            }

            // Keywords -> XMP dc:subject and IPTC Keywords
            if (keywords && Array.isArray(keywords) && keywords.length > 0) {
                const keywordsArray = keywords.map(k => String(k).trim()).filter(k => k.length > 0);
                exifToolTags['XMP:Subject'] = keywordsArray;
                exifToolTags['IPTC:Keywords'] = keywordsArray;
            } else if (keywords && typeof keywords === 'string') {
                // Support comma-separated string
                const keywordsArray = keywords.split(',').map(k => String(k).trim()).filter(k => k.length > 0);
                if (keywordsArray.length > 0) {
                    exifToolTags['XMP:Subject'] = keywordsArray;
                    exifToolTags['IPTC:Keywords'] = keywordsArray;
                }
            }

            // City -> XMP photoshop:City and IPTC City
            if (city) {
                const cityStr = String(city);
                exifToolTags['XMP:City'] = cityStr;
                exifToolTags['IPTC:City'] = cityStr;
            }

            // Country -> XMP photoshop:Country and IPTC Country/PrimaryLocationName
            if (country) {
                const countryStr = String(country);
                exifToolTags['XMP:Country'] = countryStr;
                exifToolTags['IPTC:Country-PrimaryLocationName'] = countryStr;
            }
        }

        // Handle legacy format (backward compatibility)
        if (hasLegacyFormat) {
            if (exifData.description && !description) {
                const descStr = String(exifData.description);
                exifToolTags['XMP:Description'] = descStr;
                exifToolTags['IPTC:Caption-Abstract'] = descStr;
            }
            if (exifData.keywords && !keywords) {
                const kw = typeof exifData.keywords === 'string' 
                    ? exifData.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
                    : Array.isArray(exifData.keywords) ? exifData.keywords.map(k => String(k).trim()).filter(k => k.length > 0) : [];
                if (kw.length > 0) {
                    exifToolTags['XMP:Subject'] = kw;
                    exifToolTags['IPTC:Keywords'] = kw;
                }
            }
        }

        // For EXIF GPS, we need to use piexifjs (Sharp doesn't support all EXIF GPS fields well)
        // Convert image to binary string for piexifjs
        const imageString = imageBuffer.toString('binary');

        // Load existing EXIF or start fresh
        let exifObj = {};
        try {
            exifObj = piexif.load(imageString);
            console.log('Loaded existing EXIF data');
        } catch (e) {
            console.log('No existing EXIF, starting fresh');
            exifObj = {"0th": {}, "Exif": {}, "GPS": {}, "Interop": {}, "1st": {}, "thumbnail": null};
        }

        // Determine GPS coordinates (prefer new format, fallback to legacy)
        let lat, lon, alt;
        if (hasNewFormat && (latitude !== undefined || longitude !== undefined)) {
            lat = latitude !== undefined ? parseFloat(latitude) : undefined;
            lon = longitude !== undefined ? parseFloat(longitude) : undefined;
            alt = altitude !== undefined ? parseFloat(altitude) : undefined;
        } else if (hasLegacyFormat && exifData.latitude !== undefined && exifData.longitude !== undefined) {
            lat = parseFloat(exifData.latitude);
            lon = parseFloat(exifData.longitude);
            alt = exifData.altitude !== undefined ? parseFloat(exifData.altitude) : undefined;
        }

        // Write GPS coordinates to EXIF
        if (lat !== undefined && lon !== undefined && 
            !isNaN(lat) && !isNaN(lon) && 
            lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            
            const latResult = convertDDToDMS(lat, true);
            const lonResult = convertDDToDMS(lon, false);
            
            exifObj["GPS"][piexif.GPSIFD.GPSLatitude] = latResult[0];
            exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef] = latResult[1];
            exifObj["GPS"][piexif.GPSIFD.GPSLongitude] = lonResult[0];
            exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef] = lonResult[1];
            
            if (alt !== undefined && !isNaN(alt)) {
                exifObj["GPS"][piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(alt) * 100), 100];
                exifObj["GPS"][piexif.GPSIFD.GPSAltitudeRef] = alt >= 0 ? 0 : 1;
            }
        }

        // Ensure all required EXIF sections exist
        if (!exifObj['0th']) exifObj['0th'] = {};
        if (!exifObj['Exif']) exifObj['Exif'] = {};
        if (!exifObj['GPS']) exifObj['GPS'] = {};
        if (!exifObj['Interop']) exifObj['Interop'] = {};
        if (!exifObj['1st']) exifObj['1st'] = {};
        if (exifObj['thumbnail'] === undefined) exifObj['thumbnail'] = null;

        // Apply EXIF GPS data using piexifjs
        const exifString = piexif.dump(exifObj);
        const imageWithExif = piexif.insert(exifString, imageString);
        const imageBufferWithExif = Buffer.from(imageWithExif, 'binary');

        // Apply XMP/IPTC metadata using ExifTool (proper UTF-8 support)
        let finalImageBuffer = imageBufferWithExif;
        if (Object.keys(exifToolTags).length > 0) {
            // Write image to temp file, process with ExifTool, then read back
            // ExifTool needs file paths, so we'll use a temporary approach
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            
            // Create temp file
            const tempInput = path.join(os.tmpdir(), `exif-input-${Date.now()}.jpg`);
            const tempOutput = path.join(os.tmpdir(), `exif-output-${Date.now()}.jpg`);
            
            try {
                // Write input image
                fs.writeFileSync(tempInput, imageBufferWithExif);
                
                // Use ExifTool to write XMP/IPTC metadata
                const exiftool = new ExifTool();
                await exiftool.write(tempInput, exifToolTags, ['-overwrite_original']);
                await exiftool.end();
                
                // Read the modified image
                finalImageBuffer = fs.readFileSync(tempInput);
                
                // Clean up temp files
                try {
                    fs.unlinkSync(tempInput);
                    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                } catch (cleanupError) {
                    console.warn('Failed to cleanup temp files:', cleanupError);
                }
            } catch (exifToolError) {
                console.error('ExifTool error:', exifToolError);
                // Fallback: return image with EXIF GPS only
                finalImageBuffer = imageBufferWithExif;
            }
        }

        // Return the modified image
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="edited-image.jpg"');
        return res.status(200).send(finalImageBuffer);

    } catch (error) {
        console.error('Error processing image:', error);
        return res.status(500).json({ 
            error: 'Failed to process image', 
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
