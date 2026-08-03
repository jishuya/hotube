import { Outlet } from 'react-router-dom';
import BottomNavigation from './BottomNavigation';
import PushNotificationPrompt from './PushNotificationPrompt';

const BottomNavigationLayout = () => (
  <div className="bottom-navigation-layout min-h-screen bg-background">
    <Outlet />
    <PushNotificationPrompt />
    <BottomNavigation />
  </div>
);

export default BottomNavigationLayout;
