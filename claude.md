# HoTube 개발 안내

- 운영 백엔드는 `backend/src/server.js`에서 실행되는 Express 서버입니다.
- 프런트엔드는 `frontend/`에서 빌드하며, 결과물은 Express가 제공합니다.
- 데이터베이스는 PostgreSQL입니다.
- 배포 및 장애 대응 절차는 `docs/DEPLOYMENT.md`를 기준으로 합니다.
- Firebase Functions와 Firestore 기반의 이전 구현은 제거되었습니다.
