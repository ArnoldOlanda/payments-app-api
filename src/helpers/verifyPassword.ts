import * as bcrypt from 'bcrypt';

export const verifyPassword = (password: string, hash: string) => {
  return bcrypt.compareSync(password, hash);
};
