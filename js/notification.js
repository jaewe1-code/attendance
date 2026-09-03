/**
 * EduCheck - Notification & Message Helper Module
 * 학부모 안심 등·하원 알림 문자/카카오톡 템플릿 생성 및 전송 지원
 */

const NotificationManager = {
  // 알림 메시지 생성
  createMessage(student, attendance, type = 'checkIn') {
    if (!student) return '';
    const studentName = student.name;
    const today = attendance ? attendance.date : window.getTodayString();

    if (type === 'checkIn') {
      const time = attendance?.checkIn || window.getCurrentTimeString();
      return `[공부방 등원알림]\n안녕하세요, ${studentName} 학생 학부모님.\n${studentName} 학생이 오늘 ${time}에 공부방에 안전하게 도착하여 학습을 시작하였습니다.`;
    } else if (type === 'checkOut') {
      const checkInTime = attendance?.checkIn || '-';
      const checkOutTime = attendance?.checkOut || window.getCurrentTimeString();
      
      let durationStr = '';
      if (attendance?.durationMinutes > 0) {
        durationStr = window.formatMinutesToKorean(attendance.durationMinutes);
      } else if (checkInTime !== '-') {
        const dur = window.calculateDurationMinutes(checkInTime, checkOutTime);
        durationStr = window.formatMinutesToKorean(dur);
      } else {
        durationStr = '확인중';
      }

      return `[공부방 하원알림]\n안녕하세요, ${studentName} 학생 학부모님.\n${studentName} 학생이 오늘 학습을 마치고 ${checkOutTime}에 하원하였습니다.\n- 등원: ${checkInTime}\n- 하원: ${checkOutTime}\n- 총 학습시간: ${durationStr}\n오늘도 수고 많았습니다.`;
    } else if (type === 'status') {
      const statusText = attendance?.status === 'late' ? '지각' : 
                         attendance?.status === 'absent' ? '결석' : 
                         attendance?.status === 'supplement' ? '보강수업' : '출결변동';
      const memo = attendance?.memo ? `\n- 사유/메모: ${attendance.memo}` : '';
      return `[공부방 출결알림]\n안녕하세요, ${studentName} 학생 학부모님.\n금일(${today}) ${studentName} 학생 출결 사항 안내드립니다.\n- 상태: ${statusText}${memo}\n문의사항이 있으시면 언제든 연락주세요.`;
    }

    return '';
  },

  // 메시지 복사
  copyMessage(text) {
    if (!navigator.clipboard) {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      window.showToast?.('📋 알림 메시지가 복사되었습니다.');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      window.showToast?.('📋 알림 메시지가 클립보드에 복사되었습니다.');
    }).catch(err => {
      console.error('Clipboard copy error', err);
      window.showToast?.('복사에 실패했습니다.');
    });
  },

  // 모바일 SMS 바로 열기
  sendSMS(parentPhone, message) {
    if (!parentPhone) {
      alert('학부모 연락처가 등록되어 있지 않습니다.');
      return;
    }
    const cleanPhone = parentPhone.replace(/[^0-9]/g, '');
    const encodedBody = encodeURIComponent(message);
    
    // iOS and Android compatible SMS link
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const separator = isIOS ? '&' : '?';
    window.location.href = `sms:${cleanPhone}${separator}body=${encodedBody}`;
  }
};

window.NotificationManager = NotificationManager;
