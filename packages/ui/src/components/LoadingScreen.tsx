import { Spinner } from './Spinner';

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="bcn-loading-screen">
      <Spinner label="" />
      <span>{label}</span>
    </div>
  );
}
