# RunMate High-Risk Review Harness

이 문서는 RunMate Live에서 고위험 작업을 시작하기 전에 사용하는 체크리스트다.
`my_harness`를 설치하거나 자동 실행하는 문서가 아니라, Codex와 사용자가 작업 범위, 위험, 검증 방법을 먼저 맞추기 위한 검토 템플릿으로만 사용한다.

## When To Use

아래 작업에는 이 문서를 먼저 사용한다.

- 위치 권한, GPS 추적, 거리 계산, 페이스 계산 변경
- 실시간 위치/페이스 공유, WebSocket 연결, 재연결, 버퍼링 변경
- 러닝 기록 저장, pending save, retry, sync, 활동 기록 표시 변경
- 친구 초대, 친구 목록, 그룹 러닝 참여 권한, 세션 초대 로직 변경
- API 응답 형식, DB schema, migration, shared model 변경
- Railway, EAS, Expo, Google Maps, Sentry, 환경변수, 배포 설정 변경
- APK 배포, 외부 베타 테스트, production 또는 preview 서버 영향 작업
- 개인정보, 위치정보, 인증 토큰, 진단 리포트에 영향을 주는 변경

아래 작업에는 기본적으로 사용하지 않는다.

- 단순 문구 수정
- 작은 색상, 아이콘, 간격 조정
- README 또는 주석 정리
- 단일 파일의 명확한 타입 오류 수정
- 로컬-only UI polish 중 저장 데이터, API, 위치, 배포에 영향이 없는 작업

단, 작은 UI 작업이라도 Live Run의 `Finish`, `Pause`, GPS 상태, 오류 메시지, 저장 상태를 바꾸면 이 문서를 사용한다.

## Fixed Rules

- `my_harness`를 현재 repo 루트에서 바로 실행하지 않는다.
- `AGENTS.md`, `.codex`, `.agents` 경로를 자동 생성물로 덮어쓰지 않는다.
- 전역 `~/.codex/skills` 설치, symlink 생성, 외부 reviewer 활성화를 하지 않는다.
- 외부 LLM, 외부 OCR/API, production 서비스 호출은 명시 승인 전 사용하지 않는다.
- 실제 위치정보, 러닝 경로, 친구 관계, 인증 토큰, DB URL, JWT secret, Google Maps API key, Sentry token을 입력이나 로그에 노출하지 않는다.
- 자동 commit, push, PR 생성 권한을 하네스 자체에 주지 않는다.
- 서버 DB/API 변경, 새 패키지 설치, 배포 설정 변경은 사용자가 명시한 경우에만 진행한다.

## Data Safety Gate

작업 시작 전에 데이터 등급을 하나로 표시한다.

```text
데이터 등급:
- [ ] 샘플/공개 데이터
- [ ] 로컬 UI 설정만 포함
- [ ] 위치정보 또는 러닝 기록 포함 가능
- [ ] 친구 관계 또는 인증 정보 포함 가능
- [ ] 비밀/API key/DB URL/토큰 포함 가능
```

기본 허용은 `샘플/공개 데이터`와 `로컬 UI 설정만 포함`뿐이다.

아래 항목이 있으면 작업을 중단하고 별도 보안 검토 또는 사용자 승인을 받는다.

- 실제 사용자의 위치 좌표, 이동 경로, 러닝 기록 원문
- 인증 토큰, refresh token, JWT secret, DB URL
- Google Maps API key, Sentry auth token, Railway secret
- 친구 초대 코드나 사용자 식별자가 포함된 로그
- production 데이터 삭제, 마이그레이션, 환경변수 변경

## Review Template

고위험 작업 전에 아래 내용을 짧게 채운다.

```text
1. Goal
이번 작업의 목표:
사용자가 성공했다고 판단할 기준:
이번 작업에서 하지 않을 것:

2. Current Context
관련 파일 또는 문서:
현재 동작:
이미 검증된 것:
아직 모르는 것:

3. Risk Review
요구사항/범위 리스크:
구현/테스트 리스크:
사용자 통제/보안 리스크:
개인정보 또는 위치정보 노출 가능성:
되돌리기 어려운 작업 여부:

4. Execution Boundary
수정 허용 파일:
수정 금지 파일:
외부 네트워크/API 사용 여부:
새 패키지 설치 여부:
커밋/푸시 필요 여부:

5. Verification Plan
좁은 테스트:
전체 테스트:
타입체크:
빌드:
모바일 번들 검증:
실제 Android 수동 확인:
실패하면 되돌릴 기준:
```

기본값은 다음과 같다.

- 외부 네트워크/API 사용 안 함
- 새 패키지 설치 안 함
- production 데이터와 secret 사용 안 함
- 서버 DB/API schema 변경 안 함
- 커밋/푸시는 사용자 별도 요청 전까지 안 함

## Deep Review Output Format

고위험 작업 검토 결과는 아래 형식으로 남긴다.

```md
## 판단
- 실행 가능 / 조건부 실행 가능 / 보류

## 주요 리스크
- ...

## 보완 권장사항
- ...

## 실행 경계
- 수정 허용:
- 수정 금지:
- 외부 호출:
- 새 패키지:
- 사용자 승인 필요:

## 검증 체크리스트
- ...

## 롤백 기준
- ...

## 비개발자 설명
- 이번 작업은 쉽게 말해 ...
```

## RunMate Risk Levels

- 낮음: 문구, 작은 색상, 단순 레이아웃 조정. 한 줄 영향 스캔 후 진행 가능.
- 중간: AsyncStorage 저장, 사용자별 설정, navigation, Home/Profile/Settings에 보이는 동작 변경. 짧은 실행 경계와 검증 계획 필요.
- 높음: 위치, 러닝 기록 저장, 친구/그룹 권한, API/DB/WebSocket, 배포/EAS/Railway/Google Maps/Sentry. 이 문서 전체를 사용한다.

## UI Decoration Lightweight Harness

아이와 함께 하는 UI 꾸미기처럼 기본은 가벼운 작업이지만 사용자별 저장이나 Live Run 화면에 닿을 수 있는 경우 아래 경계를 사용한다.

```text
데이터 등급: 로컬 UI 설정만 포함
수정 허용: theme tokens, theme storage, Design Studio, common UI components
수정 금지: GPS 계산, run save, API, DB, WebSocket, 배포 설정
외부 호출: 없음
새 패키지: 없음
검증: typecheck, build, test, 필요 시 expo export
수동 확인: 작은 Android 화면, 탭바 겹침, Live Run 핵심 버튼 가독성
```

## 초등학생 버전 설명

이 문서는 위험한 작업을 하기 전에 쓰는 안전 점검표다.

앱 색깔을 바꾸는 건 방 꾸미기와 비슷해서 가볍게 해도 된다.
하지만 위치, 기록 저장, 친구 초대, 서버 배포를 바꾸는 건 전기 배선을 만지는 것과 비슷하다.

그래서 RunMate에서는 위험한 작업 전에 이렇게 확인한다.

```text
1. 무엇을 바꿀지 적는다.
2. 개인정보나 위치정보가 있는지 확인한다.
3. 바꿔도 되는 파일과 안 되는 파일을 나눈다.
4. 테스트 방법을 적는다.
5. 문제가 생기면 어떻게 멈추거나 되돌릴지 정한다.
```

핵심은 도구를 자동으로 실행하는 것이 아니라, 안전하게 일하기 위한 점검표로만 쓰는 것이다.
