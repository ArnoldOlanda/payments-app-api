import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface PasswordResetEmailProps {
  resetUrl: string;
  ttlMinutes: number;
}

export function PasswordResetEmail({
  resetUrl,
  ttlMinutes,
}: PasswordResetEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>
        Restablecé tu contraseña — el link expira en {ttlMinutes} minutos.
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={brand}>Payments App</Heading>
          <Hr style={hr} />
          <Heading style={h1}>Restablecé tu contraseña</Heading>
          <Text style={text}>
            Recibimos una solicitud para restablecer la contraseña de tu cuenta.
            Si fuiste vos, hacé click en el botón para definir una nueva.
          </Text>
          <Text style={textMuted}>
            El link expira en <strong>{ttlMinutes} minutos</strong>.
          </Text>
          <Section style={cta}>
            <Button href={resetUrl} style={button}>
              Restablecer contraseña
            </Button>
          </Section>
          <Text style={text}>
            Si el botón no funciona, copiá y pegá este link en tu navegador:
          </Text>
          <Text style={link}>{resetUrl}</Text>
          <Hr style={hr} />
          <Text style={footer}>
            Si no pediste restablecer tu contraseña, podés ignorar este mail —
            tu cuenta sigue segura.
          </Text>
          <Text style={footerMuted}>
            © {new Date().getFullYear()} Payments App
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: '#fafafa',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '48px 32px',
  backgroundColor: '#ffffff',
};

const brand = {
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: '#0f172a',
  textAlign: 'center' as const,
  margin: '0 0 24px',
};

const hr = {
  border: 'none',
  borderTop: '1px solid #e5e7eb',
  margin: '24px 0',
};

const h1 = {
  fontSize: '24px',
  fontWeight: 600,
  color: '#111827',
  margin: '0 0 16px',
  lineHeight: '1.3',
};

const text = {
  fontSize: '15px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '0 0 12px',
};

const textMuted = { ...text, color: '#6b7280' };

const cta = { textAlign: 'center' as const, margin: '32px 0' };

const button = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  padding: '14px 32px',
  borderRadius: '6px',
  textDecoration: 'none',
};

const link = {
  fontSize: '12px',
  color: '#6b7280',
  wordBreak: 'break-all' as const,
};

const footer = {
  fontSize: '13px',
  color: '#6b7280',
  lineHeight: '1.6',
  margin: '0 0 8px',
};

const footerMuted = { fontSize: '12px', color: '#9ca3af', margin: '0' };
