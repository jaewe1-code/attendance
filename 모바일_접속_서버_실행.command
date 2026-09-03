#!/bin/bash
cd "$(dirname "$0")"

# 현재 IP 주소 확인
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)

echo "====================================================="
echo "   📱 EduCheck 공부방 출석관리 모바일 접속 서버      "
echo "====================================================="
echo ""
echo "같은 Wi-Fi(공유기)에 연결된 스마트폰/태블릿 브라우저에서"
echo "아래 주소로 접속해주세요:"
echo ""
echo "👉 http://${IP}:8080"
echo ""
echo "-----------------------------------------------------"
echo "※ 종료하시려면 이 창을 닫거나 Ctrl + C 를 누르세요."
echo "====================================================="
echo ""

python3 -m http.server 8080
