/**
 * EduCheck - Student Management Module
 * 학생 목록 조회, 초·중·고 학년별 세분화 필터링, 신규 등록, 수정, 삭제 로직
 */

const StudentsManager = {
  currentFilter: 'all', // 'all', '초등', '중등', '고등'
  currentGradeFilter: 'all', // 'all', '초5'~'초6', '중1'~'중3', '고1'~'고3'
  searchKeyword: '',

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // 1. 초/중/고 필터 칩 클릭
    const filterChips = document.querySelectorAll('#studentFilterChips .chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        filterChips.forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.dataset.filter;
        this.currentGradeFilter = 'all'; // 학교급 변경 시 학년 필터 초기화
        this.render();
      });
    });

    // 2. 검색 입력
    const searchInput = document.getElementById('studentSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchKeyword = e.target.value.trim().toLowerCase();
        this.render();
      });
    }

    // 3. 학생 등록 폼 학교급 변경 시 학년 드롭다운 동적 갱신
    const modalLevel = document.getElementById('modalStudentLevel');
    if (modalLevel) {
      modalLevel.addEventListener('change', () => {
        this.updateModalGradeOptions();
      });
    }

    // 4. 학생 등록 폼 제출
    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
      studentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveStudent();
      });
    }
  },

  // 모달 내 학년 드롭다운 옵션 동적 업데이트
  updateModalGradeOptions(selectedGrade = '') {
    const levelSelect = document.getElementById('modalStudentLevel');
    const gradeSelect = document.getElementById('modalStudentGrade');
    if (!levelSelect || !gradeSelect) return;

    const level = levelSelect.value || '초등';
    const grades = window.getGradesForLevel ? window.getGradesForLevel(level) : (level === '초등' ? ['초5', '초6'] : level === '중등' ? ['중1', '중2', '중3'] : ['고1', '고2', '고3']);
    
    const normSelected = window.normalizeGrade ? window.normalizeGrade(level, selectedGrade) : selectedGrade;

    gradeSelect.innerHTML = grades.map(g => {
      const isSelected = normSelected ? (g === normSelected) : false;
      return `<option value="${g}" ${isSelected ? 'selected' : ''}>${g} (${level === '초등' ? '초등학교 ' : level === '중등' ? '중학교 ' : '고등학교 '}${g.replace(/[^0-9]/g, '')}학년)</option>`;
    }).join('');

    if (normSelected && !grades.includes(normSelected)) {
      // 기타/직접 입력 값이 있는 경우 옵션 추가
      const opt = document.createElement('option');
      opt.value = normSelected;
      opt.textContent = normSelected;
      opt.selected = true;
      gradeSelect.appendChild(opt);
    }
  },

  // 학년 서브 필터 칩 렌더링
  renderGradeFilterChips(allStudents) {
    const container = document.getElementById('studentGradeChips');
    if (!container) return;

    let availableGrades = [];
    if (this.currentFilter === '초등') {
      availableGrades = ['초5', '초6'];
    } else if (this.currentFilter === '중등') {
      availableGrades = ['중1', '중2', '중3'];
    } else if (this.currentFilter === '고등') {
      availableGrades = ['고1', '고2', '고3'];
    } else {
      availableGrades = ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
    }

    // 각 학년별 인원수 계산
    const gradeCounts = {};
    availableGrades.forEach(g => { gradeCounts[g] = 0; });
    allStudents.forEach(s => {
      if (s.grade && gradeCounts[s.grade] !== undefined) {
        gradeCounts[s.grade]++;
      }
    });

    const levelPrefix = this.currentFilter === 'all' ? '전체 학년' : `${this.currentFilter} 전체`;
    const totalCountInLevel = this.currentFilter === 'all' 
      ? allStudents.length 
      : allStudents.filter(s => s.level === this.currentFilter).length;

    let html = `
      <button class="chip ${this.currentGradeFilter === 'all' ? 'active' : ''}" data-grade="all">
        ${levelPrefix} <span style="font-size:0.75rem; opacity:0.85;">(${totalCountInLevel})</span>
      </button>
    `;

    availableGrades.forEach(g => {
      const cnt = gradeCounts[g] || 0;
      html += `
        <button class="chip ${this.currentGradeFilter === g ? 'active' : ''}" data-grade="${g}">
          ${g} <span style="font-size:0.75rem; opacity:0.85;">(${cnt})</span>
        </button>
      `;
    });

    container.innerHTML = html;

    // 학년 칩 클릭 이벤트 바인딩
    const chips = container.querySelectorAll('.chip');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        chips.forEach(c => c.classList.remove('active'));
        const btn = e.currentTarget;
        btn.classList.add('active');
        this.currentGradeFilter = btn.dataset.grade;
        this.render();
      });
    });
  },

  render() {
    const container = document.getElementById('studentListContainer');
    if (!container) return;

    let allStudents = window.store.getStudents();
    this.renderGradeFilterChips(allStudents);

    let students = [...allStudents];

    // 1. 구분(초/중/고) 필터링
    if (this.currentFilter !== 'all') {
      students = students.filter(s => s.level === this.currentFilter);
    }

    // 2. 세부 학년 필터링 (초5~초6, 중1~중3, 고1~고3)
    if (this.currentGradeFilter !== 'all') {
      students = students.filter(s => s.grade === this.currentGradeFilter);
    }

    // 3. 검색어 필터링
    if (this.searchKeyword) {
      students = students.filter(s => 
        s.name.toLowerCase().includes(this.searchKeyword) ||
        (s.phone && s.phone.includes(this.searchKeyword)) ||
        (s.parentPhone && s.parentPhone.includes(this.searchKeyword)) ||
        (s.grade && s.grade.toLowerCase().includes(this.searchKeyword))
      );
    }

    // 학생 수 배지 업데이트
    const countBadge = document.getElementById('studentTotalCount');
    if (countBadge) countBadge.textContent = `${students.length}명`;

    if (students.length === 0) {
      const filterName = this.currentGradeFilter !== 'all' ? `[${this.currentGradeFilter}] ` : (this.currentFilter !== 'all' ? `[${this.currentFilter}부] ` : '');
      container.innerHTML = `
        <div class="card text-center" style="padding: 40px 20px;">
          <p style="color: var(--text-muted); font-size: 0.95rem;">${filterName}해당 조건의 등록된 학생이 없습니다.</p>
          <button class="btn btn-primary btn-sm" style="margin: 14px auto 0 auto;" onclick="StudentsManager.openAddModal()">
            <i data-lucide="user-plus"></i> 학생 새로 등록
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let html = '';
    students.forEach(std => {
      const avatarClass = std.level === '초등' ? 'elem' : std.level === '중등' ? 'middle' : 'high';
      const initial = std.name ? std.name.slice(0, 1) : '?';
      
      // 누적 학습 시간 계산
      const allAtts = window.store.attendances.filter(a => a.studentId === std.id);
      const totalMinutes = allAtts.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
      const attendanceDays = allAtts.filter(a => a.status === 'present' || a.status === 'supplement').length;
      const schSummary = DataStore.formatScheduleText(std.schedules);
      const gradeText = std.grade ? `${std.level} · ${std.grade}` : std.level;

      html += `
        <div class="student-card">
          <div class="student-card-top">
            <div class="student-profile">
              <div class="student-avatar ${avatarClass}">${initial}</div>
              <div class="student-meta">
                <h3>
                  ${std.name}
                  <span class="badge badge-school">${gradeText}</span>
                </h3>
                <div class="sub-info">
                  <span>📱 ${std.parentPhone ? '학부모: ' + std.parentPhone : (std.phone || '연락처 없음')}</span>
                </div>
                ${schSummary ? `
                  <div style="margin-top: 4px;">
                    <span class="badge" style="background:#eef2ff; color:var(--primary); font-size:0.75rem; padding: 2px 8px; border-radius: var(--radius-full);">
                      🕒 ${schSummary}
                    </span>
                  </div>
                ` : ''}
              </div>
            </div>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="StudentsManager.openEditModal('${std.id}')" title="수정">
              <i data-lucide="more-vertical"></i>
            </button>
          </div>

          <div style="font-size: 0.8rem; color: var(--text-muted); background: #f8fafc; padding: 8px 12px; border-radius: var(--radius-sm);">
            <div class="flex-between">
              <span>📅 누적 출석: <strong>${attendanceDays}일</strong></span>
              <span>⏱️ 총 학습: <strong>${window.formatMinutesToKorean(totalMinutes)}</strong></span>
            </div>
            ${std.memo ? `<div style="margin-top: 4px; color: #475569;">💡 ${std.memo}</div>` : ''}
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-sm btn-full" onclick="StudentsManager.openIndividualAttendance('${std.id}')" style="background: #4f46e5;">
              <i data-lucide="calendar-days"></i> 개인출석부·시간표
            </button>
            <button class="btn btn-outline btn-sm" onclick="StudentsManager.openEditModal('${std.id}')">
              <i data-lucide="edit-3"></i> 수정
            </button>
            <button class="btn btn-danger btn-sm" onclick="StudentsManager.deleteStudent('${std.id}', '${std.name}')">
              <i data-lucide="trash-2"></i> 삭제
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  },

  // 특정 학생의 개인출석부 탭으로 바로 이동
  openIndividualAttendance(studentId) {
    if (window.IndividualAttendanceManager) {
      window.IndividualAttendanceManager.selectStudent(studentId);
    }
    if (window.App) {
      window.App.switchTab('individual');
    }
  },

  // 학생 등록 모달 열기
  openAddModal() {
    const modal = document.getElementById('studentModal');
    const form = document.getElementById('studentForm');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('modalStudentId').value = '';
    document.getElementById('studentModalTitle').textContent = '새 학생 등록';
    document.getElementById('modalStudentLevel').value = '초등';
    this.updateModalGradeOptions('초5');
    modal.classList.add('active');
  },

  // 학생 수정 모달 열기
  openEditModal(id) {
    const student = window.store.getStudentById(id);
    if (!student) return;

    const modal = document.getElementById('studentModal');
    if (!modal) return;

    document.getElementById('studentModalTitle').textContent = '학생 정보 수정';
    document.getElementById('modalStudentId').value = student.id;
    document.getElementById('modalStudentName').value = student.name;
    document.getElementById('modalStudentLevel').value = student.level || '초등';
    this.updateModalGradeOptions(student.grade || '');
    document.getElementById('modalStudentPhone').value = student.phone || '';
    document.getElementById('modalParentPhone').value = student.parentPhone || '';
    document.getElementById('modalTargetHours').value = student.weeklyTargetHours || 10;
    document.getElementById('modalStudentMemo').value = student.memo || '';

    modal.classList.add('active');
  },

  // 모달 닫기
  closeModal() {
    const modal = document.getElementById('studentModal');
    if (modal) modal.classList.remove('active');
  },

  // 저장 (추가 또는 수정)
  handleSaveStudent() {
    const id = document.getElementById('modalStudentId').value;
    const name = document.getElementById('modalStudentName').value.trim();
    const level = document.getElementById('modalStudentLevel').value;
    const grade = document.getElementById('modalStudentGrade').value.trim();
    const phone = document.getElementById('modalStudentPhone').value.trim();
    const parentPhone = document.getElementById('modalParentPhone').value.trim();
    const weeklyTargetHours = Number(document.getElementById('modalTargetHours').value) || 10;
    const memo = document.getElementById('modalStudentMemo').value.trim();

    if (!name) {
      alert('학생 이름을 입력해주세요.');
      return;
    }

    const data = {
      name,
      level,
      grade,
      phone,
      parentPhone,
      weeklyTargetHours,
      memo
    };

    if (id) {
      window.store.updateStudent(id, data);
      window.showToast?.(`✅ ${name} (${data.grade || data.level}) 학생 정보가 수정되었습니다.`);
    } else {
      window.store.addStudent(data);
      window.showToast?.(`🎉 ${name} (${data.grade || data.level}) 학생이 새로 등록되었습니다.`);
    }

    this.closeModal();
    this.render();
    if (window.AttendanceManager) {
      window.AttendanceManager.render();
    }
    if (window.IndividualAttendanceManager) {
      window.IndividualAttendanceManager.render();
    }
  },

  // 학생 삭제
  deleteStudent(id, name) {
    if (confirm(`'${name}' 학생을 삭제하시겠습니까?\n(등록된 출결 기록도 모두 삭제됩니다)`)) {
      window.store.deleteStudent(id);
      window.showToast?.(`🗑️ ${name} 학생이 삭제되었습니다.`);
      this.render();
      if (window.AttendanceManager) {
        window.AttendanceManager.render();
      }
      if (window.IndividualAttendanceManager) {
        window.IndividualAttendanceManager.setDefaultStudent();
        window.IndividualAttendanceManager.render();
      }
    }
  }
};

window.StudentsManager = StudentsManager;


