import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import videosRouter from './routes/videos.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어
app.use(cors());
app.use(express.json());

// 라우터
app.use('/api/videos', videosRouter);

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Hotube API 서버 실행 중' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다`);
});
