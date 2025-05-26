'use client';

import Link from 'next/link';
import { Bird } from 'lucide-react'; // Twitter-like bird icon

export default function Header() {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary hover:text-accent transition-colors">
          <Bird className="h-7 w-7" />
          <span>TweetStorm</span>
        </Link>
        <nav>
          <ul className="flex items-center gap-4">
            <li>
              <Link href="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link href="/admin/login" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                Admin
              </Link>
            </li>
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
