/**
 * EduCheck - Data Store & Local Storage Management
 * 로컬 저장소(LocalStorage) 및 데이터 영속화, 샘플 데이터 관리
 */

const STORAGE_KEYS = {
  STUDENTS: 'educheck_students_v2',
  ATTENDANCE: 'educheck_attendance_v2',
  SETTINGS: 'educheck_settings_v2'
};

// 초기 학생 데이터 (빈 상태)
const INITIAL_STUDENTS = [];

// 오늘 날짜 문자열 (YYYY-MM-DD)
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 현재 시간 문자열 (HH:mm)
function getCurrentTimeString() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

// 두 시간 문자열 (HH:mm) 간의 차이(분) 계산
function calculateDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let startTotal = startH * 60 + startM;
  let endTotal = endH * 60 + endM;
  
  // 혹시 자정을 넘긴 경우 처리
  if (endTotal < startTotal) {
    endTotal += 24 * 60;
  }
  return Math.max(0, endTotal - startTotal);
}

// 분을 "X시간 Y분" 문자열로 변환
function formatMinutesToKorean(minutes) {
  if (!minutes || minutes <= 0) return '0분';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

class DataStore {
  constructor() {
    this.students = [];
    this.attendances = [];
    this.init();
  }

  init() {
    // 1. 학생 데이터 로드 (초기 빈 배열)
    const savedStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (savedStudents) {
      try {
        this.students = JSON.parse(savedStudents);
      } catch (e) {
        this.students = [];
      }
    } else {
      this.students = [];
      this.saveStudents();
    }

    // 2. 출결 데이터 로드 (초기 빈 배열)
    const savedAttendances = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    if (savedAttendances) {
      try {
        this.attendances = JSON.parse(savedAttendances);
      } catch (e) {
        this.attendances = [];
      }
    } else {
      this.attendances = [];
      this.saveAttendances();
    }

    this.initIndexedDB();
  }

  // IndexedDB 영구 저장소 초기화 (브라우저 캐시 삭제 시에도 안전)
  initIndexedDB() {
    if (!window.indexedDB) return;
    const request = indexedDB.open('EduCheck_LocalDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('students')) {
        db.createObjectStore('students', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('attendances')) {
        db.createObjectStore('attendances', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      this.db = e.target.result;
      this.syncToIndexedDB();
    };
  }

  // IndexedDB에 전체 동기화
  syncToIndexedDB() {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(['students', 'attendances'], 'readwrite');
      const stdStore = tx.objectStore('students');
      const attStore = tx.objectStore('attendances');

      stdStore.clear();
      attStore.clear();

      this.students.forEach(s => stdStore.put(s));
      this.attendances.forEach(a => attStore.put(a));
    } catch (err) {
      console.warn('IndexedDB sync warning:', err);
    }
  }

  saveStudents() {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(this.students));
    this.syncToIndexedDB();
    this.notifySaved();
  }

  saveAttendances() {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(this.attendances));
    this.syncToIndexedDB();
    this.notifySaved();
  }

  // 로컬 저장 완료 피드백 알림
  notifySaved() {
    const badge = document.getElementById('localSaveBadge');
    if (badge) {
      badge.style.opacity = '1';
      badge.style.color = '#10b981';
      badge.innerHTML = `<i data-lucide="shield-check" style="width:12px;height:12px;"></i> 로컬 저장완료`;
      if (window.lucide) window.lucide.createIcons();
      
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => {
        badge.innerHTML = `<i data-lucide="hard-drive" style="width:12px;height:12px;"></i> 로컬 단독보관`;
        badge.style.color = 'var(--text-muted)';
        if (window.lucide) window.lucide.createIcons();
      }, 1500);
    }
  }

  // --- 학생 CRUD ---
  getStudents() {
    return [...this.students];
  }

  getStudentById(id) {
    return this.students.find(s => s.id === id);
  }

  findStudentsByLast4(last4) {
    return this.students.filter(s => {
      const p4 = s.phoneLast4 || (s.phone ? s.phone.replace(/[^0-9]/g, '').slice(-4) : '');
      return p4 === last4;
    });
  }

  addStudent(studentData) {
    const phoneRaw = (studentData.phone || '').replace(/[^0-9]/g, '');
    const phoneLast4 = studentData.phoneLast4 || (phoneRaw.length >= 4 ? phoneRaw.slice(-4) : '');
    
    const newStudent = {
      id: 'std-' + Date.now(),
      name: studentData.name.trim(),
      level: studentData.level || '초등',
      grade: studentData.grade || '',
      phone: studentData.phone || '',
      parentPhone: studentData.parentPhone || '',
      phoneLast4: phoneLast4,
      weeklyTargetHours: Number(studentData.weeklyTargetHours) || 10,
      memo: studentData.memo || '',
      createdAt: getTodayString()
    };
    this.students.unshift(newStudent);
    this.saveStudents();
    return newStudent;
  }

  updateStudent(id, studentData) {
    const index = this.students.findIndex(s => s.id === id);
    if (index !== -1) {
      const phoneRaw = (studentData.phone || '').replace(/[^0-9]/g, '');
      const phoneLast4 = studentData.phoneLast4 || (phoneRaw.length >= 4 ? phoneRaw.slice(-4) : '');

      this.students[index] = {
        ...this.students[index],
        ...studentData,
        phoneLast4: phoneLast4
      };
      this.saveStudents();
      return this.students[index];
    }
    return null;
  }

  deleteStudent(id) {
    this.students = this.students.filter(s => s.id !== id);
    this.saveStudents();
    // 해당 학생의 출결 기록도 보존하거나 삭제
  }

  // --- 출결 CRUD ---
  getAttendancesByDate(dateStr = getTodayString()) {
    return this.attendances.filter(a => a.date === dateStr);
  }

  getTodayAttendanceForStudent(studentId, dateStr = getTodayString()) {
    return this.attendances.find(a => a.studentId === studentId && a.date === dateStr);
  }

  // 입실 (Check-in)
  checkInStudent(studentId, customTime = null, dateStr = getTodayString()) {
    const time = customTime || getCurrentTimeString();
    let att = this.getTodayAttendanceForStudent(studentId, dateStr);

    if (att) {
      // 이미 오늘 기록이 있으면 입실 시간 갱신 또는 상태 갱신
      att.checkIn = time;
      att.status = 'present';
      if (att.checkOut) {
        att.durationMinutes = calculateDurationMinutes(att.checkIn, att.checkOut);
      }
    } else {
      att = {
        id: 'att-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        studentId: studentId,
        date: dateStr,
        checkIn: time,
        checkOut: null,
        status: 'present',
        durationMinutes: 0,
        memo: ''
      };
      this.attendances.push(att);
    }
    this.saveAttendances();
    return att;
  }

  // 퇴실 (Check-out)
  checkOutStudent(studentId, customTime = null, dateStr = getTodayString()) {
    const time = customTime || getCurrentTimeString();
    let att = this.getTodayAttendanceForStudent(studentId, dateStr);

    if (att) {
      att.checkOut = time;
      if (att.checkIn) {
        att.durationMinutes = calculateDurationMinutes(att.checkIn, att.checkOut);
      }
      this.saveAttendances();
      return att;
    } else {
      // 입실 기록 없이 퇴실하는 경우
      att = {
        id: 'att-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        studentId: studentId,
        date: dateStr,
        checkIn: '00:00',
        checkOut: time,
        status: 'present',
        durationMinutes: 0,
        memo: '입실 미체크'
      };
      this.attendances.push(att);
      this.saveAttendances();
      return att;
    }
  }

  // 출결 수동 변경 (시간, 상태, 메모 수정)
  updateAttendanceRecord(id, updateData) {
    const index = this.attendances.findIndex(a => a.id === id);
    if (index !== -1) {
      const att = this.attendances[index];
      const checkIn = updateData.checkIn !== undefined ? updateData.checkIn : att.checkIn;
      const checkOut = updateData.checkOut !== undefined ? updateData.checkOut : att.checkOut;
      
      let durationMinutes = 0;
      if (checkIn && checkOut) {
        durationMinutes = calculateDurationMinutes(checkIn, checkOut);
      }

      this.attendances[index] = {
        ...att,
        ...updateData,
        checkIn,
        checkOut,
        durationMinutes
      };
      this.saveAttendances();
      return this.attendances[index];
    }
    return null;
  }

  // 출석 상태 즉시 변경 (지각, 조퇴, 결석, 보강)
  setAttendanceStatus(studentId, status, dateStr = getTodayString(), memo = '') {
    let att = this.getTodayAttendanceForStudent(studentId, dateStr);
    if (att) {
      att.status = status;
      if (memo) att.memo = memo;
    } else {
      att = {
        id: 'att-' + Date.now(),
        studentId: studentId,
        date: dateStr,
        checkIn: status === 'absent' ? null : getCurrentTimeString(),
        checkOut: null,
        status: status,
        durationMinutes: 0,
        memo: memo
      };
      this.attendances.push(att);
    }
    this.saveAttendances();
    return att;
  }

  // 전체 데이터 내보내기 (JSON 백업)
  exportJSON() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      students: this.students,
      attendances: this.attendances
    };
    return JSON.stringify(data, null, 2);
  }

  // 백업 데이터 복원
  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.students && Array.isArray(data.students)) {
        this.students = data.students;
        this.saveStudents();
      }
      if (data.attendances && Array.isArray(data.attendances)) {
        this.attendances = data.attendances;
        this.saveAttendances();
      }
      return true;
    } catch (e) {
      console.error('Failed to import JSON', e);
      return false;
    }
  }
}

// 전역 싱글톤 인스턴스 생성
window.store = new DataStore();
window.getTodayString = getTodayString;
window.getCurrentTimeString = getCurrentTimeString;
window.calculateDurationMinutes = calculateDurationMinutes;
window.formatMinutesToKorean = formatMinutesToKorean;
