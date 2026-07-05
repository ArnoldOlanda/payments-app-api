import { render } from '@react-email/render';
import { PasswordResetEmail } from './password-reset';

export interface PasswordResetData {
  resetUrl: string;
  ttlMinutes: number;
}

export async function renderPasswordReset(data: PasswordResetData) {
  const [html, text] = await Promise.all([
    render(<PasswordResetEmail {...data} />),
    render(<PasswordResetEmail {...data} />, { plainText: true }),
  ]);
  return { html, text };
}
