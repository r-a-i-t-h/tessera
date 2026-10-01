export interface UserRecord {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  /** Absent or false means the editor can sign in. */
  disabled?: boolean;
}

export interface SessionRecord {
  token: string;
  username: string;
  createdAt: string;
  expiresAt: string;
}
