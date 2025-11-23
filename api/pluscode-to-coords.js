// Convert Plus Code to Latitude and Longitude
// Uses Google Maps Geocoding API which supports Plus Codes

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const plusCode = req.query.pluscode || req.body.pluscode;

        if (!plusCode) {
            return res.status(400).json({ 
                error: 'Plus Code is required. Provide it as ?pluscode=CC2C+8X or in request body.' 
            });
        }

        // Extract Plus Code from the input
        // Format: CC2C+8X Agadir, Maroc -> extract just the code part
        let cleanCode = plusCode.trim();
        
        // Try to match Plus Code pattern (e.g., CC2C+8X)
        const codeMatch = cleanCode.match(/([A-Z0-9]{2,}\+[A-Z0-9]{2,})/i);
        if (codeMatch) {
            cleanCode = codeMatch[1].toUpperCase();
        } else {
            // If no match, try to extract by removing non-code characters
            cleanCode = cleanCode.replace(/[^A-Z0-9+]/gi, '').toUpperCase();
        }
        
        // Validate the code format
        if (!cleanCode.includes('+')) {
            return res.status(400).json({ 
                error: 'Invalid Plus Code format. Must contain a + symbol.',
                received: plusCode,
                extracted: cleanCode
            });
        }
        
        const parts = cleanCode.split('+');
        if (parts.length !== 2 || parts[0].length < 2 || parts[1].length < 2) {
            return res.status(400).json({ 
                error: 'Invalid Plus Code format. Expected format: CC2C+8X or similar.',
                received: plusCode,
                extracted: cleanCode
            });
        }
        
        // FIRST: Try Google Maps Geocoding API (works for any Plus Code)
        // Google Maps Geocoding API supports Plus Codes natively
        if (process.env.GOOGLE_MAPS_API_KEY) {
            try {
                const mapsUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanCode)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
                const mapsResponse = await fetch(mapsUrl);
                const mapsData = await mapsResponse.json();
                
                if (mapsData.results && mapsData.results.length > 0) {
                    const location = mapsData.results[0].geometry.location;
                    return res.status(200).json({
                        plusCode: cleanCode,
                        latitude: location.lat,
                        longitude: location.lng,
                        formatted: `${location.lat}, ${location.lng}`,
                        address: mapsData.results[0].formatted_address,
                        source: 'Google Maps Geocoding API'
                    });
                }
            } catch (mapsError) {
                console.warn('Google Maps API failed:', mapsError);
            }
        }
        
        // SECOND: Check for known Plus Codes with exact coordinates (fallback)
        const knownPlusCodes = {
            'CC2C+8X': { latitude: 30.40082090, longitude: -9.57759430, location: 'Amseel Cars, Agadir' },
            'CC7W+3M': { latitude: 30.412687, longitude: -9.553313, location: 'Agadir, Morocco' },
            'CC7W+93': { latitude: 30.412687, longitude: -9.553313, location: 'Agadir, Morocco' }, // Same area
            '8C2GCC7W+3M': { latitude: 30.412687, longitude: -9.553313, location: 'Agadir, Morocco' },
            // Add more known codes as needed
        };
        
        if (knownPlusCodes[cleanCode]) {
            const coords = knownPlusCodes[cleanCode];
            return res.status(200).json({
                plusCode: cleanCode,
                latitude: coords.latitude,
                longitude: coords.longitude,
                formatted: `${coords.latitude}, ${coords.longitude}`,
                location: coords.location,
                source: 'known coordinates'
            });
        }

        // If no API key and code not in known list, return helpful error
        return res.status(400).json({ 
            error: 'Could not decode Plus Code. Please add a GOOGLE_MAPS_API_KEY to your Vercel environment variables, or the Plus Code may be invalid.',
            received: plusCode,
            extracted: cleanCode,
            suggestion: 'To decode any Plus Code, add GOOGLE_MAPS_API_KEY to Vercel environment variables. Get a free key at: https://console.cloud.google.com/google/maps-apis'
        });

    } catch (error) {
        console.error('Error converting Plus Code:', error);
        return res.status(500).json({ 
            error: 'Failed to convert Plus Code', 
            message: error.message 
        });
    }
}
