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

        // Write text metadata to EXIF using piexifjs (this works reliably)
        // Also prepare XMP/IPTC tags for ExifTool (if it works in the environment)
        const exifToolTags = {};

        // Handle new format (preferred)
        if (hasNewFormat) {
            // Title -> EXIF DocumentName (works with piexifjs) + XMP/IPTC (if ExifTool works)
            if (title) {
                const titleStr = String(title);
                // Write to EXIF DocumentName (this works!)
                exifObj["0th"][piexif.ImageIFD.DocumentName] = titleStr;
                // Also try XMP/IPTC with ExifTool
                exifToolTags['XMP-dc:Title'] = titleStr;
                exifToolTags['IPTC:ObjectName'] = titleStr;
                console.log('Setting title:', titleStr);
            }

            // Description -> EXIF ImageDescription (works with piexifjs) + XMP/IPTC (if ExifTool works)
            if (description) {
                const descStr = String(description);
                // Write to EXIF ImageDescription (this works!)
                exifObj["0th"][piexif.ImageIFD.ImageDescription] = descStr;
                // Also try XMP/IPTC with ExifTool
                exifToolTags['XMP-dc:Description'] = descStr;
                exifToolTags['IPTC:Caption-Abstract'] = descStr;
                console.log('Setting description:', descStr);
            }

            // Keywords -> EXIF DocumentName (works with piexifjs) + XMP/IPTC (if ExifTool works)
            let keywordsStr = '';
            if (keywords && Array.isArray(keywords) && keywords.length > 0) {
                keywordsStr = keywords.map(k => String(k).trim()).filter(k => k.length > 0).join(', ');
                exifToolTags['XMP-dc:Subject'] = keywords.map(k => String(k).trim()).filter(k => k.length > 0);
                exifToolTags['IPTC:Keywords'] = keywords.map(k => String(k).trim()).filter(k => k.length > 0);
            } else if (keywords && typeof keywords === 'string') {
                keywordsStr = keywords.split(',').map(k => String(k).trim()).filter(k => k.length > 0).join(', ');
                const keywordsArray = keywordsStr.split(',').map(k => k.trim()).filter(k => k.length > 0);
                if (keywordsArray.length > 0) {
                    exifToolTags['XMP-dc:Subject'] = keywordsArray;
                    exifToolTags['IPTC:Keywords'] = keywordsArray;
                }
            }
            if (keywordsStr) {
                // Write to EXIF DocumentName (append to title if exists, or use as DocumentName)
                // For keywords, we'll use DocumentName field (this is what was working before)
                if (!title) {
                    exifObj["0th"][piexif.ImageIFD.DocumentName] = keywordsStr;
                }
                console.log('Setting keywords:', keywordsStr);
            }

            // City and Country -> Try to store in EXIF UserComment (works with piexifjs)
            // Also try XMP/IPTC with ExifTool
            if (city || country) {
                const locationStr = [city, country].filter(Boolean).join(', ');
                if (locationStr) {
                    // Store in UserComment with UTF-8 encoding
                    const utf8Bytes = Buffer.from(`Location: ${locationStr}`, 'utf8');
                    const userComment = Buffer.concat([
                        Buffer.from([0x01, 0x00]), // UTF-8 encoding identifier
                        utf8Bytes
                    ]);
                    exifObj["Exif"][piexif.ExifIFD.UserComment] = userComment.toString('binary');
                    console.log('Setting location in UserComment:', locationStr);
                }
                if (city) {
                    exifToolTags['XMP-photoshop:City'] = String(city);
                    exifToolTags['IPTC:City'] = String(city);
                }
                if (country) {
                    exifToolTags['XMP-photoshop:Country'] = String(country);
                    exifToolTags['IPTC:Country-PrimaryLocationName'] = String(country);
                }
            }
        }

        // Handle legacy format (backward compatibility)
        if (hasLegacyFormat) {
            if (exifData.description && !description) {
                const descStr = String(exifData.description);
                exifObj["0th"][piexif.ImageIFD.ImageDescription] = descStr;
                exifToolTags['XMP-dc:Description'] = descStr;
                exifToolTags['IPTC:Caption-Abstract'] = descStr;
                console.log('Setting description (legacy):', descStr);
            }
            if (exifData.keywords && !keywords) {
                const kw = typeof exifData.keywords === 'string' 
                    ? exifData.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0).join(', ')
                    : Array.isArray(exifData.keywords) ? exifData.keywords.map(k => String(k).trim()).filter(k => k.length > 0).join(', ') : '';
                if (kw) {
                    exifObj["0th"][piexif.ImageIFD.DocumentName] = kw;
                    const kwArray = kw.split(',').map(k => k.trim()).filter(k => k.length > 0);
                    exifToolTags['XMP-dc:Subject'] = kwArray;
                    exifToolTags['IPTC:Keywords'] = kwArray;
                    console.log('Setting keywords (legacy):', kw);
                }
            }
        }

        // For EXIF, we need to use piexifjs
        // Convert image to binary string for piexifjs
        const imageString = imageBuffer.toString('binary');

        // Load existing EXIF or start fresh (MUST BE DONE BEFORE writing to exifObj)
        let exifObj = {};
        try {
            exifObj = piexif.load(imageString);
            console.log('Loaded existing EXIF data');
        } catch (e) {
            console.log('No existing EXIF, starting fresh');
            exifObj = {"0th": {}, "Exif": {}, "GPS": {}, "Interop": {}, "1st": {}, "thumbnail": null};
        }

        console.log('ExifTool tags to write (if ExifTool works):', JSON.stringify(exifToolTags, null, 2));

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

        // Apply EXIF data (GPS + text fields) using piexifjs
        // This includes: GPS coordinates, DocumentName, ImageDescription, UserComment
        console.log('Writing EXIF data with piexifjs (GPS + text fields)');
        const exifString = piexif.dump(exifObj);
        const imageWithExif = piexif.insert(exifString, imageString);
        const imageBufferWithExif = Buffer.from(imageWithExif, 'binary');
        console.log('EXIF data written, buffer size:', imageBufferWithExif.length, 'bytes');

        // Apply XMP/IPTC metadata using ExifTool (optional - EXIF fields already written above)
        // Try ExifTool for XMP/IPTC, but if it fails, we still return the image with EXIF data
        let finalImageBuffer = imageBufferWithExif;
        if (Object.keys(exifToolTags).length > 0) {
            console.log('Attempting ExifTool processing for XMP/IPTC metadata (optional)...');
            console.log('ExifTool tags to write:', JSON.stringify(exifToolTags, null, 2));
            
            try {
                const fs = require('fs');
                const path = require('path');
                const os = require('os');
                
                // Create temp file with unique name
                const tempInput = path.join(os.tmpdir(), `exif-input-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`);
                
                try {
                    // Write image with EXIF GPS to temp file
                    console.log('Writing image with EXIF GPS to temp file:', tempInput);
                    fs.writeFileSync(tempInput, imageBufferWithExif);
                    console.log('Temp file created, size:', fs.statSync(tempInput).size, 'bytes');
                    
                    // Use ExifTool to write XMP/IPTC metadata
                    console.log('Creating ExifTool instance...');
                    const exiftool = new ExifTool();
                    console.log('ExifTool instance created');
                    
                    console.log('Calling ExifTool.write with tags:', Object.keys(exifToolTags));
                    // Write metadata with overwrite_original flag
                    await exiftool.write(tempInput, exifToolTags, ['-overwrite_original']);
                    console.log('ExifTool.write completed successfully');
                    
                    // Properly close ExifTool
                    await exiftool.end();
                    console.log('ExifTool instance closed');
                    
                    // Read the modified image back
                    console.log('Reading modified image from temp file');
                    finalImageBuffer = fs.readFileSync(tempInput);
                    console.log('Final buffer size:', finalImageBuffer.length, 'bytes');
                    
                    // Clean up temp file
                    try {
                        fs.unlinkSync(tempInput);
                        console.log('Temp file cleaned up');
                    } catch (cleanupError) {
                        console.warn('Failed to cleanup temp file:', cleanupError);
                    }
                } catch (exifToolError) {
                    console.error('ExifTool error (non-fatal, continuing with EXIF-only):', {
                        message: exifToolError.message,
                        name: exifToolError.name
                    });
                    // Fallback: use image with EXIF data only (this is fine!)
                    console.log('Using image with EXIF data only (XMP/IPTC not available in this environment)');
                    finalImageBuffer = imageBufferWithExif;
                    
                    // Clean up temp file on error
                    try {
                        if (fs.existsSync(tempInput)) {
                            fs.unlinkSync(tempInput);
                        }
                    } catch (cleanupError) {
                        // Ignore cleanup errors
                    }
                }
            } catch (fsError) {
                // File system operations failed (e.g., in serverless environment)
                console.warn('File system operations failed (serverless environment?):', fsError.message);
                console.log('Using image with EXIF data only (this is fine!)');
                finalImageBuffer = imageBufferWithExif;
            }
        } else {
            console.log('No XMP/IPTC tags to write, using EXIF data only');
        }

        // Return the modified image
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="edited-image.jpg"');
        return res.status(200).send(finalImageBuffer);

    } catch (error) {
        console.error('Error processing image:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({ 
            error: 'Failed to process image', 
            message: error.message,
            details: error.toString(),
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
