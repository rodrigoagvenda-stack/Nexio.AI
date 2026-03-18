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
      backgroundColor: color,
      padding: '32 40 28 40',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end' },
    logo: { width: 80, height: 28, objectFit: 'contain', marginBottom: 8 },
    titleText: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#ffffff', lineHeight: 1.2 },
    companyText: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
    dateLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
    dateValue: { fontSize: 10, color: '#ffffff', fontFamily: 'Helvetica-Bold' },

    // Meta strip
    metaStrip: {
      backgroundColor: '#f8f7ff',
      borderBottom: 1,
      borderBottomColor: '#e5e7eb',
      padding: '10 40',
      flexDirection: 'row',
      gap: 24,
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 6 },
    metaText: { fontSize: 9, color: '#6b7280' },
    metaBold: { fontSize: 9, color: '#111827', fontFamily: 'Helvetica-Bold' },

    // Body
    body: { padding: '28 40 0 40' },
    sectionTitle: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: color,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
      marginTop: 4,
    },

    // QA grid
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
    qaBlockFull: {
      width: '100%',
      backgroundColor: '#f9fafb',
      borderRadius: 6,
      padding: '10 14',
      marginBottom: 8,
      borderLeft: 3,
      borderLeftColor: color,
    },
    qaBlockHalf: {
      width: '48%',
      backgroundColor: '#f9fafb',
      borderRadius: 6,
      padding: '10 14',
      marginBottom: 8,
      marginRight: '2%',
      borderLeft: 3,
      borderLeftColor: color,
    },
    qaLabel: {
      fontSize: 8,
      color: '#9ca3af',
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
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
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>Empresa: </Text>
            <Text style={styles.metaBold}>{companyName}</Text>
          </View>
          <View style={styles.metaItem}>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>Formulário: </Text>
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

export async function generateBriefingMtPDF(props: BriefingMtPDFProps): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  return pdf(<BriefingMtPDF {...props} />).toBlob();
}
