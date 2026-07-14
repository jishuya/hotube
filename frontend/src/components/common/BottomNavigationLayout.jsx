import { Outlet } from 'react-router-dom';
import BottomNavigation from './BottomNavigation';

const BottomNavigationLayout = () => (
  <div className="bottom-navigation-layout min-h-screen bg-background">
    <Outlet />
    <BottomNavigation />
  </div>
);

export default BottomNavigationLayout;
