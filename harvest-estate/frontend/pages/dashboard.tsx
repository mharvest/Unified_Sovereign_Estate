import Head from 'next/head';
import { NavTicker } from '../components/NavTicker';
import { RedeemPanel } from '../components/RedeemPanel';
import { FiduciaryConsolePanel } from '../components/FiduciaryConsolePanel';
import { EyeionHashCard } from '../components/EyeionHashCard';

export default function Dashboard() {
  return (
    <>
      <Head>
        <title>Harvest Estate Fiduciary Console</title>
      </Head>
      <main className="min-h-screen space-y-8 bg-[#070013] px-6 py-10">
        <section className="mx-auto max-w-5xl space-y-6">
          <div className="text-sm uppercase tracking-[0.4em] text-violet-400">Unified Sovereign Estate</div>
          <h1 className="text-4xl font-semibold text-violet-200">Fiduciary Dashboard</h1>
          <p className="text-sm text-gray-400">
            Real-time NAV, redemption orchestration, and Eyeion verification for auditors and trustees.
          </p>
        </section>

        <section className="mx-auto max-w-5xl space-y-6">
          <NavTicker />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <RedeemPanel />
              <FiduciaryConsolePanel />
            </div>
            <EyeionHashCard />
          </div>
        </section>
      </main>
    </>
  );
}
