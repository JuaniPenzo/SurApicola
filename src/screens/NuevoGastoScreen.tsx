// =============================================================================
// SurApícola — Pantalla de Nuevo Gasto (Fase 3D)
// =============================================================================
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/AppNavigator';
import { useSQLiteContext } from 'expo-sqlite';
import { getCategoriasGasto } from '../database/gastos';
import { useGastos } from '../hooks/useGastos';
import { formatearDinero, fechaHoy } from '../utils/format';
import type { CategoriaGasto, MedioPago } from '../types';

const COLORS = {
  bg: '#0F0F1A',
  surface: '#1A1A2E',
  card: '#16213E',
  accent: '#E8A020',
  accentLight: '#F5C842',
  success: '#4CAF7D',
  danger: '#E05A5A',
  text: '#F0F0F0',
  textMuted: '#8A8A9A',
  border: '#2A2A3E',
};

export function NuevoGastoScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const { crearGasto } = useGastos();

  // ── Datos de Referencia (SQLite) ───────────────────────────────────────────
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

  // ── Campos del Gasto ───────────────────────────────────────────────────────
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<CategoriaGasto | null>(null);
  const [fecha, setFecha] = useState(fechaHoy());
  const [descripcion, setDescripcion] = useState('');
  const [totalPesos, setTotalPesos] = useState('');
  const [notas, setNotas] = useState('');

  // Medio de Pago (Requerido ya que se paga completo)
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo');

  // ── Modales de Selección ───────────────────────────────────────────────────
  const [catModalVisible, setCatModalVisible] = useState(false);

  // Cargar categorías
  const loadReferenceData = async () => {
    try {
      setLoadingCats(true);
      const cats = await getCategoriasGasto(db);
      setCategorias(cats);
    } catch (err) {
      console.error('[NuevoGastoScreen] Error al cargar categorías:', err);
    } finally {
      setLoadingCats(false);
    }
  };

  const resetForm = () => {
    setCategoriaSeleccionada(null);
    setFecha(fechaHoy());
    setDescripcion('');
    setTotalPesos('');
    setNotas('');
    setMedioPago('efectivo');
  };

  useFocusEffect(
    React.useCallback(() => {
      loadReferenceData();
      resetForm();
    }, [])
  );

  // ── Guardar Gasto ──────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!categoriaSeleccionada) {
      Alert.alert('Validación', 'Seleccioná una categoría de gasto.');
      return;
    }

    if (!descripcion || descripcion.trim().length < 2) {
      Alert.alert('Validación', 'Ingresá una descripción válida (mínimo 2 caracteres).');
      return;
    }

    const totalPesosNum = parseFloat(totalPesos);
    if (isNaN(totalPesosNum) || totalPesosNum <= 0) {
      Alert.alert('Validación', 'El costo total debe ser un número positivo.');
      return;
    }

    const totalCentavos = Math.round(totalPesosNum * 100);

    try {
      await crearGasto({
        categoria_id: categoriaSeleccionada.id,
        proveedor_id: null,
        fecha,
        descripcion: descripcion.trim(),
        total_centavos: totalCentavos,
        notas: notas.trim() || null,
        monto_pagado: totalCentavos, // Pagado en su totalidad
        medio_pago: medioPago,
        notas_pago: 'Gasto operativo registrado',
      });

      Alert.alert('Éxito', 'Gasto operativo registrado correctamente.', [
        { text: 'Aceptar', onPress: () => navigation.navigate('Gastos') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo registrar el gasto.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.navigate('Gastos')}>
          <Text style={styles.btnVolverTexto}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>📤 Nuevo Gasto Operativo</Text>
      </View>

      {/* Advertencia Gastos vs Compras */}
      <View style={styles.advertenciaBanner}>
        <Text style={styles.advertenciaTexto}>
          ℹ️ Los gastos son egresos operativos. Las compras de miel, panal, envases o insumos deben cargarse desde Compras.
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Clasificación */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>CLASIFICACIÓN</Text>
            
            {/* Categoría */}
            <Text style={styles.label}>Categoría de Gasto *</Text>
            <TouchableOpacity
              style={styles.selectorBtn}
              activeOpacity={0.7}
              onPress={() => setCatModalVisible(true)}
            >
              <Text style={categoriaSeleccionada ? styles.selectorText : styles.selectorPlaceholder}>
                {categoriaSeleccionada ? categoriaSeleccionada.nombre : 'Seleccionar categoría...'}
              </Text>
              <Text style={styles.selectorIcon}>▼</Text>
            </TouchableOpacity>

            {/* Fecha */}
            <View style={{ gap: 6, marginTop: 6 }}>
              <Text style={styles.label}>Fecha</Text>
              <TextInput
                style={styles.input}
                value={fecha}
                onChangeText={setFecha}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          {/* Detalles del Gasto */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>DETALLE DEL GASTO</Text>

            {/* Descripción */}
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Descripción / Concepto *</Text>
              <TextInput
                style={styles.input}
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Ej. Carga combustible camioneta"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {/* Costo Total */}
            <View style={{ gap: 6, marginTop: 6 }}>
              <Text style={styles.label}>Costo Total (ARS) *</Text>
              <TextInput
                style={styles.input}
                value={totalPesos}
                onChangeText={setTotalPesos}
                keyboardType="numeric"
                placeholder="Ej. 1850.50"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {/* Notas */}
            <View style={{ gap: 6, marginTop: 6 }}>
              <Text style={styles.label}>Notas Adicionales</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notas}
                onChangeText={setNotas}
                multiline
                numberOfLines={3}
                placeholder="Observaciones adicionales sobre el gasto..."
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          {/* Medio de Pago */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>MEDIO DE PAGO *</Text>
            
            <View style={styles.medioRow}>
              {(['efectivo', 'transferencia', 'otro'] as MedioPago[]).map((medio) => (
                <TouchableOpacity
                  key={medio}
                  style={[
                    styles.medioBtn,
                    medioPago === medio ? styles.medioBtnActivo : null,
                  ]}
                  onPress={() => setMedioPago(medio)}
                >
                  <Text style={[styles.medioBtnTexto, medioPago === medio ? styles.medioBtnTextoActivo : null]}>
                    {medio.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Botón Guardar */}
          <TouchableOpacity
            style={styles.btnGuardar}
            activeOpacity={0.8}
            onPress={handleGuardar}
          >
            <Text style={styles.btnGuardarTexto}>💾 Registrar Gasto</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal: Categoría Gasto */}
      <Modal
        visible={catModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCatModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitulo}>Seleccionar Categoría</Text>
              <TouchableOpacity
                onPress={() => setCatModalVisible(false)}
                style={styles.modalCerrarBtn}
              >
                <Text style={styles.modalCerrarBtnTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingCats ? (
              <View style={styles.modalCentrado}>
                <ActivityIndicator size="large" color={COLORS.accent} />
              </View>
            ) : (
              <FlatList
                data={categorias}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }: { item: CategoriaGasto }) => (
                  <TouchableOpacity
                    style={styles.modalItemRow}
                    onPress={() => {
                      setCategoriaSeleccionada(item);
                      setCatModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalItemNombre}>🏷️ {item.nombre}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.modalVacioContainer}>
                    <Text style={styles.modalVacioTexto}>
                      No hay categorías activas.{'\n'}Creá una desde{'\n'}📤 Gastos → Categorías.
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  btnVolver: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.card,
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnVolverTexto: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitulo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  seccionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  seccionTitulo: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.accent,
    letterSpacing: 1,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectorText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  selectorPlaceholder: {
    color: COLORS.textMuted,
    fontSize: 16,
  },
  selectorIcon: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  provSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnLimpiarProv: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 48,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLimpiarProvTexto: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  medioRow: {
    flexDirection: 'row',
    gap: 10,
  },
  medioBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  medioBtnActivo: {
    borderColor: COLORS.success,
    backgroundColor: '#4CAF7D15',
  },
  medioBtnTexto: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
  },
  medioBtnTextoActivo: {
    color: COLORS.success,
  },
  btnGuardar: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  btnGuardarTexto: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modals Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalCerrarBtn: {
    padding: 4,
  },
  modalCerrarBtnTexto: {
    fontSize: 18,
    color: COLORS.textMuted,
  },
  modalSearchContainer: {
    marginBottom: 12,
  },
  modalSearchInput: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCentrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalItemRow: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalItemNombre: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalItemSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  modalVacioContainer: {
    padding: 24,
    alignItems: 'center',
  },
  modalVacioTexto: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  advertenciaBanner: {
    backgroundColor: 'rgba(232, 160, 32, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  advertenciaTexto: {
    color: COLORS.accent,
    fontSize: 12,
    lineHeight: 16,
  },
});
