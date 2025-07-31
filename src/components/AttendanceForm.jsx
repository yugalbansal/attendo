import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { markAttendance as markBlockchainAttendance } from '../utils/contractUtils';
import { markAttendance, validateAttendanceCode } from '../utils/supabaseClient';
import { createAttendanceRecord } from '../utils/attendanceUtils';
import { isWithinAllowedRange, getDistanceFromLatLonInMeters, getCurrentLocation } from '../utils/locationUtils';
import QRScanner from './QRScanner';
import { QrCode, ExternalLink } from 'lucide-react';

const AttendanceForm = ({ onAttendanceMarked }) => {
  const { user, profile } = useAuth();
  const { walletAddress, provider } = useWeb3();
  const [attendanceCode, setAttendanceCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [blockchainTxHash, setBlockchainTxHash] = useState('');

  const checkLocationAndMarkAttendance = async (codeData) => {
    try {
      // Get student's current location
      const studentLocation = await getCurrentLocation();
      
      console.log('Student location accuracy:', studentLocation.accuracy, 'meters');
      
      // Check if teacher location is available in the code data
      if (!codeData.latitude || !codeData.longitude) {
        throw new Error('Teacher location not available for this attendance code');
      }
      
      // Check if student is within allowed range of teacher
      const allowedRadius = codeData.location_radius || 100; // Default 100 meters
      
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
        
        throw new Error(`You must be within ${allowedRadius}m of the class location to mark attendance. You are ${distance}m away from the teacher.`);
      }

      // Calculate actual distance for record keeping
      const actualDistance = getDistanceFromLatLonInMeters(
        studentLocation.latitude,
        studentLocation.longitude,
        codeData.latitude,
        codeData.longitude
      );

      // Create attendance record with location data
      const attendanceData = {
        ...createAttendanceRecord(
          user.id, 
          codeData.course_id,
          attendanceCode,
          codeData.id
        ),
        student_latitude: studentLocation.latitude,
        student_longitude: studentLocation.longitude,
        distance_from_teacher: actualDistance
      };

      // Record attendance in database
      const { data, error: dbError } = await markAttendance(attendanceData);

      if (dbError) {
        console.error("Database error:", dbError);
        throw new Error(dbError.message || 'Failed to record attendance in database');
      }

      // Mark attendance on blockchain
      if (walletAddress && provider) {
        try {
          const signer = await provider.getSigner();
          const tx = await markBlockchainAttendance(signer, attendanceCode);
          await tx.wait(); // Wait for transaction confirmation
          setBlockchainTxHash(tx.hash);
          console.log("Blockchain attendance marked successfully:", tx.hash);
        } catch (blockchainError) {
          console.error("Blockchain error:", blockchainError);
          throw new Error('Failed to record attendance on blockchain. Please try again.');
        }
      } else {
        console.warn("No wallet connected for blockchain attendance");
      }

      return data;
    } catch (error) {
      console.error("Error in attendance process:", error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!attendanceCode.trim()) {
      setError('Please enter an attendance code');
      return;
    }

    if (!walletAddress) {
      setError('Please connect your wallet to mark attendance');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');
      setBlockchainTxHash('');

      const { data: codeData, error: codeError } = await validateAttendanceCode(attendanceCode);

      if (codeError || !codeData) {
        throw new Error('Invalid or expired attendance code');
      }

      const data = await checkLocationAndMarkAttendance(codeData);

      setSuccess('Attendance marked successfully!');
      setAttendanceCode('');
      
      if (onAttendanceMarked) onAttendanceMarked(data);
      setShowQRScanner(false);
    } catch (error) {
      console.error('Error marking attendance:', error);
      setError(error.message || 'Failed to mark attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQRCodeScanned = (code) => {
    if (!code) {
      setError('Invalid QR code');
      return;
    }
    
    const cleanCode = code.trim().toUpperCase();
    setAttendanceCode(cleanCode);
    setShowQRScanner(false);
    
    setTimeout(() => {
      handleSubmit();
    }, 800);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Mark Attendance</h3>
      
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
                placeholder="Enter code or scan QR"
                className="input uppercase flex-1"
                maxLength={6}
              />
              <button
                type="button"
                onClick={() => setShowQRScanner(true)}
                className="btn btn-secondary px-3"
                aria-label="Scan QR Code"
              >
                <QrCode size={20} />
              </button>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting || !walletAddress}
            className="btn btn-primary w-full"
          >
            {isSubmitting ? 'Marking Attendance...' : 'Mark Attendance'}
          </button>
          
          {!walletAddress && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 text-sm text-yellow-700">
              Please connect your wallet to mark attendance
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border-l-4 border-green-400 p-3 text-sm text-green-700">
              {success}
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