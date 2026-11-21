# TODO

목표: React Native로 Android/iOS 개인용 앱 개발(스토어 미배포, D-011)
지침: 남은 항목만 둔다. 최상위 항목이 하위 항목까지 모두 끝나면 블록째 `docs/history.md`의 같은 절 끝으로 옮긴다. 새 단계·항목은 여기에 추가한다

## 5. 개발

### 5-5. 앱 공통 기반 (5-4와 병행 가능)
- [ ] 접근 키 B-b: QR(`futureetp-key:v1:`)·붙여넣기, `GET /v1/settings`로 확인 후 SecureStore, `UNAUTHORIZED` 시 B-b 이동, `scripts/` 키 생성·QR (D-044)
  - [x] SecureStore 저장·붙여넣기 입력·첫 실행 B-b(키 없으면 스택 대신)·B 목록 `설정됨` (2026-10-27, D-077)
    - [x] 키 확인 응답을 설정 스키마로 (2026-10-27, D-081)
    - [x] 앱(dev 변형 아닌 저장 키)에서 dev 서버로 키 확인: 기기 확인 때 (2026-10-31, iPhone 14 Pro, `DEV_API_TOKEN` 없이 Metro 실행: 저장 키로 접속 → 서버 키 교체 뒤 당겨서 새로고침에 B-b 자동 이동·거절 줄 → QR로 새 키 저장 뒤 목록 복귀. 거절 줄은 가운데 정렬·빨간색(`colors.error`)으로 바꿈. dev 키가 48자라 앱 형식(43자, D-044)으로 넣을 수 없어 `npm run access-key` 키로 교체)
  - [x] QR 읽기(`expo-camera`, 권한 거부·카메라 없음 안내) (2026-10-27, D-078)
    - [ ] 재빌드 후 Android 기기에서 권한 요청·QR 읽기 확인
      - 에뮬레이터 확인(2026-11-17, Pixel_API_36, prod release APK `dc6ec27`): 권한 요청 대화상자, 거부하면 "카메라를 쓸 수 없음" 안내 줄, 다시 눌러 허용하면 카메라 열림(CameraX 세션 시작). QR 읽기는 에뮬레이터 카메라로 못 봐서 실기기 남음
    - [ ] iOS 재빌드 뒤 실기기에서 권한 문구(기기 언어 ko·en, `locales`)·QR 읽기 확인
      - QR 읽기 확인(2026-10-31, iPhone 14 Pro). 권한 문구는 이미 허용된 기기라 못 봄: 앱 삭제 후 재설치 때 확인
  - [x] `UNAUTHORIZED` 시 어느 화면에서든 B-b로 이동 + 오류 줄 (2026-10-27, D-079)
  - [x] `scripts/` 키 생성·QR 표시(`npm run access-key`, 기존 키는 `--show`에 stdin) (2026-10-27, D-080)

### 5-6. 화면 수직 슬라이스 (API + 화면 + 테스트)
- [x] A 원자재 목록: `GET /v1/commodities` + 화면(당겨서 새로고침, 대표월물·알림 표시)
  - [x] `GET /v1/commodities` + shared 스키마(기준 거래일·대표월물·표시 값 우선순위·freshness) (2026-10-27, D-085)
    - [x] 5-4 적재 뒤 dev DB에서 실제 값으로 확인: 원자재마다 5개 월물·대표월물 1개, 가격·전일 대비 정상, CL만 알림 표시, GCQ27 거래 없음 표시. 응답 3.4KB·63ms (2026-10-28 21:30 CT)
  - [x] A 화면(목록·● 대표월물·🔔·거래 없음·당겨서 새로고침·자동 새로고침, C-a 이동) (2026-10-27)
    - [ ] 기기에서 열 너비·긴 가격(천 단위)·당겨서 새로고침 확인(5-4 적재 뒤 실제 값)
      - 에뮬레이터 확인(2026-10-29, en): 열 너비·천 단위 가격(4,065.1)·거래 없음·당겨서 새로고침 정상. 실기기 남음
    - [ ] 당겨서 새로고침 햅틱·진행 중 터치 차단·5초 초과 안내(D-138): iOS 실기기에서 햅틱 시점(당기는 도중)·실패 Alert 확인
      - 에뮬레이터 확인(2026-11-17, Pixel_API_36, dev 빌드 `2690fb7`): 안내 줄을 공통 실패 Alert로 바꾼 뒤, dev 서버를 멈춘(SIGSTOP) 채 당기면 인디케이터 유지, 5초 뒤 "새로고침을 마치지 못했습니다" Alert + [확인]
      - 에뮬레이터 확인(2026-11-17, Pixel_API_36, dev 빌드 `f5ab04f`): 당기면 진동 1회(vibrator 기록), dev 서버를 멈춘 채 당기면 인디케이터 유지·그동안 행 탭 무시, 5초 뒤 인디케이터 사라지고 빨간 안내 줄 + [확인], [확인]은 진동·재조회 없이 줄만 닫음. 서버를 되살린 뒤 정상 새로고침·완료 뒤 행 탭으로 C-a 이동
- [ ] C-a 이격도차트: `GET /v1/commodities/:code/disparity`(기준값 없는 원자재 대체 표시 포함) + 차트 본 구현(스파이크 이관, `src/charts/`), 롤 마커·음영, rare-level 밴드·특수 라벨, 십자선 상세, 기간 버튼(Zustand), 스파이크 삭제
  - [x] `GET /v1/commodities/:code/disparity?basis&ma&window&levels` + shared 스키마(맞춤 비율·보유 월물·잠정 봉·rare 레벨·꼬리 백분위·대체) (2026-10-27, D-086)
    - [x] 5-4 적재 뒤 dev DB에서 실제 값·응답 크기·앱 파싱 시간 확인(행 객체 유지 여부, D-046) (2026-10-29)
      - 서버 측 실측(2026-10-28): 원자재 4개 × 기준값 3개 모두 200, 봉 4,125개, 응답 약 1.03MB(dev 서버는 압축 없음), 서버 처리 30~60ms. gzip 264KB로 D-046 가정(약 100KB)의 2.6배. 소수점 끝자리(부동소수 17자리)가 주원인이라 가격·이평선 4자리·이격도 3자리로 반올림하면 gzip 125KB. Node의 JSON.parse + zod 8~15ms. → 서버에서 가격은 표시 자릿수+2·이격도 3자리로 반올림(`roundDisparityChart`): 원자재 4개 약 770~786KB, gzip 124~134KB
      - 에뮬레이터(Pixel_API_36, dev 빌드 Hermes) 실측(2026-10-29): JSON.parse 3~19ms + zod 45~135ms(첫 호출이 가장 김), 원자재 4개 모두 차트 표시. 200ms 아래라 행 객체 유지, 열 배열 전환 안 함. 실기기는 이보다 느릴 수 있어 실기기 확인 때 체감만 본다
    - [x] `INTRADAY` 구현 때 잠정 봉의 롤 중 판정(롤 첫날 장중) 다시 보기 (2026-10-30, 규칙의 영업일 순번으로 판정(`isRollPeriodDay`). 보유 월물 수로 정하던 때는 롤 첫날을 놓치고 미국형 CL(3 leg)이 늘 롤 중이었다. dev DB 10/30 잠정 봉 12개 모두 `inRoll false`, D-086)
  - [x] 차트 부품(`src/charts/` `CandleChart`, 스파이크 이관, 한글 Paragraph·선 경로 변환·특수 라벨) (2026-10-27, D-087)
    - [x] C-a 연결 뒤 에뮬레이터·실기기에서 한글 라벨·선 굵기·제스처 FPS 확인 (2026-10-31)
      - 실기기 확인(2026-10-30, iPhone 14 Pro): 핀치 초점 고정·가장 가까운 기간 칩 테두리·십자선이 떠 있으면 바로 끌어 기준일 이동·정보 줄을 차트 안으로(데이터는 비켜 그림)·되돌리기 버튼이 롤 마커를 가리던 것 수정
      - 실기기 측정(2026-10-31, iPhone 14 Pro 운영 번들 `perf:collect`, CL): 진입 372ms(응답 184ms). 이동 UI 87~107fps(봉 756개)·66~109fps(1,512~3,024개), 핀치 116fps, 가장 긴 프레임 28ms·긴 프레임 0. 과거 3년 이어 받기 3회 모두 범위 유지(260~530ms), 튐 없음. C-c 진입 293ms. → 통과
      - [x] 과거 데이터를 받는 동안 햅틱·차트 터치 막기 (2026-10-31, D-108)
        - [x] 실기기에서 로딩 햅틱·받는 동안 끌기 멈춤 확인 (2026-10-31, iPhone 14 Pro 적당)
      - [ ] 받는 동안 C 화면 전체 터치 차단·5초 초과 시 공통 실패 Alert (D-139): iOS 실기기 확인 남음
        - 에뮬레이터 확인(2026-11-17, Pixel_API_36, dev 빌드 `2690fb7`, C-a GC 12M): 서버 정상일 때 3회 연속 이어 받기·범위 유지. dev 서버를 멈춘(SIGSTOP) 채 가장 과거 봉까지 끌면 진동 1회·왼쪽 가운데 로딩 표시, 그동안 월물차트 탭·2M 칩·[←]을 눌러도 C-a 12M 그대로. 5초 뒤 "과거 데이터를 불러오지 못했습니다" Alert + [확인]. 서버를 되살리면 늦은 응답이 붙고(+756봉, 범위 유지) 진동·Alert 추가 없음. [확인] 뒤 탭 이동 정상
        - 에뮬레이터 재확인(2026-11-17, dev 빌드 `0d112a3`, C-a GC 12M): 시간 초과 Alert를 닫은 뒤 가장 과거 끝에서 한 번만 끌어도 다시 받기 시작(진동 1회·로딩 표시·`older pages start`), 서버가 멈춰 있으면 5초 뒤 Alert 다시. 서버를 되살리면 늦은 응답이 붙음(+756봉, 범위 유지). 이 상태(1,512봉)에서 빠른 swipe(300ms)는 UI 6~12fps라 이동 없이 끝나는 일이 잦았고 느린 swipe(800ms)는 이동함 → 에뮬레이터 프레임 지연으로 보고 실기기 확인 때 함께 본다
        - 실기기 확인(2026-11-17, iPhone 14 Pro 운영 앱, OTA `01a1e914`, 미러링, C-a GC 12M): 빠른 끌기 17회 연속으로 2013년까지 이어 받는 동안 끌기가 빠짐없이 움직임 → 에뮬레이터의 끌기 무시는 에뮬레이터 프레임 지연. 남은 확인: 실패·시간 초과 Alert와 그 뒤 한 번 끌어 다시 받기(미러링은 기기 Wi-Fi가 필요해 네트워크를 끊고 볼 수 없음), 받기 시작 햅틱(기기에서 직접)
      - [x] 주요 사용자 액션 햅틱(원자재·ETP 선택, 탭·기간·설정 값 변경, 설정 진입, 회전, 뒤로 가기) (2026-10-31, D-109)
        - [x] 실기기에서 촉감·빈도 확인 (2026-10-31, iPhone 14 Pro 적당)
      - 에뮬레이터 확인(2026-10-29, CL 12M, ko): 한글 꼬리표·월 축·하단 줄·밴드 선 굵기 정상, 끌어서 이동 동작. 이동 뒤 고가 꼬리표가 현재가 점선과 겹치던 것은 꼬리표를 점선 바깥으로 옮겨 고침. FPS는 에뮬레이터가 소프트웨어 GPU(SwiftShader)라 중앙값 113ms/프레임으로 의미 없어 실기기에서 본다
  - [x] C-a 화면(좌상단·좌하단 줄, 기준값 안내, 꼬리표, 롤 표시, 십자선 상세, 기간 칩, 스파이크 삭제) (2026-10-27)
    - [x] y축 라벨이 차트 위·아래 끝에 붙으면 반 높이만큼 안쪽에 그림(맨 위 rare-level 라벨 `110.70`이 title-bar 경계선 아래로 잘리던 것, C-c 끝값 라벨도 같은 배치) (2026-11-03)
      - [ ] 다음 iOS 빌드 때 기기에서 C-a를 과거로 이동해 맨 위 라벨 확인(지금 dev 빌드는 `apiUrl`이 빌드에 박혀 `localhost`라 실기기에서 dev 서버에 못 붙음 → `.env.local`에 `DEV_API_URL`(Mac LAN IP) 넣고 재빌드)
    - [x] 전환 마커 라벨을 월 번호로(겹치면 생략·오른쪽 끝은 ▲ 왼쪽), 전체 월물명은 십자선 상세 (2026-10-28, D-087)
- [x] C-c 월물차트: `GET /v1/commodities/:code/contracts` + 화면(C-a 차트 공용 부품 재사용)
  - [x] `GET /v1/commodities/:code/contracts` + shared 스키마(공유 날짜 + 월물별 가격 열 배열, 오늘 잠정 값) (2026-10-28, D-092)
  - [x] C-c 화면(선 5개·끝값 y축 라벨·기간 칩 C-a와 따로 기억·제스처) (2026-10-28, `src/charts/LinesChart` + 공용 `useChartViewport`, D-093)
    - [x] 에뮬레이터에서 선 색 구분·끝값 라벨 밀어 쌓기·이동·기간 칩·십자선 상세 확인 (2026-10-28, 숫자 글꼴 서브픽셀 위치로 `J AN27` 간격 수정)
    - [x] 끝값 라벨을 보이는 범위 마지막 날 값으로(이동해도 범례 유지), 기간 맞춤이 처음 진입 때 빠지던 경쟁 상태 수정 (2026-10-28, D-093)
    - [ ] 실기기에서 같은 항목·핀치 확대 확인
      - 미러링 확인(2026-11-03, prod CL): 선 5개 색·끝값 라벨 쌓기·끌어 이동 뒤 끝값이 보이는 범위 마지막 값·길게 눌러 십자선 상세·C-a와 따로 기간 기억·목록 재진입 때 6M(D-107) 정상. 핀치는 기기 손으로

### 5-8. 알림
- [ ] 기기별 설정(D-120): 설정·알림 판정·기록을 installation ID(`X-Device-Id`) 기준 기기별로
  - [x] 결정·문서(decisions·product·data-model·architecture·screens) (2026-11-04)
  - [x] 앱: installation ID 생성·SecureStore(`api/deviceId.ts`, Math.random UUID v4), 인증 요청에 `X-Device-Id` (2026-11-04)
  - [x] 서버: `app_settings` → `device` 설정 컬럼 마이그레이션(`0006_device_settings`, 기존 기기 행 삭제), 토큰 없어도 `PUT /v1/devices`(shared `pushToken` nullable, 앱은 빈 토큰이면 null로 등록), `/v1/settings`·`/v1/commodities`·`/v1/devices`가 헤더 기기 사용(`api/deviceId.ts`, 처음 보인 기기는 기본값 행), 같은 토큰은 다른 기기 행에서 비움, 무효 토큰은 비우기. dev DB 적용·저장소 동작 확인 (2026-11-04)
  - [x] 알림: `alert_record.device_id`(중복 방지 키, 기기 삭제 시 함께 삭제, `0007_alert_record_device`에서 기존 기록 삭제), 알림 원자재가 같은 기기마다 판정·기록·그 기기로만 발송, 재시도·지연 발송은 기록의 기기 설정(거부 시간)·언어, 운영·ETP 후보·다수 판정 알림은 기기별 언어 문구. dev DB 적용·저장소 동작 확인 (2026-11-04)
  - [x] 서버 배포(`5f5eef7`, `0006`·`0007` 적용으로 prod 기기·설정·알림 기록 초기화) + 앱 OTA(iOS·Android). iPhone 14 Pro·16 Pro Max에 prod Release(Personal Team) 새로 설치 → prod `device`에 두 행, 기준·알림 원자재가 기기마다 따로 저장됨 확인 (2026-11-04)
  - [ ] 기기별 알림 수신 확인(푸시 토큰 등록 기기 필요: Android 실기기 또는 Apple 가입 뒤 iOS)
    - 2026-11-17 에뮬레이터(Google Play 이미지)에 prod release 설치 → 알림 허용 뒤 prod `device`에 ANDROID 행·FCM 토큰 등록 확인. 새 기기 행 locale이 앱 언어(en)와 달리 `ko`로 남던 것은 D-137로 수정(`5212503`, Android OTA `01a1e511`로 반영·확인). 알림 수신은 알림 원자재 지정 후 rare 레벨 도달 때

### 5-10. 운영과 첫 배포
- [x] 테스트 앱 배포(Firebase App Distribution): 기존 Firebase 프로젝트(FCM, D-037)의 prod Android 앱에 release APK 업로드, 테스터 그룹 `owner`(본인)에 배포. `npm run build:android:release -w apps/mobile` → `npm run distribute:android -- [노트]`(루트, 노트 기본은 `apps/mobile`·`packages/shared`를 마지막으로 바꾼 커밋, 그 커밋보다 오래된 APK는 거부). 첫 배포 1.0.0 (1) (2026-11-02, D-039 보충)
  - 재배포 2026-11-03: `31c47b4`(C 차트 십자선·등락 색 수정분), 같은 1.0.0 (1)·서명 지문 일치. 빌드 중 작업 트리가 바뀌면 미커밋 코드가 번들에 들어가므로 깨끗한 상태에서 빌드한다
  - 2026-11-03: versionCode를 커밋 수(`git rev-list --count HEAD`)로 자동 지정, 배포 스크립트를 루트 `scripts/distribute-android.sh`로 옮김(fingerprint 변화 없음 확인). `apps/mobile` `distribute:android`는 지우면 fingerprint가 바뀌어 남겨 둠: 다음 네이티브 변경 때 함께 삭제
  - [ ] 기기에서 초대 수락 → App Tester로 설치 → 접근 키 QR 등록·표시 설정 저장/복원·OTA 첫 확인(위 release APK 항목)
- [ ] Apple Developer 가입(최대한 늦게) 뒤: iOS 실기기 설치 방식 결정, APNs 발송 경로 추가 (D-037, D-039)
  - 2026-11-02: iOS 테스트 배포(Firebase App Distribution·TestFlight)는 ad-hoc 서명·UDID 등록이 유료 계정 전용이라 가입 전에는 불가. prod 변형 Personal Team 직접 설치도 보류하고 Android 기기 확인을 먼저 한다
  - [x] 2026-11-03: prod 변형 Release를 Personal Team으로 iPhone 14 Pro·16 Pro Max에 설치·실행(푸시 권한 빼고, 7일 만료). 다른 세션과 겹치지 않게 별도 git worktree에서 prebuild·빌드. 16 Pro Max는 `-allowProvisioningDeviceRegistration`으로 팀에 등록 (D-039 보충)
    - [x] 두 기기에서 접근 키 QR 등록 (2026-11-03)
    - [ ] 두 기기에서 운영 데이터 표시·카메라 권한 문구 확인

- [ ] KRX 2027년 휴장일 공식 공지(보통 12월 말) 뒤 `scripts/calendar/krx/2027.json`을 맞추고(잠정 표시 지우기, 수능일 개장 지연 추가) dev·prod 다시 import
  - 2027 KRX가 `missing`인 동안 앱은 달력을 5분만 캐시하므로, import 뒤 화면 재진입·앱 복귀로 반영된다(재시작 불필요). 반영 확인만 한다

### 5-11. 검증 강화 (D-127)
- [ ] (후속) victory-native가 Gesture Handler hook API를 받으면 `useChartViewport` 제스처 이전, 예외 주석 삭제 (D-128)
  - 2026-11-16: victory-native 43.0.1은 RNGH `>=2 <4`를 허용한다. Skia 패키지 `react-native-skia` 전환(네이티브 재빌드)과 `customGestures`가 hook 제스처를 받는지 확인이 남음
  - 2026-11-16 확인: 43.0.1도 `CartesianChart`가 `customGestures`를 legacy `Gesture.Race`로 합쳐 hook 제스처를 받지 않는다. 이전 불가라 보류(43만 올리는 건 이득 없이 재빌드 비용뿐). 다음 victory-native 릴리스에서 다시 본다
  - 자동 확인: `npm run deps:watch`가 아래 (2)를 하고, CI가 매주 돌린다(D-130)
  - 확인 방법: (1) `npm view victory-native version peerDependencies`로 버전과 RNGH 허용 범위 확인 (2) `npm pack victory-native@<버전>` 압축을 풀어 `src/cartesian/CartesianChart.tsx`에서 `customGestures`를 아직 `Gesture.Race`로 합치는지 확인. 그대로면 이전 불가
