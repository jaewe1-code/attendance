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

// 초·중·고 학년별 세분화 매핑 정의 (초5~초6, 중1~중3, 고1~고3)
const GRADE_MAP = {
  '초등': ['초5', '초6'],
  '중등': ['중1', '중2', '중3'],
  '고등': ['고1', '고2', '고3']
};

// 학교급별 학년 목록 반환
function getGradesForLevel(level) {
  return GRADE_MAP[level] || [];
}

// 학년 문자열 표준화 함수 (초1~초6, 중1~중3, 고1~고3)
function normalizeGrade(level, gradeStr) {
  if (!gradeStr) return '';
  let str = String(gradeStr).trim();
  if (!str) return '';

  // 이미 '초1'~'초6', '중1'~'중3', '고1'~'고3' 형태인 경우
  if (/^(초[1-6]|중[1-3]|고[1-3])$/.test(str)) {
    return str;
  }

  // '초등 1학년', '중학교 2학년', '고3' 등 패턴 매칭
  const numMatch = str.match(/([1-6])/);
  if (numMatch) {
    const num = numMatch[1];
    if (str.includes('초') || level === '초등') {
      if (num >= '1' && num <= '6') return `초${num}`;
    } else if (str.includes('중') || level === '중등') {
      if (num >= '1' && num <= '3') return `중${num}`;
    } else if (str.includes('고') || level === '고등') {
      if (num >= '1' && num <= '3') return `고${num}`;
    } else {
      // level 기본값 기준
      if (level === '초등') return `초${num}`;
      if (level === '중등') return `중${Math.min(Number(num), 3)}`;
      if (level === '고등') return `고${Math.min(Number(num), 3)}`;
    }
  }

  return str;
}

window.GRADE_MAP = GRADE_MAP;
window.getGradesForLevel = getGradesForLevel;
window.normalizeGrade = normalizeGrade;

class DataStore {
  constructor() {
    this.students = [];
    this.attendances = [];
    this.init();
  }

  init() {
    // 1. 학생 데이터 로드
    const savedStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (savedStudents) {
      try {
        this.students = JSON.parse(savedStudents);
      } catch (e) {
        this.students = [];
      }
    } else {
      this.students = [];
    }

    // 2. 출결 데이터 로드
    const savedAttendances = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    if (savedAttendances) {
      try {
        this.attendances = JSON.parse(savedAttendances);
      } catch (e) {
        this.attendances = [];
      }
    } else {
      this.attendances = [];
    }

    // 3. 데이터 무결성 검사 및 중복/오류 완전 치료
    this.sanitizeData();

    this.initIndexedDB();
  }

  // 데이터 무결성 완전 치료 (중복 ID, 다중 출결 레코드, 세션 오류 정규화)
  sanitizeData() {
    let modified = false;

    // 1) 학생 ID 고유화 및 맵 생성
    const idMap = new Map(); // oldId -> newId (필요시)
    const seenIds = new Set();
    
    this.students.forEach((s, idx) => {
      if (!s.id || seenIds.has(s.id)) {
        const newId = 'std-' + (Date.now() + idx) + '-' + Math.random().toString(36).substr(2, 6);
        s.id = newId;
        modified = true;
      }
      seenIds.add(s.id);
      // 학년 표준화 (초1~초6, 중1~중3, 고1~고3)
      if (s.grade) {
        const normGrade = normalizeGrade(s.level, s.grade);
        if (normGrade !== s.grade) {
          s.grade = normGrade;
          modified = true;
        }
      }
    });

    const validStudentIds = new Set(this.students.map(s => s.id));

    // 2) 출결 데이터 무결성 정규화 (1학생 1날짜 1레코드 원칙)
    const attendanceMap = new Map(); // key: "studentId_date" -> record

    const cleanedAttendances = [];

    this.attendances.forEach((att, idx) => {
      if (!att || !att.studentId || !att.date) return;
      
      // 유효한 학생 ID인지 확인
      if (!validStudentIds.has(att.studentId)) {
        // 학생이 없어진 유령 출결은 무시
        modified = true;
        return;
      }

      const key = `${att.studentId}_${att.date}`;
      if (!attendanceMap.has(key)) {
        // 고유 ID 보장
        if (!att.id) {
          att.id = 'att-' + (Date.now() + idx) + '-' + Math.random().toString(36).substr(2, 6);
          modified = true;
        }
        // sessions 정규화
        if (!Array.isArray(att.sessions)) {
          att.sessions = [];
          if (att.checkIn) {
            att.sessions.push({
              in: att.checkIn,
              out: att.checkOut || null,
              duration: att.durationMinutes || 0
            });
            modified = true;
          }
        }
        if (Array.isArray(att.sessions) && att.sessions.length > 2) {
          att.sessions = att.sessions.slice(0, 2);
          modified = true;
        }
        attendanceMap.set(key, att);
        cleanedAttendances.push(att);
      } else {
        // 동일 날짜에 중복된 출결 레코드가 있으면 세션을 병합하고 1개로 통합!
        const existing = attendanceMap.get(key);
        if (Array.isArray(att.sessions) && att.sessions.length > 0) {
          existing.sessions = [...(existing.sessions || []), ...att.sessions];
        } else if (att.checkIn) {
          existing.sessions.push({
            in: att.checkIn,
            out: att.checkOut || null,
            duration: att.durationMinutes || 0
          });
        }
        if (existing.sessions.length > 2) {
          existing.sessions = existing.sessions.slice(0, 2);
        }
        if (existing.sessions.length > 0) {
          existing.checkIn = existing.sessions[0].in;
          existing.checkOut = existing.sessions[existing.sessions.length - 1].out;
        }
        existing.durationMinutes = (existing.sessions || []).reduce((sum, s) => sum + (s.duration || 0), 0);
        modified = true;
      }
    });

    this.attendances = cleanedAttendances;

    if (modified) {
      console.log('DataStore: Sanitized and saved clean data state.');
      this.saveStudents();
      this.saveAttendances();
    }
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
    return [...this.students].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
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

  // 특정 요일(월~일) 한글명 가져오기 (YYYY-MM-DD)
  static getDayName(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
  }

  // 스케줄 배열을 사람이 읽기 편한 문자열로 변환 (예: "월 14:00, 화 16:00")
  static formatScheduleText(schedules) {
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) return '';
    const dayOrder = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
    const sorted = [...schedules].sort((a, b) => (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99));
    return sorted.map(s => `${s.day} ${s.time || ''}`).join(', ');
  }

  // 모든 학생 명단 삭제 (덮어쓰기용)
  clearAllStudents() {
    this.students = [];
    this.saveStudents();
  }

  addStudent(studentData) {
    const phoneRaw = (studentData.phone || '').replace(/[^0-9]/g, '');
    const phoneLast4 = studentData.phoneLast4 || (phoneRaw.length >= 4 ? phoneRaw.slice(-4) : '');
    const level = studentData.level || '초등';
    const grade = normalizeGrade(level, studentData.grade || '');
    
    const newStudent = {
      id: 'std-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      name: studentData.name.trim(),
      level: level,
      grade: grade,
      phone: studentData.phone || '',
      parentPhone: studentData.parentPhone || '',
      phoneLast4: phoneLast4,
      schedules: Array.isArray(studentData.schedules) ? studentData.schedules : [],
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
      const level = studentData.level !== undefined ? studentData.level : this.students[index].level;
      const rawGrade = studentData.grade !== undefined ? studentData.grade : this.students[index].grade;
      const grade = normalizeGrade(level, rawGrade);

      this.students[index] = {
        ...this.students[index],
        ...studentData,
        level: level,
        grade: grade,
        phoneLast4: phoneLast4,
        schedules: studentData.schedules !== undefined ? studentData.schedules : (this.students[index].schedules || [])
      };
      this.saveStudents();
      return this.students[index];
    }
    return null;
  }

  // 특정 학생의 스케줄만 전용 업데이트
  updateStudentSchedules(id, schedules) {
    const student = this.getStudentById(id);
    if (student) {
      student.schedules = Array.isArray(schedules) ? schedules : [];
      this.saveStudents();
      return student;
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

  // 입실 (Check-in) - 최대 2회차(2차 재입실)까지 지원
  checkInStudent(studentId, customTime = null, dateStr = getTodayString()) {
    const time = customTime || getCurrentTimeString();
    let att = this.getTodayAttendanceForStudent(studentId, dateStr);

    if (att) {
      // 1. sessions 배열 보정
      if (!Array.isArray(att.sessions) || att.sessions.length === 0) {
        att.sessions = [];
        if (att.checkIn) {
          att.sessions.push({
            in: att.checkIn,
            out: att.checkOut || null,
            duration: att.durationMinutes || 0
          });
        }
      }

      // 2. 이미 하원 완료(checkOut이 존재) 상태인 경우
      if (att.checkOut) {
        // 이미 2차 퇴실까지 완료된 경우 (최대 2회차 제한)
        if (att.sessions.length >= 2) {
          console.warn('CheckIn: Maximum 2 sessions reached for student', studentId);
          return att;
        }

        // 이전 세션 닫기 확인
        att.sessions.forEach(s => {
          if (!s.out) {
            s.out = att.checkOut;
            s.duration = calculateDurationMinutes(s.in, s.out);
          }
        });

        // 2차 재입실 세션 추가 (최대 2회차)
        att.sessions.push({
          in: time,
          out: null,
          duration: 0
        });
        att.checkOut = null; // 재실 중 상태로 전환!
      } else {
        // 이미 재실 중인 상태에서 입실 시간 재설정
        const openSession = att.sessions.find(s => !s.out);
        if (openSession) {
          openSession.in = time;
        } else {
          if (att.sessions.length < 2) {
            att.sessions.push({ in: time, out: null, duration: 0 });
          }
        }
      }

      // 최초 등원시간 유지
      att.checkIn = att.sessions[0]?.in || time;
      att.status = 'present';
    } else {
      att = {
        id: 'att-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        studentId: studentId,
        date: dateStr,
        checkIn: time,
        checkOut: null,
        sessions: [
          { in: time, out: null, duration: 0 }
        ],
        status: 'present',
        durationMinutes: 0,
        memo: ''
      };
      this.attendances.push(att);
    }
    this.saveAttendances();
    return att;
  }

  // 퇴실 (Check-out) - 다회차 세션 총 누적 시간 자동 계산
  checkOutStudent(studentId, customTime = null, dateStr = getTodayString()) {
    const time = customTime || getCurrentTimeString();
    let att = this.getTodayAttendanceForStudent(studentId, dateStr);

    if (att) {
      if (!Array.isArray(att.sessions) || att.sessions.length === 0) {
        att.sessions = [];
        if (att.checkIn) {
          att.sessions.push({
            in: att.checkIn,
            out: null,
            duration: 0
          });
        }
      }

      // 열려 있는 세션 닫기
      const openSession = att.sessions.find(s => !s.out);
      if (openSession) {
        openSession.out = time;
        openSession.duration = calculateDurationMinutes(openSession.in, time);
      } else if (att.sessions.length > 0) {
        const lastSession = att.sessions[att.sessions.length - 1];
        lastSession.out = time;
        lastSession.duration = calculateDurationMinutes(lastSession.in, time);
      } else {
        att.sessions.push({ in: att.checkIn || time, out: time, duration: 0 });
      }

      // 최대 2회차 초과 세션 정리
      if (att.sessions.length > 2) {
        att.sessions = att.sessions.slice(0, 2);
      }

      att.checkIn = att.sessions[0]?.in || att.checkIn || time;
      att.checkOut = time;
      // 전체 세션 누적 시간 합산
      att.durationMinutes = att.sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      this.saveAttendances();
      return att;
    } else {
      // 입실 기록 없이 퇴실하는 경우
      att = {
        id: 'att-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        studentId: studentId,
        date: dateStr,
        checkIn: time,
        checkOut: time,
        sessions: [
          { in: time, out: time, duration: 0 }
        ],
        status: 'present',
        durationMinutes: 0,
        memo: '입실 미체크'
      };
      this.attendances.push(att);
      this.saveAttendances();
      return att;
    }
  }

  // 특정 학생의 특정 날짜 출결 완전 초기화(삭제)
  clearAttendance(studentId, dateStr = getTodayString()) {
    this.attendances = this.attendances.filter(a => !(a.studentId === studentId && a.date === dateStr));
    this.saveAttendances();
  }

  // 출결 수동 변경 (시간, 상태, 메모 수정) - 1차/2차 세션 완벽 동기화 보장
  updateAttendanceRecord(id, updateData) {
    const index = this.attendances.findIndex(a => a.id === id);
    if (index !== -1) {
      const att = this.attendances[index];
      
      let sessions = [];
      if (Array.isArray(updateData.sessions)) {
        // sessions 배열이 직접 전달된 경우 (최대 2회차)
        sessions = updateData.sessions.slice(0, 2).map(s => {
          const inTime = s.in ? s.in.trim() : null;
          const outTime = s.out ? s.out.trim() : null;
          const dur = (inTime && outTime) ? calculateDurationMinutes(inTime, outTime) : 0;
          return {
            in: inTime,
            out: outTime,
            duration: dur
          };
        }).filter(s => s.in || s.out);
      } else {
        // 기존 checkIn / checkOut 단일 필드로 넘어온 경우
        const checkIn = updateData.checkIn !== undefined ? updateData.checkIn : att.checkIn;
        const checkOut = updateData.checkOut !== undefined ? updateData.checkOut : att.checkOut;
        sessions = Array.isArray(att.sessions) ? [...att.sessions] : [];
        if (checkIn) {
          if (sessions.length === 0) {
            sessions = [{
              in: checkIn,
              out: checkOut || null,
              duration: (checkIn && checkOut) ? calculateDurationMinutes(checkIn, checkOut) : 0
            }];
          } else {
            const lastIdx = sessions.length - 1;
            sessions[lastIdx].in = checkIn;
            sessions[lastIdx].out = checkOut || null;
            sessions[lastIdx].duration = (checkIn && checkOut) ? calculateDurationMinutes(checkIn, checkOut) : 0;
          }
        }
      }

      const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      const firstIn = sessions[0]?.in || updateData.checkIn || null;
      const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
      const lastOut = lastSession ? lastSession.out : (updateData.checkOut || null);

      this.attendances[index] = {
        ...att,
        ...updateData,
        checkIn: firstIn,
        checkOut: lastOut,
        sessions,
        durationMinutes: totalDuration
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
    let authData = null;
    try {
      const rawAuth = localStorage.getItem('educheck_auth_v2');
      if (rawAuth) authData = JSON.parse(rawAuth);
    } catch (e) {}

    const data = {
      version: '1.1',
      exportedAt: new Date().toISOString(),
      students: this.students,
      attendances: this.attendances,
      auth: authData
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
      if (data.auth && typeof data.auth === 'object') {
        localStorage.setItem('educheck_auth_v2', JSON.stringify(data.auth));
        if (window.AuthManager) {
          window.AuthManager.loadAuthConfig();
          window.AuthManager.renderSettingsUI();
          window.AuthManager.updateHeaderLockButton();
        }
      }
      return true;
    } catch (e) {
      console.error('Failed to import JSON', e);
      return false;
    }
  }
}

// 전역 싱글톤 인스턴스 생성
window.DataStore = DataStore;
window.store = new DataStore();
window.getTodayString = getTodayString;
window.getCurrentTimeString = getCurrentTimeString;
window.calculateDurationMinutes = calculateDurationMinutes;
window.formatMinutesToKorean = formatMinutesToKorean;

