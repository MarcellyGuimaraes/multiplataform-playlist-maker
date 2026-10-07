// @vitest-environment jsdom
// Telas de conta com o fetch simulado: validação pelos schemas compartilhados e mensagens da API.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../src/auth/AuthContext';
import {
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
  safeReturnPath,
  SignupPage,
} from '../../src/pages/AuthPages';

type Handler = (body: unknown) => Response;
let routes: Record<string, Handler>;
let calls: { path: string; body: unknown }[];

beforeEach(() => {
  calls = [];
  routes = { 'GET /api/auth/me': () => Response.json({ user: null }) };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${String(input)}`;
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ path: key, body });
      const handler = routes[key];
      return handler ? handler(body) : Response.json({ error: { code: 'not_found', message: '?' } }, { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/cadastro" element={<SignupPage />} />
          <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const apiCalls = () => calls.filter((c) => c.path !== 'GET /api/auth/me');

describe('/cadastro', () => {
  it('erros de validação vêm dos schemas compartilhados e não chamam a API', async () => {
    renderAt('/cadastro');
    type('E-mail', 'maria@');
    type(/^Senha/, 'segredo123');
    submit('Criar conta');
    expect((await screen.findByRole('alert')).textContent).toBe('Informe um e-mail válido.');

    type('E-mail', 'maria@exemplo.com');
    type(/^Senha/, '1234567');
    submit('Criar conta');
    expect((await screen.findByRole('alert')).textContent).toBe('A senha deve ter pelo menos 8 caracteres.');
    expect(apiCalls()).toHaveLength(0);
  });

  it('envia o e-mail normalizado e, logada, vai para a tela inicial', async () => {
    routes['POST /api/auth/signup'] = () => Response.json({ user: { id: 'u1', email: 'maria@exemplo.com' } }, { status: 201 });
    renderAt('/cadastro');
    type('E-mail', ' Maria@Exemplo.com ');
    type(/^Senha/, 'segredo123');
    submit('Criar conta');
    expect((await screen.findByTestId('where')).textContent).toBe('/');
    expect(apiCalls()[0].body).toEqual({ email: 'maria@exemplo.com', password: 'segredo123' });
  });

  it('mostra a mensagem de conflito da API', async () => {
    routes['POST /api/auth/signup'] = () =>
      Response.json({ error: { code: 'conflict', message: 'Este e-mail já tem conta.' } }, { status: 409 });
    renderAt('/cadastro');
    type('E-mail', 'maria@exemplo.com');
    type(/^Senha/, 'segredo123');
    submit('Criar conta');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Este e-mail já tem conta.'));
  });
});

describe('/entrar', () => {
  it('validação local e mensagem genérica da API', async () => {
    routes['POST /api/auth/login'] = () =>
      Response.json({ error: { code: 'unauthorized', message: 'E-mail ou senha inválidos.' } }, { status: 401 });
    renderAt('/entrar');
    submit('Entrar');
    expect((await screen.findByRole('alert')).textContent).toBe('Informe o e-mail.');
    expect(apiCalls()).toHaveLength(0);

    type('E-mail', 'maria@exemplo.com');
    type('Senha', 'errada123');
    submit('Entrar');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('E-mail ou senha inválidos.'));
  });

  it('?voltar= leva de volta ao destino interno após entrar', async () => {
    routes['POST /api/auth/login'] = () => Response.json({ user: { id: 'u1', email: 'maria@exemplo.com' } });
    renderAt('/entrar?voltar=%2Fp%2Fabc');
    type('E-mail', 'maria@exemplo.com');
    type('Senha', 'segredo123');
    submit('Entrar');
    expect((await screen.findByTestId('where')).textContent).toBe('/p/abc');
  });

  it('links para cadastro (mantendo ?voltar=) e para "esqueci a senha"', () => {
    renderAt('/entrar?voltar=%2F');
    expect(screen.getByRole('link', { name: 'Criar uma conta' }).getAttribute('href')).toBe('/cadastro');
    expect(screen.getByRole('link', { name: 'Esqueci a senha' }).getAttribute('href')).toBe('/esqueci-senha');
  });

  it('safeReturnPath só aceita caminhos internos', () => {
    expect(safeReturnPath('/p/1?x=2')).toBe('/p/1?x=2');
    expect(safeReturnPath('//evil.example')).toBe('/');
    expect(safeReturnPath('/\\evil.example')).toBe('/');
    expect(safeReturnPath('https://evil.example')).toBe('/');
    expect(safeReturnPath(null)).toBe('/');
  });
});

describe('/esqueci-senha', () => {
  it('valida o e-mail e mostra a mensagem neutra da API', async () => {
    const neutral = 'Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha.';
    routes['POST /api/auth/password-reset'] = () => Response.json({ message: neutral }, { status: 202 });
    renderAt('/esqueci-senha');
    type('E-mail', 'nao-e-email');
    submit('Enviar link');
    expect((await screen.findByRole('alert')).textContent).toBe('Informe um e-mail válido.');
    expect(apiCalls()).toHaveLength(0);

    type('E-mail', 'ninguem@exemplo.com');
    submit('Enviar link');
    expect((await screen.findByRole('status')).textContent).toBe(neutral);
  });
});

describe('/redefinir-senha', () => {
  it('lê o token do fragmento, tira-o da URL, valida e envia', async () => {
    routes['POST /api/auth/password-reset/confirm'] = () => new Response(null, { status: 204 });
    const token = 'T'.repeat(43);
    window.history.replaceState(null, '', `/redefinir-senha#${token}`);
    renderAt('/redefinir-senha');
    await waitFor(() => expect(window.location.hash).toBe(''));

    type(/^Nova senha/, 'curta');
    submit('Salvar nova senha');
    expect((await screen.findByRole('alert')).textContent).toBe('A senha deve ter pelo menos 8 caracteres.');
    expect(apiCalls()).toHaveLength(0);

    type(/^Nova senha/, 'novaSenha99');
    submit('Salvar nova senha');
    expect((await screen.findByRole('status')).textContent).toMatch(/Senha redefinida/);
    expect(apiCalls()[0].body).toEqual({ token, password: 'novaSenha99' });
  });

  it('mostra o erro de link inválido ou expirado vindo da API', async () => {
    routes['POST /api/auth/password-reset/confirm'] = () =>
      Response.json({ error: { code: 'validation', message: 'Link inválido ou expirado. Peça um novo.' } }, { status: 400 });
    window.history.replaceState(null, '', `/redefinir-senha#${'T'.repeat(43)}`);
    renderAt('/redefinir-senha');
    type(/^Nova senha/, 'novaSenha99');
    submit('Salvar nova senha');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Link inválido ou expirado. Peça um novo.'));
  });

  it('sem token, avisa e oferece pedir um novo link', () => {
    window.history.replaceState(null, '', '/redefinir-senha');
    renderAt('/redefinir-senha');
    expect(screen.getByRole('status').textContent).toMatch(/Link inválido ou expirado/);
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toBeTruthy();
  });
});
