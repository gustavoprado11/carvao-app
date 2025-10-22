import React, { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../context/ProfileContext';
import { SupplierTablePreview, TableRow, useTable } from '../context/TableContext';
import { colors, spacing } from '../theme';

const unitOptions = [
  { label: 'm³', value: 'm3' as const },
  { label: 'tonelada', value: 'tonelada' as const }
];

export const TablesScreen: React.FC = () => {
  const { profile } = useProfile();
  const isSteelProfile = profile.type === 'steel';
  const { table, addRow, removeRow, updateRow, updateNotes, supplierTables, loading } = useTable();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (supplierTables.length === 0) {
      return;
    }
    setExpanded(prev => {
      if (Object.keys(prev).length > 0) {
        return prev;
      }
      const initialId = supplierTables[0].id;
      return { [initialId]: true };
    });
  }, [supplierTables]);

  const handleSelectUnit = (rowId: string) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...unitOptions.map(option => option.label), 'Cancelar'],
          cancelButtonIndex: unitOptions.length,
          title: 'Unidade de Pagamento'
        },
        index => {
          if (index !== undefined && index < unitOptions.length) {
            updateRow(rowId, 'unit', unitOptions[index].value);
          }
        }
      );
    } else {
      Alert.alert('Unidade de Pagamento', 'Selecione a unidade', [
        ...unitOptions.map(option => ({
          text: option.label,
          onPress: () => updateRow(rowId, 'unit', option.value)
        })),
        { text: 'Cancelar', style: 'cancel' }
      ]);
    }
  };

  const unitLabel = (value: typeof unitOptions[number]['value']) =>
    unitOptions.find(option => option.value === value)?.label ?? value;

  const toggleTable = (tableId: string) => {
    setExpanded(prev => ({ ...prev, [tableId]: !prev[tableId] }));
  };

  const renderReadOnlyRow = (row: TableRow) => (
    <View key={row.id} style={styles.rowCardReadonly}>
      <Text style={styles.fieldLabel}>Faixa de Densidade (kg/m³)</Text>
      <Text style={styles.readOnlyValue}>
        {row.densityMin || '—'} — {row.densityMax || '—'}
      </Text>
      <View style={styles.fieldGroup}>
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Preço PF (R$)</Text>
          <Text style={styles.readOnlyValue}>{row.pricePF || '—'}</Text>
        </View>
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Preço PJ (R$)</Text>
          <Text style={styles.readOnlyValue}>{row.pricePJ || '—'}</Text>
        </View>
      </View>
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Unidade de Pagamento</Text>
        <Text style={styles.readOnlyValue}>{unitLabel(row.unit)}</Text>
      </View>
    </View>
  );

  const renderSteelView = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{table.title}</Text>
        <Text style={styles.subtitle}>{table.description}</Text>
      </View>

      <View style={styles.tableContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Faixas de preço</Text>
          <TouchableOpacity style={styles.addButton} onPress={addRow}>
            <Ionicons color={colors.primary} name="add" size={18} />
            <Text style={styles.addButtonText}>Adicionar linha</Text>
          </TouchableOpacity>
        </View>

        {table.rows.map(row => (
          <View key={row.id} style={styles.rowCard}>
            <View style={styles.rowHeader}>
              <Text style={styles.fieldLabel}>Faixa de Densidade (kg/m³)</Text>
              <TouchableOpacity accessibilityLabel="Remover linha" hitSlop={10} onPress={() => removeRow(row.id)}>
                <Ionicons color={colors.accent} name="close-circle" size={20} />
              </TouchableOpacity>
            </View>

            <View style={styles.rangeRow}>
              <TextInput
                value={row.densityMin}
                onChangeText={value => updateRow(row.id, 'densityMin', value)}
                placeholder="0"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.rangeInput]}
              />
              <Text style={styles.rangeSeparator}>—</Text>
              <TextInput
                value={row.densityMax}
                onChangeText={value => updateRow(row.id, 'densityMax', value)}
                placeholder="199,99"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.rangeInput]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Preço PF (R$)</Text>
                <TextInput
                  value={row.pricePF}
                  onChangeText={value => updateRow(row.id, 'pricePF', value)}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Preço PJ (R$)</Text>
                <TextInput
                  value={row.pricePJ}
                  onChangeText={value => updateRow(row.id, 'pricePJ', value)}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Unidade de Pagamento</Text>
              <TouchableOpacity
                accessibilityLabel="Selecionar unidade de pagamento"
                activeOpacity={0.86}
                style={styles.unitButton}
                onPress={() => handleSelectUnit(row.id)}
              >
                <Text style={styles.unitButtonText}>{unitLabel(row.unit)}</Text>
                <Ionicons color={colors.textSecondary} name="chevron-down" size={16} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.notesCard}>
        <Text style={styles.sectionTitle}>Observações da Tabela</Text>
        <TextInput
          multiline
          placeholder="Inclua regras adicionais ou descontos aplicáveis."
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, styles.notesInput]}
          value={table.notes}
          onChangeText={updateNotes}
        />
      </View>
    </>
  );

  const renderSupplierView = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Tabelas das siderúrgicas</Text>
        <Text style={styles.subtitle}>
          Explore condições atualizadas e compare preços antes de enviar suas propostas.
        </Text>
      </View>

      <View style={styles.cardGroup}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Carregando tabelas...</Text>
          </View>
        ) : null}

        {!loading && supplierTables.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nenhuma tabela publicada</Text>
            <Text style={styles.emptySubtitle}>
              As siderúrgicas cadastradas ainda não compartilharam tabelas de preços. Tente novamente mais tarde.
            </Text>
          </View>
        ) : null}

        {supplierTables.map((item: SupplierTablePreview) => {
          const isExpanded = !!expanded[item.id];
          return (
            <View key={item.id} style={styles.supplierCard}>
              <TouchableOpacity style={styles.supplierHeader} onPress={() => toggleTable(item.id)} activeOpacity={0.9}>
                <View style={styles.supplierTitleBlock}>
                  <Text style={styles.cardTitle}>{item.company}</Text>
                  <Text style={styles.cardSubtitle}>{item.route}</Text>
                </View>
                <View style={styles.supplierMeta}>
                  <Text style={styles.updatedText}>{item.updatedAt}</Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textSecondary}
                  />
                </View>
              </TouchableOpacity>
              {isExpanded ? (
                <View style={styles.supplierBody}>
                  {item.rows.map(renderReadOnlyRow)}
                  <View style={styles.notesBox}>
                    <Text style={styles.sectionTitle}>Observações</Text>
                    <Text style={styles.notesText}>{item.notes}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isSteelProfile ? renderSteelView() : renderSupplierView()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg
  },
  header: {
    gap: spacing.xs
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22
  },
  tableContainer: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
    gap: spacing.xs
  },
  addButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13
  },
  rowCard: {
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: '#F8FAFC',
    gap: spacing.sm
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  rangeSeparator: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary
  },
  fieldGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  fieldBlock: {
    flex: 1,
    minWidth: 140,
    gap: spacing.xs
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 4,
    fontSize: 15,
    color: colors.textPrimary
  },
  rangeInput: {
    flex: 1
  },
  readOnlyValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  unitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  unitButtonText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  notesCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  notesInput: {
    minHeight: 120,
    textAlignVertical: 'top'
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary
  },
  cardGroup: {
    gap: spacing.md
  },
  supplierCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2
  },
  supplierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#EFF4FF'
  },
  supplierTitleBlock: {
    flex: 1,
    paddingRight: spacing.md
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2
  },
  supplierMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  updatedText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  supplierBody: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md
  },
  rowCardReadonly: {
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: '#F8FAFC'
  },
  notesBox: {
    borderRadius: spacing.md,
    backgroundColor: '#F1F5F9',
    padding: spacing.md,
    gap: spacing.xs
  },
  loadingState: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center'
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20
  }
});
