import { Router } from 'express';
import pool from '../db/config.js';

const router = Router();

// 모든 비디오 조회
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM videos ORDER BY created_at DESC'
    );

    // 프론트엔드에서 사용하는 camelCase로 변환
    const videos = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      youtubeUrl: row.youtube_url,
      thumbnailUrl: row.thumbnail_url,
      type: row.type,
      year: row.year,
      tags: row.tags || [],
      uploadedAt: row.uploaded_at,
      durationSeconds: row.duration_seconds,
      viewCount: row.view_count,
      likeCount: row.like_count,
      channelTitle: row.channel_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json(videos);
  } catch (error) {
    console.error('비디오 조회 오류:', error);
    res.status(500).json({ error: '비디오 조회 실패' });
  }
});

// 단일 비디오 조회
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '비디오를 찾을 수 없습니다' });
    }

    const row = result.rows[0];
    const video = {
      id: row.id,
      title: row.title,
      description: row.description,
      youtubeUrl: row.youtube_url,
      thumbnailUrl: row.thumbnail_url,
      type: row.type,
      year: row.year,
      tags: row.tags || [],
      uploadedAt: row.uploaded_at,
      durationSeconds: row.duration_seconds,
      viewCount: row.view_count,
      likeCount: row.like_count,
      channelTitle: row.channel_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    res.json(video);
  } catch (error) {
    console.error('비디오 조회 오류:', error);
    res.status(500).json({ error: '비디오 조회 실패' });
  }
});

// 비디오 등록
router.post('/', async (req, res) => {
  try {
    const {
      videoId,
      title,
      description,
      youtubeUrl,
      thumbnailUrl,
      type,
      year,
      tags,
      uploadedAt,
      durationSeconds,
      viewCount,
      likeCount,
      channelTitle
    } = req.body;

    // videoId를 id로 사용 (YouTube video ID)
    const id = videoId;

    const result = await pool.query(
      `INSERT INTO videos (
        id, title, description, youtube_url, thumbnail_url,
        type, year, tags, uploaded_at, duration_seconds,
        view_count, like_count, channel_title
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        id,
        title,
        description,
        youtubeUrl,
        thumbnailUrl,
        type || 'video',
        year,
        tags || [],
        uploadedAt,
        durationSeconds,
        viewCount || 0,
        likeCount || 0,
        channelTitle
      ]
    );

    const row = result.rows[0];
    const video = {
      id: row.id,
      title: row.title,
      description: row.description,
      youtubeUrl: row.youtube_url,
      thumbnailUrl: row.thumbnail_url,
      type: row.type,
      year: row.year,
      tags: row.tags || [],
      uploadedAt: row.uploaded_at,
      createdAt: row.created_at
    };

    res.status(201).json(video);
  } catch (error) {
    console.error('비디오 등록 오류:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: '이미 등록된 영상입니다' });
    }
    res.status(500).json({ error: '비디오 등록 실패' });
  }
});

// 비디오 수정
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      youtubeUrl,
      thumbnailUrl,
      type,
      year,
      tags,
      uploadedAt
    } = req.body;

    const result = await pool.query(
      `UPDATE videos SET
        title = $1,
        description = $2,
        youtube_url = $3,
        thumbnail_url = $4,
        type = $5,
        year = $6,
        tags = $7,
        uploaded_at = $8
      WHERE id = $9
      RETURNING *`,
      [title, description, youtubeUrl, thumbnailUrl, type, year, tags || [], uploadedAt, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '비디오를 찾을 수 없습니다' });
    }

    const row = result.rows[0];
    const video = {
      id: row.id,
      title: row.title,
      description: row.description,
      youtubeUrl: row.youtube_url,
      thumbnailUrl: row.thumbnail_url,
      type: row.type,
      year: row.year,
      tags: row.tags || [],
      uploadedAt: row.uploaded_at,
      updatedAt: row.updated_at
    };

    res.json(video);
  } catch (error) {
    console.error('비디오 수정 오류:', error);
    res.status(500).json({ error: '비디오 수정 실패' });
  }
});

// 비디오 삭제
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM videos WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '비디오를 찾을 수 없습니다' });
    }

    res.json({ message: '비디오가 삭제되었습니다', id: result.rows[0].id });
  } catch (error) {
    console.error('비디오 삭제 오류:', error);
    res.status(500).json({ error: '비디오 삭제 실패' });
  }
});

export default router;
