let currentImageData = null;
let originalExifData = null;

// Load image from URL
document.getElementById('loadUrlBtn').addEventListener('click', async () => {
    const imageUrl = document.getElementById('imageUrl').value.trim();
    if (!imageUrl) {
        alert('Please enter an image URL');
        return;
    }

    try {
        await loadImageFromUrl(imageUrl);
    } catch (error) {
        alert('Error loading image: ' + error.message);
        console.error(error);
    }
});

// Load image from file upload
document.getElementById('imageFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        loadImageFromFile(file);
    }
});

// Load image from URL
async function loadImageFromUrl(url) {
    try {
        // Fetch image with CORS handling
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) {
            throw new Error('Failed to fetch image');
        }
        const blob = await response.blob();
        loadImageFromBlob(blob, url);
    } catch (error) {
        // If CORS fails, try loading directly (may work for some servers)
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            // Convert image to blob
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                loadImageFromBlob(blob, url);
            }, 'image/jpeg');
        };
        img.onerror = () => {
            throw new Error('Failed to load image. CORS may be blocking the request.');
        };
        img.src = url;
    }
}

// Load image from file
function loadImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const blob = new Blob([e.target.result], { type: file.type });
        loadImageFromBlob(blob, file.name);
    };
    reader.readAsArrayBuffer(file);
}

// Load image from blob
function loadImageFromBlob(blob, source) {
    const reader = new FileReader();
    reader.onload = (e) => {
        currentImageData = e.target.result;
        displayImage(currentImageData);
        readExifData(currentImageData);
    };
    reader.readAsDataURL(blob);
}

// Display image preview
function displayImage(imageData) {
    const preview = document.getElementById('imagePreview');
    const img = document.getElementById('previewImg');
    img.src = imageData;
    preview.classList.remove('hidden');
}

// Read EXIF data from image
function readExifData(imageData) {
    const img = document.getElementById('previewImg');
    img.onload = function() {
        EXIF.getData(img, function() {
            originalExifData = EXIF.getAllTags(this);
            displayExifData(originalExifData);
            populateForm(originalExifData);
            document.getElementById('exifEditor').classList.remove('hidden');
        });
    };
    img.src = imageData;
}

// Display current EXIF data
function displayExifData(exifData) {
    const exifDisplay = document.getElementById('currentExif');
    const exifText = document.getElementById('exifData');
    exifText.textContent = JSON.stringify(exifData, null, 2);
    exifDisplay.classList.remove('hidden');
}

// Populate form with EXIF data
function populateForm(exifData) {
    // Description (ImageDescription or UserComment)
    document.getElementById('description').value = 
        exifData.ImageDescription || exifData.UserComment || '';

    // Keywords (XPKeywords or Subject)
    const keywords = exifData.XPKeywords || exifData.Subject || '';
    document.getElementById('keywords').value = Array.isArray(keywords) 
        ? keywords.join(', ') 
        : keywords;

    // GPS Coordinates
    if (exifData.GPSLatitude && exifData.GPSLongitude) {
        document.getElementById('latitude').value = 
            convertDMSToDD(exifData.GPSLatitude, exifData.GPSLatitudeRef);
        document.getElementById('longitude').value = 
            convertDMSToDD(exifData.GPSLongitude, exifData.GPSLongitudeRef);
    }
    
    if (exifData.GPSAltitude) {
        document.getElementById('altitude').value = exifData.GPSAltitude;
    }

    // Camera info
    document.getElementById('make').value = exifData.Make || '';
    document.getElementById('model').value = exifData.Model || '';

    // DateTime
    if (exifData.DateTimeOriginal || exifData.DateTime) {
        const dateStr = exifData.DateTimeOriginal || exifData.DateTime;
        const date = new Date(dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
        if (!isNaN(date.getTime())) {
            document.getElementById('datetime').value = 
                date.toISOString().slice(0, 16);
        }
    }

    // Copyright
    document.getElementById('copyright').value = exifData.Copyright || '';
}

// Convert DMS (Degrees, Minutes, Seconds) to Decimal Degrees
function convertDMSToDD(dms, ref) {
    let dd = dms[0] + dms[1]/60 + dms[2]/(60*60);
    if (ref === "S" || ref === "W") {
        dd = dd * -1;
    }
    return dd;
}

// Convert Decimal Degrees to DMS
function convertDDToDMS(dd, isLat) {
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const min = Math.floor((abs - deg) * 60);
    const sec = ((abs - deg - min/60) * 3600).toFixed(2);
    const ref = isLat 
        ? (dd >= 0 ? "N" : "S")
        : (dd >= 0 ? "E" : "W");
    return [[deg, min, sec], ref];
}

// Save EXIF data
document.getElementById('saveBtn').addEventListener('click', () => {
    if (!currentImageData) {
        alert('Please load an image first');
        return;
    }

    try {
        const editedExif = collectFormData();
        const newImageData = writeExifData(currentImageData, editedExif);
        
        // Update preview
        displayImage(newImageData);
        currentImageData = newImageData;
        
        // Re-read and display updated EXIF
        readExifData(newImageData);
        
        // Trigger download
        downloadImage(newImageData);
        
        alert('EXIF data saved! Image download started.');
    } catch (error) {
        alert('Error saving EXIF data: ' + error.message);
        console.error(error);
    }
});

// Collect form data
function collectFormData() {
    const exif = {};
    
    // Description
    const description = document.getElementById('description').value.trim();
    if (description) {
        exif['0th'] = exif['0th'] || {};
        exif['0th'][piexif.ImageIFD.ImageDescription] = description;
    }

    // Keywords
    const keywords = document.getElementById('keywords').value.trim();
    if (keywords) {
        exif['0th'] = exif['0th'] || {};
        exif['0th'][piexif.ImageIFD.XPKeywords] = keywords.split(',').map(k => k.trim()).join(';');
    }

    // GPS Coordinates
    const lat = parseFloat(document.getElementById('latitude').value);
    const lon = parseFloat(document.getElementById('longitude').value);
    if (!isNaN(lat) && !isNaN(lon)) {
        exif['GPS'] = exif['GPS'] || {};
        const [latDMS, latRef] = convertDDToDMS(lat, true);
        const [lonDMS, lonRef] = convertDDToDMS(lon, false);
        
        exif['GPS'][piexif.GPSIFD.GPSLatitude] = latDMS;
        exif['GPS'][piexif.GPSIFD.GPSLatitudeRef] = latRef;
        exif['GPS'][piexif.GPSIFD.GPSLongitude] = lonDMS;
        exif['GPS'][piexif.GPSIFD.GPSLongitudeRef] = lonRef;
        
        const altitude = parseFloat(document.getElementById('altitude').value);
        if (!isNaN(altitude)) {
            exif['GPS'][piexif.GPSIFD.GPSAltitude] = [Math.abs(altitude), 1];
            exif['GPS'][piexif.GPSIFD.GPSAltitudeRef] = altitude >= 0 ? 0 : 1;
        }
    }

    // Camera info
    const make = document.getElementById('make').value.trim();
    const model = document.getElementById('model').value.trim();
    if (make) {
        exif['0th'] = exif['0th'] || {};
        exif['0th'][piexif.ImageIFD.Make] = make;
    }
    if (model) {
        exif['0th'] = exif['0th'] || {};
        exif['0th'][piexif.ImageIFD.Model] = model;
    }

    // DateTime
    const datetime = document.getElementById('datetime').value;
    if (datetime) {
        const date = new Date(datetime);
        const dateStr = date.toISOString().replace(/[-T]/g, ':').slice(0, 19);
        exif['0th'] = exif['0th'] || {};
        exif['0th'][piexif.ImageIFD.DateTime] = dateStr;
        exif['Exif'] = exif['Exif'] || {};
        exif['Exif'][piexif.ExifIFD.DateTimeOriginal] = dateStr;
    }

    // Copyright
    const copyright = document.getElementById('copyright').value.trim();
    if (copyright) {
        exif['0th'] = exif['0th'] || {};
        exif['0th'][piexif.ImageIFD.Copyright] = copyright;
    }

    return exif;
}

// Write EXIF data to image
function writeExifData(imageData, newExif) {
    try {
        // Load existing EXIF if available
        let exifObj = {};
        try {
            exifObj = piexif.load(imageData);
        } catch (e) {
            // No existing EXIF, start fresh
            exifObj = {"0th": {}, "Exif": {}, "GPS": {}, "Interop": {}, "1st": {}, "thumbnail": null};
        }

        // Merge new EXIF data
        if (newExif['0th']) {
            Object.assign(exifObj['0th'], newExif['0th']);
        }
        if (newExif['Exif']) {
            Object.assign(exifObj['Exif'], newExif['Exif']);
        }
        if (newExif['GPS']) {
            Object.assign(exifObj['GPS'], newExif['GPS']);
        }

        // Convert to binary
        const exifString = piexif.dump(exifObj);
        
        // Insert EXIF into image
        const newImageData = piexif.insert(exifString, imageData);
        
        return newImageData;
    } catch (error) {
        throw new Error('Failed to write EXIF data: ' + error.message);
    }
}

// Download image
function downloadImage(imageData) {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = 'edited-image.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Reset form
document.getElementById('resetBtn').addEventListener('click', () => {
    if (originalExifData) {
        populateForm(originalExifData);
    } else {
        document.getElementById('exifEditor').querySelectorAll('input, textarea').forEach(input => {
            input.value = '';
        });
    }
});

// Check for image URL in query parameters on page load
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const imageUrl = urlParams.get('image');
    
    if (imageUrl) {
        // Set the URL in the input field
        document.getElementById('imageUrl').value = imageUrl;
        // Automatically load the image
        loadImageFromUrl(imageUrl).catch(error => {
            alert('Error loading image from URL parameter: ' + error.message);
            console.error(error);
        });
    }
});

