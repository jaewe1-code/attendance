/**
 * EduCheck - Attendance Management Module
 * 실시간 출석/입퇴실 관리, 재실 현황 대시보드, 유동 시간 계산
 */

const AttendanceManager = {
  selectedDate: window.getTodayString(),
  levelFilter: 'all', // 'all', '초등', '중등', '고등'
  statusFilter: 'all', // 'all', 'studying', 'finished', 'not_attended', 'absent'
  searchKeyword: '',
  timerInterval: null,

  init() {
    this.bindEvents();
    this.startLiveTimer();
    this.render();
  },

  bindEvents() {
    // 1. 날짜 변경 이벤트
    const dateInput = document.getElementById('attendanceDateInput');
    if (dateInput) {
      dateInput.value = this.selectedDate;
      dateInput.addEventListener('change', (e) => {
        this.selectedDate = e.target.value;
        this.render();
      });
    }

    // 2. 초/중/고 학교급 탭 클릭
    const levelTabs = document.querySelectorAll('#attendanceLevelTabs .level-tab-btn');
    levelTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        levelTabs.forEach(t => t.classList.remove('active'));
        const btn = e.currentTarget;
        btn.classList.add('active');
        this.levelFilter = btn.dataset.level;
        this.render();
      });
    });

    // 3. 상태 필터 칩 클릭
    const filterChips = document.querySelectorAll('#attendanceFilterChips .chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        filterChips.forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        this.statusFilter = e.target.dataset.status;
        this.render();
      });
    });

    // 4. 출석 검색창
    const searchInput = document.getElementById('attendanceSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchKeyword = e.target.value.trim().toLowerCase();
        this.render();
      });
    }

    // 5. 출석 수정 폼 제출
    const form = document.getElementById('attendanceEditForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveAttendanceEdit();
      });
    }
  },

  // 1분마다 재실 학생 경과시간 갱신
  startLiveTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      // 오늘 날짜를 보고 있을 때만 렌더링 업데이트
      if (this.selectedDate === window.getTodayString()) {
        this.updateLiveDurations();
      }
    }, 30000); // 30초마다 갱신
  },

  updateLiveDurations() {
    const liveBadges = document.querySelectorAll('[data-live-checkin]');
    const currentNow = window.getCurrentTimeString();
    liveBadges.forEach(badge => {
      const checkInTime = badge.dataset.liveCheckin;
      if (checkInTime) {
        const mins = window.calculateDurationMinutes(checkInTime, currentNow);
        badge.textContent = `🔥 ${window.formatMinutesToKorean(mins)} 학습중`;
      }
    });
  },

  render() {
    this.renderDashboardStats();
    this.renderAttendanceList();
  },

  // 상단 대시보드 통계 카드 및 학교급별 탭 뱃지 갱신
  renderDashboardStats() {
    const students = window.store.getStudents();
    const attendances = window.store.getAttendancesByDate(this.selectedDate);

    const totalStudents = students.length;
    let studyingCount = 0;
    let finishedCount = 0;
    let absentCount = 0;

    // 학교급별 인원 및 재실 카운트
    const levelStats = {
      초등: { total: 0, studying: 0 },
      중등: { total: 0, studying: 0 },
      고등: { total: 0, studying: 0 }
    };

    students.forEach(s => {
      if (levelStats[s.level]) {
        levelStats[s.level].total++;
      }
    });

    attendances.forEach(att => {
      const std = students.find(s => s.id === att.studentId);
      const isStudying = att.checkIn && !att.checkOut && att.status !== 'absent';

      if (isStudying) {
        studyingCount++;
        if (std && levelStats[std.level]) {
          levelStats[std.level].studying++;
        }
      } else if (att.checkIn && att.checkOut) {
        finishedCount++;
      } else if (att.status === 'absent') {
        absentCount++;
      }
    });

    const notAttendedCount = Math.max(0, totalStudents - studyingCount - finishedCount - absentCount);

    // 대시보드 히어로 숫자 업데이트
    const totalEl = document.getElementById('statTotalStudents');
    const studyingEl = document.getElementById('statStudying');
    const finishedEl = document.getElementById('statFinished');

    if (totalEl) totalEl.textContent = `${totalStudents}명`;
    if (studyingEl) studyingEl.textContent = `${studyingCount}명`;
    if (finishedEl) finishedEl.textContent = `${finishedCount}명`;

    // 학교급 세그먼트 탭 뱃지 업데이트
    const countAllEl = document.getElementById('levelCountAll');
    const countElemEl = document.getElementById('levelCountElem');
    const countMiddleEl = document.getElementById('levelCountMiddle');
    const countHighEl = document.getElementById('levelCountHigh');

    if (countAllEl) countAllEl.textContent = `재실 ${studyingCount}/${totalStudents}`;
    if (countElemEl) countElemEl.textContent = `재실 ${levelStats['초등'].studying}/${levelStats['초등'].total}`;
    if (countMiddleEl) countMiddleEl.textContent = `재실 ${levelStats['중등'].studying}/${levelStats['중등'].total}`;
    if (countHighEl) countHighEl.textContent = `재실 ${levelStats['고등'].studying}/${levelStats['고등'].total}`;
  },

  // 학생별 출석 카드 리스트
  renderAttendanceList() {
    const container = document.getElementById('attendanceListContainer');
    if (!container) return;

    let students = window.store.getStudents();
    const attendances = window.store.getAttendancesByDate(this.selectedDate);

    // 1. 초/중/고 학교급 필터
    if (this.levelFilter !== 'all') {
      students = students.filter(s => s.level === this.levelFilter);
    }

    // 2. 검색어 필터
    if (this.searchKeyword) {
      students = students.filter(s => 
        s.name.toLowerCase().includes(this.searchKeyword) ||
        (s.phone && s.phone.includes(this.searchKeyword)) ||
        (s.grade && s.grade.includes(this.searchKeyword))
      );
    }

    // 3. 상태 필터 (공부중, 하원완료 등)
    if (this.statusFilter !== 'all') {
      students = students.filter(std => {
        const att = attendances.find(a => a.studentId === std.id);
        if (this.statusFilter === 'studying') {
          return att && att.checkIn && !att.checkOut && att.status !== 'absent';
        } else if (this.statusFilter === 'finished') {
          return att && att.checkIn && att.checkOut;
        } else if (this.statusFilter === 'not_attended') {
          return !att || (!att.checkIn && att.status !== 'absent');
        } else if (this.statusFilter === 'absent') {
          return att && att.status === 'absent';
        }
        return true;
      });
    }

    if (students.length === 0) {
      const levelName = this.levelFilter === 'all' ? '' : `[${this.levelFilter}부] `;
      container.innerHTML = `
        <div class="card text-center" style="padding: 35px 20px;">
          <p style="color: var(--text-muted); font-size: 0.92rem;">${levelName}해당 조건의 학생/출석 데이터가 없습니다.</p>
        </div>
      `;
      return;
    }

    let html = '';
    const nowTime = window.getCurrentTimeString();

    const selectedDayName = DataStore.getDayName(this.selectedDate);

    students.forEach(std => {
      const att = attendances.find(a => a.studentId === std.id);
      const avatarClass = std.level === '초등' ? 'elem' : std.level === '중등' ? 'middle' : 'high';
      const initial = std.name ? std.name.slice(0, 1) : '?';

      // 오늘 요일에 맞는 스케줄 확인
      const todaySch = (std.schedules || []).find(s => s.day === selectedDayName);

      const isStudying = att && att.checkIn && !att.checkOut && att.status !== 'absent';
      const isFinished = att && att.checkIn && att.checkOut && att.status !== 'absent';
      const isAbsent = att && att.status === 'absent';

      let statusBadge = `<span class="badge badge-left">미출석</span>`;
      if (isStudying) {
        const sNum = att.sessions?.length || 1;
        const sText = sNum > 1 ? ` (${sNum}차)` : '';
        statusBadge = `<span class="badge badge-present">🔥 재실 중${sText}</span>`;
      } else if (isFinished) {
        const sNum = att.sessions?.length || 1;
        const sText = sNum > 1 ? ` (${sNum}회 수업완료)` : '';
        statusBadge = `<span class="badge badge-left">✅ 하원 완료${sText}</span>`;
      } else if (isAbsent) {
        statusBadge = `<span class="badge badge-absent">결석</span>`;
      } else if (att?.status === 'late') {
        statusBadge = `<span class="badge badge-late">지각</span>`;
      } else if (att?.status === 'supplement') {
        statusBadge = `<span class="badge badge-supplement">보강</span>`;
      }

      // 학습 시간 계산
      let durationDisplay = '-';
      if (att && att.durationMinutes > 0) {
        durationDisplay = window.formatMinutesToKorean(att.durationMinutes);
        if (isStudying && att.checkIn) {
          const curM = window.calculateDurationMinutes(att.checkIn, nowTime);
          durationDisplay += ` <small style="color:var(--primary);">(+${curM}분)</small>`;
        }
      } else if (isStudying && att.checkIn) {
        const dur = window.calculateDurationMinutes(att.checkIn, nowTime);
        durationDisplay = `<span data-live-checkin="${att.checkIn}">🔥 ${window.formatMinutesToKorean(dur)} 학습중</span>`;
      }

      // 다회차 세션 타임라인 텍스트
      let sessionsSummary = '';
      if (att && Array.isArray(att.sessions) && att.sessions.length > 1) {
        sessionsSummary = att.sessions.map((s, idx) => 
          `<span style="background:white; border:1px solid #e2e8f0; padding:2px 6px; border-radius:4px; font-size:0.72rem;">${idx+1}차: ${s.in}~${s.out || '학습중'} (${s.duration ? window.formatMinutesToKorean(s.duration) : '진행'})</span>`
        ).join(' ');
      }

      // 액션 버튼 (미출석 -> 입실, 재실 -> 퇴실, 하원완료 -> 재입실 가능!)
      let actionBtnHtml = '';
      if (isStudying) {
        const sNum = att.sessions?.length || 1;
        const outLabel = sNum > 1 ? `${sNum}차 퇴실 (하원)` : '퇴실 (하원)';
        actionBtnHtml = `
          <button class="btn btn-danger btn-sm" onclick="AttendanceManager.quickCheckOut('${std.id}')">
            <i data-lucide="log-out"></i> ${outLabel}
          </button>
        `;
      } else if (isFinished) {
        const nextNum = (att.sessions?.length || 1) + 1;
        actionBtnHtml = `
          <button class="btn btn-primary btn-sm" onclick="AttendanceManager.quickCheckIn('${std.id}')" style="background: #4f46e5;">
            <i data-lucide="log-in"></i> ${nextNum}차 재입실
          </button>
        `;
      } else {
        actionBtnHtml = `
          <button class="btn btn-success btn-sm" onclick="AttendanceManager.quickCheckIn('${std.id}')">
            <i data-lucide="log-in"></i> 입실 (등원)
          </button>
        `;
      }

      html += `
        <div class="student-card ${isStudying ? 'is-studying' : ''}">
          <div class="student-card-top">
            <div class="student-profile">
              <div class="student-avatar ${avatarClass}">${initial}</div>
              <div class="student-meta">
                <h3>
                  ${std.name}
                  <span class="badge badge-school">${std.level} · ${std.grade || '전체'}</span>
                </h3>
                <div class="sub-info" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  ${statusBadge}
                  ${todaySch ? `<span class="badge" style="background:#e0e7ff; color:#4338ca; font-weight:700;">🕒 오늘수업 ${todaySch.time}</span>` : ''}
                  ${att?.memo ? `<span style="color: #6366f1; font-weight: 500;">· 💬 ${att.memo}</span>` : ''}
                </div>
              </div>
            </div>

            <div style="display:flex; gap:4px;">
              <button class="btn btn-ghost btn-icon btn-sm" onclick="StudentsManager.openIndividualAttendance('${std.id}')" title="개인출석부">
                <i data-lucide="calendar-days"></i>
              </button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="AttendanceManager.openEditModal('${std.id}')" title="출석/시간 직접 수정">
                <i data-lucide="sliders"></i>
              </button>
            </div>
          </div>

          <!-- 입/퇴실 시간 및 학습시간 정보 바 -->
          <div class="attendance-time-bar">
            <div class="time-item">
              <span class="time-label">등원(입실)</span>
              <span class="time-val">${att?.checkIn || '-'}</span>
            </div>
            <div class="time-item">
              <span class="time-label">하원(퇴실)</span>
              <span class="time-val">${att?.checkOut || (isStudying ? '학습중' : '-')}</span>
            </div>
            <div class="time-item" style="text-align: right;">
              <span class="time-label">총 학습시간</span>
              <span class="study-duration">${durationDisplay}</span>
            </div>
          </div>

          ${sessionsSummary ? `
            <div style="display:flex; gap:4px; flex-wrap:wrap; background:#f8fafc; padding:6px 10px; border-radius:var(--radius-sm); margin-top:-4px;">
              <span style="font-size:0.7rem; color:var(--text-muted); align-self:center; font-weight:600;">회차별:</span>
              ${sessionsSummary}
            </div>
          ` : ''}

          <!-- 빠른 액션 버튼 행 -->
          <div class="card-action-row">
            ${actionBtnHtml}

            <button class="btn btn-outline btn-sm" onclick="AttendanceManager.openNotificationModal('${std.id}')">
              <i data-lucide="message-square"></i> 안심문자
            </button>

            <button class="btn btn-ghost btn-icon btn-sm" onclick="AttendanceManager.openStatusSheet('${std.id}')" title="상태 변경 및 초기화">
              <i data-lucide="more-horizontal"></i>
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  },

  // 특정 날짜의 출결 직접 수정 모달 열기 (개인출석부 등에서 호출)
  openDirectEditModal(studentId, dateStr) {
    const student = window.store.getStudentById(studentId);
    if (!student) return;

    const att = window.store.attendances.find(a => a.studentId === studentId && a.date === dateStr);
    const modal = document.getElementById('attendanceEditModal');
    if (!modal) return;

    document.getElementById('editStudentId').value = student.id;
    document.getElementById('editStudentName').textContent = `${student.name} (${dateStr})`;
    document.getElementById('editDate').value = dateStr;
    document.getElementById('editCheckIn').value = att?.checkIn || '';
    document.getElementById('editCheckOut').value = att?.checkOut || '';
    document.getElementById('editStatus').value = att?.status || 'present';
    document.getElementById('editMemo').value = att?.memo || '';

    modal.classList.add('active');
  },

  // 원터치 입실
  quickCheckIn(studentId) {
    const student = window.store.getStudentById(studentId);
    const att = window.store.checkInStudent(studentId, null, this.selectedDate);
    const sNum = att.sessions?.length || 1;
    const prefix = sNum > 1 ? `${sNum}차 ` : '';
    window.showToast?.(`🚪 ${student?.name || '학생'} ${prefix}입실 처리되었습니다. (${att.checkIn})`);
    this.render();
    if (window.IndividualAttendanceManager) {
      window.IndividualAttendanceManager.render();
    }
  },

  // 원터치 퇴실
  quickCheckOut(studentId) {
    const student = window.store.getStudentById(studentId);
    const att = window.store.checkOutStudent(studentId, null, this.selectedDate);
    const durStr = window.formatMinutesToKorean(att.durationMinutes);
    const sNum = att.sessions?.length || 1;
    const prefix = sNum > 1 ? `${sNum}차 ` : '';
    window.showToast?.(`👋 ${student?.name || '학생'} ${prefix}퇴실 완료 (${att.checkOut}, 오늘 누적: ${durStr})`);
    this.render();
    if (window.IndividualAttendanceManager) {
      window.IndividualAttendanceManager.render();
    }
  },

  // 출석 상세 수정 모달 열기
  openEditModal(studentId) {
    const student = window.store.getStudentById(studentId);
    const att = window.store.getTodayAttendanceForStudent(studentId, this.selectedDate);
    if (!student) return;

    const modal = document.getElementById('attendanceEditModal');
    if (!modal) return;

    document.getElementById('editStudentId').value = student.id;
    document.getElementById('editStudentName').textContent = `${student.name} (${student.level} ${student.grade})`;
    document.getElementById('editDate').value = this.selectedDate;
    document.getElementById('editCheckIn').value = att?.checkIn || '';
    document.getElementById('editCheckOut').value = att?.checkOut || '';
    document.getElementById('editStatus').value = att?.status || 'present';
    document.getElementById('editMemo').value = att?.memo || '';

    modal.classList.add('active');
  },

  closeEditModal() {
    const modal = document.getElementById('attendanceEditModal');
    if (modal) modal.classList.remove('active');
  },

  handleSaveAttendanceEdit() {
    const studentId = document.getElementById('editStudentId').value;
    const targetDate = document.getElementById('editDate')?.value || this.selectedDate;
    const checkIn = document.getElementById('editCheckIn').value.trim() || null;
    const checkOut = document.getElementById('editCheckOut').value.trim() || null;
    const status = document.getElementById('editStatus').value;
    const memo = document.getElementById('editMemo').value.trim();

    let att = window.store.attendances.find(a => a.studentId === studentId && a.date === targetDate);
    if (!att) {
      att = {
        id: 'att-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        studentId,
        date: targetDate,
        checkIn,
        checkOut,
        status,
        durationMinutes: 0,
        memo
      };
      if (checkIn && checkOut) {
        att.durationMinutes = window.calculateDurationMinutes(checkIn, checkOut);
      }
      window.store.attendances.push(att);
      window.store.saveAttendances();
    } else {
      window.store.updateAttendanceRecord(att.id, {
        checkIn,
        checkOut,
        status,
        memo
      });
    }

    window.showToast?.('💾 출결 정보가 저장되었습니다.');
    this.closeEditModal();
    this.render();
    if (window.IndividualAttendanceManager) {
      window.IndividualAttendanceManager.render();
    }
  },

  // 상태 빠른 변경 시트 (보강, 지각, 결석 등)
  openStatusSheet(studentId) {
    const student = window.store.getStudentById(studentId);
    if (!student) return;
    
    const action = prompt(`[${student.name}] 상태를 선택해주세요:\n1. 정상출석\n2. 지각\n3. 결석\n4. 보강수업\n5. 초기화(삭제)\n(번호 1~5 입력)`);
    if (!action) return;

    if (action === '1') {
      window.store.setAttendanceStatus(studentId, 'present', this.selectedDate);
    } else if (action === '2') {
      const memo = prompt('지각 사유 메모(선택):', '');
      window.store.setAttendanceStatus(studentId, 'late', this.selectedDate, memo || '지각');
    } else if (action === '3') {
      const memo = prompt('결석 사유 메모(선택):', '');
      window.store.setAttendanceStatus(studentId, 'absent', this.selectedDate, memo || '결석');
    } else if (action === '4') {
      const memo = prompt('보강 내용/시간(선택):', '주말 보강');
      window.store.setAttendanceStatus(studentId, 'supplement', this.selectedDate, memo);
    } else if (action === '5') {
      window.store.clearAttendance(studentId, this.selectedDate);
      window.showToast?.(`🗑️ [${student.name}] 학생의 오늘 출결 기록이 초기화되었습니다.`);
    }
    this.render();
    if (window.IndividualAttendanceManager) {
      window.IndividualAttendanceManager.render();
    }
  },

  // 안심 문자 모달 열기
  openNotificationModal(studentId) {
    const student = window.store.getStudentById(studentId);
    const att = window.store.getTodayAttendanceForStudent(studentId, this.selectedDate);
    if (!student) return;

    const modal = document.getElementById('notificationModal');
    if (!modal) return;

    const isFinished = att && att.checkIn && att.checkOut;
    const type = isFinished ? 'checkOut' : (att?.checkIn ? 'checkIn' : 'status');

    const msg = window.NotificationManager.createMessage(student, att, type);

    document.getElementById('notifStudentName').textContent = student.name;
    document.getElementById('notifParentPhone').textContent = student.parentPhone || '연락처 미등록';
    document.getElementById('notifMessagePreview').value = msg;
    document.getElementById('notifTargetPhone').value = student.parentPhone || '';

    // 모달 데이터 속성에 저장
    modal.dataset.studentId = studentId;
    modal.dataset.date = this.selectedDate;

    modal.classList.add('active');
  },

  closeNotificationModal() {
    const modal = document.getElementById('notificationModal');
    if (modal) modal.classList.remove('active');
  },

  // 모달 내에서 메시지 타입 변경 (등원/하원/출결변동)
  changeNotificationType(type) {
    const modal = document.getElementById('notificationModal');
    const studentId = modal.dataset.studentId;
    const dateStr = modal.dataset.date;
    const student = window.store.getStudentById(studentId);
    const att = window.store.getTodayAttendanceForStudent(studentId, dateStr);

    const msg = window.NotificationManager.createMessage(student, att, type);
    document.getElementById('notifMessagePreview').value = msg;
  }
};

window.AttendanceManager = AttendanceManager;
