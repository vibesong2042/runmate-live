# RunMate Live Codex 작업 지침

이 문서는 RunMate Live 프로젝트에서 Codex가 작업할 때 따라야 할 고정 원칙이다.
사용자의 최신 요청과 이 문서를 우선하되, 시스템/개발자 지침과 충돌하면 상위 지침을 따른다.

## 1. 공통 작업 원칙

- 사용자의 최신 요청을 우선한다.
- 구현 전 현재 코드, 설정, 빌드 상태, 배포 상태를 먼저 확인한다.
- 작은 문제 하나만 보지 말고 모바일 앱, API, 데이터베이스, 배포, 실제 사용자 흐름에 미치는 영향을 함께 본다.
- 불확실한 내용은 사실처럼 단정하지 않고 `가정:` 또는 `확실치 않음:`으로 표시한다.
- 사용자가 명시적으로 계획만 요청한 경우 코드를 수정하지 않는다.
- 코드 수정이 필요한 요청이면 가능한 범위에서 직접 수정, 검증, 결과 요약까지 진행한다.
- 기존 사용자 변경사항을 되돌리지 않는다.
- 관련 없는 리팩터링, 포맷 변경, 파일 정리는 피한다.
- 임시 해결책이나 workaround를 적용할 때는 이유, 한계, 이후 개선 방향을 설명한다.

## 2. 보안 및 개인정보 원칙

- 위치 정보, 러닝 기록, 친구 관계, 인증 토큰은 개인정보로 취급한다.
- 실시간 위치 공유는 사용자의 명시적 동의와 세션 참여 상태를 기준으로 동작해야 한다.
- API URL, WebSocket URL, Sentry DSN처럼 공개 가능한 설정과 JWT secret, DB URL, Google Maps API key처럼 비공개 설정을 구분한다.
- 비공개 키, 토큰, DB 접속 문자열을 코드에 하드코딩하지 않는다.
- 로그, 화면, 문서에 민감한 토큰이나 DB 접속 문자열을 노출하지 않는다.
- 외부 테스트 환경에서는 HTTPS/WSS를 우선 사용한다.
- 실패 상황에서도 러닝 기록이 불필요하게 유실되지 않도록 로컬 보관 또는 재시도 흐름을 고려한다.
- 빌드 검증이나 자동 테스트에서 운영 서버를 직접 호출하지 않는다. 필요하면 로컬 또는 staging 서버를 사용한다.

## 3. 코드 수정 전 확인할 사항

- `git status --short`로 작업트리 상태를 확인한다.
- 관련 파일을 먼저 읽고 기존 패턴을 따른다.
- 모바일 변경은 Expo SDK, Metro, EAS Build, Android 실제 기기 동작까지 고려한다.
- API 변경은 REST 응답 형식, WebSocket 이벤트, PostgreSQL 마이그레이션, Railway 배포 영향을 확인한다.
- 공유 패키지(`packages/shared`) 변경은 모바일 Metro 번들링과 API TypeScript 빌드 양쪽에서 동작해야 한다.
- 환경변수 변경은 local, preview, production 값을 구분한다.
- 데이터 모델 또는 마이그레이션 변경은 기존 사용자와 기록 삭제 없이 적용되어야 한다.
- 변경 파일 목록은 `git diff --name-only`로 확인하고, 요청 범위를 벗어난 파일은 커밋에 포함하지 않는다.

## 4. 공유 패키지 및 Metro 안정성 원칙

- `packages/shared/src`에서 `.ts` 파일이 `.js` 확장자로 import/export하는 경로는 Metro에서도 해석 가능해야 한다.
- 새 공유 모듈을 추가할 때는 필요한 경우 같은 이름의 `.js` bridge 파일을 함께 둔다.
- `apps/mobile/metro.config.js`는 Expo 기본 설정을 보존하면서 모노레포에 필요한 설정만 추가한다.
- Metro 설정에는 `workspaceRoot`, `watchFolders`, `nodeModulesPaths`가 의도대로 존재하는지 확인한다.
- EAS 빌드 실패 시 먼저 실패 단계를 분리한다.
  - `RUN_EXPO_DOCTOR`: SDK, Metro 설정, Expo 설정 문제
  - `EAGER_BUNDLE`: 모듈 해석, import/export, 번들링 문제
  - Native build: Gradle, native dependency, Android 설정 문제

## 5. UI, API, 빌드 영향 확인 기준

- UI 변경 후에는 작은 Android 화면에서 시스템 하단 내비게이션, 앱 탭바, 주요 버튼이 겹치지 않아야 한다.
- 러닝 화면은 GPS 상태, API/WS 연결 상태, 거리 측정 상태, 오류 원인을 사용자가 이해할 수 있게 보여줘야 한다.
- 친구 초대, 친구 목록, 그룹 러닝, 실시간 위치/페이스, 응원, 종료 저장 흐름이 깨지지 않아야 한다.
- API 변경 후 `/health`, 로그인, 친구 관리, 세션 생성, WebSocket 연결을 확인한다.
- 기본 검증 순서는 다음을 우선한다.
  - `npm run typecheck`
  - `npm run build`
  - `npm run test`
- Windows 로컬에서 실행할 때는 필요에 따라 `npm.cmd`, `npx.cmd`를 사용한다.
- 모바일 번들 검증이 필요한 경우 `apps/mobile`에서 다음을 확인한다.
  - `npx.cmd expo-doctor`
  - `npx.cmd expo export --platform android --output-dir .expo-export-check`
- `.expo-export-check/` 같은 임시 산출물은 커밋하지 않는다.
- APK 링크가 생성되면 실제 설치 후 로그인, 친구 연결, 그룹 러닝, Send Cheer, Finish 저장, 앱 재시작 후 기록 유지까지 확인한다.

## 6. 외부 서비스 작업 원칙

- Railway, EAS, Expo, GitHub처럼 외부 서비스가 관련된 경우 현재 주소, Build ID, 배포 상태를 정확히 기록한다.
- EAS `preview` 빌드는 Google 지도 없는 안정 빌드로 취급한다.
- EAS `preview-map` 빌드는 Google Maps API key가 준비된 뒤에만 실행한다.
- 빌드가 `IN_QUEUE`이면 중복 빌드를 만들지 않고 기존 Build ID를 우선 추적한다.
- 빌드가 `ERRORED` 또는 `FAILED`이면 로그를 확인해 실패 단계를 먼저 분리한 뒤 수정한다.
- APK 다운로드 링크는 `artifacts.buildUrl` 또는 `artifacts.applicationArchiveUrl`을 기준으로 안내한다.

## 7. 커뮤니케이션 원칙

- 비전공자도 이해할 수 있게 원인은 쉬운 비유와 함께 설명한다.
- 사용자가 직접 해야 하는 작업과 Codex가 직접 처리한 작업을 구분해서 말한다.
- 최종 답변에는 수정 파일, 검증 결과, 남은 사용자 작업을 짧고 명확하게 정리한다.
- APK, Railway, EAS, Expo Go처럼 외부 서비스가 관련된 경우 사용자가 입력해야 할 최종 주소나 링크를 정확히 제시한다.
- 실패한 경우 숨기지 말고 실패 단계, 확인한 로그, 다음 조치 계획을 함께 말한다.

## 8. Superpowers 균형형 운영 원칙

RunMate Live 개발에는 Superpowers를 균형형으로 적용한다. 설치된 환경에서는 Superpowers 스킬을 우선 활용하되, 모든 요청에 과한 절차를 강제하지 않는다.

- 인증, 위치, 개인정보, DB/API 계약, 데이터 저장, 매칭, 알림, 배포, 사용자-visible 동작 변경은 구현 전에 짧은 설계와 테스트 계획을 먼저 제시한다.
- 코드 변경이 있으면 가능한 범위에서 테스트를 먼저 작성하고 실패를 확인한 뒤 구현한다.
- 문구 수정, 색상/아이콘 교체, README 정리, 코드 설명, 빠른 조사 요청에는 Superpowers 절차를 강제하지 않는다.
- 작은 UI/스타일 변경은 변경 전 영향 스캔 결과를 한 줄로 말하고 바로 진행할 수 있다.
- 위치, 알림, 지도, 실기기 동작은 자동 테스트만으로 완료 선언하지 않고 필요한 수동 검증 항목을 남긴다.
- 완료 전에는 만족한 요구사항, 실행한 자동 테스트, 필요한 수동 검증, 실제 의도한 상태가 확인됐는지를 보고한다.
- 상세 기준과 기본 프롬프트는 `docs/SUPERPOWERS_ADOPTION.md`를 따른다.
