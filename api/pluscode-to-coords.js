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
        
        // Use Google Maps Geocoding API to fetch coordinates for any Plus Code
        // This is the only method - no hardcoded codes, always fetch from Google
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            return res.status(400).json({ 
                error: 'GOOGLE_MAPS_API_KEY is required. Please add it to your Vercel environment variables.',
                received: plusCode,
                extracted: cleanCode,
                suggestion: 'Add GOOGLE_MAPS_API_KEY to Vercel environment variables. Get a free key at: https://console.cloud.google.com/google/maps-apis'
            });
        }

        try {
            const mapsUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanCode)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
            const mapsResponse = await fetch(mapsUrl);
            const mapsData = await mapsResponse.json();
            
            if (mapsData.status === 'OK' && mapsData.results && mapsData.results.length > 0) {
                const location = mapsData.results[0].geometry.location;
                return res.status(200).json({
                    plusCode: cleanCode,
                    latitude: location.lat,
                    longitude: location.lng,
                    formatted: `${location.lat}, ${location.lng}`,
                    address: mapsData.results[0].formatted_address,
                    source: 'Google Maps Geocoding API'
                });
            } else if (mapsData.status === 'ZERO_RESULTS') {
                return res.status(400).json({ 
                    error: 'Plus Code not found. The Plus Code may be invalid.',
                    received: plusCode,
                    extracted: cleanCode,
                    googleStatus: mapsData.status
                });
            } else {
                return res.status(400).json({ 
                    error: `Google Maps API error: ${mapsData.status}`,
                    received: plusCode,
                    extracted: cleanCode,
                    googleStatus: mapsData.status,
                    errorMessage: mapsData.error_message || 'Unknown error'
                });
            }
        } catch (mapsError) {
            console.error('Google Maps API error:', mapsError);
            return res.status(500).json({ 
                error: 'Failed to fetch coordinates from Google Maps API',
                received: plusCode,
                extracted: cleanCode,
                message: mapsError.message
            });
        }

    } catch (error) {
        console.error('Error converting Plus Code:', error);
        return res.status(500).json({ 
            error: 'Failed to convert Plus Code', 
            message: error.message 
        });
    }
}
