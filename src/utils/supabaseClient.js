import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// ====== AUTOMATIC TABLE INITIALIZATION ======
const initializeHomeworkTables = async () => {
  try {
    // Check if homework table exists
    const { error } = await supabase.from('homework').select('*').limit(1);
    
    if (error) {
      console.log('Initializing homework tables...');
      await supabase.rpc(`
        CREATE TABLE IF NOT EXISTS homework (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          description TEXT,
          due_date TIMESTAMPTZ NOT NULL,
          course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
          teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          attachments TEXT[] DEFAULT array[]::TEXT[],
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS homework_submissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          homework_id UUID REFERENCES homework(id) ON DELETE CASCADE,
          student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          submission_text TEXT,
          attachments TEXT[] DEFAULT array[]::TEXT[],
          submitted_at TIMESTAMPTZ DEFAULT NOW(),
          grade NUMERIC(5,2),
          feedback TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_homework_course ON homework(course_id);
        CREATE INDEX IF NOT EXISTS idx_submissions_homework ON homework_submissions(homework_id);
        CREATE INDEX IF NOT EXISTS idx_submissions_student ON homework_submissions(student_id);
      `);
      console.log('Homework tables initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing homework tables:', error.message);
    console.log(`
      Manual table creation required. Please run these SQL commands:
      
      CREATE TABLE homework (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        due_date TIMESTAMPTZ NOT NULL,
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        attachments TEXT[] DEFAULT array[]::TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE homework_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        homework_id UUID REFERENCES homework(id) ON DELETE CASCADE,
        student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        submission_text TEXT,
        attachments TEXT[] DEFAULT array[]::TEXT[],
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        grade NUMERIC(5,2),
        feedback TEXT
      );
    `);
  }
};

// Initialize tables when module loads
initializeHomeworkTables();

// ========== Auth Functions ==========
export const signUp = async (email, password, userData) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData,
    },
  });
  return { data, error };
};

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
};

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select();
  return { data, error };
};

// ========== Course Functions ==========
export const createCourse = async (courseData) => {
  const { data, error } = await supabase
    .from('courses')
    .insert([courseData])
    .select();
  return { data, error };
};

export const getTeacherCourses = async (teacherId) => {
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      course_students (
        student_id,
        profiles (
          id,
          first_name,
          last_name,
          roll_number
        )
      )
    `)
    .eq('teacher_id', teacherId);
  return { data, error };
};

export const enrollStudentInCourse = async (courseId, studentId) => {
  const { data, error } = await supabase
    .from('course_students')
    .insert([{ course_id: courseId, student_id: studentId }]);
  return { data, error };
};

export const getAvailableCourses = async () => {
  const { data, error } = await supabase
    .from('courses')
    .select('*');
  return { data, error };
};
// ========== Fixed Attendance Functions ==========

export const createAttendanceCode = async ({ teacherId, courseId, code, validityMinutes = 5 }) => {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + validityMinutes);
  
  const { data, error } = await supabase
    .from('attendance_codes')
    .insert([{
      teacher_id: teacherId,
      course_id: courseId,
      code: code.toUpperCase(), // Ensure uppercase
      expires_at: expiresAt.toISOString()
    }])
    .select();
  return { data, error };
};

export const createAttendanceCodeWithLocation = async ({ 
  teacherId, 
  courseId, 
  code, 
  validityMinutes = 5, 
  latitude, 
  longitude, 
  locationRadius = 100, 
  locationName 
}) => {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + validityMinutes);
  
  const { data, error } = await supabase
    .from('attendance_codes')
    .insert([{
      teacher_id: teacherId,
      course_id: courseId,
      code: code.toUpperCase(), // Ensure uppercase
      expires_at: expiresAt.toISOString(),
      latitude,
      longitude,
      location_radius: locationRadius,
      location_name: locationName
    }])
    .select();
  return { data, error };
};

export const validateAttendanceCode = async (code) => {
  try {
    // Convert to uppercase for consistency
    const upperCode = code.toUpperCase().trim();
    
    // Get current time with buffer to account for small time differences
    const now = new Date();
    const bufferTime = new Date(now.getTime() - 30000); // 30 seconds buffer
    
    console.log('Validating code:', upperCode);
    console.log('Current time:', now.toISOString());
    console.log('Buffer time:', bufferTime.toISOString());
    
    const { data, error } = await supabase
      .from('attendance_codes')
      .select(`
        *,
        courses(name, code),
        profiles(first_name, last_name)
      `)
      .eq('code', upperCode)
      .gt('expires_at', bufferTime.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.error('Database error in validateAttendanceCode:', error);
      return { data: null, error };
    }
    
    // Additional check for expiration with logging
    const expirationTime = new Date(data.expires_at);
    console.log('Code expires at:', expirationTime.toISOString());
    console.log('Is expired?', expirationTime <= now);
    
    if (expirationTime <= now) {
      return { 
        data: null, 
        error: { message: 'Attendance code has expired' }
      };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('Error validating attendance code:', error);
    return { data: null, error };
  }
};

export const markAttendance = async (attendanceData) => {
  try {
    // Check if attendance already exists for this student and code
    const { data: existingAttendance, error: checkError } = await supabase
      .from('attendance')
      .select('id')
      .eq('student_id', attendanceData.student_id)
      .eq('attendance_code_id', attendanceData.attendance_code_id)
      .limit(1);
    
    if (checkError) {
      console.error('Error checking existing attendance:', checkError);
      return { data: null, error: checkError };
    }
    
    if (existingAttendance && existingAttendance.length > 0) {
      return { 
        data: null, 
        error: { message: 'Attendance already marked for this code' }
      };
    }
    
    // Insert new attendance record
    const { data, error } = await supabase
      .from('attendance')
      .insert([{
        ...attendanceData,
        created_at: new Date().toISOString()
      }])
      .select(`
        *,
        courses(name, code),
        profiles(first_name, last_name)
      `);
    
    if (error) {
      console.error('Error inserting attendance:', error);
      return { data: null, error };
    }
    
    return { data: data[0], error: null };
  } catch (error) {
    console.error('Error in markAttendance:', error);
    return { data: null, error };
  }
};

// ========== Homework Functions ==========
export const addHomework = async (homeworkData) => {
  const { data, error } = await supabase
    .from('homework')
    .insert([homeworkData])
    .select();
  return { data, error };
};

export const getHomeworkByCourse = async (courseId) => {
  const { data, error } = await supabase
    .from('homework')
    .select(`
      *,
      courses (
        id,
        name,
        code
      ),
      profiles (
        id,
        first_name,
        last_name
      )
    `)
    .eq('course_id', courseId)
    .order('due_date', { ascending: true });
  return { data, error };
};

export const getHomeworkByStudent = async (studentId) => {
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('course_students')
    .select('course_id')
    .eq('student_id', studentId);
  
  if (enrollmentError) return { data: null, error: enrollmentError };
  
  const courseIds = enrollments.map(enrollment => enrollment.course_id);
  if (courseIds.length === 0) return { data: [], error: null };
  
  const { data, error } = await supabase
    .from('homework')
    .select(`
      *,
      courses (
        id,
        name,
        code,
        teacher_id,
        profiles (
          id,
          first_name,
          last_name
        )
      )
    `)
    .in('course_id', courseIds)
    .order('due_date', { ascending: true });
  
  return { data, error };
};

export const getStudentAssignments = async (studentId) => {
  return getHomeworkByStudent(studentId);
};

export const submitHomework = async (submissionData) => {
  const { data, error } = await supabase
    .from('homework_submissions')
    .insert([submissionData])
    .select();
  return { data, error };
};

export const getHomeworkSubmissions = async (homeworkId) => {
  const { data, error } = await supabase
    .from('homework_submissions')
    .select(`
      *,
      profiles (
        id,
        first_name,
        last_name,
        roll_number
      )
    `)
    .eq('homework_id', homeworkId);
  return { data, error };
};

export const getHomeworkById = async (homeworkId) => {
  const { data, error } = await supabase
    .from('homework')
    .select(`
      *,
      courses (
        id,
        name,
        code,
        teacher_id,
        profiles (
          id,
          first_name,
          last_name
        )
      )
    `)
    .eq('id', homeworkId)
    .single();
  return { data, error };
};

export const updateHomework = async (homeworkId, updates) => {
  const { data, error } = await supabase
    .from('homework')
    .update(updates)
    .eq('id', homeworkId)
    .select();
  return { data, error };
};

export const deleteHomework = async (homeworkId) => {
  const { data, error } = await supabase
    .from('homework')
    .delete()
    .eq('id', homeworkId);
  return { data, error };
};

export const getStudentHomeworkSubmission = async (homeworkId, studentId) => {
  const { data, error } = await supabase
    .from('homework_submissions')
    .select('*')
    .eq('homework_id', homeworkId)
    .eq('student_id', studentId)
    .maybeSingle();
  return { data, error };
};

// ========== Utility Functions ==========
export const uploadFile = async (bucketName, filePath, file) => {
  const { data, error } = await supabase
    .storage
    .from(bucketName)
    .upload(filePath, file);
  return { data, error };
};

export const getFileUrl = (bucketName, filePath) => {
  const { data } = supabase
    .storage
    .from(bucketName)
    .getPublicUrl(filePath);
  return data.publicUrl;
};