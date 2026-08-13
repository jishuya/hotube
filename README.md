# HoTube

가족 사진과 영상을 비공개로 공유하는 PWA입니다.

## 구성

- Frontend: React 19, Vite, Tailwind CSS
- Backend: Express, PostgreSQL
- Media: 로컬 파일 저장소, FFmpeg
- Deployment: PM2, Cloudflare Tunnel

운영 환경에서는 `backend/src/server.js`가 API와 `frontend/dist` 정적 파일을 함께 제공합니다.

## 개발

```bash
npm run install:all
npm run dev
npm run dev:backend
```

## 검증 및 배포

```bash
npm run build
npm test --prefix backend
pm2 restart hotube-backend
curl http://localhost:5001/health
```

상세 운영 절차는 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)를 참고하세요.
