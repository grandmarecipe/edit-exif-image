const fs = require('fs');
const piexif = require('piexifjs');

// Read the image file
const imagePath = './coolest-cars-feature.jpg';
console.log('Reading image:', imagePath);

const jpeg = fs.readFileSync(imagePath);
const jpegString = jpeg.toString('binary');

// Load existing EXIF data
let exifObj = {};
try {
    exifObj = piexif.load(jpegString);
    console.log('Existing EXIF data loaded');
} catch (e) {
    console.log('No existing EXIF, starting fresh');
    exifObj = {"0th": {}, "Exif": {}, "GPS": {}, "Interop": {}, "1st": {}, "thumbnail": null};
}

// Modify EXIF data
console.log('\nModifying EXIF data...');

// Basic information
exifObj["0th"][piexif.ImageIFD.ImageDescription] = "Modified by EXIF Editor - Coolest Cars Feature";
exifObj["0th"][piexif.ImageIFD.Make] = "Canon";
exifObj["0th"][piexif.ImageIFD.Model] = "EOS 5D Mark IV";
exifObj["0th"][piexif.ImageIFD.Copyright] = "Test Copyright 2025";

// Date/Time (format: YYYY:MM:DD HH:MM:SS)
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
const seconds = String(now.getSeconds()).padStart(2, '0');
const dateStr = `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;

exifObj["0th"][piexif.ImageIFD.DateTime] = dateStr;
exifObj["Exif"][piexif.ExifIFD.DateTimeOriginal] = dateStr;

// GPS Coordinates (New York City as example)
// Latitude: 40.7128, Longitude: -74.0060
const lat = 40.7128;
const lon = -74.0060;

// Convert to DMS format
function convertDDToDMS(dd, isLat) {
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = (minFloat - min) * 60;
    const ref = isLat 
        ? (dd >= 0 ? "N" : "S")
        : (dd >= 0 ? "E" : "W");
    const degInt = Math.floor(deg);
    const minInt = Math.floor(min);
    const secNumerator = Math.round(sec * 100);
    return [[[degInt, 1], [minInt, 1], [secNumerator, 100]], ref];
}

const latResult = convertDDToDMS(lat, true);
const lonResult = convertDDToDMS(lon, false);

exifObj["GPS"][piexif.GPSIFD.GPSLatitude] = latResult[0];
exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef] = latResult[1];
exifObj["GPS"][piexif.GPSIFD.GPSLongitude] = lonResult[0];
exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef] = lonResult[1];
exifObj["GPS"][piexif.GPSIFD.GPSAltitude] = [100, 1]; // 100 meters
exifObj["GPS"][piexif.GPSIFD.GPSAltitudeRef] = 0; // Above sea level

// Dump EXIF data
console.log('Creating EXIF binary data...');
const exifString = piexif.dump(exifObj);

// Insert EXIF into image
console.log('Inserting EXIF data into image...');
const newJpegString = piexif.insert(exifString, jpegString);

// Save the modified image
const outputPath = './coolest-cars-feature-edited.jpg';
const newJpeg = Buffer.from(newJpegString, 'binary');
fs.writeFileSync(outputPath, newJpeg);

console.log('\n✅ SUCCESS!');
console.log('Modified image saved as:', outputPath);
console.log('\nModified EXIF data:');
console.log('- Description:', exifObj["0th"][piexif.ImageIFD.ImageDescription]);
console.log('- Make:', exifObj["0th"][piexif.ImageIFD.Make]);
console.log('- Model:', exifObj["0th"][piexif.ImageIFD.Model]);
console.log('- Copyright:', exifObj["0th"][piexif.ImageIFD.Copyright]);
console.log('- DateTime:', exifObj["0th"][piexif.ImageIFD.DateTime]);
console.log('- GPS Latitude:', lat, '°');
console.log('- GPS Longitude:', lon, '°');
console.log('- GPS Altitude: 100 meters');

