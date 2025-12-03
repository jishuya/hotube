# HoTube

가족 전용 비공개 유튜브 영상 시청 웹사이트

## 기술 스택

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: REST API (`VITE_API_URL` 환경변수)
- **외부 API**: YouTube Data API v3 (`VITE_YOUTUBE_API_KEY`)

## 프로젝트 구조

```
frontend/src/
├── components/common/   # Header, VideoCard
├── pages/               # HomePage, VideoPage, AdminPage
├── services/            # videoApi.js, youtubeService.js
└── App.jsx              # 라우팅
```

## 라우팅

- `/` - 홈페이지 (영상 목록)
- `/video/:videoId` - 영상 재생
- `/admin` - 관리자 (영상 CRUD)

## 개발 명령어

```bash
cd frontend && npm run dev   # 개발 서버
cd frontend && npm run build # 빌드
```
