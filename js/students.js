/**
 * EduCheck - Student Management Module
 * 학생 목록 조회, 필터링, 신규 등록, 수정, 삭제 로직
 */

const StudentsManager = {
  currentFilter: 'all', // 'all', '초등', '중등', '고등'
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

    // 3. 학생 등록 폼 제출
    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
      studentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveStudent();
      });
    }
  },

  render() {
    const container = document.getElementById('studentListContainer');
    if (!container) return;

    let students = window.store.getStudents();

    // 1. 구분(초/중/고) 필터링
    if (this.currentFilter !== 'all') {
      students = students.filter(s => s.level === this.currentFilter);
    }

    // 2. 검색어 필터링
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
      container.innerHTML = `
        <div class="card text-center" style="padding: 40px 20px;">
          <p style="color: var(--text-muted); font-size: 0.95rem;">등록된 학생이 없거나 조건에 맞는 학생이 없습니다.</p>
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

      html += `
        <div class="student-card">
          <div class="student-card-top">
            <div class="student-profile">
              <div class="student-avatar ${avatarClass}">${initial}</div>
              <div class="student-meta">
                <h3>
                  ${std.name}
                  <span class="badge badge-school">${std.level} · ${std.grade || '전체'}</span>
                </h3>
                <div class="sub-info">
                  <span>📱 ${std.parentPhone ? '학부모: ' + std.parentPhone : (std.phone || '연락처 없음')}</span>
                </div>
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
            <button class="btn btn-outline btn-sm btn-full" onclick="StudentsManager.openEditModal('${std.id}')">
              <i data-lucide="edit-3"></i> 정보 수정
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

  // 학생 등록 모달 열기
  openAddModal() {
    const modal = document.getElementById('studentModal');
    const form = document.getElementById('studentForm');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('modalStudentId').value = '';
    document.getElementById('studentModalTitle').textContent = '새 학생 등록';
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
    document.getElementById('modalStudentGrade').value = student.grade || '';
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
      window.showToast?.(`✅ ${name} 학생 정보가 수정되었습니다.`);
    } else {
      window.store.addStudent(data);
      window.showToast?.(`🎉 ${name} 학생이 새로 등록되었습니다.`);
    }

    this.closeModal();
    this.render();
    if (window.AttendanceManager) {
      window.AttendanceManager.render();
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
    }
  }
};

window.StudentsManager = StudentsManager;
