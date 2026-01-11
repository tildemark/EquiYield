'use client';

import { useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  Code2,
  Copy,
  ExternalLink,
  Github,
  Network,
  Server,
  ShieldCheck,
  User,
  Zap,
} from 'lucide-react';

const docs = [
  {
    title: 'Architecture',
    description: 'System Design & Stack',
    details: 'Explore the full-stack architecture: Express.js API, Next.js frontend, Prisma ORM, PostgreSQL, Redis, and Docker containerization.',
    href: 'https://github.com/tildemark/EquiYield#architecture',
    Icon: Network,
    accent: 'from-cyan-400/30 via-cyan-500/10 to-transparent',
  },
  {
    title: 'Admin Guide',
    description: 'Operational Manual',
    details: 'Complete operational guide covering member management, contribution processing, loan approvals, dividend distributions, and system configuration.',
    href: 'https://github.com/tildemark/EquiYield/blob/main/ADMIN_GUIDE.md',
    Icon: BookOpen,
    accent: 'from-indigo-400/30 via-indigo-500/10 to-transparent',
  },
  {
    title: 'Deployment',
    description: 'OCI & Docker Setup',
    details: 'Step-by-step deployment instructions for OCI Cloud, Docker Compose production setup, environment configuration, and SSL certificates.',
    href: 'https://github.com/tildemark/EquiYield/blob/main/DEPLOYMENT.md',
    Icon: Server,
    accent: 'from-emerald-400/30 via-emerald-500/10 to-transparent',
  },
  {
    title: 'Source Code',
    description: 'Full Repository',
    details: 'Browse the complete, production-ready codebase on GitHub. TypeScript, React, Express.js, and Prisma with comprehensive documentation.',
    href: 'https://github.com/tildemark/EquiYield',
    Icon: Code2,
    accent: 'from-purple-400/30 via-purple-500/10 to-transparent',
  },
  {
    title: 'Blog Post',
    description: 'Read the Story',
    details: 'Read the detailed case study and technical journey behind building EquiYield, design decisions, and lessons learned.',
    href: 'https://blog.sanchez.ph/posts/2025-01-10-equiyield',
    Icon: Zap,
    accent: 'from-orange-400/30 via-orange-500/10 to-transparent',
  },
];

type CopyKey =
  | 'admin-email'
  | 'admin-password'
  | 'member-email'
  | 'member-password';

export default function LandingPage() {
  const [copiedField, setCopiedField] = useState<CopyKey | null>(null);

  const copyToClipboard = (text: string, field: CopyKey) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-800/25 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-200 text-sm font-medium shadow-lg shadow-sky-900/40">
              <span className="w-2 h-2 bg-sky-300 rounded-full animate-pulse" />
              v1.0.0 Live Demo
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-slate-100 via-sky-200 to-slate-200 bg-clip-text text-transparent">
                EquiYield
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-slate-300 font-light max-w-3xl mx-auto">
              Full-Stack Cooperative Savings & Loan Management System
            </p>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Production-ready architecture for member contributions, loans, dividends, and operational controls.
            </p>
          </div>
        </div>
      </div>

      {/* Access Cards */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-semibold">Access the Live Demo</h2>
          <p className="text-slate-400 mt-2">Choose a portal to explore capabilities.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <AccessCard
            title="Admin Portal"
            description="Full management access"
            href="/admin/login"
            icon={ShieldCheck}
            color="blue"
            email="admin@equiyield.local"
            password="Admin@123456"
            copiedField={copiedField}
            copyToClipboard={copyToClipboard}
          />

          <AccessCard
            title="Member Portal"
            description="Self-service dashboard"
            href="/member/login"
            icon={User}
            color="emerald"
            email="juan.delacruz@demo.com"
            password="Member@123"
            copiedField={copiedField}
            copyToClipboard={copyToClipboard}
          />
        </div>
      </section>

      {/* Documentation */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold">Project Documentation</h2>
          <p className="text-slate-400 mt-2">Deep dives into the system architecture, operations, and deployment.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {docs.map(({ title, description, details, href, Icon, accent }) => (
            <a
              key={title}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl p-8 shadow-2xl shadow-black/40 overflow-hidden transition hover:border-sky-500/50 hover:shadow-sky-500/10 hover:shadow-2xl"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-50 group-hover:opacity-70 transition duration-300`} />
              
              <div className="relative space-y-4">
                <div className="w-14 h-14 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center group-hover:bg-white/25 transition">
                  <Icon className="w-7 h-7 text-slate-50" />
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">{title}</h3>
                  <p className="text-sm text-sky-200 font-medium">{description}</p>
                </div>

                <p className="text-slate-200 text-sm leading-relaxed">
                  {details}
                </p>

                <div className="flex items-center gap-2 text-sky-300 text-sm font-medium pt-2 group-hover:gap-3 transition-all">
                  <span>Learn more</span>
                  <ExternalLink className="w-4 h-4" />
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-400 text-sm text-center sm:text-left">
            Built by Alfredo Sanchez Jr | <a href="https://blog.sanchez.ph/posts/2025-01-10-equiyield" target="_blank" rel="noopener noreferrer">Read the Blog Post</a>
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/tildemark/EquiYield"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white transition"
              aria-label="GitHub repository"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

type AccessCardProps = {
  title: string;
  description: string;
  href: string;
  icon: typeof ShieldCheck;
  color: 'blue' | 'emerald';
  email: string;
  password: string;
  copiedField: CopyKey | null;
  copyToClipboard: (text: string, field: CopyKey) => void;
};

function AccessCard({
  title,
  description,
  href,
  icon: Icon,
  color,
  email,
  password,
  copiedField,
  copyToClipboard,
}: AccessCardProps) {
  const ring = color === 'blue' ? 'from-sky-500 to-blue-500' : 'from-emerald-500 to-teal-500';
  const badge = color === 'blue' ? 'bg-sky-500/10 text-sky-200 border-sky-500/30' : 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30';

  return (
    <div className="group relative">
      <div className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-r ${ring} opacity-30 blur transition duration-300 group-hover:opacity-50`} />
      <div className="relative rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-8 shadow-2xl shadow-black/30 transition duration-300 group-hover:border-white/20">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border ${badge}`}>
              <Icon className="w-4 h-4" />
              Portal
            </span>
            <div>
              <h3 className="text-2xl font-semibold text-white">{title}</h3>
              <p className="text-slate-400 text-sm">{description}</p>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <CredentialRow
            label="Email"
            value={email}
            field={color === 'blue' ? 'admin-email' : 'member-email'}
            copiedField={copiedField}
            copyToClipboard={copyToClipboard}
          />
          <CredentialRow
            label="Password"
            value={password}
            field={color === 'blue' ? 'admin-password' : 'member-password'}
            copiedField={copiedField}
            copyToClipboard={copyToClipboard}
          />
        </div>

        <a
          href={href}
          className={`group/btn inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${
            color === 'blue'
              ? 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 focus:ring-sky-400'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 focus:ring-emerald-400'
          }`}
        >
          {title === 'Admin Portal' ? 'Launch Admin Console' : 'Launch Member Portal'}
          <ExternalLink className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
        </a>
      </div>
    </div>
  );
}

type CredentialRowProps = {
  label: string;
  value: string;
  field: CopyKey;
  copiedField: CopyKey | null;
  copyToClipboard: (text: string, field: CopyKey) => void;
};

function CredentialRow({ label, value, field, copiedField, copyToClipboard }: CredentialRowProps) {
  const copied = copiedField === field;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="font-mono text-sm text-slate-100 break-all">{value}</p>
      </div>
      <button
        onClick={() => copyToClipboard(value, field)}
        className="rounded-lg border border-white/10 bg-white/10 p-2 text-slate-200 transition hover:border-white/30 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
        aria-label={`Copy ${label}`}
      >
        {copied ? <CheckCircle className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
