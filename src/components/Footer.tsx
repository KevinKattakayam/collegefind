import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-white mt-12">
      {/* Main Footer */}
      <div className="container-main py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 text-white font-bold text-xl no-underline mb-4 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center shadow-button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/>
                </svg>
              </div>
              CollegeFind
            </Link>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">Compare Indian colleges using official, cited data.</p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Sources cited on every page
            </div>
          </div>

          {/* Explore */}
          <div>
            <h3 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wider">Explore</h3>
            <div className="flex flex-col gap-2.5">
              {[['/colleges', 'Colleges'], ['/courses', 'Courses'], ['/exams', 'Exams'], ['/rankings', 'Rankings'], ['/articles', 'News & Articles']].map(([href, label]) => (
                <Link key={href} href={href} className="text-sm text-slate-400 hover:text-indigo-300 transition-colors no-underline">{label}</Link>
              ))}
            </div>
          </div>

          {/* Tools */}
          <div>
            <h3 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wider">Tools</h3>
            <div className="flex flex-col gap-2.5">
              {[['/compare', 'Compare Colleges'], ['/predictor', 'College Predictor'], ['/saved', 'Saved Colleges']].map(([href, label]) => (
                <Link key={href} href={href} className="text-sm text-slate-400 hover:text-indigo-300 transition-colors no-underline">{label}</Link>
              ))}
            </div>
          </div>

          {/* Top Streams */}
          <div>
            <h3 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wider">Top Streams</h3>
            <div className="flex flex-col gap-2.5">
              {[['/courses/btech', 'Engineering (B.Tech)'], ['/courses/mbbs', 'Medical (MBBS)'], ['/courses/mba', 'Management (MBA)'], ['/courses/llb', 'Law (LLB)'], ['/courses/bsc', 'Science (B.Sc)']].map(([href, label]) => (
                <Link key={href} href={href} className="text-sm text-slate-400 hover:text-indigo-300 transition-colors no-underline">{label}</Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs text-slate-500">© {currentYear} CollegeFind. All rights reserved.</span>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <span>Made with ❤️ in India</span>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">Built with Next.js + Prisma + Neon</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
