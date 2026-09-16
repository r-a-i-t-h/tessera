export interface UserRecord {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

export interface SessionRecord {
  token: string;
  username: string;
  createdAt: string;
  expiresAt: string;
}
