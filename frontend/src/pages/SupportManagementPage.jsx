import { useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import SupportManagement from '../components/admin/SupportManagement';

const SupportManagementPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-background px-4 pb-20 pt-4 text-text-primary sm:px-6 sm:pt-6">
        <div className="mx-auto max-w-5xl">
          <SupportManagement onBack={() => navigate('/mypage')} />
        </div>
      </main>
    </>
  );
};

export default SupportManagementPage;
