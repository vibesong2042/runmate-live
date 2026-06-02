# Running Mate Codex Project Guide

이 Project는 러닝 메이트 앱 개발 전용 작업 공간입니다.

## Recommended New Chats

- 앱 전체 기획/로드맵: MVP 우선순위, 기능 정의, 출시 단계
- 친구 초대/친구 관리: 초대 코드, 친구 목록, 친구 상태
- 실시간 위치 공유/WebSocket: 라이브 러닝, 위치 동기화, 네트워크 장애 대응
- UI/UX 개선: 화면 구조, Android safe area, 상태 표시, 사용성
- 테스트/배포/GitHub: typecheck, build, test, Android bundle, PR/CI 관리

## Working Rules

- 수정 전 전체 흐름을 먼저 확인한다.
- 바로 앞의 오류만 고치지 말고 관련 화면, API 계약, 테스트, 빌드 영향까지 같이 본다.
- 기능 추가 후 `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test`를 우선 확인한다.
- 모바일 런타임 영향이 있으면 Android Expo export도 확인한다.
- 위치정보, 친구관계, 러닝 기록은 개인정보로 취급한다.
- UI 대규모 리디자인은 MVP 기능 안정화 이후 진행한다.
