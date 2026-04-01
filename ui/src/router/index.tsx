import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts';
import LandingPage from '@/pages/LandingPage';
import Dashboard from '@/pages/Dashboard';
import ExplorePage from '@/pages/ExplorePage';
import { CreateTokenPage } from '@/pages/CreateTokenPage';
import TokenManager from '@/pages/TokenManager';
import SetupBridge from '@/pages/SetupBridge';
import MigrateCeloNative from '@/pages/MigrateCeloNative';
import InternalPage from '@/pages/InternalPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: 'explore',
        element: <ExplorePage />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
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
        path: 'internal',
        element: <InternalPage />,
      },
      {
        path: '*',
        element: <Navigate to='/' replace />,
      },
    ],
  },
]);

