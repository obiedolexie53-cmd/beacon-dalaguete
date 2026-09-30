import { Link } from 'react-router';
import { Camera, ClipboardCheck, MapPin, ShieldCheck } from 'lucide-react';
import { Logo, buttonClassName } from '@beacon/ui';

export function WelcomeScreen() {
  return (
    <div className="r-hero">
      <main className="r-screen r-hero__body">
        <Logo size={48} inverse />
        <h1>Report disasters directly to the Dalaguete MDRRMO</h1>
        <p className="r-hero__lead">
          Help your community by sending clear, verified information about hazards in your barangay.
        </p>
        <ul className="r-feature-list">
          <li>
            <MapPin size={20} aria-hidden="true" />
            Share the exact incident location
          </li>
          <li>
            <Camera size={20} aria-hidden="true" />
            Attach photos or videos as supporting evidence
          </li>
          <li>
            <ClipboardCheck size={20} aria-hidden="true" />
            Track the status of your reports
          </li>
          <li>
            <ShieldCheck size={20} aria-hidden="true" />
            Reports are reviewed by authorized MDRRMO personnel
          </li>
        </ul>
        <div className="r-hero__actions">
          <Link to="/register" className={buttonClassName('accent', { block: true })}>
            Create an account
          </Link>
          <Link to="/login" className={buttonClassName('secondary', { block: true })}>
            Log in
          </Link>
        </div>
      </main>
    </div>
  );
}
