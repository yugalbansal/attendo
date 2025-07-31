import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Home, FileText, User, Calendar, 
  Menu, X, QrCode, Plus, Check, Clock, Download
} from 'lucide-react';
// import { Link } from 'react-router-dom'; // Remove this import for now

// Reusing existing components
import WalletConnect from '../../components/WalletConnect';
import AttendanceForm from '../../components/AttendanceForm';
import BlockchainAttendance from '../../components/BlockchainAttendance';
import QRScanner from '../../components/QRScanner';

const StudentDashboard = () => {
  const { user, profile } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');

  // Get current time for greeting
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : 
                  currentHour < 18 ? 'Good afternoon' : 'Good evening';

  // Load todos from localStorage on component mount
  useEffect(() => {
    const savedTodos = localStorage.getItem('studentTodos');
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
  }, []);

  // Save todos to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('studentTodos', JSON.stringify(todos));
  }, [todos]);

  // Get current date for calendar
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentDate.getFullYear();

  // Handle when new attendance is marked
  const handleAttendanceMarked = (newAttendance) => {
    // Add the new attendance record to the list
    const attendanceRecord = {
      id: Date.now(),
      date: new Date().toISOString(),
      course_name: newAttendance.course_name || 'Unknown Course',
      status: newAttendance.is_late ? 'Late' : 'Present',
      time_in: new Date().toLocaleTimeString(),
      is_late: newAttendance.is_late || false
    };
    
    setAttendanceRecords([attendanceRecord, ...attendanceRecords]);
    setShowQRScanner(false);
    
    // Show success message
    alert('Attendance marked successfully!');
  };

  // Handle QR code scan result
  const handleQRScan = (qrData) => {
    console.log('QR Data scanned:', qrData);
    setShowQRScanner(false);
  };

  // Calculate attendance stats from local records
  const getAttendanceStats = () => {
    if (!attendanceRecords.length) return { present: 0, late: 0, total: 0 };
    
    const present = attendanceRecords.filter(r => !r.is_late).length;
    const late = attendanceRecords.filter(r => r.is_late).length;
    const total = attendanceRecords.length;
    
    return {
      present: total > 0 ? Math.round((present / total) * 100) : 0,
      late: total > 0 ? Math.round((late / total) * 100) : 0,
      total: total
    };
  };

  const stats = getAttendanceStats();

  // Todo list functions
  const addTodo = () => {
    if (newTodo.trim() === '') return;
    setTodos([...todos, { id: Date.now(), text: newTodo, completed: false }]);
    setNewTodo('');
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const days = [];
    const today = new Date().getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return { days, today };
  };

  const { days, today } = generateCalendarDays();

  // Toggle QR scanner
  const toggleQRScanner = () => {
    setShowQRScanner(!showQRScanner);
  };

  // Format date for display
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6">
          {/* Main Content */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column - Dashboard and Stats */}
            <div className="w-full lg:w-2/3 space-y-6">
              {/* Greeting Header */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  {greeting}, {profile?.first_name || 'Student'}!
                </h1>
                <p className="text-gray-600">Ready to mark your attendance today?</p>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={toggleQRScanner}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-6 rounded-xl transition-colors shadow-sm"
                >
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-purple-500 mr-4">
                      <QrCode size={24} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-lg">Mark Attendance</h3>
                      <p className="text-purple-100">Scan QR code to mark your presence</p>
                    </div>
                  </div>
                </button>
                
                <div className="bg-white hover:bg-gray-50 p-6 rounded-xl transition-colors shadow-sm border border-gray-100">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-green-100 text-green-600 mr-4">
                      <Clock size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-800">Attendance Records</h3>
                      <p className="text-gray-600">View your attendance history</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Section */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-semibold text-xl text-gray-800">Attendance Overview</h2>
                  <span className="text-sm text-gray-500">Total Records: {stats.total}</span>
                </div>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-green-50 p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Present</p>
                        <p className="text-3xl font-bold text-green-600">{stats.present}%</p>
                      </div>
                      <div className="p-3 bg-green-100 rounded-full">
                        <Check size={24} className="text-green-600" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-yellow-50 p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Late</p>
                        <p className="text-3xl font-bold text-yellow-600">{stats.late}%</p>
                      </div>
                      <div className="p-3 bg-yellow-100 rounded-full">
                        <Clock size={24} className="text-yellow-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Attendance */}
                <div>
                  <h3 className="font-medium text-gray-800 mb-4">Recent Attendance</h3>
                  {attendanceRecords.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Calendar size={24} className="text-gray-400" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No attendance records yet</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Start by scanning a QR code to mark your first attendance.
                      </p>
                      <button 
                        onClick={toggleQRScanner}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium"
                      >
                        Mark Attendance Now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {attendanceRecords.slice(0, 5).map((record) => (
                        <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-3 ${
                              record.is_late ? 'bg-yellow-400' : 'bg-green-400'
                            }`}></div>
                            <div>
                              <p className="font-medium text-gray-800">{record.course_name}</p>
                              <p className="text-sm text-gray-600">
                                {formatDate(record.date)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                              record.is_late 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {record.status}
                            </span>
                            <p className="text-sm text-gray-500 mt-1">{record.time_in}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="w-full lg:w-1/3 space-y-6">
              {/* Calendar */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-800">{currentMonth} {currentYear}</h3>
                  <Calendar size={20} className="text-gray-400" />
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                    <div key={day} className="text-xs text-gray-500 py-2 font-medium">{day}</div>
                  ))}
                  {days.map((day, index) => (
                    <div 
                      key={index} 
                      className={`text-sm p-2 rounded-lg ${
                        day === today 
                          ? 'bg-purple-100 text-purple-800 font-semibold' 
                          : day 
                            ? 'text-gray-700 hover:bg-gray-100 cursor-pointer' 
                            : ''
                      }`}
                    >
                      {day || ''}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Todo List */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-800">My Tasks</h3>
                  <span className="text-sm text-gray-500">{todos.filter(t => !t.completed).length} pending</span>
                </div>
                <div className="space-y-3 mb-4">
                  {todos.slice(0, 4).map(todo => (
                    <div key={todo.id} className="flex items-center group">
                      <button 
                        onClick={() => toggleTodo(todo.id)}
                        className={`w-5 h-5 rounded mr-3 flex items-center justify-center transition-colors ${
                          todo.completed 
                            ? 'bg-purple-500 text-white' 
                            : 'border border-gray-300 hover:border-purple-400'
                        }`}
                      >
                        {todo.completed && <Check size={14} />}
                      </button>
                      <span className={`text-sm flex-grow transition-all ${
                        todo.completed 
                          ? 'line-through text-gray-400' 
                          : 'text-gray-700'
                      }`}>
                        {todo.text}
                      </span>
                      <button 
                        onClick={() => deleteTodo(todo.id)}
                        className="text-gray-400 hover:text-red-500 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {todos.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">No tasks yet. Add one below!</p>
                  )}
                </div>
                <div className="flex">
                  <input
                    type="text"
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                    placeholder="Add a new task..."
                    className="flex-grow text-sm border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <button
                    onClick={addTodo}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-r-lg transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Mark Attendance Tool */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">Quick Attendance</h3>
                  <button 
                    onClick={toggleQRScanner}
                    className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-full transition-colors"
                  >
                    <QrCode size={18} />
                  </button>
                </div>
                
                <AttendanceForm onAttendanceMarked={handleAttendanceMarked} />
              </div>
              
              {/* Blockchain Attendance */}
              <BlockchainAttendance />
              
              {/* Wallet Section */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <WalletConnect />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Scan QR Code</h3>
              <button 
                onClick={toggleQRScanner} 
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X size={24} />
              </button>
            </div>
            <QRScanner onScan={handleQRScan} />
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;