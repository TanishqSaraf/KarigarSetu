import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import KarigarDetail from './pages/KarigarDetail';
import Karigars from './pages/Karigars';
import Ledger from './pages/Ledger';
import NotFound from './pages/NotFound';
import OrderDetail from './pages/OrderDetail';
import OrderForm from './pages/OrderForm';
import Orders from './pages/Orders';
import Settings from './pages/Settings';
import { StoreProvider } from './store/StoreProvider';

// The hosted single-file build runs inside a sandboxed viewer where path URLs are not available,
// so it keeps the current page in memory instead.
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : BrowserRouter;

export default function App() {
  return (
    <StoreProvider>
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/new" element={<OrderForm key="new" />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="orders/:id/edit" element={<OrderForm key="edit" />} />
            <Route path="karigars" element={<Karigars />} />
            <Route path="karigars/:id" element={<KarigarDetail />} />
            <Route path="ledger" element={<Ledger />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Router>
    </StoreProvider>
  );
}
