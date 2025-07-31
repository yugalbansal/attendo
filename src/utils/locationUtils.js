// Calculate distance between two points using Haversine formula
export const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
};

// Calculate distance in meters
export const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
  return getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) * 1000;
};

const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

// Check if student location is within allowed range of teacher location
export const isWithinAllowedRange = (studentLat, studentLon, teacherLat, teacherLon, allowedRadiusMeters = 100) => {
  // Log the coordinates for debugging
  console.log('Student location:', { latitude: studentLat, longitude: studentLon });
  console.log('Teacher location:', { latitude: teacherLat, longitude: teacherLon });
  console.log('Allowed radius:', allowedRadiusMeters, 'meters');
  
  const distanceInMeters = getDistanceFromLatLonInMeters(
    studentLat,
    studentLon,
    teacherLat,
    teacherLon
  );
  
  // Log the calculated distance
  console.log('Distance from teacher:', distanceInMeters, 'meters');
  
  // Add some tolerance to account for GPS inaccuracy (10 meters buffer)
  const GPS_ACCURACY_BUFFER = 10;
  
  return distanceInMeters <= (allowedRadiusMeters + GPS_ACCURACY_BUFFER);
};

// Get current location as a Promise
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        let errorMsg = 'Please enable location access.';
        
        switch(error.code) {
          case 1:
            errorMsg = 'Location permission denied. Please enable location services in your browser settings.';
            break;
          case 2:
            errorMsg = 'Location information is unavailable. Please try again in a different area.';
            break;
          case 3:
            errorMsg = 'Location request timed out. Please check your connection and try again.';
            break;
        }
        
        reject(new Error(errorMsg));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
};

// Get location name from coordinates (reverse geocoding)
export const getLocationName = async (latitude, longitude) => {
  try {
    // Using a simple reverse geocoding approach
    // In production, you might want to use a proper geocoding service
    return `Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  } catch (error) {
    console.error('Error getting location name:', error);
    return `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
  }
};