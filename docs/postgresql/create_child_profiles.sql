-- Existing database migration: create the shared child profile table.
-- Store uploaded images in object/file storage and save only their URL/path here.

BEGIN;

CREATE TABLE IF NOT EXISTS child_profiles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    birth_date DATE NOT NULL,
    photo_url TEXT,
    photo_path TEXT,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_child_profiles_name
        CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_child_profiles_nickname
        CHECK (BTRIM(nickname) <> ''),
    CONSTRAINT chk_child_profiles_gender
        CHECK (gender IN ('male', 'female')),
    CONSTRAINT fk_child_profiles_created_by
        FOREIGN KEY (created_by)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT fk_child_profiles_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_child_profiles_birth_date
    ON child_profiles (birth_date);

COMMIT;

-- Example seed. Replace created_by/updated_by with an existing users.id.
-- INSERT INTO child_profiles
--     (name, nickname, gender, birth_date, photo_url, photo_path, created_by, updated_by)
-- VALUES
--     ('정수호', '수호', 'male', '2024-05-16', NULL, NULL, 'USER_ID', 'USER_ID');
