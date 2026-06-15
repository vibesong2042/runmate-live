# RunMate Live Superpowers Adoption

This document defines how to use Superpowers for RunMate Live development in Codex App.

## Summary

Use Superpowers in balanced mode. Apply the full design, plan, TDD, review, and verification flow to high-risk product and engineering changes. Keep the flow light for copy, visual polish, documentation, and short investigation tasks.

## Strong Superpowers Scope

Use Superpowers strongly before implementing changes in these areas:

- Authentication, signup, login, sessions, permissions
- Location permission, maps, live route tracking
- Running record create, update, delete, retry, and sync flows
- Friend matching, running mate recommendation, group run logic
- Push notifications, schedule reminders, live cheering
- Database schema, migrations, API contracts, backend response shapes
- Privacy, security, secrets, deployment, EAS/Railway production checks
- Any user-visible behavior change that can affect a real running session

For these tasks, Codex should present a short design and test plan before changing code.

## Light Superpowers Scope

Use a lighter flow for these areas:

- Screen layout adjustments
- Form validation messages
- Small list/detail screen improvements
- Empty, loading, and error states
- Simple settings screen options
- Local-only UX polish that does not affect saved data or API behavior

For these tasks, Codex may state a one-line impact scan and proceed.

## No Superpowers Needed By Default

Do not force the Superpowers workflow for:

- Copy edits
- Color or icon swaps
- README or comment cleanup
- Code explanation requests
- Quick research, comparison, or investigation tasks
- Throwaway prototypes explicitly requested as prototypes

If any of these touch authentication, location, privacy, saved data, API contracts, or deployment, move the task back to the strong scope.

## Default Prompt

Use this prompt at the start of RunMate Live development threads:

```text
Superpowers를 균형형으로 적용해서 진행해줘.

이 작업이 인증, 위치, 개인정보, DB/API 계약, 데이터 저장, 매칭, 알림, 배포, 사용자-visible 동작 변경에 걸리면 구현 전에 짧은 설계와 테스트 계획을 먼저 보여줘.

작은 UI/문구/스타일 변경이면 과한 절차 없이 진행하되, 변경 전 스캔 결과를 한 줄로 말해줘.

코드 변경이 있으면 가능한 한 테스트를 먼저 만들고 실패를 확인한 뒤 구현해줘.

완료 전에는 다음을 짧게 보고해줘:
1. 만족한 요구사항
2. 실행한 자동 테스트
3. 필요한 수동 검증
4. 실제 의도한 상태가 확인됐는지
```

## Pilot Task

Use the first small feature after adoption as the pilot. Good candidates:

- Profile edit
- Running history list
- Running detail screen
- Notification settings

Evaluate the pilot by checking:

- Requirements were not misunderstood
- The design step was short but sufficient
- Tests or manual checks had real regression value
- Completion included evidence, not just a success claim
- The process did not add unreasonable delay

## Verification Expectations

Use the smallest meaningful verification set for each change:

- Shared or API change: `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test`
- Mobile UI or navigation change: add Expo export when needed from `apps/mobile`
- Location, maps, notifications, or APK change: require physical Android verification notes
- Provider, environment, or deployment change: verify the intended new state, not only command success

Never claim completion for location, map, notification, real-device, or external-service behavior from automated tests alone.

## Continuation Rules

After the pilot:

- Keep balanced Superpowers as the default if quality improves and friction is acceptable.
- If small tasks slow down too much, explicitly say small UI/copy changes should use one-line impact scans.
- If automated tests are hard for a real-device feature, record manual acceptance steps.
- If a manual check finds a bug that can be automated, add a regression test before fixing it.
