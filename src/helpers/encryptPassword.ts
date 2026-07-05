import * as bcrypt from 'bcryptjs';

export const encryptPassword = (password: string, salto = 10) => {
  const salt = bcrypt.genSaltSync(salto);
  const hash = bcrypt.hashSync(password, salt);

  return hash;
};
