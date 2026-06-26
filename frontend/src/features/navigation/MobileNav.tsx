import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useBudget } from "../../app/providers/BudgetProvider";
import { Spinner } from "../../shared/ui";

export function MobileNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isLoading, transactions } = useBudget();

  if (isLoading && transactions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spinner size={48} />
          <p className="mt-4 text-gray-600">Loading budget data...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: "Overview", href: "/" },
    { name: "Insights", href: "/insights" },
    { name: "Imports", href: "/imports" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <nav className="bg-white sticky top-0 z-50 border-b border-gray-900/5 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-xl font-serif text-gray-900 tracking-tight">
              Budgeting App
            </Link>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-colors"
              aria-label="Menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="bg-white border-b border-gray-900/5 shadow-sm">
          <div className="px-4 pt-2 pb-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMenuOpen(false)}
                className="block px-3 py-3 rounded-xl text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-amber-50 hover:border border-amber-100/50 transition-all duration-200"
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
