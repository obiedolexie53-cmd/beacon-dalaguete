import { useNavigate } from 'react-router';
import { Card, PageHeader } from '@beacon/ui';
import { PrivacyNotice } from './PrivacyNotice';

export function PrivacyScreen() {
  const navigate = useNavigate();
  return (
    <main className="r-screen">
      <PageHeader title="Privacy Notice" onBack={() => navigate(-1)} />
      <Card>
        <PrivacyNotice />
      </Card>
    </main>
  );
}
