import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { PlaylistPage } from './pages/PlaylistPage';
import { SharedPage } from './pages/SharedPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/p/:id" element={<PlaylistPage />} />
        <Route path="/s/:token" element={<SharedPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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
