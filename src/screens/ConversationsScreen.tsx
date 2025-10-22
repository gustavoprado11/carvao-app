import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfile } from '../context/ProfileContext';
import { colors, spacing } from '../theme';

type Conversation = {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  status: 'active' | 'pending' | 'awaiting';
};

const supplierConversations: Conversation[] = [
  {
    id: 'conv-01',
    title: 'Vale Azul • Compras',
    lastMessage: 'Podemos ajustar o cronograma da próxima entrega?',
    timestamp: '14:21',
    status: 'active'
  },
  {
    id: 'conv-02',
    title: 'Horizonte • Logística',
    lastMessage: 'Enviado laudo atualizado de granulometria.',
    timestamp: 'Ontem',
    status: 'pending'
  }
];

const steelConversations: Conversation[] = [
  {
    id: 'conv-03',
    title: 'Carbono Prime • Comercial',
    lastMessage: 'Temos disponibilidade para entrega semanal.',
    timestamp: '09:12',
    status: 'active'
  },
  {
    id: 'conv-04',
    title: 'Floresta Mineral • Operações',
    lastMessage: 'Documento de conformidade revisado.',
    timestamp: 'Ontem',
    status: 'awaiting'
  }
];

const statusCopy: Record<Conversation['status'], { label: string; color: string }> = {
  active: { label: 'Em andamento', color: colors.primary },
  pending: { label: 'Resposta pendente', color: colors.accent },
  awaiting: { label: 'Aguardando retorno', color: colors.textSecondary }
};

export const ConversationsScreen: React.FC = () => {
  const { profile } = useProfile();

  const data = useMemo(
    () => (profile.type === 'supplier' ? supplierConversations : steelConversations),
    [profile.type]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Text style={styles.title}>Conversas</Text>
        <Text style={styles.subtitle}>Mantenha o relacionamento ativo com mensagens objetivas e rápidas.</Text>
        <View style={styles.cardGroup}>
          {data.map(item => {
            const status = statusCopy[item.status];
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.headerRow}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.time}>{item.timestamp}</Text>
                </View>
                <Text style={styles.lastMessage}>{item.lastMessage}</Text>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.textPrimary
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg
  },
  cardGroup: {
    marginTop: spacing.lg
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: spacing.md
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    paddingRight: spacing.sm
  },
  time: {
    fontSize: 13,
    color: colors.textSecondary
  },
  lastMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 6,
    marginBottom: spacing.xs
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600'
  }
});
