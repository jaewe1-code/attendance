/**
 * EduCheck - Student Self Check-in Kiosk Mode
 * 학생 셀프 출석 키오스크 (전화번호 뒷자리 4자리 키패드)
 */

const KioskManager = {
  enteredDigits: '',

  init() {
    this.bindEvents();
    this.updateDisplay();
  },

  bindEvents() {
    // 키패드 숫자 버튼
    const numKeys = document.querySelectorAll('.keypad-grid .num-key');
    numKeys.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const digit = e.currentTarget.dataset.digit;
        this.addDigit(digit);
      });
    });

    // 지우기 버튼
    const backBtn = document.getElementById('kioskBackspace');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.removeDigit();
      });
    }

    // 전체 삭제 버튼
    const clearBtn = document.getElementById('kioskClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearAll();
      });
    }
  },

  addDigit(digit) {
    if (this.enteredDigits.length < 4) {
      this.enteredDigits += digit;
      this.updateDisplay();

      // 4자리가 다 찼을 때 자동 학생 검색
      if (this.enteredDigits.length === 4) {
        setTimeout(() => {
          this.searchAndPromptStudent(this.enteredDigits);
        }, 150);
      }
    }
  },

  removeDigit() {
    if (this.enteredDigits.length > 0) {
      this.enteredDigits = this.enteredDigits.slice(0, -1);
      this.updateDisplay();
    }
  },

  clearAll() {
    this.enteredDigits = '';
    this.updateDisplay();
  },

  updateDisplay() {
    const slots = document.querySelectorAll('.kiosk-display .digit-slot');
    slots.forEach((slot, index) => {
      if (index < this.enteredDigits.length) {
        slot.textContent = this.enteredDigits[index];
        slot.classList.add('filled');
      } else {
        slot.textContent = '·';
        slot.classList.remove('filled');
      }
    });
  },

  searchAndPromptStudent(last4) {
    const matchedStudents = window.store.findStudentsByLast4(last4);

    if (matchedStudents.length === 0) {
      alert(`뒷자리 [${last4}] 번호로 등록된 학생을 찾을 수 없습니다.\n선생님께 문의해주세요.`);
      this.clearAll();
      return;
    }

    if (matchedStudents.length === 1) {
      this.showCheckPrompt(matchedStudents[0]);
    } else {
      // 2명 이상 매칭된 경우 선택 목록 모달
      this.showMultipleStudentChoice(matchedStudents);
    }
  },

  // 출석/퇴실 확인 팝업
  showCheckPrompt(student) {
    const today = window.getTodayString();
    const att = window.store.getTodayAttendanceForStudent(student.id, today);
    const isStudying = att && att.checkIn && !att.checkOut && att.status !== 'absent';

    const modal = document.getElementById('kioskConfirmModal');
    if (!modal) return;

    document.getElementById('kioskStudentName').textContent = student.name;
    document.getElementById('kioskStudentInfo').textContent = `${student.level} ${student.grade || ''}`;

    const actionContainer = document.getElementById('kioskActionButtons');
    if (!isStudying) {
      actionContainer.innerHTML = `
        <button class="btn btn-success btn-lg btn-full" onclick="KioskManager.executeCheckIn('${student.id}')">
          <i data-lucide="log-in"></i> 지금 [입실 (등원)] 하기
        </button>
      `;
    } else {
      const nowTime = window.getCurrentTimeString();
      const mins = window.calculateDurationMinutes(att.checkIn, nowTime);
      actionContainer.innerHTML = `
        <div style="background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:12px; font-size:0.88rem;">
          등원시간: <strong>${att.checkIn}</strong><br>
          현재까지 학습: <strong style="color:var(--primary);">${window.formatMinutesToKorean(mins)}</strong>
        </div>
        <button class="btn btn-danger btn-lg btn-full" onclick="KioskManager.executeCheckOut('${student.id}')">
          <i data-lucide="log-out"></i> 공부 마치고 [퇴실 (하원)] 하기
        </button>
      `;
    }

    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  },

  showMultipleStudentChoice(students) {
    const modal = document.getElementById('kioskConfirmModal');
    if (!modal) return;

    document.getElementById('kioskStudentName').textContent = '학생을 선택하세요';
    document.getElementById('kioskStudentInfo').textContent = `동일한 뒷번호 학생 ${students.length}명`;

    const actionContainer = document.getElementById('kioskActionButtons');
    let listHtml = '<div style="display:flex; flex-direction:column; gap:8px;">';
    students.forEach(s => {
      listHtml += `
        <button class="btn btn-outline btn-full" style="padding:12px; justify-content:space-between;" onclick="KioskManager.showCheckPrompt(window.store.getStudentById('${s.id}'))">
          <strong>${s.name}</strong>
          <span style="font-size:0.8rem; color:var(--text-muted);">${s.level} ${s.grade || ''}</span>
        </button>
      `;
    });
    listHtml += '</div>';

    actionContainer.innerHTML = listHtml;
    modal.classList.add('active');
  },

  executeCheckIn(studentId) {
    const student = window.store.getStudentById(studentId);
    const att = window.store.checkInStudent(studentId);
    
    this.closeConfirmModal();
    this.clearAll();
    
    // 축하 토스트 및 메시지
    window.showToast?.(`🎉 ${student.name} 학생 입실 완료 (${att.checkIn})! 열공하세요!`);

    // 출석 뷰가 있으면 동기화
    if (window.AttendanceManager) {
      window.AttendanceManager.render();
    }
  },

  executeCheckOut(studentId) {
    const student = window.store.getStudentById(studentId);
    const att = window.store.checkOutStudent(studentId);
    const durStr = window.formatMinutesToKorean(att.durationMinutes);

    this.closeConfirmModal();
    this.clearAll();

    window.showToast?.(`👋 ${student.name} 학생 퇴실 완료! 오늘 총 학습: ${durStr}`);

    if (window.AttendanceManager) {
      window.AttendanceManager.render();
    }
  },

  closeConfirmModal() {
    const modal = document.getElementById('kioskConfirmModal');
    if (modal) modal.classList.remove('active');
    this.clearAll();
  }
};

window.KioskManager = KioskManager;
