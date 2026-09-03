/**
 * EduCheck - Excel Import / Export Module (SheetJS XLSX Integration)
 * 엑셀 파일 생성, 다운로드, 학생 명단 일괄 업로드 기능
 */

const ExcelManager = {
  // 1. 일간 출석부 엑셀 내보내기
  exportDailyAttendance(dateStr = window.getTodayString()) {
    if (typeof XLSX === 'undefined') {
      alert('엑셀 라이브러리(SheetJS)가 아직 로드되지 않았습니다.');
      return;
    }

    const students = window.store.getStudents();
    const attendances = window.store.getAttendancesByDate(dateStr);

    const rows = [
      ['공부방 일일 출석 현황표'],
      [`기준 일자: ${dateStr}`],
      [], // 빈 줄
      ['번호', '구분', '학년', '이름', '연락처', '입실시간', '퇴실시간', '학습시간', '상태', '비고']
    ];

    students.forEach((std, idx) => {
      const att = attendances.find(a => a.studentId === std.id);
      
      let statusKr = '미출석';
      let checkIn = '-';
      let checkOut = '-';
      let durationStr = '-';
      let memo = '';

      if (att) {
        checkIn = att.checkIn || '-';
        checkOut = att.checkOut || (att.checkIn ? '학습중' : '-');
        
        if (att.status === 'present') statusKr = att.checkOut ? '퇴실완료' : '재실(학습중)';
        else if (att.status === 'late') statusKr = '지각';
        else if (att.status === 'early_leave') statusKr = '조퇴';
        else if (att.status === 'absent') statusKr = '결석';
        else if (att.status === 'supplement') statusKr = '보강';

        if (att.durationMinutes > 0) {
          durationStr = window.formatMinutesToKorean(att.durationMinutes);
        } else if (att.checkIn && !att.checkOut) {
          const currentM = window.calculateDurationMinutes(att.checkIn, window.getCurrentTimeString());
          durationStr = `${window.formatMinutesToKorean(currentM)} (진행중)`;
        }
        memo = att.memo || '';
      }

      rows.push([
        idx + 1,
        std.level,
        std.grade,
        std.name,
        std.phone || std.parentPhone || '',
        checkIn,
        checkOut,
        durationStr,
        statusKr,
        memo
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 6 },  // 번호
      { wch: 8 },  // 구분
      { wch: 8 },  // 학년
      { wch: 10 }, // 이름
      { wch: 15 }, // 연락처
      { wch: 10 }, // 입실시간
      { wch: 10 }, // 퇴실시간
      { wch: 14 }, // 학습시간
      { wch: 12 }, // 상태
      { wch: 25 }  // 비고
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `출석부_${dateStr}`);

    const fileName = `공부방_출석부_${dateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    window.showToast?.(`✅ ${fileName} 다운로드가 완료되었습니다.`);
  },

  // 2. 월간 학생별 종합 통계 엑셀 내보내기
  exportMonthlyReport(yearMonth = null) {
    if (typeof XLSX === 'undefined') {
      alert('엑셀 라이브러리가 로드되지 않았습니다.');
      return;
    }

    if (!yearMonth) {
      const today = window.getTodayString();
      yearMonth = today.slice(0, 7); // 'YYYY-MM'
    }

    const students = window.store.getStudents();
    const allAtt = window.store.attendances.filter(a => a.date && a.date.startsWith(yearMonth));

    const rows = [
      [`공부방 ${yearMonth} 월간 학습 및 출결 종합 리포트`],
      [`생성일: ${window.getTodayString()}`],
      [],
      ['번호', '구분', '학년', '이름', '출석일수', '총 학습시간(분)', '총 학습시간(표시)', '지각/보강', '학부모 연락처', '특이사항']
    ];

    students.forEach((std, idx) => {
      const studentAtts = allAtt.filter(a => a.studentId === std.id);
      
      const presentDays = studentAtts.filter(a => a.status === 'present' || a.status === 'supplement').length;
      const lateDays = studentAtts.filter(a => a.status === 'late').length;
      const totalMinutes = studentAtts.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
      
      rows.push([
        idx + 1,
        std.level,
        std.grade,
        std.name,
        `${presentDays}일`,
        totalMinutes,
        window.formatMinutesToKorean(totalMinutes),
        lateDays > 0 ? `지각 ${lateDays}회` : '-',
        std.parentPhone || '',
        std.memo || ''
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 8 },
      { wch: 8 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      { wch: 16 },
      { wch: 25 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `월간통계_${yearMonth}`);
    const fileName = `공부방_월간리포트_${yearMonth}.xlsx`;
    XLSX.writeFile(wb, fileName);
    window.showToast?.(`✅ ${fileName} 파일이 저장되었습니다.`);
  },

  // 3. 학생 명단 엑셀 등록용 템플릿 다운로드
  downloadStudentTemplate() {
    if (typeof XLSX === 'undefined') return;
    const templateRows = [
      ['이름*', '구분(초등/중등/고등)*', '학년(예: 초5, 중2, 고1)', '학생연락처', '학부모연락처*', '주당목표시간(시간단위)', '특이사항메모'],
      ['홍길동', '초등', '초5', '010-1111-2222', '010-3333-4444', 8, '월/수 17:00 등원'],
      ['이순신', '중등', '중2', '010-5555-6666', '010-7777-8888', 12, '수학 집중반'],
      ['강감찬', '고등', '고1', '010-9999-0000', '010-1234-5678', 18, '평일 19:30 등원']
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateRows);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 22 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 25 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '학생등록양식');
    XLSX.writeFile(wb, '공부방_학생등록_양식.xlsx');
    window.showToast?.('📥 엑셀 등록 양식이 다운로드되었습니다.');
  },

  // 4. 학생 명단 엑셀 파일 읽어서 일괄 등록
  importStudentsFromExcel(file, callback) {
    if (typeof XLSX === 'undefined') {
      alert('엑셀 라이브러리가 로드되지 않았습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // JSON으로 파싱 (첫 행 헤더 기준)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (!jsonData || jsonData.length <= 1) {
          alert('엑셀 파일에 유효한 학생 데이터가 없습니다.');
          return;
        }

        // 헤더 다음 행부터 처리
        let addedCount = 0;
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const name = row[0] ? String(row[0]).trim() : '';
          if (!name) continue;

          const level = row[1] ? String(row[1]).trim() : '초등';
          const grade = row[2] ? String(row[2]).trim() : '';
          const phone = row[3] ? String(row[3]).trim() : '';
          const parentPhone = row[4] ? String(row[4]).trim() : '';
          const targetHours = Number(row[5]) || 10;
          const memo = row[6] ? String(row[6]).trim() : '';

          window.store.addStudent({
            name,
            level,
            grade,
            phone,
            parentPhone,
            weeklyTargetHours: targetHours,
            memo
          });
          addedCount++;
        }

        if (callback) callback(addedCount);
      } catch (err) {
        console.error('Excel parse error', err);
        alert('엑셀 파일을 읽는 중 오류가 발생했습니다. 양식을 확인해주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
  }
};

window.ExcelManager = ExcelManager;
