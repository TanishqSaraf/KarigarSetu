import { SearchX } from 'lucide-react';
import { ButtonLink, Card, EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <Card>
      <EmptyState
        icon={<SearchX size={20} />}
        title="Not found"
        body="This page or record does not exist. It may have been removed by a data reset."
        action={<ButtonLink to="/">Go to dashboard</ButtonLink>}
      />
    </Card>
  );
}
