let currentImageData = null;
let originalExifData = null;
let originalImageFormat = null;

// Show notification message
function showNotification(message, type = 'info') {
    // Remove existing notification if any
    const existing = document.getElementById('notification');
    if (existing) {
        existing.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    if (!document.getElementById('notification-style')) {
        style.id = 'notification-style';
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

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
    reader.onload = async (e) => {
        const dataUrl = e.target.result;
        // Detect image format
        const mimeType = dataUrl.split(',')[0].split(':')[1].split(';')[0];
        originalImageFormat = mimeType;
        
        // Convert to JPEG if not already JPEG
        if (mimeType !== 'image/jpeg') {
            try {
                // Show conversion message
                const formatName = mimeType.split('/')[1].toUpperCase();
                showNotification(`Converting ${formatName} to JPEG for EXIF editing...`, 'info');
                
                currentImageData = await convertToJPEG(dataUrl);
                showNotification(`Successfully converted ${formatName} to JPEG!`, 'success');
            } catch (error) {
                console.error('Conversion error:', error);
                showNotification('Failed to convert image. Using original format.', 'error');
                currentImageData = dataUrl; // Fallback to original
            }
        } else {
            currentImageData = dataUrl;
        }
        
        displayImage(currentImageData);
        readExifData(currentImageData);
    };
    reader.readAsDataURL(blob);
}

// Convert any image format to JPEG using canvas
function convertToJPEG(imageDataUrl, quality = 0.95) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            try {
                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw image to canvas
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                // Convert to JPEG data URL
                const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(jpegDataUrl);
            } catch (error) {
                reject(new Error('Failed to convert image to JPEG: ' + error.message));
            }
        };
        
        img.onerror = function() {
            reject(new Error('Failed to load image for conversion'));
        };
        
        img.src = imageDataUrl;
    });
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

    // Keywords (DocumentName, XPKeywords, or Subject)
    const keywords = exifData.DocumentName || exifData.XPKeywords || exifData.Subject || '';
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

// Convert Decimal Degrees to DMS (piexif format: [[deg, 1], [min, 1], [sec*100, 100]])
function convertDDToDMS(dd, isLat) {
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = (minFloat - min) * 60;
    const ref = isLat 
        ? (dd >= 0 ? "N" : "S")
        : (dd >= 0 ? "E" : "W");
    // piexif expects rational numbers: [[deg, 1], [min, 1], [sec*100, 100]]
    // All values must be integers - ensure they are
    const degInt = Math.floor(deg);
    const minInt = Math.floor(min);
    const secNumerator = Math.round(sec * 100);
    // Return format: [[[deg, 1], [min, 1], [sec*100, 100]], ref]
    return [[[degInt, 1], [minInt, 1], [secNumerator, 100]], ref];
}

// Save EXIF data
document.getElementById('saveBtn').addEventListener('click', () => {
    if (!currentImageData) {
        alert('Please load an image first');
        return;
    }

    // Validate GPS coordinates - both must be provided if one is filled
    const latStr = document.getElementById('latitude').value.trim();
    const lonStr = document.getElementById('longitude').value.trim();
    if ((latStr && !lonStr) || (!latStr && lonStr)) {
        alert('Please provide both latitude and longitude for GPS coordinates, or leave both empty.');
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
        // Ensure it's a string
        exif['0th'][piexif.ImageIFD.ImageDescription] = String(description);
    }

    // Keywords - use DocumentName field which is more widely supported
    const keywords = document.getElementById('keywords').value.trim();
    if (keywords) {
        exif['0th'] = exif['0th'] || {};
        // Use DocumentName field for keywords (more widely recognized than XPKeywords)
        exif['0th'][piexif.ImageIFD.DocumentName] = String(keywords.split(',').map(k => k.trim()).join(', '));
    }

    // GPS Coordinates - only set if both lat and lon are provided
    const latStr = document.getElementById('latitude').value.trim();
    const lonStr = document.getElementById('longitude').value.trim();
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    
    // Only add GPS if both coordinates are provided and valid
    if (latStr && lonStr && !isNaN(lat) && !isNaN(lon) && 
        lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        exif['GPS'] = exif['GPS'] || {};
        const latResult = convertDDToDMS(lat, true);
        const lonResult = convertDDToDMS(lon, false);
        
        // Ensure GPS coordinates are in correct format - validate the structure
        if (Array.isArray(latResult[0]) && Array.isArray(lonResult[0])) {
            exif['GPS'][piexif.GPSIFD.GPSLatitude] = latResult[0];
            exif['GPS'][piexif.GPSIFD.GPSLatitudeRef] = String(latResult[1]); // Must be string
            exif['GPS'][piexif.GPSIFD.GPSLongitude] = lonResult[0];
            exif['GPS'][piexif.GPSIFD.GPSLongitudeRef] = String(lonResult[1]); // Must be string
            
            const altitude = parseFloat(document.getElementById('altitude').value);
            if (!isNaN(altitude) && altitude !== 0) {
                // Altitude must be rational number [numerator, denominator] as integers
                const altNum = Math.round(Math.abs(altitude) * 100);
                exif['GPS'][piexif.GPSIFD.GPSAltitude] = [altNum, 100];
                exif['GPS'][piexif.GPSIFD.GPSAltitudeRef] = altitude >= 0 ? 0 : 1; // Must be integer 0 or 1
            }
        }
    }

    // Camera info
    const make = document.getElementById('make').value.trim();
    const model = document.getElementById('model').value.trim();
    if (make) {
        exif['0th'] = exif['0th'] || {};
        exif['0th'][piexif.ImageIFD.Make] = String(make);
    }
    if (model) {
        exif['0th'] = exif['0th'] || {};
        exif['0th'][piexif.ImageIFD.Model] = String(model);
    }

    // DateTime - validate and format properly
    const datetime = document.getElementById('datetime').value.trim();
    if (datetime && datetime !== '--:--' && !datetime.includes('--:--')) {
        try {
            const date = new Date(datetime);
            const year = date.getFullYear();
            // Validate year is reasonable (1900-2100)
            if (!isNaN(date.getTime()) && year >= 1900 && year <= 2100) {
                // Format: YYYY:MM:DD HH:MM:SS (EXIF standard format)
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');
                const dateStr = `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
                
                exif['0th'] = exif['0th'] || {};
                exif['0th'][piexif.ImageIFD.DateTime] = dateStr;
                exif['Exif'] = exif['Exif'] || {};
                exif['Exif'][piexif.ExifIFD.DateTimeOriginal] = dateStr;
            } else {
                console.warn('Date year out of valid range (1900-2100):', year);
            }
        } catch (e) {
            console.warn('Invalid date format, skipping DateTime:', datetime, e);
        }
    }

    // Copyright
    const copyright = document.getElementById('copyright').value.trim();
    if (copyright) {
        exif['0th'] = exif['0th'] || {};
        exif['0th'][piexif.ImageIFD.Copyright] = String(copyright);
    }

    return exif;
}

// Write EXIF data to image
function writeExifData(imageData, newExif) {
    try {
        // Convert data URL to binary string for piexif
        let binaryString;
        if (imageData.startsWith('data:')) {
            // Extract base64 part from data URL
            const base64 = imageData.split(',')[1];
            binaryString = atob(base64);
        } else {
            binaryString = imageData;
        }

        // Ensure image is JPEG (should already be converted, but double-check)
        if (!binaryString.startsWith('\xff\xd8')) {
            // If not JPEG, try to convert it
            throw new Error('Image must be in JPEG format. Please ensure the image was properly loaded.');
        }

        // Start with a fresh EXIF object - match the working Node.js script approach
        let exifObj = {"0th": {}, "Exif": {}, "GPS": {}, "Interop": {}, "1st": {}, "thumbnail": null};
        
        // Directly assign values like in the working script - don't copy through loops
        if (newExif['0th']) {
            // Direct assignment for each field
            if (newExif['0th'][piexif.ImageIFD.ImageDescription]) {
                exifObj['0th'][piexif.ImageIFD.ImageDescription] = String(newExif['0th'][piexif.ImageIFD.ImageDescription]);
            }
            if (newExif['0th'][piexif.ImageIFD.Make]) {
                exifObj['0th'][piexif.ImageIFD.Make] = String(newExif['0th'][piexif.ImageIFD.Make]);
            }
            if (newExif['0th'][piexif.ImageIFD.Model]) {
                exifObj['0th'][piexif.ImageIFD.Model] = String(newExif['0th'][piexif.ImageIFD.Model]);
            }
            if (newExif['0th'][piexif.ImageIFD.Copyright]) {
                exifObj['0th'][piexif.ImageIFD.Copyright] = String(newExif['0th'][piexif.ImageIFD.Copyright]);
            }
            if (newExif['0th'][piexif.ImageIFD.DateTime]) {
                exifObj['0th'][piexif.ImageIFD.DateTime] = String(newExif['0th'][piexif.ImageIFD.DateTime]);
            }
            if (newExif['0th'][piexif.ImageIFD.DocumentName]) {
                exifObj['0th'][piexif.ImageIFD.DocumentName] = String(newExif['0th'][piexif.ImageIFD.DocumentName]);
            }
        }
        
        if (newExif['Exif']) {
            if (newExif['Exif'][piexif.ExifIFD.DateTimeOriginal]) {
                exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = String(newExif['Exif'][piexif.ExifIFD.DateTimeOriginal]);
            }
        }
        
        if (newExif['GPS']) {
            const gpsData = newExif['GPS'];
            // Direct assignment like in working script
            if (gpsData[piexif.GPSIFD.GPSLatitude] && Array.isArray(gpsData[piexif.GPSIFD.GPSLatitude])) {
                exifObj['GPS'][piexif.GPSIFD.GPSLatitude] = gpsData[piexif.GPSIFD.GPSLatitude];
            }
            if (gpsData[piexif.GPSIFD.GPSLatitudeRef]) {
                exifObj['GPS'][piexif.GPSIFD.GPSLatitudeRef] = String(gpsData[piexif.GPSIFD.GPSLatitudeRef]);
            }
            if (gpsData[piexif.GPSIFD.GPSLongitude] && Array.isArray(gpsData[piexif.GPSIFD.GPSLongitude])) {
                exifObj['GPS'][piexif.GPSIFD.GPSLongitude] = gpsData[piexif.GPSIFD.GPSLongitude];
            }
            if (gpsData[piexif.GPSIFD.GPSLongitudeRef]) {
                exifObj['GPS'][piexif.GPSIFD.GPSLongitudeRef] = String(gpsData[piexif.GPSIFD.GPSLongitudeRef]);
            }
            if (gpsData[piexif.GPSIFD.GPSAltitude] && Array.isArray(gpsData[piexif.GPSIFD.GPSAltitude])) {
                exifObj['GPS'][piexif.GPSIFD.GPSAltitude] = [
                    Math.round(gpsData[piexif.GPSIFD.GPSAltitude][0]),
                    Math.round(gpsData[piexif.GPSIFD.GPSAltitude][1])
                ];
            }
            if (gpsData[piexif.GPSIFD.GPSAltitudeRef] === 0 || gpsData[piexif.GPSIFD.GPSAltitudeRef] === 1) {
                exifObj['GPS'][piexif.GPSIFD.GPSAltitudeRef] = gpsData[piexif.GPSIFD.GPSAltitudeRef];
            }
        }

        // Check if we have any EXIF data to write
        const has0thData = exifObj['0th'] && Object.keys(exifObj['0th']).length > 0;
        const hasExifData = exifObj['Exif'] && Object.keys(exifObj['Exif']).length > 0;
        const hasGPSData = exifObj['GPS'] && Object.keys(exifObj['GPS']).length > 0;
        
        if (!has0thData && !hasExifData && !hasGPSData) {
            throw new Error('No EXIF data to save. Please fill in at least one field.');
        }

        // Ensure all required sections exist (like in working script)
        // Don't delete empty sections - piexif expects the structure
        if (!exifObj['0th']) exifObj['0th'] = {};
        if (!exifObj['Exif']) exifObj['Exif'] = {};
        if (!exifObj['GPS']) exifObj['GPS'] = {};
        if (!exifObj['Interop']) exifObj['Interop'] = {};
        if (!exifObj['1st']) exifObj['1st'] = {};
        if (exifObj['thumbnail'] === undefined) exifObj['thumbnail'] = null;

        // Convert to binary
        let exifString;
        try {
            // Log the structure for debugging
            console.log('Attempting to dump EXIF:', {
                '0th': Object.keys(exifObj['0th']),
                'Exif': Object.keys(exifObj['Exif']),
                'GPS': Object.keys(exifObj['GPS'])
            });
            exifString = piexif.dump(exifObj);
        } catch (dumpError) {
            console.error('EXIF dump error:', dumpError);
            console.error('EXIF object structure:', JSON.stringify(exifObj, (key, value) => {
                // Don't stringify functions or circular refs
                if (typeof value === 'function') return '[Function]';
                if (value instanceof Array) return value;
                return value;
            }, 2));
            const errorMsg = dumpError.message || dumpError.toString() || String(dumpError);
            throw new Error('Failed to create EXIF data: ' + errorMsg);
        }
        
        // Insert EXIF into image
        const newBinaryString = piexif.insert(exifString, binaryString);
        
        // Convert back to data URL
        const base64 = btoa(newBinaryString);
        const mimeType = imageData.startsWith('data:') 
            ? imageData.split(',')[0].split(':')[1].split(';')[0]
            : 'image/jpeg';
        const newImageData = `data:${mimeType};base64,${base64}`;
        
        return newImageData;
    } catch (error) {
        throw new Error('Failed to write EXIF data: ' + (error.message || String(error)));
    }
}

// Download image
function downloadImage(imageData, filename = 'edited-image.jpg') {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = filename;
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

// ========== CROP IMAGE FUNCTIONALITY ==========

// Get current image URL (from input or convert data URL to blob URL)
async function getCurrentImageUrl() {
    const urlInput = document.getElementById('imageUrl').value.trim();
    if (urlInput) {
        return urlInput;
    }
    
    // If we have a data URL, convert it to a blob URL
    if (currentImageData && currentImageData.startsWith('data:')) {
        const response = await fetch(currentImageData);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    }
    
    throw new Error('No image loaded. Please load an image first.');
}

// Show crop editor
document.getElementById('showCropBtn').addEventListener('click', () => {
    document.getElementById('cropEditor').classList.remove('hidden');
    document.getElementById('cropEditor').scrollIntoView({ behavior: 'smooth' });
});

// Reset crop form
document.getElementById('cropResetBtn').addEventListener('click', () => {
    document.getElementById('cropTop').value = '';
    document.getElementById('cropBottom').value = '';
    document.getElementById('cropLeft').value = '';
    document.getElementById('cropRight').value = '';
});

// Crop image
document.getElementById('cropBtn').addEventListener('click', async () => {
    try {
        // Get crop values
        const cropTop = parseInt(document.getElementById('cropTop').value) || 0;
        const cropBottom = parseInt(document.getElementById('cropBottom').value) || 0;
        const cropLeft = parseInt(document.getElementById('cropLeft').value) || 0;
        const cropRight = parseInt(document.getElementById('cropRight').value) || 0;

        // Validate that at least one crop value is provided
        if (cropTop === 0 && cropBottom === 0 && cropLeft === 0 && cropRight === 0) {
            showNotification('Please enter at least one crop value (top, bottom, left, or right)', 'error');
            return;
        }

        showNotification('Cropping image...', 'info');

        // Prepare crop options
        const cropOptions = {};
        if (cropTop > 0) cropOptions.top = cropTop;
        if (cropBottom > 0) cropOptions.bottom = cropBottom;
        if (cropLeft > 0) cropOptions.left = cropLeft;
        if (cropRight > 0) cropOptions.right = cropRight;

        // Prepare request body - use imageData if we have it, otherwise try URL
        const requestBody = { cropOptions: cropOptions };
        
        if (currentImageData && currentImageData.startsWith('data:')) {
            // Use base64 data directly
            requestBody.imageData = currentImageData;
        } else {
            // Try to get URL
            try {
                const imageUrl = await getCurrentImageUrl();
                requestBody.imageUrl = imageUrl;
            } catch (error) {
                showNotification('Please load an image first (from URL or file upload)', 'error');
                return;
            }
        }

        // Call crop API
        const response = await fetch('/api/crop-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to crop image');
        }

        // Get the cropped image as blob
        const blob = await response.blob();
        const croppedDataUrl = URL.createObjectURL(blob);

        // Display the cropped image
        displayImage(croppedDataUrl);
        
        // Update current image data
        const reader = new FileReader();
        reader.onload = (e) => {
            currentImageData = e.target.result;
            // Re-read EXIF data from cropped image
            readExifData(currentImageData);
        };
        reader.readAsDataURL(blob);

        // Download the cropped image automatically
        downloadImage(croppedDataUrl, 'cropped-image.jpg');

        showNotification('Image cropped and downloaded successfully!', 'success');

    } catch (error) {
        console.error('Crop error:', error);
        showNotification('Failed to crop image: ' + error.message, 'error');
    }
});

