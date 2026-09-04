import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

interface BriefingMtPDFProps {
  companyName: string;
  title: string;
  primaryColor: string;
  logoUrl?: string;
  questions: { label: string; field_key: string }[];
  answers: Record<string, any>;
  submittedAt: string;
}

export const BriefingMtPDF: React.FC<BriefingMtPDFProps> = ({
  companyName,
  title,
  primaryColor,
  logoUrl,
  questions,
  answers,
  submittedAt,
}) => {
  const formattedDate = new Date(submittedAt).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const color = primaryColor || '#7c3aed';

  const styles = StyleSheet.create({
    page: {
      fontSize: 10,
      fontFamily: 'Helvetica',
      backgroundColor: '#ffffff',
      paddingBottom: 60,
    },

    // Header
    header: {
      backgroundColor: '#ffffff',
      padding: '32 40 20 40',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottom: 2,
      borderBottomColor: color,
    },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end' },
    logo: { width: 80, height: 28, objectFit: 'contain', marginBottom: 8 },
    titleText: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#111827', lineHeight: 1.2 },
    companyText: { fontSize: 11, color: '#6b7280', marginTop: 4 },
    dateLabel: { fontSize: 8, color: '#9ca3af', marginTop: 2 },
    dateValue: { fontSize: 10, color: '#111827', fontFamily: 'Helvetica-Bold' },

    // Meta strip
    metaStrip: {
      borderBottom: 1,
      borderBottomColor: '#e5e7eb',
      padding: '10 40',
      flexDirection: 'row',
      gap: 24,
    },
    metaItem: { flexDirection: 'row', alignItems: 'center' },
    metaText: { fontSize: 9, color: '#6b7280' },
    metaBold: { fontSize: 9, color: '#111827', fontFamily: 'Helvetica-Bold' },

    // Body
    body: { padding: '24 40 0 40' },
    sectionTitle: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 10,
    },

    // QA grid
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    qaBlockFull: {
      width: '100%',
      borderBottom: 1,
      borderBottomColor: '#f3f4f6',
      paddingTop: 10,
      paddingBottom: 10,
    },
    qaBlockHalf: {
      width: '50%',
      borderBottom: 1,
      borderBottomColor: '#f3f4f6',
      paddingTop: 10,
      paddingBottom: 10,
      paddingRight: 16,
    },
    qaLabel: {
      fontSize: 8,
      color: '#9ca3af',
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    qaValue: { fontSize: 11, color: '#111827', lineHeight: 1.4 },
    qaEmpty: { fontSize: 10, color: '#d1d5db', fontStyle: 'italic' },

    // Footer
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#111827',
      padding: '12 40',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerBrand: { fontSize: 10, color: '#ffffff', fontFamily: 'Helvetica-Bold' },
    footerDot: { fontSize: 10, color: color, fontFamily: 'Helvetica-Bold' },
    footerSub: { fontSize: 8, color: '#6b7280', marginTop: 1 },
    footerRight: { alignItems: 'flex-end' },
    footerPage: { fontSize: 8, color: '#6b7280' },
  });

  const qaItems = questions.map((q) => {
    const val = answers[q.field_key];
    const display = Array.isArray(val)
      ? val.join(', ')
      : val != null && String(val).trim() !== '' ? String(val) : null;
    return { label: q.label, display };
  });

  // Short answers (≤40 chars) go in half-width, long ones full-width
  const isShort = (s: string | null) => !s || s.length <= 40;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            <Text style={styles.titleText}>{title || 'Briefing'}</Text>
            <Text style={styles.companyText}>{companyName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dateLabel}>Enviado em</Text>
            <Text style={styles.dateValue}>{formattedDate}</Text>
            <Text style={[styles.dateLabel, { marginTop: 6 }]}>Respostas</Text>
            <Text style={styles.dateValue}>{qaItems.filter(i => i.display).length}/{qaItems.length}</Text>
          </View>
        </View>

        {/* Meta strip */}
        <View style={styles.metaStrip}>
          <View style={styles.metaItem}>
            <Text style={styles.metaText}>Empresa: </Text>
            <Text style={styles.metaBold}>{companyName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaText}>  ·  Formulário: </Text>
            <Text style={styles.metaBold}>{title || 'Briefing'}</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Respostas do formulário</Text>
          <View style={styles.grid}>
            {qaItems.map((item, i) => {
              const isHalf = isShort(item.display) && isShort(qaItems[i + 1]?.display ?? null);
              return (
                <View key={i} style={isHalf ? styles.qaBlockHalf : styles.qaBlockFull}>
                  <Text style={styles.qaLabel}>{item.label}</Text>
                  {item.display
                    ? <Text style={styles.qaValue}>{item.display}</Text>
                    : <Text style={styles.qaEmpty}>Não informado</Text>
                  }
                </View>
              );
            })}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerLeft}>
            <Text style={styles.footerBrand}>nexio</Text>
            <Text style={styles.footerDot}>.</Text>
            <Text style={styles.footerBrand}>ai</Text>
          </View>
          <View style={styles.footerRight}>
            <Text style={styles.footerPage}>
              Gerado em {new Date().toLocaleDateString('pt-BR')}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// @react-pdf/renderer 3.4.x tem bug conhecido resolvendo <Image src="URL remota">
// (buscando internamente, gera "Cannot read properties of undefined
// (reading 'hasOwnProperty')" durante o layout). Workaround padrão da
// própria comunidade da lib: buscar a imagem à parte e passar já como
// data URI base64, evitando o caminho de código com o bug.
//
// Achado ao vivo (Rodrigo, 2026-09-04) : o mesmo erro continuava mesmo já
// convertendo pra base64 -- a logo é upload livre do usuário (arbitrário,
// via wizard), e o decoder de PNG interno do react-pdf trava em alguns
// formatos válidos de PNG (ex: perfil de cor ICC embutido, entrelaçado,
// 16-bit) que o navegador abre sem problema mas a lib não sabe ler. Fix:
// redesenhar a imagem num <canvas> antes de exportar como data URI -- isso
// força um PNG "normalizado" (RGBA padrão, sem os metadados exóticos que
// travavam o decoder da lib), contornando o bug sem depender de reupload.
async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        // "Image" sem qualificar aqui resolveria pro componente <Image> do
        // @react-pdf/renderer (importado no topo do arquivo pro JSX do PDF),
        // não pro construtor HTMLImageElement do DOM -- por isso window.Image.
        const el = new window.Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

export async function generateBriefingMtPDF(props: BriefingMtPDFProps): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  // Logo é melhor esforço : se falhar ao buscar/converter, gera o PDF sem
  // logo em vez de travar o download inteiro.
  const logoDataUri = props.logoUrl ? await toDataUri(props.logoUrl) : null;
  return pdf(<BriefingMtPDF {...props} logoUrl={logoDataUri ?? undefined} />).toBlob();
}
