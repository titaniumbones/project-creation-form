import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectForm from './pages/ProjectForm';
import Settings from './pages/Settings';
import Success from './pages/Success';
import MyDrafts from './pages/MyDrafts';
import ReviewDraft from './pages/ReviewDraft';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProjectForm />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/success" element={<Success />} />
          <Route path="/drafts" element={<MyDrafts />} />
          <Route path="/review/:token" element={<ReviewDraft />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
