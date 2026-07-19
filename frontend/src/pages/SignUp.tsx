import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import api from '../api/client';
import { useBranding } from '../hooks/useBranding';

interface SignUpProps {
  onRegister: (username: string, password: string, confirmPassword: string) => Promise<void>;
}

export default function SignUp({ onRegister }: SignUpProps) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rules, setRules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const branding = useBranding();

  useEffect(() => {
    api.get('/auth/password-rules')
      .then((resp) => setRules(resp.data.rules || []))
      .catch(() => setRules([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await onRegister(username, password, confirmPassword);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      const detail = axiosErr.response?.data?.detail;
      notifications.show({
        title: 'Sign Up Failed',
        message: detail || 'Could not create account. Please try again.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const checks = [
    { label: 'Passwords match', pass: password.length > 0 && password === confirmPassword },
  ];

  return (
    <Box
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(135deg, #050608 0%, #0e1117 50%, #050608 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: '16px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
      className="signup-page"
    >
      <Card
        shadow="xl"
        padding="xl"
        radius="md"
        w="100%"
        maw={440}
        style={{
          background: '#0e1117',
          border: '1px solid #1a1f2e',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="lg">
            <Center>
              <img
                src="/logo-full.png"
                alt={branding.company_name}
                style={{ width: '100%', maxWidth: 420, height: 'auto' }}
              />
            </Center>

            <Title order={3} c="#e8edf2" ta="center" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px' }}>
              CREATE ACCOUNT
            </Title>

            <TextInput
              label="Username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              styles={{
                input: { background: '#050608', borderColor: '#1a1f2e', color: '#e8edf2' },
                label: { color: '#5a6478', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', letterSpacing: '1px' },
              }}
            />

            <PasswordInput
              label="Password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              styles={{
                input: { background: '#050608', borderColor: '#1a1f2e', color: '#e8edf2' },
                label: { color: '#5a6478', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', letterSpacing: '1px' },
              }}
            />

            <PasswordInput
              label="Confirm Password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              styles={{
                input: { background: '#050608', borderColor: '#1a1f2e', color: '#e8edf2' },
                label: { color: '#5a6478', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', letterSpacing: '1px' },
              }}
            />

            <Stack gap={4}>
              {rules.map((rule) => {
                const pass = password.length > 0 &&
                  (rule.toLowerCase().includes('10 characters') ? password.length >= 10 : true) &&
                  (rule.toLowerCase().includes('uppercase') ? /[A-Z]/.test(password) : true) &&
                  (rule.toLowerCase().includes('lowercase') ? /[a-z]/.test(password) : true) &&
                  (rule.toLowerCase().includes('number') ? /\d/.test(password) : true) &&
                  (rule.toLowerCase().includes('special') ? /[^A-Za-z0-9]/.test(password) : true);
                return (
                  <Checkbox
                    key={rule}
                    label={rule}
                    checked={pass}
                    readOnly
                    styles={{
                      label: { color: pass ? '#00d4ff' : '#5a6478', fontSize: '12px', fontFamily: "'Share Tech Mono', monospace" },
                    }}
                    color="cyan"
                  />
                );
              })}
              {checks.map((c) => (
                <Checkbox
                  key={c.label}
                  label={c.label}
                  checked={c.pass}
                  readOnly
                  styles={{
                    label: { color: c.pass ? '#00d4ff' : '#5a6478', fontSize: '12px', fontFamily: "'Share Tech Mono', monospace" },
                  }}
                  color="cyan"
                />
              ))}
            </Stack>

            <Button
              type="submit"
              fullWidth
              loading={loading}
              color="cyan"
              variant="filled"
              styles={{
                root: { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px', fontSize: '16px' },
              }}
            >
              SIGN UP
            </Button>

            <Text ta="center" size="sm" c="#5a6478" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
              Already have an account?{' '}
              <Text component={Link} to="/login" c="#00d4ff" td="underline" inherit>
                Log in
              </Text>
            </Text>
          </Stack>
        </form>
      </Card>

      <Text size="xs" c="#3a3f4a" style={{ fontFamily: "'Share Tech Mono', monospace", letterSpacing: '1px' }}>
        v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''}
      </Text>
    </Box>
  );
}
