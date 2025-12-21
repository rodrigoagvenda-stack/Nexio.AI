import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Estilos do PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: 2,
    borderBottomColor: '#3b82f6',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 10,
    borderBottom: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: '35%',
    fontWeight: 'bold',
    color: '#475569',
  },
  value: {
    width: '65%',
    color: '#1e293b',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 9,
    borderTop: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
});

interface BriefingPDFProps {
  data: {
    nome_responsavel: string;
    email: string;
    whatsapp: string;
    country_code: string;
    nome_empresa: string;
    site?: string;
    instagram?: string;
    segmento: string;
    tempo_mercado: string;
    investe_marketing: string;
    resultados?: string;
    objetivo?: string;
    faturamento: string;
    budget: string;
    submitted_at: string;
  };
}

export const BriefingPDF: React.FC<BriefingPDFProps> = ({ data }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Briefing - vend.AI</Text>
          <Text style={styles.subtitle}>
            Enviado em {formatDate(data.submitted_at)}
          </Text>
        </View>

        {/* Informações de Contato */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações de Contato</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome do Responsável:</Text>
            <Text style={styles.value}>{data.nome_responsavel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{data.email}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>WhatsApp:</Text>
            <Text style={styles.value}>
              {data.country_code} {data.whatsapp}
            </Text>
          </View>
        </View>

        {/* Informações da Empresa */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações da Empresa</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome da Empresa:</Text>
            <Text style={styles.value}>{data.nome_empresa}</Text>
          </View>
          {data.site && (
            <View style={styles.row}>
              <Text style={styles.label}>Site:</Text>
              <Text style={styles.value}>{data.site}</Text>
            </View>
          )}
          {data.instagram && (
            <View style={styles.row}>
              <Text style={styles.label}>Instagram:</Text>
              <Text style={styles.value}>{data.instagram}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Segmento:</Text>
            <Text style={styles.value}>{data.segmento}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tempo de Mercado:</Text>
            <Text style={styles.value}>{data.tempo_mercado}</Text>
          </View>
        </View>

        {/* Marketing Atual */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Marketing Atual</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Investe em Marketing:</Text>
            <Text style={styles.value}>{data.investe_marketing}</Text>
          </View>
          {data.resultados && (
            <View style={styles.row}>
              <Text style={styles.label}>Resultados Atuais:</Text>
              <Text style={styles.value}>{data.resultados}</Text>
            </View>
          )}
        </View>

        {/* Objetivos e Expectativas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Objetivos e Expectativas</Text>
          {data.objetivo && (
            <View style={styles.row}>
              <Text style={styles.label}>Objetivo Principal:</Text>
              <Text style={styles.value}>{data.objetivo}</Text>
            </View>
          )}
        </View>

        {/* Informações Financeiras */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações Financeiras</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Faturamento Mensal:</Text>
            <Text style={styles.value}>{data.faturamento}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Budget para Marketing:</Text>
            <Text style={styles.value}>{data.budget}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            vend.AI - Sistema CRM Inteligente | Gerado automaticamente em{' '}
            {new Date().toLocaleDateString('pt-BR')}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

// Função para gerar o PDF em buffer
export async function generateBriefingPDF(briefingData: any) {
  const { pdf } = await import('@react-pdf/renderer');
  const blob = await pdf(<BriefingPDF data={briefingData} />).toBlob();
  return blob;
}
