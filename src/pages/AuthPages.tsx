// Telas de conta: entrar, cadastrar, pedir e confirmar a redefinição de senha.
// A validação usa os mesmos schemas da API (shared/schemas.ts).
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import { PASSWORD_MAX } from '../../shared/limits';
import { loginSchema, passwordResetRequestSchema, passwordSchema, signupSchema } from '../../shared/schemas';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/** Destino de `?voltar=`: só caminhos internos, para não virar redirecionamento aberto. */
export function safeReturnPath(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/';
}

/** Valida com o schema; devolve os dados ou a primeira mensagem de erro. */
function validate<S extends z.ZodType>(schema: S, input: unknown): { data: z.infer<S> } | { error: string } {
  const r = schema.safeParse(input);
  return r.success ? { data: r.data } : { error: r.error.issues[0]?.message ?? 'Dados inválidos.' };
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.');

function AuthForm(props: {
  title: string;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="page auth-page">
      <h1>{props.title}</h1>
      <form
        className="card auth-form"
        noValidate
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          props.onSubmit();
        }}
      >
        {props.children}
        <p id="auth-error" className="error" role="alert">
          {props.error}
        </p>
        <button type="submit" disabled={props.busy}>
          {props.busy ? props.busyLabel : props.submitLabel}
        </button>
      </form>
      {props.footer && <div className="auth-links">{props.footer}</div>}
    </main>
  );
}

function Field(props: {
  label: string;
  type: 'email' | 'password';
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  invalid: boolean;
}) {
  return (
    <label>
      {props.label}
      <input
        type={props.type}
        value={props.value}
        autoComplete={props.autoComplete}
        maxLength={props.type === 'password' ? PASSWORD_MAX + 20 : undefined}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={props.invalid || undefined}
        aria-describedby="auth-error"
      />
    </label>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = safeReturnPath(params.get('voltar'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const v = validate(loginSchema, { email, password });
    if ('error' in v) return setError(v.error);
    setBusy(true);
    setError(null);
    try {
      await login(v.data.email, v.data.password);
      navigate(back, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const query = back === '/' ? '' : `?voltar=${encodeURIComponent(back)}`;
  return (
    <AuthForm
      title="Entrar"
      submitLabel="Entrar"
      busyLabel="Entrando…"
      busy={busy}
      error={error}
      onSubmit={submit}
      footer={
        <>
          <Link to={`/cadastro${query}`}>Criar uma conta</Link>
          <Link to="/esqueci-senha">Esqueci a senha</Link>
        </>
      }
    >
      <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={(v) => (setEmail(v), setError(null))} invalid={!!error} />
      <Field label="Senha" type="password" autoComplete="current-password" value={password} onChange={(v) => (setPassword(v), setError(null))} invalid={!!error} />
    </AuthForm>
  );
}

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = safeReturnPath(params.get('voltar'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const v = validate(signupSchema, { email, password });
    if ('error' in v) return setError(v.error);
    setBusy(true);
    setError(null);
    try {
      await signup(v.data.email, v.data.password);
      navigate(back, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const query = back === '/' ? '' : `?voltar=${encodeURIComponent(back)}`;
  return (
    <AuthForm
      title="Criar conta"
      submitLabel="Criar conta"
      busyLabel="Criando…"
      busy={busy}
      error={error}
      onSubmit={submit}
      footer={<Link to={`/entrar${query}`}>Já tenho conta</Link>}
    >
      <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={(v) => (setEmail(v), setError(null))} invalid={!!error} />
      <Field label="Senha (8 a 128 caracteres)" type="password" autoComplete="new-password" value={password} onChange={(v) => (setPassword(v), setError(null))} invalid={!!error} />
    </AuthForm>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const v = validate(passwordResetRequestSchema, { email });
    if ('error' in v) return setError(v.error);
    setBusy(true);
    setError(null);
    try {
      setSent((await api.requestPasswordReset(v.data.email)).message);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <main className="page auth-page">
        <h1>Esqueci a senha</h1>
        <p className="card" role="status">
          {sent}
        </p>
        <div className="auth-links">
          <Link to="/entrar">Voltar para entrar</Link>
        </div>
      </main>
    );
  }
  return (
    <AuthForm
      title="Esqueci a senha"
      submitLabel="Enviar link"
      busyLabel="Enviando…"
      busy={busy}
      error={error}
      onSubmit={submit}
      footer={<Link to="/entrar">Voltar para entrar</Link>}
    >
      <p className="muted">Informe o e-mail da conta. Se ele estiver cadastrado, enviamos um link válido por 1 hora.</p>
      <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={(v) => (setEmail(v), setError(null))} invalid={!!error} />
    </AuthForm>
  );
}

export function ResetPasswordPage() {
  // O token vem no fragmento (#), que nunca chega ao servidor. Depois de lido, sai da barra de endereço.
  const [token] = useState(() => window.location.hash.slice(1));
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  }, []);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const v = validate(passwordSchema, password);
    if ('error' in v) return setError(v.error);
    setBusy(true);
    setError(null);
    try {
      await api.confirmPasswordReset(token, v.data);
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (!token || done) {
    return (
      <main className="page auth-page">
        <h1>Redefinir senha</h1>
        <p className="card" role="status">
          {done ? 'Senha redefinida. Entre com a nova senha.' : 'Link inválido ou expirado. Peça um novo.'}
        </p>
        <div className="auth-links">
          {done ? <Link to="/entrar">Entrar</Link> : <Link to="/esqueci-senha">Pedir um novo link</Link>}
        </div>
      </main>
    );
  }
  return (
    <AuthForm title="Redefinir senha" submitLabel="Salvar nova senha" busyLabel="Salvando…" busy={busy} error={error} onSubmit={submit}>
      <Field label="Nova senha (8 a 128 caracteres)" type="password" autoComplete="new-password" value={password} onChange={(v) => (setPassword(v), setError(null))} invalid={!!error} />
    </AuthForm>
  );
}
