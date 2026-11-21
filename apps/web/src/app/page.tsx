import { MHD_SCHEMA_VERSION } from '@musichub/music-model';
import { getApiHealth } from '@/lib/api-health';

// Health must reflect the API at request time, never a build-time snapshot.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const health = await getApiHealth();

  return (
    <main>
      <h1>MusicHub</h1>
      <p data-testid="api-health">API: {health}</p>
      <p>Document schema v{MHD_SCHEMA_VERSION}</p>
    </main>
  );
}
