'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { getInitials } from '@/lib/utils';

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/colleges', label: 'Colleges' },
    { href: '/exams', label: 'Exams' },
    { href: '/courses', label: 'Courses' },
    { href: '/rankings', label: 'Rankings' },
    { href: '/compare', label: 'Compare' },
    { href: '/predictor', label: 'Predictor' },
    { href: '/articles', label: 'News' },
    ...(session ? [{ href: '/saved', label: 'Saved' }] : []),
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/80 backdrop-blur-xl shadow-nav-scroll border-b border-slate-200/60'
            : 'bg-white/95 backdrop-blur-md shadow-nav'
        }`}
      >
        <div className="container-main flex items-center justify-between h-[64px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 text-indigo-900 font-extrabold text-xl no-underline group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-button group-hover:shadow-search transition-shadow duration-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/>
              </svg>
            </div>
            <span className="tracking-tight">CollegeFind</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-all duration-200 no-underline ${
                  isActive(link.href)
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-slate-500 hover:text-indigo-700 hover:bg-slate-50'
                }`}>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Auth */}
          <div className="hidden lg:flex items-center gap-2.5">
            {status === 'loading' && <div className="skeleton w-[80px] h-[36px] rounded-lg" />}
            {status === 'unauthenticated' && (
              <>
                <Link href="/login" className="btn-ghost text-sm !h-[36px] !px-4 no-underline">Login</Link>
                <Link href="/register" className="btn-primary text-sm !h-[36px] !px-4 no-underline">Register</Link>
              </>
            )}
            {status === 'authenticated' && session?.user && (
              <div className="relative">
                <button onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-400 text-white flex items-center justify-center text-xs font-bold shadow-button">
                    {getInitials(session.user.name || 'U')}
                  </div>
                  <span className="max-w-[100px] truncate">{session.user.name}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
                </button>
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-modal border border-slate-200 py-1.5 z-50 animate-scale-in">
                      <Link href="/saved" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg mx-1.5 no-underline transition-colors" onClick={() => setDropdownOpen(false)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        Saved Colleges
                      </Link>
                      <div className="border-t border-slate-100 my-1" />
                      <button onClick={() => { signOut({ callbackUrl: '/' }); setDropdownOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error-600 hover:bg-error-50 rounded-lg mx-1.5 transition-colors text-left" style={{ width: 'calc(100% - 12px)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Hamburger */}
          <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 lg:hidden" onClick={() => setMobileOpen(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-[300px] bg-white z-50 p-6 animate-slide-in-right lg:hidden overflow-y-auto shadow-modal">
            <div className="flex items-center justify-between mb-8">
              <span className="text-lg font-bold text-slate-900">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {navLinks.map(link => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                  className={`text-base font-medium py-2.5 px-3 rounded-lg no-underline transition-colors ${isActive(link.href) ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700 hover:bg-slate-50'}`}>
                  {link.label}
                </Link>
              ))}
              <div className="border-t border-slate-100 my-3" />
              {status === 'unauthenticated' && (
                <div className="flex flex-col gap-2.5">
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="btn-outlined w-full text-center no-underline">Login</Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="btn-primary w-full text-center no-underline">Register</Link>
                </div>
              )}
              {status === 'authenticated' && (
                <button onClick={() => signOut({ callbackUrl: '/' })} className="btn-danger text-left py-2.5 px-3">Sign Out</button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Spacer for fixed nav */}
      <div className="h-[64px]" />

      <style jsx>{`
        @keyframes slide-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in-right { animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </>
  );
}
