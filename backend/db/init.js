import pool from './config.js';

const createTables = async () => {
  const createVideosTable = `
    CREATE TABLE IF NOT EXISTS videos (
      id SERIAL PRIMARY KEY,
      video_id VARCHAR(20) NOT NULL UNIQUE,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      youtube_url VARCHAR(500) NOT NULL,
      thumbnail_url VARCHAR(500),
      type VARCHAR(20) DEFAULT 'video',
      year INTEGER,
      tags TEXT[],
      uploaded_at DATE,
      duration_seconds INTEGER,
      view_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      channel_title VARCHAR(200),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(createVideosTable);
    console.log('videos 테이블 생성 완료');

    // updated_at 자동 업데이트 트리거 함수
    const createTriggerFunction = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `;
    await pool.query(createTriggerFunction);

    // 트리거 생성 (이미 존재하면 무시)
    const createTrigger = `
      DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
      CREATE TRIGGER update_videos_updated_at
        BEFORE UPDATE ON videos
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;
    await pool.query(createTrigger);
    console.log('트리거 생성 완료');

    console.log('데이터베이스 초기화 완료!');
  } catch (error) {
    console.error('테이블 생성 오류:', error);
  } finally {
    await pool.end();
  }
};

createTables();
