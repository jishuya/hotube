# HoTube

가족 전용 비공개 유튜브 영상 시청 웹사이트

## 기술 스택

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Firebase Functions (Node.js 24)
- **Database**: Firebase Firestore
- **외부 API**: YouTube Data API v3 (`VITE_YOUTUBE_API_KEY`)

## 배포 정보

### Frontend (Netlify)
- **URL**: https://transcendent-cocada-9a2381.netlify.app
- **빌드 설정**:
  - Base directory: `frontend`
  - Build command: `npm run build`
  - Publish directory: `frontend/dist`

### Backend (Firebase Functions)
- **프로젝트**: hotube-9e9dd
- **리전**: asia-northeast3 (서울)
- **Functions URL**:
  | 함수 | URL |
  |------|-----|
  | getVideos | https://getvideos-2wvg2ln7bq-du.a.run.app | (홈페이지)
  | getVideo | https://getvideo-2wvg2ln7bq-du.a.run.app | (상세페이지)
  | createVideo | https://createvideo-2wvg2ln7bq-du.a.run.app |
  | updateVideo | https://updatevideo-2wvg2ln7bq-du.a.run.app |
  | deleteVideo | https://deletevideo-2wvg2ln7bq-du.a.run.app |

### Database (Firestore)
- **컬렉션**: `videos`
- **문서 수**: 31개

## 요금 정보

### Firebase Blaze 플랜 (종량제)
- **무료 할당량**:
  - Cloud Functions: 월 200만 호출
  - Firestore: 일 50,000 읽기, 20,000 쓰기
- **주의**: 월 200만 건 이상 호출 시 과금 발생

## 프로젝트 구조

```
frontend/src/
├── components/common/   # Header, VideoCard
├── pages/               # HomePage, VideoPage, AdminPage
├── services/            # videoApi.js, youtubeService.js
└── App.jsx              # 라우팅

functions/
└── index.js             # Firebase Functions API
```

## 라우팅

- `/` - 홈페이지 (영상 목록)
- `/video/:videoId` - 영상 재생
- `/admin` - 관리자 (영상 CRUD)

## 개발 명령어

```bash
# Frontend
cd frontend && npm run dev   # 개발 서버
cd frontend && npm run build # 빌드

# Backend (Firebase Functions)
cd functions && npm run serve  # 로컬 에뮬레이터
firebase deploy --only functions  # 배포
```

## 배포 이력

- **2025-12-05**: Firebase + Netlify로 배포 완료
