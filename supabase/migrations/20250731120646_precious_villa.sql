/*
  # Add location fields to attendance_codes table

  1. Changes
    - Add `latitude` (numeric) to store teacher's latitude when generating QR code
    - Add `longitude` (numeric) to store teacher's longitude when generating QR code
    - Add `location_radius` (numeric) to store allowed radius in meters (default 100)
    - Add `location_name` (text) to store human-readable location description

  2. Security
    - No changes to existing RLS policies needed
*/

-- Add location fields to attendance_codes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_codes' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE attendance_codes ADD COLUMN latitude numeric(10, 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_codes' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE attendance_codes ADD COLUMN longitude numeric(11, 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_codes' AND column_name = 'location_radius'
  ) THEN
    ALTER TABLE attendance_codes ADD COLUMN location_radius numeric DEFAULT 100;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_codes' AND column_name = 'location_name'
  ) THEN
    ALTER TABLE attendance_codes ADD COLUMN location_name text;
  END IF;
END $$;

-- Add location fields to attendance table for tracking where student marked attendance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'student_latitude'
  ) THEN
    ALTER TABLE attendance ADD COLUMN student_latitude numeric(10, 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'student_longitude'
  ) THEN
    ALTER TABLE attendance ADD COLUMN student_longitude numeric(11, 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'distance_from_teacher'
  ) THEN
    ALTER TABLE attendance ADD COLUMN distance_from_teacher numeric;
  END IF;
END $$;