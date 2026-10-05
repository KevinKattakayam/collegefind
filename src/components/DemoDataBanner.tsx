/**
 * Site-wide notice shown while the catalogue contains demo rows.
 * Controlled by NEXT_PUBLIC_DATA_NOTICE (default "demo"); set to "off" once
 * every visible number comes from a cited source.
 */
export default function DemoDataBanner() {
  if (process.env.NEXT_PUBLIC_DATA_NOTICE === 'off') return null;
  return (
    <div role="note" className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
      <div className="container-main py-2">
        <strong className="font-semibold">Demo data:</strong> college fees, placement figures and other numbers marked
        &ldquo;Demo data&rdquo; are sample values, not facts. Check the official college and counselling websites before
        making any decision.
      </div>
    </div>
  );
}
