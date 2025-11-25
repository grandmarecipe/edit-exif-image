/**
 * Test script to verify XMP/IPTC metadata writing
 * 
 * Usage:
 *   node test-metadata.js <input-image.jpg> [output-image.jpg]
 * 
 * Then run: exiftool -a -G -s output-image.jpg
 */

const fs = require('fs');
const path = require('path');
const piexif = require('piexifjs');
const ExifTool = require('exiftool-vendored').ExifTool;

// Test metadata
const testMetadata = {
    title: 'AZ Detailing Pro car detailing in Agadir',
    description: 'Premium automotive detailing service in Agadir Morocco exterior polish and interior cleaning',
    keywords: ['auto detailing', 'car detailing', 'Agadir', 'Morocco', 'ceramic coating'],
    city: 'Agadir',
    country: 'Morocco',
    latitude: 30.4008,
    longitude: -9.5776,
    altitude: 59
};

// Convert Decimal Degrees to DMS
function convertDDToDMS(dd, isLat) {
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = (minFloat - min) * 60;
    const ref = isLat 
        ? (dd >= 0 ? "N" : "S")
        : (dd >= 0 ? "E" : "W");
    
    const secNumerator = Math.round(sec * 10000);
    const secDenominator = 10000;
    
    return [[[deg, 1], [min, 1], [secNumerator, secDenominator]], ref];
}

async function testMetadataWriting(inputPath, outputPath) {
    console.log('=== Testing Metadata Writing ===\n');
    console.log('Input image:', inputPath);
    console.log('Output image:', outputPath);
    console.log('Test metadata:', JSON.stringify(testMetadata, null, 2));
    console.log('');

    try {
        // Read input image
        console.log('1. Reading input image...');
        const imageBuffer = fs.readFileSync(inputPath);
        console.log('   Image size:', imageBuffer.length, 'bytes');
        
        // Verify it's JPEG
        if (imageBuffer[0] !== 0xFF || imageBuffer[1] !== 0xD8) {
            throw new Error('Input file is not a JPEG');
        }

        // Step 2: Add EXIF GPS with piexifjs
        console.log('\n2. Adding EXIF GPS coordinates...');
        const imageString = imageBuffer.toString('binary');
        
        let exifObj = {};
        try {
            exifObj = piexif.load(imageString);
            console.log('   Loaded existing EXIF data');
        } catch (e) {
            console.log('   No existing EXIF, starting fresh');
            exifObj = {"0th": {}, "Exif": {}, "GPS": {}, "Interop": {}, "1st": {}, "thumbnail": null};
        }

        // Add GPS coordinates
        const latResult = convertDDToDMS(testMetadata.latitude, true);
        const lonResult = convertDDToDMS(testMetadata.longitude, false);
        
        exifObj["GPS"][piexif.GPSIFD.GPSLatitude] = latResult[0];
        exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef] = latResult[1];
        exifObj["GPS"][piexif.GPSIFD.GPSLongitude] = lonResult[0];
        exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef] = lonResult[1];
        exifObj["GPS"][piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(testMetadata.altitude) * 100), 100];
        exifObj["GPS"][piexif.GPSIFD.GPSAltitudeRef] = 0;

        // Ensure all required sections exist
        if (!exifObj['0th']) exifObj['0th'] = {};
        if (!exifObj['Exif']) exifObj['Exif'] = {};
        if (!exifObj['GPS']) exifObj['GPS'] = {};
        if (!exifObj['Interop']) exifObj['Interop'] = {};
        if (!exifObj['1st']) exifObj['1st'] = {};
        if (exifObj['thumbnail'] === undefined) exifObj['thumbnail'] = null;

        const exifString = piexif.dump(exifObj);
        const imageWithExif = piexif.insert(exifString, imageString);
        const imageBufferWithExif = Buffer.from(imageWithExif, 'binary');
        console.log('   EXIF GPS added, new size:', imageBufferWithExif.length, 'bytes');

        // Step 3: Write to temp file
        console.log('\n3. Writing image with EXIF GPS to temp file...');
        const tempFile = path.join(__dirname, 'test-temp.jpg');
        fs.writeFileSync(tempFile, imageBufferWithExif);
        console.log('   Temp file created:', tempFile);

        // Step 4: Add XMP/IPTC with ExifTool
        console.log('\n4. Adding XMP/IPTC metadata with ExifTool...');
        const exifToolTags = {
            'XMP-dc:Title': testMetadata.title,
            'IPTC:ObjectName': testMetadata.title,
            'XMP-dc:Description': testMetadata.description,
            'IPTC:Caption-Abstract': testMetadata.description,
            'XMP-dc:Subject': testMetadata.keywords,
            'IPTC:Keywords': testMetadata.keywords,
            'XMP-photoshop:City': testMetadata.city,
            'IPTC:City': testMetadata.city,
            'XMP-photoshop:Country': testMetadata.country,
            'IPTC:Country-PrimaryLocationName': testMetadata.country
        };
        
        console.log('   ExifTool tags:', JSON.stringify(exifToolTags, null, 2));
        
        const exiftool = new ExifTool();
        await exiftool.write(tempFile, exifToolTags, ['-overwrite_original']);
        await exiftool.end();
        console.log('   ExifTool.write completed');

        // Step 5: Read modified image
        console.log('\n5. Reading modified image...');
        const finalImageBuffer = fs.readFileSync(tempFile);
        console.log('   Final image size:', finalImageBuffer.length, 'bytes');

        // Write to output file
        fs.writeFileSync(outputPath, finalImageBuffer);
        console.log('   Output file written:', outputPath);

        // Clean up temp file
        fs.unlinkSync(tempFile);
        console.log('   Temp file cleaned up');

        console.log('\n=== Test Complete ===');
        console.log('\nTo verify metadata, run:');
        console.log(`  exiftool -a -G -s "${outputPath}"`);
        console.log('\nOr check in Windows Properties > Details tab');

    } catch (error) {
        console.error('\n=== ERROR ===');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Main
const inputPath = process.argv[2];
const outputPath = process.argv[3] || 'test-output.jpg';

if (!inputPath) {
    console.error('Usage: node test-metadata.js <input-image.jpg> [output-image.jpg]');
    process.exit(1);
}

if (!fs.existsSync(inputPath)) {
    console.error('Error: Input file not found:', inputPath);
    process.exit(1);
}

testMetadataWriting(inputPath, outputPath).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});

