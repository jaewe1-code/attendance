/**
 * EduCheck - Simple Password Authentication & Screen Lock Manager
 * 간단 비밀번호 로그인, 화면 잠금/해제, 보안 설정 관리
 */

const AUTH_STORAGE_KEY = 'educheck_auth_v2';
const AUTH_SESSION_KEY = 'educheck_session_auth';

class AuthManager {
  constructor() {
    this.authConfig = {
      enabled: false,
      pin: '', // Base64 encoded PIN
      hint: '',
      createdAt: null
    };
    this.currentInput = '';
    this.isLocked = false;
  }

  init() {
    this.loadAuthConfig();
    this.renderSettingsUI();
    this.bindEvents();
    this.checkInitialLock();
  }

  // 설정 로드
  loadAuthConfig() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      try {
        this.authConfig = JSON.parse(raw);
      } catch (e) {
        console.error('Failed to parse auth config:', e);
      }
    }
  }

  // 설정 저장
  saveAuthConfig() {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.authConfig));
    this.renderSettingsUI();
    this.updateHeaderLockButton();
  }

  // 비밀번호 등록 여부
  hasPassword() {
    return Boolean(this.authConfig && this.authConfig.enabled && this.authConfig.pin);
  }

  // 비밀번호 인코딩 (간단 난독화)
  encodePin(pin) {
    try {
      return btoa(encodeURIComponent(pin.trim()));
    } catch (e) {
      return pin.trim();
    }
  }

  // 비밀번호 디코딩
  decodePin(encoded) {
    try {
      return decodeURIComponent(atob(encoded));
    } catch (e) {
      return encoded;
    }
  }

  // 비밀번호 검증
  verifyPassword(inputPin) {
    if (!this.hasPassword()) return true;
    const storedPin = this.decodePin(this.authConfig.pin);
    return storedPin === inputPin.trim();
  }

  // 세션 인증 여부 확인
  isSessionAuthenticated() {
    return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';
  }

  // 초기 잠금 상태 확인
  checkInitialLock() {
    this.updateHeaderLockButton();
    if (this.hasPassword()) {
      if (!this.isSessionAuthenticated()) {
        this.showLockOverlay();
      } else {
        this.hideLockOverlay();
      }
    } else {
      this.hideLockOverlay();
    }
  }

  // 상단 헤더 자물쇠 버튼 상태 동기화
  updateHeaderLockButton() {
    const lockBtn = document.getElementById('btnAppLock');
    if (!lockBtn) return;

    if (this.hasPassword()) {
      lockBtn.style.display = 'inline-flex';
      lockBtn.title = '화면 잠그기 (로그아웃)';
      lockBtn.innerHTML = '<i data-lucide="lock"></i>';
    } else {
      lockBtn.style.display = 'inline-flex';
      lockBtn.title = '비밀번호 설정';
      lockBtn.innerHTML = '<i data-lucide="shield"></i>';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // 화면 잠금 (로그아웃)
  lock() {
    if (!this.hasPassword()) {
      this.openPasswordModal('create');
      return;
    }
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    this.currentInput = '';
    this.updatePinDisplay();
    this.showLockOverlay();
    window.showToast?.('🔒 화면이 잠겼습니다.');
  }

  // 잠금 해제 (로그인)
  unlock(inputPin) {
    const pinToTest = inputPin !== undefined ? inputPin : this.currentInput;
    if (this.verifyPassword(pinToTest)) {
      sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
      this.isLocked = false;
      this.hideLockOverlay();
      this.currentInput = '';
      this.updatePinDisplay();
      window.showToast?.('🔓 정상 로그인되었습니다.');
      return true;
    } else {
      this.triggerShakeAnimation();
      window.showToast?.('❌ 비밀번호가 올바르지 않습니다.');
      this.currentInput = '';
      this.updatePinDisplay();
      return false;
    }
  }

  // 잠금 오버레이 표시
  showLockOverlay() {
    this.isLocked = true;
    const overlay = document.getElementById('authLockOverlay');
    if (overlay) {
      overlay.classList.add('active');
      overlay.style.display = 'flex';
      this.currentInput = '';
      this.updatePinDisplay();
      
      const pinInput = document.getElementById('authPasswordInput');
      if (pinInput) {
        pinInput.value = '';
        setTimeout(() => pinInput.focus(), 150);
      }

      // 힌트 표시
      const hintEl = document.getElementById('authHintText');
      if (hintEl) {
        if (this.authConfig.hint) {
          hintEl.textContent = `💡 힌트: ${this.authConfig.hint}`;
          hintEl.style.display = 'block';
        } else {
          hintEl.style.display = 'none';
        }
      }
    }
  }

  // 잠금 오버레이 숨김
  hideLockOverlay() {
    this.isLocked = false;
    const overlay = document.getElementById('authLockOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => {
        if (!this.isLocked) {
          overlay.style.display = 'none';
        }
      }, 250);
    }
  }

  // 키패드 입력 업데이트
  inputDigit(digit) {
    if (this.currentInput.length < 12) {
      this.currentInput += digit;
      this.updatePinDisplay();

      // 등록된 비밀번호 길이와 같아졌을 때 자동 검증 (4~8자리)
      const storedPin = this.decodePin(this.authConfig.pin || '');
      if (storedPin && this.currentInput.length === storedPin.length) {
        setTimeout(() => {
          this.unlock();
        }, 100);
      }
    }
  }

  // 키패드 백스페이스
  backspace() {
    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
      this.updatePinDisplay();
    }
  }

  // 키패드 전체 삭제
  clearInput() {
    this.currentInput = '';
    this.updatePinDisplay();
  }

  // PIN 디스플레이 갱신
  updatePinDisplay() {
    const dotsContainer = document.getElementById('authPinDots');
    const inputEl = document.getElementById('authPasswordInput');
    
    if (inputEl) {
      inputEl.value = this.currentInput;
    }

    if (dotsContainer) {
      const storedPin = this.decodePin(this.authConfig.pin || '');
      const dotCount = Math.max(4, storedPin.length || 4);
      let dotsHtml = '';
      for (let i = 0; i < dotCount; i++) {
        if (i < this.currentInput.length) {
          dotsHtml += '<div class="pin-dot filled"></div>';
        } else {
          dotsHtml += '<div class="pin-dot"></div>';
        }
      }
      dotsContainer.innerHTML = dotsHtml;
    }
  }

  // 오류 시 흔들림 애니메이션
  triggerShakeAnimation() {
    const card = document.querySelector('.auth-card');
    if (card) {
      card.classList.remove('shake-anim');
      void card.offsetWidth; // 트리거 reflow
      card.classList.add('shake-anim');
      if (navigator.vibrate) navigator.vibrate(200);
    }
  }

  // 설정 화면 UI 렌더링
  renderSettingsUI() {
    const statusTextEl = document.getElementById('authStatusBadge');
    const btnSetPw = document.getElementById('btnSetPassword');
    const btnDisablePw = document.getElementById('btnDisablePassword');

    if (!statusTextEl) return;

    if (this.hasPassword()) {
      statusTextEl.innerHTML = '<span class="badge badge-present" style="font-size:0.8rem; padding:4px 10px;">🔒 비밀번호 사용 중</span>';
      if (btnSetPw) btnSetPw.textContent = '비밀번호 변경';
      if (btnDisablePw) btnDisablePw.style.display = 'inline-flex';
    } else {
      statusTextEl.innerHTML = '<span class="badge" style="background:#f1f5f9; color:#64748b; font-size:0.8rem; padding:4px 10px;">🔓 비밀번호 미사용</span>';
      if (btnSetPw) btnSetPw.textContent = '비밀번호 설정하기';
      if (btnDisablePw) btnDisablePw.style.display = 'none';
    }
  }

  // 비밀번호 설정/변경 모달 열기
  openPasswordModal(mode = 'create') {
    const modal = document.getElementById('passwordSettingsModal');
    const form = document.getElementById('passwordSettingsForm');
    const currentGroup = document.getElementById('currentPasswordGroup');
    const modalTitle = document.getElementById('passwordModalTitle');

    if (!modal || !form) return;

    form.reset();

    if (this.hasPassword()) {
      modalTitle.textContent = '비밀번호 변경';
      if (currentGroup) currentGroup.style.display = 'block';
      const currInput = document.getElementById('modalCurrentPassword');
      if (currInput) currInput.required = true;
    } else {
      modalTitle.textContent = '비밀번호 설정';
      if (currentGroup) currentGroup.style.display = 'none';
      const currInput = document.getElementById('modalCurrentPassword');
      if (currInput) currInput.required = false;
    }

    modal.classList.add('active');
  }

  // 비밀번호 설정/변경 모달 닫기
  closePasswordModal() {
    const modal = document.getElementById('passwordSettingsModal');
    if (modal) modal.classList.remove('active');
  }

  // 비밀번호 저장 처리
  handleSavePassword(e) {
    e.preventDefault();
    const currInput = document.getElementById('modalCurrentPassword');
    const newInput = document.getElementById('modalNewPassword');
    const confirmInput = document.getElementById('modalConfirmPassword');
    const hintInput = document.getElementById('modalPasswordHint');

    const newPw = (newInput?.value || '').trim();
    const confirmPw = (confirmInput?.value || '').trim();
    const hint = (hintInput?.value || '').trim();

    // 기존 비밀번호 검증 (이미 설정되어 있는 경우)
    if (this.hasPassword()) {
      const currPw = (currInput?.value || '').trim();
      if (!this.verifyPassword(currPw)) {
        alert('현재 비밀번호가 일치하지 않습니다.');
        currInput?.focus();
        return;
      }
    }

    if (!newPw) {
      alert('새 비밀번호를 입력해주세요.');
      newInput?.focus();
      return;
    }

    if (newPw.length < 4) {
      alert('비밀번호는 최소 4자리 이상으로 설정해주세요.');
      newInput?.focus();
      return;
    }

    if (newPw !== confirmPw) {
      alert('새 비밀번호와 확인 입력이 일치하지 않습니다.');
      confirmInput?.focus();
      return;
    }

    // 저장
    this.authConfig = {
      enabled: true,
      pin: this.encodePin(newPw),
      hint: hint,
      updatedAt: new Date().toISOString()
    };
    this.saveAuthConfig();
    sessionStorage.setItem(AUTH_SESSION_KEY, 'true');

    this.closePasswordModal();
    window.showToast?.('✅ 비밀번호가 성공적으로 저장되었습니다.');
  }

  // 비밀번호 해제 (사용 안 함)
  disablePassword() {
    if (!this.hasPassword()) return;

    const inputPw = prompt('비밀번호 보호를 해제하려면 현재 비밀번호를 입력하세요:');
    if (inputPw === null) return;

    if (this.verifyPassword(inputPw)) {
      this.authConfig = {
        enabled: false,
        pin: '',
        hint: '',
        updatedAt: new Date().toISOString()
      };
      this.saveAuthConfig();
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      this.hideLockOverlay();
      window.showToast?.('🔓 비밀번호 보호가 해제되었습니다.');
    } else {
      alert('비밀번호가 일치하지 않아 해제할 수 없습니다.');
    }
  }

  // 이벤트 바인딩
  bindEvents() {
    // 1. 상단 헤더 자물쇠 버튼
    const headerLockBtn = document.getElementById('btnAppLock');
    if (headerLockBtn) {
      headerLockBtn.addEventListener('click', () => {
        if (this.hasPassword()) {
          this.lock();
        } else {
          this.openPasswordModal('create');
        }
      });
    }

    // 2. 키패드 숫자 버튼
    document.querySelectorAll('.auth-key-btn[data-num]').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-num');
        this.inputDigit(num);
      });
    });

    // 3. 키패드 백스페이스 & 클리어
    document.getElementById('authKeyBackspace')?.addEventListener('click', () => {
      this.backspace();
    });
    document.getElementById('authKeyClear')?.addEventListener('click', () => {
      this.clearInput();
    });

    // 4. 키보드 비밀번호 입력창 엔터 키 지원
    const pwInput = document.getElementById('authPasswordInput');
    if (pwInput) {
      pwInput.addEventListener('input', (e) => {
        this.currentInput = e.target.value;
        this.updatePinDisplay();
      });
      pwInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.unlock();
        }
      });
    }

    // 5. 잠금 해제 확인 버튼
    document.getElementById('btnAuthUnlock')?.addEventListener('click', () => {
      this.unlock();
    });

    // 6. 설정 탭 내 버튼들
    document.getElementById('btnSetPassword')?.addEventListener('click', () => {
      this.openPasswordModal();
    });
    document.getElementById('btnDisablePassword')?.addEventListener('click', () => {
      this.disablePassword();
    });
    document.getElementById('btnLockNowSettings')?.addEventListener('click', () => {
      this.lock();
    });

    // 7. 비밀번호 설정 모달 제출
    document.getElementById('passwordSettingsForm')?.addEventListener('submit', (e) => {
      this.handleSavePassword(e);
    });

    // 8. 잠금 화면에서 키오스크 모드로 바로가기 (옵션)
    document.getElementById('btnAuthGoKiosk')?.addEventListener('click', () => {
      this.hideLockOverlay();
      window.App?.switchTab('kiosk');
      window.showToast?.('📱 학생 셀프 출석 키오스크 모드로 진입했습니다.');
    });
  }
}

// 전역 인스턴스 등록
window.AuthManager = new AuthManager();
