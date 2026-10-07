import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { SiteHeader } from './components/SiteHeader';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from './pages/AuthPages';
import { HomePage } from './pages/HomePage';
import { PlaylistPage } from './pages/PlaylistPage';
import { SharedPage } from './pages/SharedPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SiteHeader />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/p/:id" element={<PlaylistPage />} />
          <Route path="/s/:token" element={<SharedPage />} />
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/cadastro" element={<SignupPage />} />
          <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export function NotFound({ message = 'Página não encontrada.' }: { message?: string }) {
  return (
    <main className="page">
      <h1>{message}</h1>
      <p>
        <Link to="/">Voltar ao início</Link>
      </p>
    </main>
  );
}
