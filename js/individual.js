/**
 * EduCheck - Individual Student Attendance & Schedule Management Module
 * 학생 개인별 요일/시간 스케줄 관리 및 월간 개인 출석부 캘린더/통계
 */

const IndividualAttendanceManager = {
  selectedStudentId: null,
  selectedMonth: window.getTodayString().slice(0, 7),
  tempSchedules: [], // 스케줄 편집 중 임시 저장 배열
  viewMode: 'calendar', // 'calendar' 또는 'list'

  init() {
    this.bindEvents();
    this.setDefaultStudent();
    this.render();
  },

  setDefaultStudent() {
    const students = window.store.getStudents();
    if (students.length > 0 && !this.selectedStudentId) {
      this.selectedStudentId = students[0].id;
    }
  },

  bindEvents() {
    // 1. 학생 선택 셀렉트박스 변경
    const studentSelect = document.getElementById('individualStudentSelect');
    if (studentSelect) {
      studentSelect.addEventListener('change', (e) => {
        this.selectStudent(e.target.value);
      });
    }

    // 2. 학생 검색어 입력
    const searchInput = document.getElementById('individualSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.trim().toLowerCase();
        this.filterStudentDropdown(keyword);
      });
    }

    // 3. 이전 / 다음 학생 이동 버튼
    const btnPrev = document.getElementById('btnPrevStudent');
    const btnNext = document.getElementById('btnNextStudent');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => this.navigateStudent(-1));
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => this.navigateStudent(1));
    }

    // 4. 월 선택기 변경
    const monthSelect = document.getElementById('individualMonthSelect');
    if (monthSelect) {
      monthSelect.value = this.selectedMonth;
      monthSelect.addEventListener('change', (e) => {
        this.selectedMonth = e.target.value;
        this.renderAttendanceHistory();
      });
    }

    // 5. 뷰 모드 토글 (캘린더 / 리스트)
    const btnViewCal = document.getElementById('btnViewCalendar');
    const btnViewList = document.getElementById('btnViewList');
    if (btnViewCal && btnViewList) {
      btnViewCal.addEventListener('click', () => {
        this.viewMode = 'calendar';
        btnViewCal.classList.add('active');
        btnViewList.classList.remove('active');
        this.renderAttendanceHistory();
      });
      btnViewList.addEventListener('click', () => {
        this.viewMode = 'list';
        btnViewList.classList.add('active');
        btnViewCal.classList.remove('active');
        this.renderAttendanceHistory();
      });
    }

    // 6. 스케줄 추가 폼 이벤트
    const btnAddSchedule = document.getElementById('btnAddScheduleItem');
    if (btnAddSchedule) {
      btnAddSchedule.addEventListener('click', () => this.handleAddScheduleItem());
    }

    // 7. 스케줄 빠른 시간 버튼 클릭 (14:00, 15:00 등)
    const quickTimeBtns = document.querySelectorAll('.quick-time-btn');
    quickTimeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const timeVal = e.currentTarget.dataset.time;
        const timeInput = document.getElementById('scheduleTimeInput');
        if (timeInput && timeVal) {
          timeInput.value = timeVal;
        }
      });
    });

    // 8. 스케줄 최종 저장 버튼
    const btnSaveSchedules = document.getElementById('btnSaveStudentSchedules');
    if (btnSaveSchedules) {
      btnSaveSchedules.addEventListener('click', () => this.handleSaveSchedules());
    }

    // 9. 개인 출석부 엑셀 다운로드 버튼
    const btnExportExcel = document.getElementById('btnExportIndividualExcel');
    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', () => this.exportExcel());
    }
  },

  // 학생 검색 시 드롭다운 옵션 필터링
  filterStudentDropdown(keyword) {
    const studentSelect = document.getElementById('individualStudentSelect');
    if (!studentSelect) return;
    const students = window.store.getStudents();
    
    let filtered = students;
    if (keyword) {
      filtered = students.filter(s => 
        s.name.toLowerCase().includes(keyword) || 
        (s.phone && s.phone.includes(keyword)) ||
        (s.grade && s.grade.toLowerCase().includes(keyword))
      );
    }

    studentSelect.innerHTML = filtered.map(s => {
      const schText = DataStore.formatScheduleText(s.schedules);
      const subInfo = schText ? ` (${schText})` : ` [${s.level} ${s.grade || ''}]`;
      return `<option value="${s.id}" ${s.id === this.selectedStudentId ? 'selected' : ''}>${s.name}${subInfo}</option>`;
    }).join('');

    if (filtered.length > 0 && !filtered.some(s => s.id === this.selectedStudentId)) {
      this.selectStudent(filtered[0].id);
    }
  },

  // 학생 선택 시 실행
  selectStudent(studentId) {
    this.selectedStudentId = studentId;
    const student = window.store.getStudentById(studentId);
    if (student) {
      this.tempSchedules = Array.isArray(student.schedules) ? JSON.parse(JSON.stringify(student.schedules)) : [];
    } else {
      this.tempSchedules = [];
    }
    this.render();
  },

  // 이전/다음 학생 이동
  navigateStudent(direction) {
    const students = window.store.getStudents();
    if (students.length === 0) return;
    const currentIndex = students.findIndex(s => s.id === this.selectedStudentId);
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = students.length - 1;
    if (nextIndex >= students.length) nextIndex = 0;
    this.selectStudent(students[nextIndex].id);
  },

  render() {
    this.renderStudentDropdown();
    this.renderStudentInfoCard();
    this.renderScheduleEditor();
    this.renderAttendanceHistory();
    if (window.lucide) window.lucide.createIcons();
  },

  // 1. 학생 드롭다운 렌더링
  renderStudentDropdown() {
    const studentSelect = document.getElementById('individualStudentSelect');
    if (!studentSelect) return;

    const students = window.store.getStudents();
    if (students.length === 0) {
      studentSelect.innerHTML = '<option value="">등록된 학생이 없습니다</option>';
      this.selectedStudentId = null;
      return;
    }

    if (!this.selectedStudentId || !students.some(s => s.id === this.selectedStudentId)) {
      this.selectedStudentId = students[0].id;
    }

    studentSelect.innerHTML = students.map(s => {
      const schText = DataStore.formatScheduleText(s.schedules);
      const subInfo = schText ? ` (${schText})` : ` [${s.level} ${s.grade || ''}]`;
      return `<option value="${s.id}" ${s.id === this.selectedStudentId ? 'selected' : ''}>${s.name}${subInfo}</option>`;
    }).join('');
  },

  // 2. 학생 기본 프로필 정보 카드 렌더링
  renderStudentInfoCard() {
    const profileContainer = document.getElementById('individualStudentProfileCard');
    if (!profileContainer) return;

    const student = window.store.getStudentById(this.selectedStudentId);
    if (!student) {
      profileContainer.innerHTML = `
        <div class="card text-center" style="padding: 24px;">
          <p style="color: var(--text-muted); font-size: 0.9rem;">학생을 등록하거나 선택해주세요.</p>
        </div>
      `;
      return;
    }

    const avatarClass = student.level === '초등' ? 'elem' : student.level === '중등' ? 'middle' : 'high';
    const initial = student.name ? student.name.slice(0, 1) : '?';
    const scheduleSummary = DataStore.formatScheduleText(student.schedules) || '설정된 스케줄 없음';

    // 해당 학생의 이번 달 통계
    const monthlyAtts = window.store.attendances.filter(a => a.studentId === student.id && a.date && a.date.startsWith(this.selectedMonth));
    const totalMinutes = monthlyAtts.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
    const attendedCount = monthlyAtts.filter(a => a.status === 'present' || a.status === 'supplement').length;

    profileContainer.innerHTML = `
      <div class="student-card" style="margin-bottom: 0; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);">
        <div class="student-card-top">
          <div class="student-profile">
            <div class="student-avatar ${avatarClass}">${initial}</div>
            <div class="student-meta">
              <h3>
                ${student.name}
                <span class="badge badge-school">${student.level} · ${student.grade || '전체'}</span>
              </h3>
              <div class="sub-info" style="display:flex; flex-direction:column; gap:2px; margin-top:3px;">
                <span>📱 학생: ${student.phone || '미등록'} | 학부모: ${student.parentPhone || '미등록'}</span>
                <span style="color: var(--primary); font-weight: 600;">🕒 정규 시간표: ${scheduleSummary}</span>
              </div>
            </div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="StudentsManager.openEditModal('${student.id}')" title="정보 수정">
            <i data-lucide="edit-3"></i> 학생수정
          </button>
        </div>

        <div style="font-size: 0.82rem; color: var(--text-muted); background: white; border: 1px solid var(--border-color); padding: 10px 14px; border-radius: var(--radius-md);">
          <div class="flex-between">
            <span>📅 이달 출석: <strong style="color: var(--primary);">${attendedCount}회</strong></span>
            <span>⏱️ 이달 누적 학습: <strong style="color: var(--success-hover);">${window.formatMinutesToKorean(totalMinutes)}</strong></span>
            <span>🎯 주당 목표: <strong>${student.weeklyTargetHours || 10}시간</strong></span>
          </div>
          ${student.memo ? `<div style="margin-top: 6px; padding-top:6px; border-top:1px dashed #e2e8f0; color: #475569;">💡 ${student.memo}</div>` : ''}
        </div>
      </div>
    `;
  },

  // 3. 스케줄 편집기 렌더링
  renderScheduleEditor() {
    const listContainer = document.getElementById('individualScheduleList');
    if (!listContainer) return;

    if (!this.tempSchedules || this.tempSchedules.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 14px; color: var(--text-sub); font-size: 0.85rem; background: #f8fafc; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          등록된 요일별 수업 시간이 없습니다. 아래에서 요일과 시간을 선택하여 추가해주세요.
        </div>
      `;
      return;
    }

    const dayOrder = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
    const sorted = [...this.tempSchedules].sort((a, b) => (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99));

    listContainer.innerHTML = sorted.map((sch, idx) => {
      // 14:00 -> 오후 2:00 변환 표시
      const displayTime = this.formatDisplayTime(sch.time);
      return `
        <div class="schedule-chip">
          <span class="schedule-day-badge">${sch.day}요일</span>
          <span class="schedule-time-text">${sch.time} <small>(${displayTime})</small></span>
          ${sch.durationMinutes ? `<span class="schedule-duration">${sch.durationMinutes}분</span>` : ''}
          <button type="button" class="btn-remove-sch" onclick="IndividualAttendanceManager.handleRemoveScheduleItem(${idx})" title="삭제">
            <i data-lucide="x"></i>
          </button>
        </div>
      `;
    }).join('');
  },

  // 시간 표시 포맷 (14:00 -> 오후 2시)
  formatDisplayTime(timeStr) {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const period = h >= 12 ? '오후' : '오전';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return m > 0 ? `${period} ${h}시 ${m}분` : `${period} ${h}시`;
  },

  // 스케줄 항목 추가
  handleAddScheduleItem() {
    const daySelect = document.getElementById('scheduleDaySelect');
    const timeInput = document.getElementById('scheduleTimeInput');
    const durationInput = document.getElementById('scheduleDurationInput');

    const day = daySelect ? daySelect.value : '월';
    const time = timeInput ? timeInput.value : '09:00';
    const durationMinutes = durationInput ? (parseInt(durationInput.value, 10) || 90) : 90;

    if (!time) {
      alert('수업 시작 시간을 선택해주세요.');
      return;
    }

    // 중복 체크
    const exists = this.tempSchedules.some(s => s.day === day && s.time === time);
    if (exists) {
      alert(`이미 ${day}요일 ${time} 스케줄이 등록되어 있습니다.`);
      return;
    }

    this.tempSchedules.push({
      day,
      time,
      durationMinutes
    });

    this.renderScheduleEditor();
    if (window.lucide) window.lucide.createIcons();
  },

  // 스케줄 항목 삭제
  handleRemoveScheduleItem(index) {
    this.tempSchedules.splice(index, 1);
    this.renderScheduleEditor();
    if (window.lucide) window.lucide.createIcons();
  },

  // 스케줄 저장 실행
  handleSaveSchedules() {
    if (!this.selectedStudentId) {
      alert('학생을 먼저 선택해주세요.');
      return;
    }

    const student = window.store.getStudentById(this.selectedStudentId);
    if (!student) return;

    window.store.updateStudentSchedules(this.selectedStudentId, this.tempSchedules);
    window.showToast?.(`✅ ${student.name} 학생의 시간표(스케줄)가 저장되었습니다.`);
    
    this.render();
    if (window.AttendanceManager) {
      window.AttendanceManager.render();
    }
  },

  // 4. 월간 출석 기록 및 캘린더/리스트 렌더링
  renderAttendanceHistory() {
    const container = document.getElementById('individualAttendanceHistoryContainer');
    const summaryContainer = document.getElementById('individualMonthSummary');
    if (!container || !summaryContainer) return;

    const student = window.store.getStudentById(this.selectedStudentId);
    if (!student) {
      summaryContainer.innerHTML = '';
      container.innerHTML = '<div class="card text-center" style="padding: 30px; color: var(--text-muted);">학생을 선택해주세요.</div>';
      return;
    }

    const [yearStr, monthStr] = this.selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-indexed

    // 해당 월의 날짜들 생성
    const daysInMonth = new Date(year, month, 0).getDate();
    const studentAtts = window.store.attendances.filter(a => a.studentId === student.id && a.date && a.date.startsWith(this.selectedMonth));

    // 스케줄 요일 매핑
    const scheduledDays = (student.schedules || []).map(s => s.day);

    let scheduledDaysCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${this.selectedMonth}-${String(d).padStart(2, '0')}`;
      const dayName = DataStore.getDayName(dStr);
      if (scheduledDays.includes(dayName)) {
        scheduledDaysCount++;
      }
    }

    const presentCount = studentAtts.filter(a => a.status === 'present').length;
    const lateCount = studentAtts.filter(a => a.status === 'late').length;
    const earlyLeaveCount = studentAtts.filter(a => a.status === 'early_leave').length;
    const absentCount = studentAtts.filter(a => a.status === 'absent').length;
    const supplementCount = studentAtts.filter(a => a.status === 'supplement').length;
    const attendedTotal = presentCount + lateCount + earlyLeaveCount + supplementCount;
    const totalMinutes = studentAtts.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);

    // 월간 요약 카드
    summaryContainer.innerHTML = `
      <div class="report-summary-box" style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);">
        <div>
          <span style="font-size: 0.72rem; opacity: 0.9;">정규 예정일</span>
          <div style="font-size: 1.35rem; font-weight: 800; margin-top: 2px;">${scheduledDaysCount}일</div>
        </div>
        <div style="border-left: 1px solid rgba(255,255,255,0.25); border-right: 1px solid rgba(255,255,255,0.25); padding: 0 14px;">
          <span style="font-size: 0.72rem; opacity: 0.9;">실제 출석</span>
          <div style="font-size: 1.35rem; font-weight: 800; margin-top: 2px; color: #4ade80;">${attendedTotal}회</div>
        </div>
        <div>
          <span style="font-size: 0.72rem; opacity: 0.9;">누적 학습</span>
          <div style="font-size: 1.35rem; font-weight: 800; margin-top: 2px;">${window.formatMinutesToKorean(totalMinutes)}</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; font-size:0.75rem; color:var(--text-muted); padding: 4px 6px;">
        <span class="badge" style="background:#ecfdf5; color:#059669;">정상 ${presentCount}회</span>
        ${lateCount > 0 ? `<span class="badge" style="background:#fef3c7; color:#d97706;">지각 ${lateCount}회</span>` : ''}
        ${absentCount > 0 ? `<span class="badge" style="background:#fee2e2; color:#dc2626;">결석 ${absentCount}회</span>` : ''}
        ${supplementCount > 0 ? `<span class="badge" style="background:#f3e8ff; color:#7c3aed;">보강 ${supplementCount}회</span>` : ''}
      </div>
    `;

    if (this.viewMode === 'calendar') {
      this.renderCalendarView(container, year, month, daysInMonth, student, studentAtts);
    } else {
      this.renderListView(container, year, month, daysInMonth, student, studentAtts);
    }
  },

  // 4-A. 캘린더 뷰 렌더링
  renderCalendarView(container, year, month, daysInMonth, student, studentAtts) {
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0(일) ~ 6(토)
    const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];

    let html = `
      <div class="calendar-grid-card">
        <div class="calendar-header-grid">
          ${dayHeaders.map((d, i) => `<div class="cal-header-cell ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${d}</div>`).join('')}
        </div>
        <div class="calendar-days-grid">
    `;

    // 1일 이전 빈 칸
    for (let i = 0; i < firstDayIndex; i++) {
      html += `<div class="cal-day-cell empty"></div>`;
    }

    const todayStr = window.getTodayString();

    // 1일부터 말일까지
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${this.selectedMonth}-${String(d).padStart(2, '0')}`;
      const dayOfWeekIndex = new Date(year, month - 1, d).getDay();
      const dayName = dayHeaders[dayOfWeekIndex];
      const isToday = (dStr === todayStr);

      // 해당 요일에 정규 스케줄이 있는지
      const matchingSchedule = (student.schedules || []).find(s => s.day === dayName);
      // 실제 출결 기록이 있는지
      const att = studentAtts.find(a => a.date === dStr);

      let cellClass = 'cal-day-cell';
      if (isToday) cellClass += ' today';
      if (dayOfWeekIndex === 0) cellClass += ' sun';
      if (dayOfWeekIndex === 6) cellClass += ' sat';
      if (matchingSchedule) cellClass += ' scheduled';

      let statusBadge = '';
      if (att) {
        let badgeClass = 'badge-present';
        let statusLabel = '출석';
        if (att.status === 'late') { badgeClass = 'badge-late'; statusLabel = '지각'; }
        else if (att.status === 'early_leave') { badgeClass = 'badge-early'; statusLabel = '조퇴'; }
        else if (att.status === 'absent') { badgeClass = 'badge-absent'; statusLabel = '결석'; }
        else if (att.status === 'supplement') { badgeClass = 'badge-supplement'; statusLabel = '보강'; }

        const dur = att.durationMinutes ? window.formatMinutesToKorean(att.durationMinutes) : (att.checkIn ? '공부중' : '-');
        statusBadge = `
          <div class="cal-att-badge ${badgeClass}" title="${att.checkIn || ''} ~ ${att.checkOut || ''} (${dur})">
            ${statusLabel} ${att.checkIn ? att.checkIn : ''}
          </div>
        `;
      } else if (matchingSchedule && dStr <= todayStr) {
        statusBadge = `<div class="cal-att-badge badge-missing">미출석</div>`;
      }

      html += `
        <div class="${cellClass}" onclick="IndividualAttendanceManager.openDayAttendanceModal('${student.id}', '${dStr}')">
          <div class="cal-day-num">${d}</div>
          ${matchingSchedule ? `<div class="cal-sch-tag">🕒 ${matchingSchedule.time}</div>` : ''}
          ${statusBadge}
        </div>
      `;
    }

    html += `
        </div>
      </div>
      <div style="font-size:0.75rem; color:var(--text-muted); text-align:center; margin-top:8px;">
        💡 달력의 날짜를 누르면 해당 일자의 출결 시간을 직접 입력/수정할 수 있습니다.
      </div>
    `;

    container.innerHTML = html;
  },

  // 4-B. 리스트 뷰 렌더링
  renderListView(container, year, month, daysInMonth, student, studentAtts) {
    const todayStr = window.getTodayString();
    let rowsHtml = '';

    for (let d = daysInMonth; d >= 1; d--) {
      const dStr = `${this.selectedMonth}-${String(d).padStart(2, '0')}`;
      const dayName = DataStore.getDayName(dStr);
      const matchingSchedule = (student.schedules || []).find(s => s.day === dayName);
      const att = studentAtts.find(a => a.date === dStr);

      // 스케줄도 없고 출결 기록도 없는 미래 날짜는 건너뛰거나 표시
      if (!matchingSchedule && !att && dStr > todayStr) continue;

      let statusBadge = `<span class="badge" style="background:#f1f5f9; color:#94a3b8;">미출석</span>`;
      let timeText = '-';
      let durationText = '-';

      if (att) {
        if (att.status === 'present') statusBadge = `<span class="badge badge-success">정상 출석</span>`;
        else if (att.status === 'late') statusBadge = `<span class="badge badge-warning">지각</span>`;
        else if (att.status === 'early_leave') statusBadge = `<span class="badge badge-warning">조퇴</span>`;
        else if (att.status === 'absent') statusBadge = `<span class="badge badge-danger">결석</span>`;
        else if (att.status === 'supplement') statusBadge = `<span class="badge badge-purple">보강</span>`;

        timeText = `${att.checkIn || '-'} ~ ${att.checkOut || '-'}`;
        durationText = att.durationMinutes ? window.formatMinutesToKorean(att.durationMinutes) : (att.checkIn ? '공부중' : '-');
      } else if (matchingSchedule) {
        statusBadge = `<span class="badge badge-outline" style="color:var(--primary);">예정일 (${matchingSchedule.time})</span>`;
      }

      rowsHtml += `
        <div class="individual-list-row ${att ? 'has-att' : ''}" onclick="IndividualAttendanceManager.openDayAttendanceModal('${student.id}', '${dStr}')">
          <div class="row-date-box">
            <span class="row-day">${d}일</span>
            <span class="row-week">(${dayName})</span>
          </div>
          <div class="row-info-box">
            <div class="row-times">${timeText}</div>
            <div class="row-sub">
              ${matchingSchedule ? `<span>스케줄: ${matchingSchedule.time}</span>` : ''}
              ${durationText !== '-' ? `<span>학습: ${durationText}</span>` : ''}
            </div>
            ${att && att.memo ? `<div class="row-memo">📝 ${att.memo}</div>` : ''}
          </div>
          <div class="row-status-box">
            ${statusBadge}
          </div>
        </div>
      `;
    }

    if (!rowsHtml) {
      rowsHtml = '<div class="card text-center" style="padding: 24px; color: var(--text-muted);">출결 및 스케줄 기록이 없습니다.</div>';
    }

    container.innerHTML = `<div class="individual-list-wrap">${rowsHtml}</div>`;
  },

  // 날짜 클릭 시 출결 수정 모달 열기
  openDayAttendanceModal(studentId, dateStr) {
    if (window.AttendanceManager && window.AttendanceManager.openDirectEditModal) {
      window.AttendanceManager.openDirectEditModal(studentId, dateStr);
    } else {
      // 대체 구현: attendanceEditModal 직접 띄우기
      const student = window.store.getStudentById(studentId);
      if (!student) return;
      const att = window.store.attendances.find(a => a.studentId === studentId && a.date === dateStr);

      const modal = document.getElementById('attendanceEditModal');
      if (!modal) return;

      document.getElementById('editStudentId').value = student.id;
      document.getElementById('editDate').value = dateStr;
      document.getElementById('editStudentName').textContent = `${student.name} (${dateStr})`;
      document.getElementById('editCheckIn').value = att ? (att.checkIn || '') : '14:00';
      document.getElementById('editCheckOut').value = att ? (att.checkOut || '') : '16:00';
      document.getElementById('editStatus').value = att ? (att.status || 'present') : 'present';
      document.getElementById('editMemo').value = att ? (att.memo || '') : '';

      modal.classList.add('active');
    }
  },

  // 개인 출석부 엑셀 다운로드
  exportExcel() {
    if (!this.selectedStudentId) {
      alert('학생을 선택해주세요.');
      return;
    }
    if (window.ExcelManager && window.ExcelManager.exportIndividualMonthlyReport) {
      window.ExcelManager.exportIndividualMonthlyReport(this.selectedStudentId, this.selectedMonth);
    } else {
      alert('엑셀 내보내기 모듈이 준비중입니다.');
    }
  }
};

window.IndividualAttendanceManager = IndividualAttendanceManager;
