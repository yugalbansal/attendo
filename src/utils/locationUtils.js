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
  // Validate coordinates
  if (!isValidCoordinate(studentLat, studentLon) || !isValidCoordinate(teacherLat, teacherLon)) {
    console.error('Invalid coordinates provided');
    return false;
  }
  
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
  console.log('Distance from teacher:', distanceInMeters.toFixed(2), 'meters');
  
  // Add some tolerance to account for GPS inaccuracy (20 meters buffer for better reliability)
  const GPS_ACCURACY_BUFFER = 20;
  const effectiveRadius = allowedRadiusMeters + GPS_ACCURACY_BUFFER;
  
  console.log('Effective radius with buffer:', effectiveRadius, 'meters');
  console.log('Within range?', distanceInMeters <= effectiveRadius);
  
  return distanceInMeters <= effectiveRadius;
};

// Validate coordinates
const isValidCoordinate = (lat, lon) => {
  return (
    typeof lat === 'number' && 
    typeof lon === 'number' &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180 &&
    !isNaN(lat) && !isNaN(lon)
  );
};

// Get current location as a Promise with better error handling
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    // Check if location services are available
    if (!('permissions' in navigator)) {
      console.warn('Permissions API not available');
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000 // Accept location that's up to 1 minute old
    };

    const successCallback = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      
      console.log('Location obtained:', { 
        latitude, 
        longitude, 
        accuracy: Math.round(accuracy) + 'm' 
      });
      
      // Validate the received coordinates
      if (!isValidCoordinate(latitude, longitude)) {
        reject(new Error('Invalid coordinates received from GPS'));
        return;
      }
      
      // Warn if accuracy is poor
      if (accuracy > 100) {
        console.warn(`Location accuracy is poor: ${Math.round(accuracy)}m`);
      }
      
      resolve({
        latitude,
        longitude,
        accuracy: Math.round(accuracy)
      });
    };

    const errorCallback = (error) => {
      let errorMsg = 'Unable to get your location.';
      
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMsg = 'Location access denied. Please enable location services and refresh the page.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMsg = 'Location information unavailable. Please ensure GPS is enabled and try again.';
          break;
        case error.TIMEOUT:
          errorMsg = 'Location request timed out. Please check your connection and try again.';
          break;
        default:
          errorMsg = `Location error: ${error.message}`;
          break;
      }
      
      console.error('Geolocation error:', error);
      reject(new Error(errorMsg));
    };

    // Try to get location
    navigator.geolocation.getCurrentPosition(
      successCallback,
      errorCallback,
      options
    );
  });
};

// Get location name from coordinates (reverse geocoding)
export const getLocationName = async (latitude, longitude) => {
  try {
    // Validate coordinates first
    if (!isValidCoordinate(latitude, longitude)) {
      return 'Invalid coordinates';
    }
    
    // Using a simple coordinate display
    // In production, you might want to use a proper geocoding service like:
    // - Google Maps Geocoding API
    // - OpenStreetMap Nominatim
    // - Mapbox Geocoding API
    
    return `Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  } catch (error) {
    console.error('Error getting location name:', error);
    return `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
  }
};

// Helper function to format distance for display
export const formatDistance = (distanceInMeters) => {
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)}m`;
  } else {
    return `${(distanceInMeters / 1000).toFixed(1)}km`;
  }
};

// Check if location permission is granted
export const checkLocationPermission = async () => {
  if (!('permissions' in navigator)) {
    return 'unavailable';
  }
  
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state; // 'granted', 'denied', or 'prompt'
  } catch (error) {
    console.error('Error checking location permission:', error);
    return 'unknown';
  }
};