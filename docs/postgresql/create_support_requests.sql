BEGIN;

CREATE TABLE IF NOT EXISTS support_requests (
    id UUID PRIMARY KEY,
    user_id TEXT,
    request_type TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received',
    email_sent BOOLEAN NOT NULL DEFAULT FALSE,
    email_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_support_requests_type CHECK (request_type IN ('inquiry', 'bug')),
    CONSTRAINT chk_support_requests_message CHECK (BTRIM(message) <> ''),
    CONSTRAINT chk_support_requests_status CHECK (status IN ('received', 'in_progress', 'resolved')),
    CONSTRAINT fk_support_requests_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS support_request_attachments (
    id UUID PRIMARY KEY,
    request_id UUID NOT NULL,
    original_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_support_attachment_size CHECK (size_bytes > 0),
    CONSTRAINT fk_support_attachments_request
        FOREIGN KEY (request_id) REFERENCES support_requests (id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_requests_created
    ON support_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_requests_user_created
    ON support_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_attachments_request
    ON support_request_attachments (request_id);

COMMIT;
