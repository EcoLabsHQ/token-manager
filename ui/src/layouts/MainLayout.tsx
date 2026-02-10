import { Outlet } from 'react-router-dom';
import { Nav } from '../components';

export function MainLayout() {
  return (
    <div className="bg-gray-100 flex flex-col min-h-screen h-screen w-full rounded-xl overflow-hidden">
      <Nav />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
