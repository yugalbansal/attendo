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

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
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

export const getCourseById = async (courseId) => {
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      profiles (
        id,
        first_name,
        last_name
      )
    `)
    .eq('id', courseId)
    .single();
  return { data, error };
};

export const updateCourse = async (courseId, updates) => {
  const { data, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('id', courseId)
    .select();
  return { data, error };
};

export const deleteCourse = async (courseId) => {
  const { data, error } = await supabase
    .from('courses')
    .delete()
    .eq('id', courseId);
  return { data, error };
};

// ========== Student Course Functions ==========
export const getStudentCourses = async (studentId) => {
  try {
    const { data, error } = await supabase
      .from('course_students')
      .select(`
        *,
        courses (
          id,
          name,
          code,
          description,
          teacher_id,
          profiles (
            id,
            first_name,
            last_name
          )
        )
      `)
      .eq('student_id', studentId);
    
    if (error) return { data: null, error };
    
    // Transform to return course data directly
    const courses = data.map(enrollment => enrollment.courses);
    
    return { data: courses, error: null };
  } catch (error) {
    console.error('Error fetching student courses:', error);
    return { data: null, error };
  }
};

export const isStudentEnrolledInCourse = async (studentId, courseId) => {
  try {
    const { data, error } = await supabase
      .from('course_students')
      .select('id')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .limit(1);
    
    if (error) return { isEnrolled: false, error };
    
    return { isEnrolled: data && data.length > 0, error: null };
  } catch (error) {
    console.error('Error checking enrollment:', error);
    return { isEnrolled: false, error };
  }
};

// ========== Attendance Code Functions ==========
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

export const getActiveAttendanceCodes = async (teacherId) => {
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('attendance_codes')
    .select(`
      *,
      courses(name, code)
    `)
    .eq('teacher_id', teacherId)
    .gt('expires_at', now)
    .order('created_at', { ascending: false });
  
  return { data, error };
};

export const deactivateAttendanceCode = async (codeId) => {
  const { data, error } = await supabase
    .from('attendance_codes')
    .update({ expires_at: new Date().toISOString() })
    .eq('id', codeId)
    .select();
  
  return { data, error };
};

// ========== Attendance Functions ==========
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
        attendance_codes (
          id,
          code,
          courses (
            id,
            name,
            code
          )
        ),
        profiles (
          id,
          first_name,
          last_name
        )
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

export const getStudentAttendance = async (studentId) => {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        attendance_codes (
          id,
          code,
          created_at,
          courses (
            id,
            name,
            code
          )
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching attendance:', error);
      return { data: [], error };
    }
    
    // Transform data for dashboard use
    const transformedData = data.map(record => ({
      id: record.id,
      date: record.created_at,
      course_name: record.attendance_codes?.courses?.name || 'Unknown Course',
      course_code: record.attendance_codes?.courses?.code || 'N/A',
      time_in: new Date(record.created_at).toLocaleTimeString(),
      is_late: record.is_late || false,
      status: record.is_late ? 'Late' : 'Present',
      latitude: record.latitude,
      longitude: record.longitude
    }));
    
    return { data: transformedData, error: null };
  } catch (error) {
    console.error('Error in getStudentAttendance:', error);
    return { data: [], error };
  }
};

export const getCourseAttendance = async (courseId) => {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      *,
      profiles (
        id,
        first_name,
        last_name,
        roll_number
      ),
      attendance_codes (
        id,
        code,
        created_at
      )
    `)
    .eq('attendance_codes.course_id', courseId)
    .order('created_at', { ascending: false });
  
  return { data, error };
};

export const getAttendanceStats = async (studentId) => {
  try {
    const { data, error } = await getStudentAttendance(studentId);
    
    if (error) return { data: null, error };
    
    const total = data.length;
    const present = data.filter(record => !record.is_late).length;
    const late = data.filter(record => record.is_late).length;
    
    return {
      data: {
        total,
        present,
        late,
        presentPercentage: total > 0 ? Math.round((present / total) * 100) : 0,
        latePercentage: total > 0 ? Math.round((late / total) * 100) : 0
      },
      error: null
    };
  } catch (error) {
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

export const submitAssignment = async (submissionData) => {
  return submitHomework(submissionData);
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

// ========== Additional Homework/Assignment Functions ==========
export const getStudentSubmissions = async (studentId) => {
  const { data, error } = await supabase
    .from('homework_submissions')
    .select(`
      *,
      homework (
        id,
        title,
        description,
        due_date,
        courses (
          id,
          name,
          code
        )
      )
    `)
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });
  
  return { data, error };
};

export const hasStudentSubmitted = async (homeworkId, studentId) => {
  const { data, error } = await supabase
    .from('homework_submissions')
    .select('id')
    .eq('homework_id', homeworkId)
    .eq('student_id', studentId)
    .limit(1);
  
  if (error) return { hasSubmitted: false, error };
  
  return { hasSubmitted: data && data.length > 0, error: null };
};

export const getUpcomingAssignments = async (studentId, limit = 5) => {
  // First get student's enrolled courses
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('course_students')
    .select('course_id')
    .eq('student_id', studentId);
  
  if (enrollmentError) return { data: null, error: enrollmentError };
  
  const courseIds = enrollments.map(enrollment => enrollment.course_id);
  if (courseIds.length === 0) return { data: [], error: null };
  
  // Get upcoming assignments from enrolled courses
  const { data, error } = await supabase
    .from('homework')
    .select(`
      *,
      courses (
        id,
        name,
        code,
        profiles (
          id,
          first_name,
          last_name
        )
      ),
      homework_submissions!left (
        id,
        student_id
      )
    `)
    .in('course_id', courseIds)
    .gte('due_date', new Date().toISOString())
    .order('due_date', { ascending: true })
    .limit(limit);
  
  return { data, error };
};

export const getOverdueAssignments = async (studentId) => {
  // First get student's enrolled courses
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('course_students')
    .select('course_id')
    .eq('student_id', studentId);
  
  if (enrollmentError) return { data: null, error: enrollmentError };
  
  const courseIds = enrollments.map(enrollment => enrollment.course_id);
  if (courseIds.length === 0) return { data: [], error: null };
  
  // Get overdue assignments that haven't been submitted
  const { data, error } = await supabase
    .from('homework')
    .select(`
      *,
      courses (
        id,
        name,
        code
      )
    `)
    .in('course_id', courseIds)
    .lt('due_date', new Date().toISOString())
    .order('due_date', { ascending: false });
  
  if (error) return { data: null, error };
  
  // Filter out assignments that have been submitted
  const overdueAssignments = [];
  for (const assignment of data) {
    const { hasSubmitted } = await hasStudentSubmitted(assignment.id, studentId);
    if (!hasSubmitted) {
      overdueAssignments.push(assignment);
    }
  }
  
  return { data: overdueAssignments, error: null };
};

export const updateHomeworkSubmission = async (submissionId, updates) => {
  const { data, error } = await supabase
    .from('homework_submissions')
    .update(updates)
    .eq('id', submissionId)
    .select();
  return { data, error };
};

export const deleteHomeworkSubmission = async (submissionId) => {
  const { data, error } = await supabase
    .from('homework_submissions')
    .delete()
    .eq('id', submissionId);
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

export const deleteFile = async (bucketName, filePath) => {
  const { data, error } = await supabase
    .storage
    .from(bucketName)
    .remove([filePath]);
  return { data, error };
};

// ========== Real-time Subscriptions ==========
export const subscribeToAttendance = (callback) => {
  return supabase
    .channel('attendance_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'attendance' }, 
      callback
    )
    .subscribe();
};

export const subscribeToAttendanceCodes = (callback) => {
  return supabase
    .channel('attendance_code_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'attendance_codes' }, 
      callback
    )
    .subscribe();
};

export const unsubscribeFromChannel = (channel) => {
  supabase.removeChannel(channel);
};

// ========== Admin/Analytics Functions ==========
export const getAttendanceAnalytics = async (courseId, startDate, endDate) => {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      *,
      profiles (
        first_name,
        last_name,
        roll_number
      ),
      attendance_codes (
        course_id,
        created_at
      )
    `)
    .eq('attendance_codes.course_id', courseId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true });
  
  return { data, error };
};

export const getCourseAttendanceReport = async (courseId) => {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      student_id,
      is_late,
      created_at,
      profiles (
        first_name,
        last_name,
        roll_number
      ),
      attendance_codes (
        course_id
      )
    `)
    .eq('attendance_codes.course_id', courseId)
    .order('created_at', { ascending: false });
  
  return { data, error };
};

// Export default client for direct access if needed
export default supabase;