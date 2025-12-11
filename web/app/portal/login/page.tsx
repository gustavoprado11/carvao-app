'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CheckCircle, RefreshCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '../../../src/components/Button';
import { useAuth } from '../../../src/providers/AuthProvider';
import type { ProfileType, SupplyAudience } from '@mobile/types/profile';

type Mode = 'signIn' | 'signUp';

const profileLabel: Record<ProfileType, string> = {
  supplier: 'Fornecedor',
  steel: 'Siderúrgica',
  admin: 'Administrador'
};

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, loading, profile } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [profileType, setProfileType] = useState<ProfileType>('supplier');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [location, setLocation] = useState('');
  const [supplyAudience, setSupplyAudience] = useState<SupplyAudience>('both');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (!loading && profile) {
      router.replace('/portal');
    }
  }, [loading, profile, router]);

  const title = mode === 'signIn' ? 'Entrar no portal' : 'Criar acesso web';
  const subtitle =
    mode === 'signIn'
      ? 'Use os mesmos dados do app para acessar a versão web.'
      : 'Cadastre fornecedores ou siderúrgicas com os mesmos fluxos do mobile.';

  const requireCompanyFields = mode === 'signUp' && profileType !== 'admin';

  const inputClass =
    'w-full h-14 rounded-2xl border border-slate-200/60 bg-[#f8fafd] px-4 text-[15px] font-medium text-ink-900 placeholder:text-ink-300 outline-none transition shadow-inner shadow-white focus:border-brand-200 focus:bg-white focus:ring-2 focus:ring-brand-100';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      if (mode === 'signIn') {
        await signIn({ email, password, profileType });
        router.replace('/portal');
        return;
      }
      if (profileType === 'admin') {
        throw new Error('Cadastro de administradores não está disponível pelo portal.');
      }
      const { needsEmailConfirmation } = await signUp({
        email,
        password,
        profileType,
        company,
        contact,
        location,
        supplyAudience
      });
      setFeedback(
        needsEmailConfirmation
          ? 'Enviamos um e-mail de confirmação. Valide o endereço e entre com sua senha.'
          : 'Conta criada com sucesso! Você já pode usar o portal.'
      );
      if (!needsEmailConfirmation) {
        router.replace('/portal');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível completar a ação.';
      setFeedback(message);
    } finally {
      setSubmitting(false);
    }
  };

  const roleOptions = useMemo(() => {
    return mode === 'signUp'
      ? (['supplier', 'steel'] as ProfileType[])
      : (['supplier', 'steel', 'admin'] as ProfileType[]);
  }, [mode]);

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_20%_20%,#e9f0ff_0%,#f5f8ff_55%,#f9fbff_100%)]">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-10 lg:max-w-6xl">
        <div className="grid w-full grid-cols-1 gap-10 rounded-[32px] bg-white/85 p-10 shadow-[0_30px_110px_rgba(19,49,95,0.12)] ring-1 ring-[#e3eaf9] backdrop-blur-2xl lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-7">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[14px] bg-white text-brand-700 shadow-inner shadow-white ring-1 ring-white/70">
                <Image src="/icon-1024.png" alt="Carvão Connect" width={48} height={48} className="h-10 w-10 object-contain" priority />
              </div>
              <div>
                <p className="text-sm font-semibold text-brand-700">Carvão Connect</p>
                <h1 className="text-[30px] font-extrabold leading-tight text-ink-900">{title}</h1>
                <p className="text-sm font-medium text-ink-500">{subtitle}</p>
              </div>
            </div>

            <div className="flex gap-2 rounded-full bg-[#eef2fb] p-1.5 text-sm font-semibold shadow-inner shadow-white/70 ring-1 ring-white/70">
              <button
                className={`flex-1 rounded-full px-4 py-2 transition ${
                  mode === 'signIn' ? 'bg-white text-brand-700 shadow-[0_8px_24px_rgba(60,125,246,0.25)]' : 'text-ink-500'
                }`}
                onClick={() => setMode('signIn')}
              >
                Entrar
              </button>
              <button
                className={`flex-1 rounded-full px-4 py-2 transition ${
                  mode === 'signUp' ? 'bg-white text-brand-700 shadow-[0_8px_24px_rgba(60,125,246,0.25)]' : 'text-ink-500'
                }`}
                onClick={() => setMode('signUp')}
              >
                Cadastrar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-400">Selecione seu perfil</p>
              <div className="flex items-center gap-2 rounded-full bg-[#eef2f9] p-1.5 shadow-inner shadow-white/80 ring-1 ring-[#e6ebf7]">
                {(['supplier', 'steel', 'admin'] as ProfileType[]).map(option => {
                  const isAvailable = roleOptions.includes(option);
                  const isActive = profileType === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => isAvailable && setProfileType(option)}
                      className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-white text-brand-800 shadow-[0_10px_26px_rgba(60,125,246,0.2)] ring-1 ring-brand-100'
                          : isAvailable
                          ? 'text-ink-500 hover:text-brand-800'
                          : 'text-ink-300 cursor-not-allowed'
                      }`}
                    >
                      {profileLabel[option]}
                    </button>
                  );
                })}
              </div>

              <label className="block space-y-1 text-sm font-semibold text-ink-700">
                E-mail corporativo
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="contato@empresa.com"
                />
              </label>

              <label className="block space-y-1 text-sm font-semibold text-ink-700">
                Senha
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </label>

              {requireCompanyFields ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block space-y-1 text-sm font-semibold text-ink-700">
                    Empresa
                    <input
                      type="text"
                      required
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      className={inputClass}
                      placeholder="Nome da empresa"
                    />
                  </label>
                  <label className="block space-y-1 text-sm font-semibold text-ink-700">
                    Responsável
                    <input
                      type="text"
                      required
                      value={contact}
                      onChange={e => setContact(e.target.value)}
                      className={inputClass}
                      placeholder="Contato principal"
                    />
                  </label>
                  <label className="block space-y-1 text-sm font-semibold text-ink-700">
                    Cidade / Estado
                    <input
                      type="text"
                      required
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      className={inputClass}
                      placeholder="Cidade, UF"
                    />
                  </label>
                  <label className="block space-y-1 text-sm font-semibold text-ink-700">
                    Perfil de fornecimento
                    <select
                      value={supplyAudience}
                      onChange={e => setSupplyAudience(e.target.value as SupplyAudience)}
                      className={inputClass}
                    >
                      <option value="pf">Forneço como PF</option>
                      <option value="pj">Forneço como PJ</option>
                      <option value="both">Atendo PF e PJ</option>
                    </select>
                  </label>
                </div>
              ) : null}

              {feedback ? <p className="text-sm text-amber-700">{feedback}</p> : null}

              <Button
                type="submit"
                loading={submitting}
                className="w-full h-14 justify-center gap-2 rounded-full bg-brand-600 py-3.5 text-base shadow-[0_16px_40px_rgba(60,125,246,0.35)] hover:bg-brand-700"
              >
                {mode === 'signIn' ? 'Entrar' : 'Criar conta'}
              </Button>
            </form>
          </div>

          <div className="relative overflow-hidden rounded-[30px] border border-white/60 bg-[radial-gradient(circle_at_20%_15%,#f4f7ff_0%,#dfe8ff_55%,#cfdafb_100%)] p-10 text-ink-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <div className="absolute -left-12 -top-16 h-48 w-48 rounded-full bg-white/40 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-brand-100/60 blur-3xl" />
            <div className="absolute inset-0 opacity-50 mix-blend-screen [background-image:radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(99,135,255,0.2),transparent_30%),radial-gradient(circle_at_60%_80%,rgba(149,178,255,0.18),transparent_32%)]" />
            <div className="relative space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 shadow-sm shadow-white/60">
                <Sparkles className="h-4 w-4" />
                Experiência igual ao app
              </div>
              <h2 className="text-[34px] font-extrabold leading-tight text-ink-900">Conectando Fornecedores à Siderúrgicas</h2>
              <p className="text-[15px] text-ink-600">
                Gerencie suas negociações, documentos e tabelas com a visão ampliada que o seu escritório precisa, totalmente integrado ao app mobile.
              </p>
              <ul className="space-y-3 text-[15px] text-ink-600">
                <li className="flex items-start gap-3">
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-white/70 text-brand-700 shadow-sm">
                    <CheckCircle className="h-4 w-4" />
                  </span>
                  <span>Multiplataforma.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-white/70 text-brand-700 shadow-sm">
                    <CheckCircle className="h-4 w-4" />
                  </span>
                  <span>Controle Total.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-white/70 text-brand-700 shadow-sm">
                    <RefreshCcw className="h-4 w-4" />
                  </span>
                  <span>Agilidade.</span>
                </li>
                <li className="flex items-start gap-3 rounded-2xl border border-white/50 bg-white/55 px-4 py-3 shadow-sm shadow-white/40 backdrop-blur-sm">
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-50 text-brand-800 shadow-[0_10px_30px_rgba(12,60,158,0.14)] ring-1 ring-white/70">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <span>
                    <p className="text-sm font-semibold text-brand-800">Mesma navegação</p>
                    <p className="text-sm text-ink-600">
                      Tabelas, documentos, conversas e aprovações. Nada muda, só a tela.
                    </p>
                  </span>
                </li>
              </ul>
              <Link href="https://carvaoconnect.com.br" className="inline-flex text-sm font-semibold text-brand-700 underline underline-offset-4">
                Voltar para o site institucional
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
