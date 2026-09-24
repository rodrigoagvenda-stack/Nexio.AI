'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Lock, RefreshCw } from 'lucide-react';
import { MetaWhatsAppConnect } from '@/components/sdr/MetaWhatsAppConnect';

// Tela do Atendimento quando não há WhatsApp conectado. Duas formas de conectar, como no Paper:
//  - uazapi: lê um QR code com o celular (estados: aguardando leitura, código expirado, conectando)
//  - API oficial da Meta (CoEx): entra com o Facebook em uma janela da Meta, sem QR
const SYS = 'system-ui, sans-serif';

// A uazapi expira o QR code em 2 minutos (documentação da uazapi, /instance/connect)
const QR_TTL_MS = 120_000;

interface Props {
  provider: 'uazapi' | 'meta';
  status: 'disconnected' | 'connecting' | 'connected';
  qrcode: string | null;
  pairingCode: string | null;
  /** o pedido de novo QR está em andamento */
  generating: boolean;
  onGenerate: () => void;
  onMetaConnected: (phoneNumberId: string, wabaId: string, token: string, phone: string) => void;
}

function StepDot({ n }: { n: number }) {
  return (
    <span style={{ width: 28, height: 28, borderRadius: 14, background: '#12301F', color: '#96F63C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, lineHeight: '16px' }}>
      {n}
    </span>
  );
}

function Spinner({ size = 16 }: { size?: number }) {
  return <span className="animate-spin flex-shrink-0" style={{ width: size, height: size, borderRadius: size / 2, border: '2px solid #262626', borderTopColor: '#96F63C' }} aria-hidden="true" />;
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center" style={{ gap: 8, color: '#737373', fontSize: 14, lineHeight: '18px' }}>
      <Lock size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row w-full overflow-hidden" style={{ maxWidth: 1000, background: '#101010', border: '1px solid #1C1C1C', borderRadius: 24 }}>
      {children}
    </div>
  );
}

function MetaScreen({ onConnected }: { onConnected: Props['onMetaConnected'] }) {
  const points = [
    'Você continua usando o WhatsApp Business no celular, ao mesmo tempo que o Zaapply',
    'Sem risco de perder o número, desde que siga as políticas de uso do WhatsApp',
    'Quem chega por anúncio que abre o WhatsApp tem 72 horas de conversa',
  ];
  const steps = [
    'Clique em Conectar com a Meta',
    'Entre com o Facebook da empresa',
    'Siga as etapas da Meta para escolher o número',
    'Ao terminar, a janela fecha e as conversas aparecem aqui',
  ];
  return (
    <>
      <Card>
        <div className="flex flex-1 flex-col" style={{ gap: 28, padding: 48 }}>
          <div className="flex flex-col" style={{ gap: 12 }}>
            <span className="inline-flex items-center self-start" style={{ gap: 8, padding: '6px 12px', borderRadius: 999, background: '#12301F', border: '1px solid #01573C', color: '#96F63C', fontSize: 13, fontWeight: 600, lineHeight: '16px' }}>
              <Check size={14} strokeWidth={2.4} /> API oficial da Meta
            </span>
            <h1 style={{ margin: 0, color: '#fff', fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '40px' }}>Conecte o WhatsApp da sua empresa</h1>
            <p style={{ margin: 0, color: '#A3A3A3', fontSize: 16, lineHeight: '24px' }}>Você entra com o Facebook e escolhe o número. Sem QR code.</p>
          </div>
          <ul className="flex flex-col" style={{ gap: 18, margin: 0, padding: 0, listStyle: 'none' }}>
            {points.map((p) => (
              <li key={p} className="flex items-start" style={{ gap: 14 }}>
                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 22, height: 22, borderRadius: 11, background: '#12301F', marginTop: 1 }}>
                  <Check size={12} strokeWidth={3.2} color="#96F63C" />
                </span>
                <span style={{ color: '#E5E5E5', fontSize: 16, lineHeight: '23px' }}>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col justify-center md:flex-shrink-0 md:w-[440px]" style={{ gap: 28, padding: 48, background: '#0E0E0E', borderLeft: '1px solid #1C1C1C' }}>
          <div style={{ color: '#737373', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', lineHeight: '16px' }}>COMO FUNCIONA</div>
          <ol className="flex flex-col" style={{ gap: 16, margin: 0, padding: 0, listStyle: 'none' }}>
            {steps.map((s, i) => (
              <li key={s} className="flex items-center" style={{ gap: 14 }}>
                <StepDot n={i + 1} />
                <span style={{ color: '#E5E5E5', fontSize: 15, lineHeight: '18px' }}>{s}</span>
              </li>
            ))}
          </ol>
          <MetaWhatsAppConnect connected={false} appearance="pill" onConnected={onConnected} onDisconnect={() => {}} />
        </div>
      </Card>
      <Footer>A conexão é feita direto com a Meta, numa janela própria dela</Footer>
    </>
  );
}

function QrScreen({ status, qrcode, pairingCode, generating, onGenerate }: Omit<Props, 'provider' | 'onMetaConnected'>) {
  const [expired, setExpired] = useState(false);
  const [lastQr, setLastQr] = useState<string | null>(null);
  const hadQr = useRef(false);

  // Cada QR novo zera o relógio; se passar de 2 minutos sem ser lido, o código expirou
  useEffect(() => {
    if (!qrcode) return;
    hadQr.current = true;
    setLastQr(qrcode);
    setExpired(false);
    const t = setTimeout(() => setExpired(true), QR_TTL_MS);
    return () => clearTimeout(t);
  }, [qrcode]);

  // Havia QR e ele sumiu com a instância ainda "conectando": o celular leu o código e o WhatsApp está sincronizando
  const scanned = status === 'connecting' && !qrcode && !pairingCode && hadQr.current && !generating && !expired;
  const showsExpired = expired && !!qrcode && !scanned;
  const waiting = !!qrcode && !expired;
  const preparing = !qrcode && !pairingCode && !scanned && !showsExpired;

  const badge = scanned ? 'Conectando' : 'WhatsApp desconectado';
  const steps = [
    'Abra o WhatsApp no seu celular',
    'Toque em Mais opções e depois em Aparelhos conectados',
    'Toque em Conectar um aparelho',
    'Aponte o celular para o QR code ao lado',
  ];

  const qrImage = (faded: boolean) => (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, opacity: faded ? 0.12 : 1, transition: 'opacity .3s' }}>
      {(qrcode ?? lastQr) ? (
        <img src={`data:image/png;base64,${qrcode ?? lastQr}`} alt={faded ? '' : 'QR code para conectar o WhatsApp'} width={200} height={200} style={{ display: 'block', width: 200, height: 200 }} />
      ) : (
        <div style={{ width: 200, height: 200, background: '#111', borderRadius: 4 }} />
      )}
    </div>
  );

  return (
    <>
      <Card>
        <div className="flex flex-1 flex-col" style={{ gap: 28, padding: 48 }}>
          <div className="flex flex-col" style={{ gap: 12 }}>
            <span className="inline-flex items-center self-start" style={{ gap: 8, padding: '6px 12px', borderRadius: 999, background: '#2A2410', border: '1px solid #4A3F16', color: '#F3E3B0', fontSize: 13, fontWeight: 600, lineHeight: '16px' }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: '#E9C46A' }} /> {badge}
            </span>
            <h1 style={{ margin: 0, color: '#fff', fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '40px' }}>Conecte o seu WhatsApp para atender</h1>
            <p style={{ margin: 0, color: '#A3A3A3', fontSize: 16, lineHeight: '24px' }}>Leva menos de um minuto. Depois disso, as conversas aparecem aqui.</p>
          </div>
          <ol className="flex flex-col" style={{ gap: 18, margin: 0, padding: 0, listStyle: 'none' }}>
            {steps.map((s, i) => (
              <li key={s} className="flex items-center" style={{ gap: 14 }}>
                <StepDot n={i + 1} />
                <span style={{ color: '#E5E5E5', fontSize: 16, lineHeight: '20px' }}>{s}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating || scanned}
            className="inline-flex items-center self-start transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ gap: 8, color: '#96F63C', fontSize: 15, fontWeight: 600, lineHeight: '18px' }}
          >
            <RefreshCw size={16} strokeWidth={2.2} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Gerando o código…' : 'Gerar novo QR code'}
          </button>
        </div>

        <div className="flex flex-col items-center justify-center md:flex-shrink-0 md:w-[440px]" style={{ gap: 24, padding: 48, background: '#0E0E0E', borderLeft: '1px solid #1C1C1C', minHeight: 360 }}>
          {pairingCode && !qrcode && !scanned ? (
            <>
              <p style={{ margin: 0, color: '#A3A3A3', fontSize: 14, textAlign: 'center' }}>Digite este código no WhatsApp</p>
              <div style={{ background: '#fff', borderRadius: 16, padding: '20px 28px' }}>
                <span style={{ color: '#111', fontFamily: 'ui-monospace, monospace', fontSize: 30, fontWeight: 700, letterSpacing: '0.3em' }}>{pairingCode}</span>
              </div>
              <div className="flex items-center" style={{ gap: 10, color: '#E5E5E5', fontSize: 15, fontWeight: 500 }}><Spinner /> Aguardando confirmação</div>
            </>
          ) : (
            <>
              {waiting && qrImage(false)}
              {(showsExpired || scanned) && qrImage(true)}
              {preparing && (
                <div style={{ background: '#fff', borderRadius: 16, padding: 16, opacity: 0.12 }}>
                  <div style={{ width: 200, height: 200, background: '#111', borderRadius: 4 }} />
                </div>
              )}

              <div className="flex flex-col items-center" style={{ gap: 10 }}>
                <div className="flex items-center" style={{ gap: 10, color: '#E5E5E5', fontSize: 15, fontWeight: 500, lineHeight: '18px' }}>
                  {(waiting || scanned || preparing) && <Spinner />}
                  {waiting ? 'Aguardando leitura' : scanned ? 'Conectando ao WhatsApp' : showsExpired ? 'O código expirou' : 'Gerando o código'}
                </div>
                <p style={{ margin: 0, color: '#737373', fontSize: 14, lineHeight: '21px', textAlign: 'center' }}>
                  {waiting
                    ? 'Deixe esta tela aberta. Quando o celular ler o código, a conexão aparece aqui sozinha.'
                    : scanned
                    ? 'O celular leu o código. Estamos sincronizando as suas conversas, pode levar alguns instantes.'
                    : showsExpired
                    ? 'Gere um novo código e leia de novo com o celular.'
                    : 'Só um instante.'}
                </p>
              </div>

              {showsExpired && (
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={generating}
                  className="flex items-center transition-transform active:translate-y-0.5 disabled:opacity-60"
                  style={{ gap: 8, height: 48, padding: '0 26px', borderRadius: 999, background: '#01573C', boxShadow: '0 3px 0 #013825', color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: '18px' }}
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw size={16} strokeWidth={2.2} />}
                  Gerar novo QR code
                </button>
              )}
            </>
          )}
        </div>
      </Card>
      <Footer>Suas mensagens são protegidas com criptografia de ponta a ponta</Footer>
    </>
  );
}

export function WhatsAppConnectScreen(props: Props) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center overflow-y-auto" style={{ gap: 24, padding: '24px 16px 64px', fontFamily: SYS, background: '#0C0C0C' }}>
      {props.provider === 'meta' ? <MetaScreen onConnected={props.onMetaConnected} /> : <QrScreen {...props} />}
    </div>
  );
}
