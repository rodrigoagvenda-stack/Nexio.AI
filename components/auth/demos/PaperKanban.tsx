'use client';

// Gerado a partir do artboard "Tema claro v2 - CRM (base)" do Paper (estilos idênticos). "fase" anima o arrastar do card da Marina Costa.
export function PaperKanban({ fase }: { fase: number }) {
  return (
      <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontSize: '12px', fontSynthesis: 'none', gap: '20px', lineHeight: '16px', MozOsxFontSmoothing: 'grayscale', overflowWrap: 'anywhere', paddingInline: '8px', WebkitFontSmoothing: 'antialiased' }}>
        <div style={{ alignItems: 'end', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '30px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '36px' }}>
              CRM
            </div>
            <div style={{ boxSizing: 'border-box', color: '#5B6660', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '14px', lineHeight: '18px' }}>
              232 leads · R$ 295.130 em pipeline · 6 fechados
            </div>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', padding: '4px' }}>
            <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', height: '32px', paddingInline: '14px' }}>
              <div style={{ boxSizing: 'border-box', color: '#5B6660', display: 'flex', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', lineHeight: '16px' }}>
                Planilha
              </div>
            </div>
            <div style={{ alignItems: 'center', backgroundColor: '#E6F1EB', borderRadius: '999px', boxSizing: 'border-box', display: 'flex', height: '32px', paddingInline: '14px' }}>
              <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'flex', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                Kanban
              </div>
            </div>
          </div>
        </div>
        <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '10px' }}>
            <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', gap: '8px', height: '38px', paddingInline: '14px', width: '280px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <circle cx="11" cy="11" r="7" fill="none" stroke="#8A948E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m21 21-4.3-4.3" fill="none" stroke="#8A948E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ boxSizing: 'border-box', color: '#8A948E', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', lineHeight: '16px' }}>
                Buscar nome, telefone ou empresa
              </div>
            </div>
            <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '8px', height: '38px', paddingInline: '14px' }}>
              <div style={{ boxSizing: 'border-box', color: '#3F4A44', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', lineHeight: '16px' }}>
                Origem: todas
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <path d="m6 9 6 6 6-6" fill="none" stroke="#8A948E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '8px', height: '38px', paddingInline: '14px' }}>
              <div style={{ boxSizing: 'border-box', color: '#3F4A44', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', lineHeight: '16px' }}>
                Etiqueta: todas
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <path d="m6 9 6 6 6-6" fill="none" stroke="#8A948E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', gap: '8px', height: '38px', paddingInline: '14px' }}>
              <div style={{ boxSizing: 'border-box', color: '#3F4A44', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', lineHeight: '16px' }}>
                Prioridade: todas
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <path d="m6 9 6 6 6-6" fill="none" stroke="#8A948E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div style={{ boxSizing: 'border-box', display: 'flex', gap: '10px' }}>
            <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxShadow: '#E2E7E4 0px 2px 0px', boxSizing: 'border-box', display: 'flex', gap: '8px', height: '40px', paddingInline: '18px' }}>
              <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'flex', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '14px', fontWeight: 600, lineHeight: '18px' }}>
                Exportar
              </div>
            </div>
            <div style={{ alignItems: 'center', backgroundColor: '#01573C', borderRadius: '999px', boxShadow: '#013825 0px 3px 0px', boxSizing: 'border-box', display: 'flex', gap: '8px', height: '40px', paddingInline: '18px' }}>
              <div style={{ boxSizing: 'border-box', color: '#FFFFFF', display: 'flex', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '14px', fontWeight: 600, lineHeight: '18px' }}>
                + Novo lead
              </div>
            </div>
          </div>
        </div>
        <div style={{ boxSizing: 'border-box', color: '#8A948E', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 500, letterSpacing: '0.1em', lineHeight: '16px' }}>
          FUNIL DE VENDA
        </div>
        <div style={{ alignItems: 'start', boxSizing: 'border-box', display: 'flex', gap: '12px' }}>
          <div style={{ backgroundColor: '#EEF2F0', borderColor: '#E2E7E4', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexBasis: '0%', flexDirection: 'column', flexGrow: '1', gap: '8px', padding: '10px' }}>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '6px', paddingInline: '2px', paddingTop: '2px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                  <div style={{ backgroundColor: '#3B82F6', borderRadius: '4px', boxSizing: 'border-box', flexShrink: '0', height: '8px', width: '8px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                    Lead novo
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', height: '20px', paddingInline: '8px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#3F4A44', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 600, lineHeight: '14px' }}>
                    {fase >= 3 ? '2' : '3'}
                  </div>
                </div>
              </div>
              <div style={{ boxSizing: 'border-box', paddingLeft: '16px' }}>
                <div style={{ boxSizing: 'border-box', color: '#5B6660', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', lineHeight: '16px' }}>
                  {fase >= 3 ? 'R$ 3.700' : 'R$ 5.900'}
                </div>
              </div>
            </div>
            <div style={{ overflow: fase >= 3 ? 'hidden' : 'visible', transition: 'max-height 0.6s ease, margin 0.6s ease, opacity 0.4s ease', maxHeight: fase >= 3 ? 0 : 140, marginBottom: fase >= 3 ? -8 : 0, opacity: fase >= 3 ? 0 : 1 }}>
              <div style={{ position: 'relative', zIndex: fase >= 1 && fase < 3 ? 10 : 0, transition: 'transform 1s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s ease', transform: fase === 2 ? 'translate(332px, 6px) scale(1.03) rotate(1.4deg)' : fase === 1 ? 'scale(1.02)' : 'none', boxShadow: fase >= 1 && fase < 3 ? '0 18px 34px rgba(14,21,18,0.20)' : 'none', borderRadius: '10px' }}><div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '10px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E3F1EA', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', justifyContent: 'center', width: '28px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 700, lineHeight: '14px' }}>
                    MC
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                  Marina Costa
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px' }}>
                  R$ 2.200
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '5px' }}>
                  <div style={{ backgroundColor: '#9AA39E', borderRadius: '3px', boxSizing: 'border-box', flexShrink: '0', height: '6px', width: '6px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#6B756F', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                    Nós falamos há 2d
                  </div>
                </div>
              </div>
            </div></div>
            </div>
            <div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '10px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E3F1EA', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', justifyContent: 'center', width: '28px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 700, lineHeight: '14px' }}>
                    RL
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                  Rafael Lima
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px' }}>
                  R$ 1.500
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '5px' }}>
                  <div style={{ backgroundColor: '#9AA39E', borderRadius: '3px', boxSizing: 'border-box', flexShrink: '0', height: '6px', width: '6px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#6B756F', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                    Nós falamos há 2d
                  </div>
                </div>
              </div>
            </div>
            <div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '10px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E3F1EA', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', justifyContent: 'center', width: '28px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 700, lineHeight: '14px' }}>
                    CR
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                  Camila Rocha
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px' }}>
                  R$ 2.200
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '5px' }}>
                  <div style={{ backgroundColor: '#9AA39E', borderRadius: '3px', boxSizing: 'border-box', flexShrink: '0', height: '6px', width: '6px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#6B756F', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                    Nós falamos há 3d
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ backgroundColor: '#EEF2F0', borderColor: '#E2E7E4', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexBasis: '0%', flexDirection: 'column', flexGrow: '1', gap: '8px', padding: '10px' }}>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '6px', paddingInline: '2px', paddingTop: '2px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                  <div style={{ backgroundColor: '#EC4899', borderRadius: '4px', boxSizing: 'border-box', flexShrink: '0', height: '8px', width: '8px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                    Em contato
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', height: '20px', paddingInline: '8px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#3F4A44', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 600, lineHeight: '14px' }}>
                    {fase >= 3 ? '3' : '2'}
                  </div>
                </div>
              </div>
              <div style={{ boxSizing: 'border-box', paddingLeft: '16px' }}>
                <div style={{ boxSizing: 'border-box', color: '#5B6660', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', lineHeight: '16px' }}>
                  {fase >= 3 ? 'R$ 7.800' : 'R$ 5.600'}
                </div>
              </div>
            </div>
            <div style={{ overflow: 'hidden', transition: 'max-height 0.6s ease, opacity 0.5s ease 0.15s, margin 0.6s ease', maxHeight: fase >= 3 ? 140 : 0, marginBottom: fase >= 3 ? 0 : -8, opacity: fase >= 3 ? 1 : 0 }}><div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '10px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E3F1EA', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', justifyContent: 'center', width: '28px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 700, lineHeight: '14px' }}>
                    MC
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                  Marina Costa
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px' }}>
                  R$ 2.200
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '5px' }}>
                  <div style={{ backgroundColor: '#9AA39E', borderRadius: '3px', boxSizing: 'border-box', flexShrink: '0', height: '6px', width: '6px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#6B756F', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                    Nós falamos há 2d
                  </div>
                </div>
              </div>
            </div></div>
            <div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '10px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E3F1EA', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', justifyContent: 'center', width: '28px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 700, lineHeight: '14px' }}>
                    BA
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                  Bruno Alves
                </div>
              </div>
              <div style={{ boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#FFF1E5', borderRadius: '6px', boxSizing: 'border-box', display: 'flex', height: '20px', paddingInline: '8px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#B45309', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 600, lineHeight: '14px' }}>
                    Quente
                  </div>
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px' }}>
                  R$ 2.200
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '5px' }}>
                  <div style={{ backgroundColor: '#9AA39E', borderRadius: '3px', boxSizing: 'border-box', flexShrink: '0', height: '6px', width: '6px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#6B756F', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                    Nós falamos há 2d
                  </div>
                </div>
              </div>
            </div>
            <div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '10px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E3F1EA', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', justifyContent: 'center', width: '28px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 700, lineHeight: '14px' }}>
                    PM
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                  Paula Mendes
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px' }}>
                  R$ 3.400
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '5px' }}>
                  <div style={{ backgroundColor: '#9AA39E', borderRadius: '3px', boxSizing: 'border-box', flexShrink: '0', height: '6px', width: '6px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#6B756F', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                    Nós falamos há 1d
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ backgroundColor: '#EEF2F0', borderColor: '#E2E7E4', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexBasis: '0%', flexDirection: 'column', flexGrow: '1', gap: '8px', padding: '10px' }}>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '6px', paddingInline: '2px', paddingTop: '2px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                  <div style={{ backgroundColor: '#16A34A', borderRadius: '4px', boxSizing: 'border-box', flexShrink: '0', height: '8px', width: '8px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                    Interessado
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', height: '20px', paddingInline: '8px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#3F4A44', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 600, lineHeight: '14px' }}>
                    2
                  </div>
                </div>
              </div>
              <div style={{ boxSizing: 'border-box', paddingLeft: '16px' }}>
                <div style={{ boxSizing: 'border-box', color: '#5B6660', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', lineHeight: '16px' }}>
                  R$ 4.000
                </div>
              </div>
            </div>
            <div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '10px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E3F1EA', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', justifyContent: 'center', width: '28px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 700, lineHeight: '14px' }}>
                    JP
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                  Juliana Prado
                </div>
              </div>
              <div style={{ boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#FFF1E5', borderRadius: '6px', boxSizing: 'border-box', display: 'flex', height: '20px', paddingInline: '8px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#B45309', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 600, lineHeight: '14px' }}>
                    Quente
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: '#FDECEC', borderRadius: '6px', boxSizing: 'border-box', display: 'flex', height: '20px', paddingInline: '8px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#B42318', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 600, lineHeight: '14px' }}>
                    Alta
                  </div>
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px' }}>
                  R$ 2.200
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '5px' }}>
                  <div style={{ backgroundColor: '#16A34A', borderRadius: '3px', boxSizing: 'border-box', flexShrink: '0', height: '6px', width: '6px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#0F7A3B', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                    Lead falou há 2d
                  </div>
                </div>
              </div>
            </div>
            <div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '10px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E3F1EA', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', justifyContent: 'center', width: '28px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 700, lineHeight: '14px' }}>
                    DN
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                  Diego Nunes
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px' }}>
                  R$ 1.800
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '5px' }}>
                  <div style={{ backgroundColor: '#9AA39E', borderRadius: '3px', boxSizing: 'border-box', flexShrink: '0', height: '6px', width: '6px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#6B756F', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                    Nós falamos há 2d
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ backgroundColor: '#EEF2F0', borderColor: '#E2E7E4', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexBasis: '0%', flexDirection: 'column', flexGrow: '1', gap: '8px', padding: '10px' }}>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '6px', paddingInline: '2px', paddingTop: '2px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                  <div style={{ backgroundColor: '#0EA5E9', borderRadius: '4px', boxSizing: 'border-box', flexShrink: '0', height: '8px', width: '8px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                    Proposta enviada
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', height: '20px', paddingInline: '8px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#3F4A44', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 600, lineHeight: '14px' }}>
                    2
                  </div>
                </div>
              </div>
              <div style={{ boxSizing: 'border-box', paddingLeft: '16px' }}>
                <div style={{ boxSizing: 'border-box', color: '#5B6660', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', lineHeight: '16px' }}>
                  R$ 7.480
                </div>
              </div>
            </div>
            <div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '10px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E3F1EA', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', justifyContent: 'center', width: '28px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 700, lineHeight: '14px' }}>
                    FD
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                  Felipe Duarte
                </div>
              </div>
              <div style={{ boxSizing: 'border-box', display: 'flex', gap: '6px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#FFF1E5', borderRadius: '6px', boxSizing: 'border-box', display: 'flex', height: '20px', paddingInline: '8px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#B45309', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 600, lineHeight: '14px' }}>
                    Quente
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: '#EDEFEE', borderRadius: '6px', boxSizing: 'border-box', display: 'flex', height: '20px', paddingInline: '8px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#4A5450', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 600, lineHeight: '14px' }}>
                    Média
                  </div>
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px' }}>
                  R$ 5.280
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '5px' }}>
                  <div style={{ backgroundColor: '#9AA39E', borderRadius: '3px', boxSizing: 'border-box', flexShrink: '0', height: '6px', width: '6px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#6B756F', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                    Nós falamos há 2d
                  </div>
                </div>
              </div>
            </div>
            <div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '10px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E3F1EA', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', justifyContent: 'center', width: '28px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 700, lineHeight: '14px' }}>
                    RS
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                  Renata Souza
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px' }}>
                  R$ 2.200
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '5px' }}>
                  <div style={{ backgroundColor: '#16A34A', borderRadius: '3px', boxSizing: 'border-box', flexShrink: '0', height: '6px', width: '6px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#0F7A3B', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                    Lead falou há 1d
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ backgroundColor: '#EEF2F0', borderColor: '#E2E7E4', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexBasis: '0%', flexDirection: 'column', flexGrow: '1', gap: '8px', padding: '10px' }}>
            <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '6px', paddingInline: '2px', paddingTop: '2px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                  <div style={{ backgroundColor: '#84CC16', borderRadius: '4px', boxSizing: 'border-box', flexShrink: '0', height: '8px', width: '8px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                    Fechado
                  </div>
                </div>
                <div style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '999px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', height: '20px', paddingInline: '8px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#3F4A44', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 600, lineHeight: '14px' }}>
                    2
                  </div>
                </div>
              </div>
              <div style={{ boxSizing: 'border-box', paddingLeft: '16px' }}>
                <div style={{ boxSizing: 'border-box', color: '#5B6660', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', lineHeight: '16px' }}>
                  R$ 3.200
                </div>
              </div>
            </div>
            <div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '10px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E3F1EA', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', justifyContent: 'center', width: '28px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 700, lineHeight: '14px' }}>
                    LF
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                  Lucas Ferraz
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px' }}>
                  R$ 2.200
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '5px' }}>
                  <div style={{ backgroundColor: '#16A34A', borderRadius: '3px', boxSizing: 'border-box', flexShrink: '0', height: '6px', width: '6px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#0F7A3B', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                    Fechou em 21 set
                  </div>
                </div>
              </div>
            </div>
            <div style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E7E4', borderRadius: '10px', borderStyle: 'solid', borderWidth: '1px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
                <div style={{ alignItems: 'center', backgroundColor: '#E3F1EA', borderRadius: '14px', boxSizing: 'border-box', display: 'flex', flexShrink: '0', height: '28px', justifyContent: 'center', width: '28px' }}>
                  <div style={{ boxSizing: 'border-box', color: '#01573C', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', fontWeight: 700, lineHeight: '14px' }}>
                    AB
                  </div>
                </div>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', fontWeight: 600, lineHeight: '16px' }}>
                  Aline Batista
                </div>
              </div>
              <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ boxSizing: 'border-box', color: '#0E1512', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px' }}>
                  R$ 1.000
                </div>
                <div style={{ alignItems: 'center', boxSizing: 'border-box', display: 'flex', gap: '5px' }}>
                  <div style={{ backgroundColor: '#16A34A', borderRadius: '3px', boxSizing: 'border-box', flexShrink: '0', height: '6px', width: '6px' }} />
                  <div style={{ boxSizing: 'border-box', color: '#0F7A3B', display: 'inline-block', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', lineHeight: '14px' }}>
                    Fechou em 08 set
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
