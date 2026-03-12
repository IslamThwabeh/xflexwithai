import { MessageCircle } from 'lucide-react';
import { useLocation } from 'wouter';

const WHATSAPP_NUMBER = '972597596030';

export default function WhatsAppFloat() {
  const [location] = useLocation();
  // Only show on public pages (not admin or authenticated student pages)
  const studentPaths = ['/courses', '/lexai', '/recommendations', '/support', '/quiz', '/orders', '/subscriptions', '/profile', '/notifications', '/my-points', '/calculators', '/dashboard', '/course/', '/upgrade'];
  if (location.startsWith('/admin')) return null;
  if (studentPaths.some(p => location.startsWith(p))) return null;

  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-20 end-5 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 hover:scale-110 transition-all duration-200 group"
    >
      <MessageCircle className="w-7 h-7" />
      <span className="absolute end-full me-3 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        WhatsApp
      </span>
    </a>
  );
}
