import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts';
import Dashboard from '@/pages/Dashboard';
import { CreateTokenPage } from '@/pages/CreateTokenPage';
import TokenManager from '@/pages/TokenManager';
import SetupBridge from '@/pages/SetupBridge';
import MigrateCeloNative from '@/pages/MigrateCeloNative';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: (
          <Dashboard  />
        ),
      },
      {
        path: 'create',
        element: <CreateTokenPage />,
      },
      {
        path: 'manage/:tokenAddress',
        element: <TokenManager />,
      },
      {
        path: 'setup-bridge',
        element: <SetupBridge />,
      },
      {
        path: 'migrate',
        element: <MigrateCeloNative />,
      },
      {
        path: '*',
        element: <Navigate to='/' replace />,
      },
    ],
  },
]);
