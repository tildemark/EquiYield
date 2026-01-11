'use client';

import { useState } from 'react';
import { CheckCircle, Copy, ExternalLink, Github, BookOpen, FileText } from 'lucide-react';

export default function LandingPage() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              Live Demo v1.0
            </div>

            {/* Title */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                EquiYield
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl sm:text-2xl text-slate-400 max-w-3xl mx-auto font-light">
              Full-Stack Cooperative Savings & Loan Management System
            </p>

            <p className="text-slate-500 max-w-2xl mx-auto">
              Production-ready application for managing member contributions, loans, dividend distributions, 
              and financial records with enterprise-grade architecture.
            </p>
          </div>
        </div>
      </div>

      {/* Try It Live Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Try It Live</h2>
          <p className="text-slate-400">Choose your portal to explore the full feature set</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Admin Portal Card */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl opacity-20 group-hover:opacity-30 blur transition duration-300"></div>
            <div className="relative bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-8 hover:border-slate-700 transition-all duration-300">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-blue-400 mb-2">Admin Portal</h3>
                  <p className="text-slate-400 text-sm">Full management access & control panel</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {/* Email Credential */}
                <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                  <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Email</label>
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-slate-200 font-mono text-sm break-all">admin@equiyield.local</code>
                    <button
                      onClick={() => copyToClipboard('admin@equiyield.local', 'admin-email')}
                      className="flex-shrink-0 p-2 hover:bg-slate-800 rounded-md transition-colors"
                      aria-label="Copy email"
                    >
                      {copiedField === 'admin-email' ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password Credential */}
                <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                  <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Password</label>
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-slate-200 font-mono text-sm">Admin@123456</code>
                    <button
                      onClick={() => copyToClipboard('Admin@123456', 'admin-password')}
                      className="flex-shrink-0 p-2 hover:bg-slate-800 rounded-md transition-colors"
                      aria-label="Copy password"
                    >
                      {copiedField === 'admin-password' ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <a
                href="/admin/login"
                className="block w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 text-center group/btn"
              >
                <span className="flex items-center justify-center gap-2">
                  Launch Admin Console
                  <ExternalLink className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </span>
              </a>
            </div>
          </div>

          {/* Member Portal Card */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl opacity-20 group-hover:opacity-30 blur transition duration-300"></div>
            <div className="relative bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-8 hover:border-slate-700 transition-all duration-300">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-emerald-400 mb-2">Member Portal</h3>
                  <p className="text-slate-400 text-sm">Self-service dashboard & loan application</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {/* Email Credential */}
                <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                  <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Email</label>
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-slate-200 font-mono text-sm break-all">juan.delacruz@demo.com</code>
                    <button
                      onClick={() => copyToClipboard('juan.delacruz@demo.com', 'member-email')}
                      className="flex-shrink-0 p-2 hover:bg-slate-800 rounded-md transition-colors"
                      aria-label="Copy email"
                    >
                      {copiedField === 'member-email' ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password Credential */}
                <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                  <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Password</label>
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-slate-200 font-mono text-sm">Member@123</code>
                    <button
                      onClick={() => copyToClipboard('Member@123', 'member-password')}
                      className="flex-shrink-0 p-2 hover:bg-slate-800 rounded-md transition-colors"
                      aria-label="Copy password"
                    >
                      {copiedField === 'member-password' ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <a
                href="/member/login"
                className="block w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 text-center group/btn"
              >
                <span className="flex items-center justify-center gap-2">
                  Launch Member Portal
                  <ExternalLink className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Key Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Core Features</h2>
          <p className="text-slate-400">Enterprise-grade functionality for cooperative management</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: 'Member Management', desc: 'Profile management, share tracking, eligibility control' },
            { title: 'Contribution Recording', desc: 'Multiple payment methods, audit trail, status tracking' },
            { title: 'Loan Management', desc: 'Application workflow, approval process, payment tracking' },
            { title: 'Dividend Distribution', desc: 'Bulk payouts, cycle-based eligibility, pro-rata calculation' },
            { title: 'Transaction Ledger', desc: 'Complete member financial history and audit trail' },
            { title: 'Admin Dashboard', desc: 'Comprehensive control panel with filters and analytics' },
            { title: 'Member Portal', desc: 'Self-service dashboard with loan application' },
            { title: 'Expense Tracking', desc: 'Profit pool management with Redis caching' },
            { title: 'Archive System', desc: 'Historical data management and reporting' },
          ].map((feature, idx) => (
            <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h3 className="font-semibold text-slate-200 mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400">{feature.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resources Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Resources</h2>
          <p className="text-slate-400">Explore the technical implementation and architecture</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <a
            href="https://sanchez.ph"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-slate-900/50 border border-slate-800 rounded-lg p-6 hover:border-blue-500/50 hover:bg-slate-900 transition-all"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <BookOpen className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Case Study</h3>
                <p className="text-sm text-slate-400">Read the full story</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
            </div>
          </a>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-slate-900/50 border border-slate-800 rounded-lg p-6 hover:border-emerald-500/50 hover:bg-slate-900 transition-all"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <Github className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Source Code</h3>
                <p className="text-sm text-slate-400">View on GitHub</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </div>
          </a>

          <a
            href="/admin/login"
            className="group bg-slate-900/50 border border-slate-800 rounded-lg p-6 hover:border-cyan-500/50 hover:bg-slate-900 transition-all"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                <FileText className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Architecture</h3>
                <p className="text-sm text-slate-400">Technical documentation</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            </div>
          </a>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Tech Stack</h2>
          <p className="text-slate-400">Built with modern, production-ready technologies</p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
          {[
            { name: 'Next.js 15', color: 'from-slate-400 to-slate-600' },
            { name: 'TypeScript', color: 'from-blue-400 to-blue-600' },
            { name: 'Prisma ORM', color: 'from-teal-400 to-teal-600' },
            { name: 'PostgreSQL', color: 'from-blue-500 to-blue-700' },
            { name: 'Redis', color: 'from-red-400 to-red-600' },
            { name: 'Docker', color: 'from-blue-400 to-cyan-500' },
            { name: 'Express.js', color: 'from-gray-400 to-gray-600' },
            { name: 'Tailwind CSS', color: 'from-cyan-400 to-blue-500' },
          ].map((tech, idx) => (
            <div
              key={idx}
              className="px-6 py-3 bg-slate-900/50 border border-slate-800 rounded-full hover:border-slate-700 transition-colors"
            >
              <span className={`bg-gradient-to-r ${tech.color} bg-clip-text text-transparent font-semibold`}>
                {tech.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">
              © 2026 EquiYield. Built for cooperative financial management.
            </p>
            <a
              href="https://sanchez.ph"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors flex items-center gap-1"
            >
              sanchez.ph
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
