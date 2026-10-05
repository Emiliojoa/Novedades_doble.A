-- One administrator for this business. Existing accounts are never removed.
CREATE UNIQUE INDEX IF NOT EXISTS users_single_admin
ON store.users(role) WHERE role = 'ADMIN';
