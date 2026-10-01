import { FileInput } from 'lucide-react';
import { Badge } from '@beacon/ui';

/** Marks records imported from MDRRMO files (not submitted through the resident app). */
export function ImportedBadge() {
  return (
    <Badge tone="neutral" icon={<FileInput size={12} aria-hidden="true" />}>
      Imported
    </Badge>
  );
}
