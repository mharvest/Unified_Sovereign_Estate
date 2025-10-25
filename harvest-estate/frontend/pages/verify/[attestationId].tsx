import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { fetchVerification, type VerifyResponse } from '../../lib/api';

export default function VerifyPage() {
  const router = useRouter();
  const { attestationId } = router.query;
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoArchive, setAutoArchive] = useState(false);

  useEffect(() => {
    if (!attestationId || typeof attestationId !== 'string') return;
    setLoading(true);
    fetchVerification(attestationId)
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [attestationId]);

  const dossier = useMemo(() => {
    if (!data) return null;
    return {
      attestation: data.attestation,
      affidavit: data.affidavit as Record<string, unknown> | null,
      docs: data.safeVault.docHashes ?? [],
    };
  }, [data]);

  const handleDownloadPdf = async () => {
    if (!dossier || typeof attestationId !== 'string') return;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const draw = (text: string, x: number, y: number, size = 12) => {
      page.drawText(text, { x, y, size, font, color: rgb(1, 1, 1) });
    };

    let cursor = 752;
    draw('Harvest Estate — Sovereign Dossier', 40, cursor, 18);
    cursor -= 30;
    draw(`Attestation: ${dossier.attestation.id}`, 40, cursor);
    cursor -= 18;
    draw(`Clause: ${dossier.attestation.clause}`, 40, cursor);
    cursor -= 18;
    draw(`Jurisdiction: ${dossier.attestation.jurisdiction}`, 40, cursor);
    cursor -= 18;
    draw(`Timestamp: ${new Date(Number(dossier.attestation.timestamp) * 1000).toISOString()}`, 40, cursor);
    cursor -= 24;
    draw('SafeVault Documents:', 40, cursor, 14);
    cursor -= 18;
    if (dossier.docs.length === 0) {
      draw('No documents recorded.', 60, cursor);
      cursor -= 18;
    } else {
      dossier.docs.forEach((hash) => {
        draw(`• ${hash}`, 60, cursor, 10);
        cursor -= 14;
      });
    }

    cursor -= 12;
    draw('Affidavit Snapshot:', 40, cursor, 14);
    cursor -= 18;
    if (dossier.affidavit) {
      Object.entries(dossier.affidavit).forEach(([key, value]) => {
        draw(`${key}: ${String(value)}`, 60, cursor, 10);
        cursor -= 14;
      });
    } else {
      draw('No affidavit payload returned.', 60, cursor);
      cursor -= 18;
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dossier-${attestationId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    if (autoArchive) {
      alert('SafeVault archive toggle is enabled — archive request queued (demo stub).');
    }
  };

  return (
    <>
      <Head>
        <title>Verification — Harvest Estate</title>
      </Head>
      <main className="min-h-screen bg-[#050012] px-6 py-10 text-gray-100">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-6 text-sm text-violet-300 hover:text-violet-200"
          >
            ← Back to dashboard
          </button>

          {loading && <p className="text-gray-400">Loading verification data…</p>}
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-900/20 p-4 text-rose-200">
              {error}
            </div>
          )}

          {dossier && (
            <div className="space-y-10">
              <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
                <h1 className="text-2xl font-semibold text-white">Attestation Summary</h1>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <InfoBlock label="Attestation ID" value={dossier.attestation.id} />
                  <InfoBlock label="Subject" value={dossier.attestation.subjectId} />
                  <InfoBlock label="Clause" value={dossier.attestation.clause} />
                  <InfoBlock label="Jurisdiction" value={dossier.attestation.jurisdiction} />
                  <InfoBlock label="Attestor" value={dossier.attestation.attestor} />
                  <InfoBlock
                    label="Timestamp"
                    value={new Date(Number(dossier.attestation.timestamp) * 1000).toLocaleString()}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
                <h2 className="text-xl font-semibold text-white">SafeVault Document Hashes</h2>
                <ul className="mt-4 space-y-2">
                  {dossier.docs.length === 0 && <li className="text-sm text-gray-400">No hashes recorded.</li>}
                  {dossier.docs.map((hash, index) => (
                    <li
                      key={index}
                      className="rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-sm text-violet-200"
                    >
                      {hash}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Batch Dossier Export</h2>
                    <p className="text-sm text-gray-400">
                      Generate a hashed dossier PDF and optionally queue SafeVault auto-archive.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="autoArchive"
                      type="checkbox"
                      className="h-4 w-4 rounded border border-white/20 bg-white/10"
                      checked={autoArchive}
                      onChange={(event) => setAutoArchive(event.target.checked)}
                    />
                    <label htmlFor="autoArchive" className="text-sm text-gray-300">
                      Auto-archive to SafeVault (beta)
                    </label>
                  </div>
                </div>
                <button
                  onClick={handleDownloadPdf}
                  className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
                >
                  Download Dossier PDF
                </button>
              </section>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

interface InfoBlockProps {
  label: string;
  value: string;
}

function InfoBlock({ label, value }: InfoBlockProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-4 text-sm">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 break-all text-white">{value}</p>
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
