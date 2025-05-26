
'use client';

import Link from 'next/link';
import { Bird } from 'lucide-react'; // Twitter-like bird icon
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  // const isAdminPage = pathname.startsWith('/admin'); // No longer needed for link visibility

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary hover:text-accent transition-colors mb-2 sm:mb-0">
          <Bird className="h-7 w-7" />
          <span>TweetTrendsTool</span>
        </Link>
        <nav>
          <ul className="flex items-center gap-4 flex-wrap justify-center">
            <li>
              <Link href="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                Home
              </Link>
            </li>
            {/* Admin Dashboard link removed entirely */}
            <li>
              <Link href="/trends" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                Trends
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

