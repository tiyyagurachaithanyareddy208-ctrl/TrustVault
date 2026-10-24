import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-context';

export const metadata: Metadata = {
  title: 'TrustVault | Secure Document Sharing Platform',
  description: 'Enterprise Document Management with Cryptographic Tamper-Evident Audit Trails',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-vault-950 text-slate-100 antialiased selection:bg-vault-accent/30 selection:text-vault-accent">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
