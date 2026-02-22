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

  const styles = StyleSheet.create({
    page: { padding: 0, fontSize: 11, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
    topBar: { height: 6, backgroundColor: primaryColor },
    header: { padding: '24 40 20 40', borderBottom: 1, borderBottomColor: '#e5e7eb' },
    logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    logo: { width: 48, height: 48, objectFit: 'contain', marginRight: 14 },
    logoPlaceholder: { width: 48, height: 6, backgroundColor: primaryColor, borderRadius: 3, marginRight: 14 },
    titleText: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
    companyText: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    dateText: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
    body: { padding: '24 40', flex: 1 },
    qaBlock: { marginBottom: 16, paddingBottom: 14, borderBottom: 1, borderBottomColor: '#f3f4f6' },
    qaLabel: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    qaValue: { fontSize: 12, color: '#111827', lineHeight: 1.5 },
    qaEmpty: { fontSize: 12, color: '#d1d5db', fontStyle: 'italic' },
    footer: {
      position: 'absolute', bottom: 24, left: 40, right: 40,
      flexDirection: 'row', justifyContent: 'space-between',
      borderTop: 1, borderTopColor: '#e5e7eb', paddingTop: 10,
    },
    footerText: { fontSize: 9, color: '#9ca3af' },
    accentDot: { color: primaryColor, fontWeight: 'bold' },
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />
        <View style={styles.header}>
          <View style={styles.logoRow}>
            {logoUrl
              ? <Image src={logoUrl} style={styles.logo} />
              : <View style={styles.logoPlaceholder} />
            }
            <View>
              <Text style={styles.titleText}>{title || 'Briefing'}</Text>
              <Text style={styles.companyText}>{companyName}</Text>
            </View>
          </View>
          <Text style={styles.dateText}>Enviado em {formattedDate}</Text>
        </View>

        <View style={styles.body}>
          {questions.map((q) => {
            const val = answers[q.field_key];
            const display = Array.isArray(val)
              ? val.join(', ')
              : val != null && String(val).trim() !== '' ? String(val) : null;

            return (
              <View key={q.field_key} style={styles.qaBlock}>
                <Text style={styles.qaLabel}>{q.label}</Text>
                {display
                  ? <Text style={styles.qaValue}>{display}</Text>
                  : <Text style={styles.qaEmpty}>Não informado</Text>
                }
              </View>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            nexio<Text style={styles.accentDot}>.</Text>ai — {companyName}
          </Text>
          <Text style={styles.footerText}>
            Gerado em {new Date().toLocaleDateString('pt-BR')}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export async function generateBriefingMtPDF(props: BriefingMtPDFProps): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  return pdf(<BriefingMtPDF {...props} />).toBlob();
}
