const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const { randomUUID } = require('crypto');
const pgDb = require('../db');
const { fetchChildProfile } = require('../services/childProfileService');

const router = express.Router();
const profileDirectory = process.env.CHILD_PROFILE_UPLOAD_DIR
  ? path.resolve(process.env.CHILD_PROFILE_UPLOAD_DIR.replace(/^~(?=$|\/)/, os.homedir()))
  : path.join(os.homedir(), 'workspace/lab/hotube_data/profile');

const mapChildProfile = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    gender: row.gender,
    birthday: row.birth_date instanceof Date
      ? row.birth_date.toISOString().slice(0, 10)
      : row.birth_date,
    profileImage: row.photo_path
      ? `/childProfile/photo/${encodeURIComponent(path.basename(row.photo_path))}`
      : null,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const decodeProfileImage = (photoData) => {
  if (!photoData) return null;
  const match = photoData.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    const error = new Error('지원하지 않는 사진 형식입니다.');
    error.status = 400;
    throw error;
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    const error = new Error('사진은 5MB 이하만 저장할 수 있습니다.');
    error.status = 400;
    throw error;
  }
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  return { buffer, extension };
};

const validateProfile = ({ name, nickname, gender, birthday }) => {
  if (!name?.trim() || !nickname?.trim() || !gender || !birthday) {
    return '아이 정보를 모두 입력해주세요.';
  }
  if (name.trim().length > 100 || nickname.trim().length > 100) {
    return '이름과 애칭은 100자 이하로 입력해주세요.';
  }
  if (!['male', 'female'].includes(gender)) {
    return '유효하지 않은 성별입니다.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    return '태어난 날 형식이 올바르지 않습니다.';
  }
  const birthDate = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
    return '태어난 날이 올바르지 않습니다.';
  }
  return null;
};

router.get('/childProfile', async (req, res) => {
  try {
    const profile = await fetchChildProfile();
    if (!profile) return res.status(404).json({ error: '저장된 아이 정보가 없습니다.' });
    return res.json(mapChildProfile(profile));
  } catch (error) {
    console.error('아이 정보 조회 오류:', error);
    return res.status(500).json({ error: '아이 정보를 불러오지 못했습니다.' });
  }
});

router.get('/childProfile/photo/:filename', async (req, res) => {
  const filename = path.basename(req.params.filename);
  if (filename !== req.params.filename || !/^[0-9a-f-]+\.(jpg|png|webp)$/i.test(filename)) {
    return res.status(400).json({ error: '잘못된 사진 경로입니다.' });
  }
  try {
    await fs.access(path.join(profileDirectory, filename));
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.sendFile(filename, { root: profileDirectory });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ error: '사진을 찾을 수 없습니다.' });
    console.error('아이 사진 조회 오류:', error);
    return res.status(500).json({ error: '사진을 불러오지 못했습니다.' });
  }
});

router.put('/childProfile', async (req, res) => {
  const { name, nickname, gender, birthday, photoData, updatedBy } = req.body;
  const validationError = validateProfile({ name, nickname, gender, birthday });
  if (validationError) return res.status(400).json({ error: validationError });

  let newFilename = null;
  let previousFilename = null;
  let client;
  try {
    client = await pgDb.getClient();
    const image = decodeProfileImage(photoData);
    if (image) {
      await fs.mkdir(profileDirectory, { recursive: true });
      newFilename = `${randomUUID()}.${image.extension}`;
      await fs.writeFile(path.join(profileDirectory, newFilename), image.buffer, { flag: 'wx' });
    }

    await client.query('BEGIN');
    const existing = await client.query('SELECT id, photo_path FROM child_profiles ORDER BY id LIMIT 1 FOR UPDATE');
    let profileId;
    if (existing.rows[0]) {
      profileId = existing.rows[0].id;
      previousFilename = existing.rows[0].photo_path && path.basename(existing.rows[0].photo_path);
      await client.query(`
        UPDATE child_profiles
        SET name = $2, nickname = $3, gender = $4, birth_date = $5,
            photo_path = COALESCE($6, photo_path), updated_by = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [profileId, name.trim(), nickname.trim(), gender, birthday, newFilename, updatedBy || null]);
    } else {
      const inserted = await client.query(`
        INSERT INTO child_profiles
          (name, nickname, gender, birth_date, photo_path, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        RETURNING id
      `, [name.trim(), nickname.trim(), gender, birthday, newFilename, updatedBy || null]);
      profileId = inserted.rows[0].id;
    }
    await client.query('COMMIT');

    if (newFilename && previousFilename && previousFilename !== newFilename) {
      await fs.unlink(path.join(profileDirectory, previousFilename)).catch((error) => {
        if (error.code !== 'ENOENT') console.error('기존 아이 사진 삭제 오류:', error);
      });
    }
    return res.json(mapChildProfile(await fetchChildProfile(profileId)));
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (newFilename) await fs.unlink(path.join(profileDirectory, newFilename)).catch(() => {});
    console.error('아이 정보 저장 오류:', error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : '아이 정보를 저장하지 못했습니다.' });
  } finally {
    client?.release();
  }
});

module.exports = router;
