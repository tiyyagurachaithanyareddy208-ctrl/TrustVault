import argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB memory
  timeCost: 3,       // 3 iterations
  parallelism: 4,    // 4 threads
};

export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }
  return await argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
