import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { markAttendance as markBlockchainAttendance } from '../utils/contractUtils';
import { markAttendance, validateAttendanceCode } from '../utils/supabaseClient';
import { createAttendanceRecord } from '../utils/attendanceUtils';
import { isWithinAllowedRange, getDistanceFromLatLonInMeters, getCurrentLocation } from '../utils/locationUtils';
import QRScanner from './QRScanner';
import { QrCode, ExternalLink, MapPin, Clock } from 'lucide-react';

const AttendanceForm = ({ onAttendanceMarked }) => {
  const { user, profile } = useAuth();
  const { walletAddress, provider } = useWeb3();
  const [attendanceCode, setAttendanceCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [blockchainTxHash, setBlockchainTxHash] = useState('');
  const [locationStatus, setLocationStatus] = useState('');
  const abortControllerRef = useRef(null);

  const checkLocationAndMarkAttendance = async (codeData) => {
    try {
      setLocationStatus('Getting your location...');
      
      // Get student's current location with timeout
      const locationPromise = getCurrentLocation();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Location request timed out')), 10000)
      );
      
      const studentLocation = await Promise.race([locationPromise, timeoutPromise]);
      
      console.log('Student location:', studentLocation);
      setLocationStatus('Checking location requirements...');
      
      // Check if teacher location is available in the code data
      if (codeData.latitude && codeData.longitude) {
        // Check if student is within allowed range of teacher
        const allowedRadius = codeData.location_radius || 100;
        
        if (!isWithinAllowedRange(
          studentLocation.latitude, 
          studentLocation.longitude, 
          codeData.latitude, 
          codeData.longitude, 
          allowedRadius
        )) {
          const distance = getDistanceFromLatLonInMeters(
            studentLocation.latitude,
            studentLocation.longitude,
            codeData.latitude,
            codeData.longitude
          ).toFixed(0);
          
          throw new Error(`You must be within ${allowedRadius}m of the class location. You are currently ${distance}m away.`);
        }
      }

      setLocationStatus('Recording attendance...');

      // Calculate actual distance for record keeping
      const actualDistance = codeData.latitude && codeData.longitude ? 
        getDistanceFromLatLonInMeters(
          studentLocation.latitude,
          studentLocation.longitude,
          codeData.latitude,
          codeData.longitude
        ) : null;

      // Create attendance record with location data
      const attendanceData = {
        ...createAttendanceRecord(
          user.id, 
          codeData.course_id,
          attendanceCode.toUpperCase(),
          codeData.id
        ),
        student_latitude: studentLocation.latitude,
        student_longitude: studentLocation.longitude,
        distance_from_teacher: actualDistance,
        location_accuracy: studentLocation.accuracy
      };

      console.log('Submitting attendance data:', attendanceData);

      // Record attendance in database
      const { data, error: dbError } = await markAttendance(attendanceData);

      if (dbError) {
        console.error("Database error:", dbError);
        throw new Error(dbError.message || 'Failed to record attendance in database');
      }

      // Mark attendance on blockchain (make this non-blocking)
      if (walletAddress && provider) {
        setLocationStatus('Recording on blockchain...');
        try {
          const signer = await provider.getSigner();
          const tx = await markBlockchainAttendance(signer, attendanceCode.toUpperCase());
          
          // Don't wait for confirmation to avoid blocking
          tx.wait().then((receipt) => {
            setBlockchainTxHash(receipt.transactionHash);
            console.log("Blockchain attendance confirmed:", receipt.transactionHash);
          }).catch((error) => {
            console.error("Blockchain confirmation error:", error);
            // Don't throw error here as database attendance is already recorded
          });
          
          setBlockchainTxHash(tx.hash);
          console.log("Blockchain transaction submitted:", tx.hash);
        } catch (blockchainError) {
          console.error("Blockchain error:", blockchainError);
          // Don't throw error here as database attendance is already recorded
          console.warn('Attendance recorded in database but blockchain transaction failed');
        }
      }

      setLocationStatus('');
      return data;
    } catch (error) {
      setLocationStatus('');
      console.error("Error in attendance process:", error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
    }
    
    // Cancel any previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    const trimmedCode = attendanceCode.trim().toUpperCase();
    
    if (!trimmedCode) {
      setError('Please enter an attendance code');
      return;
    }

    if (trimmedCode.length !== 6) {
      setError('Attendance code must be 6 characters long');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');
      setBlockchainTxHash('');
      setLocationStatus('Validating attendance code...');

      console.log('Validating code:', trimmedCode);

      const { data: codeData, error: codeError } = await validateAttendanceCode(trimmedCode);

      if (codeError || !codeData) {
        console.error('Code validation error:', codeError);
        throw new Error(codeError?.message || 'Invalid or expired attendance code');
      }

      console.log('Code validated successfully:', codeData);

      const data = await checkLocationAndMarkAttendance(codeData);

      setSuccess(`Attendance marked successfully for ${codeData.courses?.name || 'course'}!`);
      setAttendanceCode('');
      
      if (onAttendanceMarked) onAttendanceMarked(data);
      setShowQRScanner(false);
      
      // Auto-clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
      
    } catch (error) {
      console.error('Error marking attendance:', error);
      setError(error.message || 'Failed to mark attendance. Please try again.');
      
      // Auto-clear error message after 8 seconds
      setTimeout(() => setError(''), 8000);
    } finally {
      setIsSubmitting(false);
      setLocationStatus('');
      abortControllerRef.current = null;
    }
  };

  const handleQRCodeScanned = (code) => {
    if (!code) {
      setError('Invalid QR code');
      return;
    }
    
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setError('Invalid attendance code format');
      return;
    }
    
    setAttendanceCode(cleanCode);
    setShowQRScanner(false);
    
    // Small delay to show the code was scanned
    setTimeout(() => {
      handleSubmit();
    }, 500);
  };

  const cancelSubmission = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsSubmitting(false);
    setLocationStatus('');
    setError('Attendance marking cancelled');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Clock className="mr-2" size={20} />
        Mark Attendance
      </h3>
      
      {showQRScanner ? (
        <div className="mb-4">
          <QRScanner onScan={handleQRCodeScanned} />
          <button 
            onClick={() => setShowQRScanner(false)}
            className="btn btn-secondary w-full mt-2"
          >
            Cancel Scan
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="attendanceCode" className="label">
              Enter Attendance Code
            </label>
            <div className="flex space-x-2">
              <input
                id="attendanceCode"
                type="text"
                value={attendanceCode}
                onChange={(e) => setAttendanceCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit code"
                className="input uppercase flex-1 tracking-wider"
                maxLength={6}
                disabled={isSubmitting}
                pattern="[A-Z0-9]{6}"
                title="6-digit alphanumeric code"
              />
              <button
                type="button"
                onClick={() => setShowQRScanner(true)}
                className="btn btn-secondary px-3"
                aria-label="Scan QR Code"
                disabled={isSubmitting}
              >
                <QrCode size={20} />
              </button>
            </div>
          </div>
          
          {locationStatus && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 text-sm text-blue-700 flex items-center">
              <MapPin size={16} className="mr-2" />
              {locationStatus}
            </div>
          )}
          
          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={isSubmitting || !walletAddress || attendanceCode.length !== 6}
              className="btn btn-primary flex-1"
            >
              {isSubmitting ? 'Processing...' : 'Mark Attendance'}
            </button>
            
            {isSubmitting && (
              <button
                type="button"
                onClick={cancelSubmission}
                className="btn btn-secondary px-3"
                aria-label="Cancel"
              >
                Cancel
              </button>
            )}
          </div>
          
          {!walletAddress && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 text-sm text-yellow-700">
              Please connect your wallet to mark attendance
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border-l-4 border-green-400 p-3 text-sm text-green-700">
              <strong>Success:</strong> {success}
              {blockchainTxHash && (
                <div className="mt-2">
                  <p className="font-medium">Blockchain Transaction:</p>
                  <a
                    href={`https://testnet.teloscan.io/tx/${blockchainTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-800 flex items-center mt-1"
                  >
                    View on Explorer
                    <ExternalLink size={14} className="ml-1" />
                  </a>
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default AttendanceForm;