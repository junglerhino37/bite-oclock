"use client";

/** "Take me there" — hands the spot to the phone's own navigation world by
 * name + address (never raw coordinates): Android's geo: intent opens the
 * user's default maps app (Waze included), iOS gets Apple Maps, desktop gets
 * Google Maps directions in a tab. */
export default function NavButton({ name, address }: { name: string; address: string }) {
  const go = () => {
    const q = encodeURIComponent(address ? `${name}, ${address}` : `${name}, Houston, TX`);
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
      window.location.href = `geo:0,0?q=${q}`;
    } else if (/iPad|iPhone|iPod/.test(ua)) {
      window.location.href = `https://maps.apple.com/?daddr=${q}`;
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, "_blank", "noopener");
    }
  };
  return (
    <button
      onClick={go}
      className="rounded-full bg-primary px-3.5 py-1 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover"
    >
      🧭 Take me there
    </button>
  );
}
