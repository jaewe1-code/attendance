/**
 * EduCheck - Main Application Entry & Tab Navigation
 * 화면 전환, 실시간 시계, 통계 리포트 렌더링, 토스트 알림
 */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
} else {
  App.init();
}

const App = {
  currentTab: 'attendance',

  init() {
    this.startLiveClock();
    this.bindTabEvents();
    this.bindReportEvents();

    // 하위 모듈 초기화
    window.AttendanceManager?.init();
    window.StudentsManager?.init();
    window.IndividualAttendanceManager?.init();
    window.KioskManager?.init();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  // 상단 실시간 시계 및 운영 시간 안내
  startLiveClock() {
    const clockEl = document.getElementById('liveClockText');
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = days[now.getDay()];
      const isWeekend = (now.getDay() === 0 || now.getDay() === 6);

      // 공부방 운영 시간 상태
      let statusText = '';
      const currentH = now.getHours();
      if (isWeekend) {
        if (currentH >= 9 && currentH < 22) statusText = '주말 수업중 (09:00~22:00)';
        else statusText = '운영시간 외 (주말 09~22시)';
      } else {
        if (currentH >= 17 && currentH < 22) statusText = '평일 수업중 (17:00~22:00)';
        else statusText = '운영시간 외 (평일 17~22시)';
      }

      if (clockEl) {
        clockEl.innerHTML = `
          <span>${hours}:${mins}:${secs} (${dayName})</span>
          <span style="font-size:0.68rem; color:${statusText.includes('수업중') ? 'var(--success-hover)' : 'var(--text-sub)'}; font-weight:700;">• ${statusText}</span>
        `;
      }
    };

    updateClock();
    setInterval(updateClock, 1000);
  },

  // 하단 탭 네비게이션
  bindTabEvents() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        if (!tab) return;
        this.switchTab(tab);
      });
    });
  },

  switchTab(tabName) {
    this.currentTab = tabName;

    // 1. 탭 버튼 활성화 상태 변경
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => {
      if (item.dataset.tab === tabName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // 2. 뷰 섹션 표시 전환
    const views = document.querySelectorAll('.view-section');
    views.forEach(v => v.classList.remove('active'));

    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) {
      activeView.classList.add('active');
    }

    // 3. 탭별 데이터 리프레시
    if (tabName === 'attendance') {
      window.AttendanceManager?.render();
    } else if (tabName === 'individual') {
      window.IndividualAttendanceManager?.render();
    } else if (tabName === 'students') {
      window.StudentsManager?.render();
    } else if (tabName === 'kiosk') {
      window.KioskManager?.clearAll();
    } else if (tabName === 'report') {
      this.renderReportView();
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }

    // 모바일 스크롤 최상단 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // 통계 및 엑셀 탭 이벤트
  bindReportEvents() {
    // 월 선택
    const monthSelect = document.getElementById('reportMonthSelect');
    if (monthSelect) {
      const today = window.getTodayString();
      monthSelect.value = today.slice(0, 7);
      monthSelect.addEventListener('change', () => {
        this.renderReportView();
      });
    }

    // 일간 엑셀 다운로드 버튼
    const exportDailyBtn = document.getElementById('btnExportDailyExcel');
    if (exportDailyBtn) {
      exportDailyBtn.addEventListener('click', () => {
        const selectedDate = document.getElementById('attendanceDateInput')?.value || window.getTodayString();
        window.ExcelManager?.exportDailyAttendance(selectedDate);
      });
    }

    // 월간 엑셀 다운로드 버튼
    const exportMonthlyBtn = document.getElementById('btnExportMonthlyExcel');
    if (exportMonthlyBtn) {
      exportMonthlyBtn.addEventListener('click', () => {
        const selectedMonth = document.getElementById('reportMonthSelect')?.value || window.getTodayString().slice(0, 7);
        window.ExcelManager?.exportMonthlyReport(selectedMonth);
      });
    }

    // 양식 다운로드 버튼
    const templateBtn = document.getElementById('btnDownloadStudentTemplate');
    if (templateBtn) {
      templateBtn.addEventListener('click', () => {
        window.ExcelManager?.downloadStudentTemplate();
      });
    }

    // 엑셀 학생 업로드 인풋
    const excelFileInput = document.getElementById('excelStudentFileInput');
    if (excelFileInput) {
      excelFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          window.ExcelManager?.importStudentsFromExcel(file, (count) => {
            window.showToast?.(`🎉 엑셀에서 ${count}명의 학생을 성공적으로 등록했습니다!`);
            excelFileInput.value = '';
            window.StudentsManager?.render();
            window.AttendanceManager?.render();
          });
        }
      });
    }

    // JSON 백업 다운로드
    const backupBtn = document.getElementById('btnBackupJSON');
    if (backupBtn) {
      backupBtn.addEventListener('click', () => {
        const json = window.store.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `공부방_출석데이터_백업_${window.getTodayString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        window.showToast?.('💾 백업 파일이 저장되었습니다.');
      });
    }

    // JSON 복원
    const restoreInput = document.getElementById('restoreJSONInput');
    if (restoreInput) {
      restoreInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const success = window.store.importJSON(event.target.result);
            if (success) {
              window.showToast?.('✅ 백업 데이터가 성공적으로 복원되었습니다.');
              window.AttendanceManager?.render();
              window.StudentsManager?.render();
              this.renderReportView();
            } else {
              alert('유효하지 않은 백업 파일입니다.');
            }
            restoreInput.value = '';
          };
          reader.readAsText(file);
        }
      });
    }
  },

  // 통계 및 엑셀 탭 렌더링
  renderReportView() {
    const monthSelect = document.getElementById('reportMonthSelect');
    const selectedMonth = monthSelect ? monthSelect.value : window.getTodayString().slice(0, 7);

    const students = window.store.getStudents();
    const allAtt = window.store.attendances.filter(a => a.date && a.date.startsWith(selectedMonth));

    let totalAttendanceCount = 0;
    let totalMinutesSum = 0;

    allAtt.forEach(a => {
      if (a.status === 'present' || a.status === 'supplement' || a.checkIn) {
        totalAttendanceCount++;
      }
      totalMinutesSum += (a.durationMinutes || 0);
    });

    // 상단 요약 박스 업데이트
    const totalMonthAttEl = document.getElementById('reportTotalMonthAttendance');
    const totalMonthTimeEl = document.getElementById('reportTotalMonthHours');
    const avgDailyTimeEl = document.getElementById('reportAvgDailyHours');

    if (totalMonthAttEl) totalMonthAttEl.textContent = `${totalAttendanceCount}회`;
    if (totalMonthTimeEl) totalMonthTimeEl.textContent = window.formatMinutesToKorean(totalMinutesSum);
    if (avgDailyTimeEl) {
      const avg = totalAttendanceCount > 0 ? Math.round(totalMinutesSum / totalAttendanceCount) : 0;
      avgDailyTimeEl.textContent = window.formatMinutesToKorean(avg);
    }

    // 테이블 렌더링
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:20px; color:var(--text-muted);">등록된 학생이 없습니다.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    students.forEach((std, idx) => {
      const studentAtts = allAtt.filter(a => a.studentId === std.id);
      const presentDays = studentAtts.filter(a => a.status === 'present' || a.status === 'supplement').length;
      const totalMinutes = studentAtts.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
      const lateDays = studentAtts.filter(a => a.status === 'late').length;

      rowsHtml += `
        <tr>
          <td><strong>${std.name}</strong></td>
          <td><span class="badge badge-school">${std.level} ${std.grade || ''}</span></td>
          <td>${presentDays}일</td>
          <td style="color:var(--primary); font-weight:700;">${window.formatMinutesToKorean(totalMinutes)}</td>
          <td>${lateDays > 0 ? `<span style="color:var(--warning); font-weight:600;">지각 ${lateDays}</span>` : '정상'}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="App.quickStudentReport('${std.id}', '${selectedMonth}')" style="padding:4px 8px; font-size:0.75rem;">
              상세
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  },

  quickStudentReport(studentId, selectedMonth) {
    const student = window.store.getStudentById(studentId);
    if (!student) return;

    const studentAtts = window.store.attendances.filter(a => a.studentId === studentId && a.date && a.date.startsWith(selectedMonth));
    let msg = `📊 [${student.name}] ${selectedMonth} 출결 상세\n`;
    msg += `----------------------------\n`;
    if (studentAtts.length === 0) {
      msg += `해당 월에 출결 기록이 없습니다.\n`;
    } else {
      studentAtts.sort((a, b) => a.date.localeCompare(b.date));
      studentAtts.forEach(a => {
        const dur = a.durationMinutes ? window.formatMinutesToKorean(a.durationMinutes) : (a.checkIn ? '학습중' : '-');
        msg += `• ${a.date}: ${a.checkIn || '-'} ~ ${a.checkOut || '-'} (${dur}) [${a.status}]\n`;
      });
    }
    alert(msg);
  }
};

// 전역 토스트 알림 함수
window.showToast = (message) => {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2600);
};

window.App = App;
