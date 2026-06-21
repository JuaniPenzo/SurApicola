// =============================================================================
// SurApícola — Pantalla de Nueva Compra (Fase 3C)
// =============================================================================
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/AppNavigator';
import { useSQLiteContext } from 'expo-sqlite';
import { getProveedoresActivos } from '../database/proveedores';
import { getInsumos } from '../database/insumos';
import { useCompras } from '../hooks/useCompras';
import { formatearDinero, fechaHoy } from '../utils/format';
import type { Proveedor, MedioPago, Insumo } from '../types';

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

interface LocalItem {
  id: string;
  tipo_stock: 'miel' | 'panal' | 'insumo';
  insumo_id: number | null;
  insumo_nombre: string | null;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
}

export function NuevaCompraScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const { crearCompra } = useCompras();

  // ── Datos de Referencia (SQLite) ───────────────────────────────────────────
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [insumosList, setInsumosList] = useState<Insumo[]>([]);

  // ── Cabecera de Compra ──────────────────────────────────────────────────────
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null);
  const [fecha, setFecha] = useState(fechaHoy());
  const [notas, setNotas] = useState('');

  // ── Lista de Ítems agregados ────────────────────────────────────────────────
  const [items, setItems] = useState<LocalItem[]>([]);

  // Formulario local para agregar un ítem
  const [itemTipo, setItemTipo] = useState<'miel' | 'panal' | 'insumo'>('miel');
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<Insumo | null>(null);
  const [itemCantidad, setItemCantidad] = useState('');
  const [itemSubtotal, setItemSubtotal] = useState('');

  // ── Pago Inicial ───────────────────────────────────────────────────────────
  const [montoPagadoPesos, setMontoPagadoPesos] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo');
  const [notasPago, setNotasPago] = useState('');

  // ── Modales de Selección ───────────────────────────────────────────────────
  const [provModalVisible, setProvModalVisible] = useState(false);
  const [searchProveedor, setSearchProveedor] = useState('');
  const [insumoModalVisible, setInsumoModalVisible] = useState(false);

  // Cargar proveedores
  const loadProveedores = async () => {
    try {
      setLoadingProveedores(true);
      const provs = await getProveedoresActivos(db, searchProveedor);
      setProveedores(provs);
    } catch (err) {
      console.error('[NuevaCompraScreen] Error al cargar proveedores:', err);
    } finally {
      setLoadingProveedores(false);
    }
  };

  const loadInsumos = async () => {
    try {
      const list = await getInsumos(db);
      setInsumosList(list);
    } catch (err) {
      console.error('[NuevaCompraScreen] Error al cargar insumos:', err);
    }
  };

  const resetForm = () => {
    setProveedorSeleccionado(null);
    setFecha(fechaHoy());
    setNotas('');
    setItems([]);
    setItemTipo('miel');
    setInsumoSeleccionado(null);
    setItemCantidad('');
    setItemSubtotal('');
    setMontoPagadoPesos('');
    setMedioPago('efectivo');
    setNotasPago('');
    setSearchProveedor('');
  };

  useFocusEffect(
    React.useCallback(() => {
      loadProveedores();
      loadInsumos();
      resetForm();
    }, [searchProveedor])
  );


  // ── Agregar ítem localmente ────────────────────────────────────────────────
  const handleAgregarItem = () => {
    if (itemTipo === 'insumo' && !insumoSeleccionado) {
      Alert.alert('Validación', 'Seleccioná un insumo.');
      return;
    }

    const cantNum = parseFloat(itemCantidad);
    if (isNaN(cantNum) || cantNum <= 0) {
      Alert.alert('Validación', 'Ingresá una cantidad válida mayor a cero.');
      return;
    }

    const subNum = parseFloat(itemSubtotal);
    if (isNaN(subNum) || subNum < 0) {
      Alert.alert('Validación', 'El costo total del renglón debe ser mayor o igual a cero.');
      return;
    }

    const unitPrice = cantNum > 0 ? subNum / cantNum : 0;

    const newItem: LocalItem = {
      id: Math.random().toString(),
      tipo_stock: itemTipo,
      insumo_id: itemTipo === 'insumo' ? insumoSeleccionado?.id ?? null : null,
      insumo_nombre: itemTipo === 'insumo' ? insumoSeleccionado?.nombre ?? null : null,
      cantidad: cantNum,
      costo_unitario: unitPrice,
      subtotal: subNum,
    };

    setItems([...items, newItem]);
    
    // Reset formulario de ítem
    setItemCantidad('');
    setItemSubtotal('');
    setInsumoSeleccionado(null);
  };

  const handleEliminarItem = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
  };

  const totalPesosGeneral = items.reduce((acc, it) => acc + it.subtotal, 0);

  // ── Guardar Compra en BD ───────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!proveedorSeleccionado) {
      Alert.alert('Validación', 'Seleccioná un proveedor.');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Validación', 'Debés agregar al menos un ítem a la compra.');
      return;
    }

    const totalCentavos = Math.round(totalPesosGeneral * 100);

    // Validar pago inicial
    const pagoInicialPesosNum = montoPagadoPesos ? parseFloat(montoPagadoPesos) : 0;
    if (isNaN(pagoInicialPesosNum) || pagoInicialPesosNum < 0) {
      Alert.alert('Validación', 'El pago inicial debe ser mayor o igual a cero.');
      return;
    }

    const pagoInicialCentavos = Math.round(pagoInicialPesosNum * 100);
    if (pagoInicialCentavos > totalCentavos) {
      Alert.alert('Validación', 'El pago inicial no puede ser mayor que el costo total de la compra.');
      return;
    }

    // Convertir renglones locales al formato de base de datos
    const itemsBD = items.map((it) => {
      const cantidadBD = it.tipo_stock === 'miel' 
        ? Math.round(it.cantidad * 1000) // miel en gramos
        : Math.round(it.cantidad); // panal e insumos en unidades
      return {
        tipo_stock: it.tipo_stock,
        insumo_id: it.insumo_id,
        cantidad: cantidadBD,
        costo_unitario_centavos: Math.round(it.costo_unitario * 100),
        subtotal_centavos: Math.round(it.subtotal * 100),
      };
    });

    try {
      await crearCompra({
        proveedor_id: proveedorSeleccionado.id,
        fecha,
        total_centavos: totalCentavos,
        notes: null, // compatibility with database function mapping
        notas: notas.trim() || null,
        monto_pagado: pagoInicialCentavos,
        medio_pago: pagoInicialCentavos > 0 ? medioPago : null,
        notas_pago: pagoInicialCentavos > 0 ? (notasPago.trim() || null) : null,
        items: itemsBD,
      } as any);

      Alert.alert('Éxito', 'Compra registrada correctamente.', [
        { text: 'Aceptar', onPress: () => navigation.navigate('Compras') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo registrar la compra.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.navigate('Compras')}>
          <Text style={styles.btnVolverTexto}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>📦 Nueva Compra</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Proveedor y Fecha */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>PROVEEDOR</Text>
            <TouchableOpacity
              style={styles.selectorBtn}
              activeOpacity={0.7}
              onPress={() => setProvModalVisible(true)}
            >
              <Text style={proveedorSeleccionado ? styles.selectorText : styles.selectorPlaceholder}>
                {proveedorSeleccionado ? proveedorSeleccionado.nombre : 'Seleccionar proveedor...'}
              </Text>
              <Text style={styles.selectorIcon}>▼</Text>
            </TouchableOpacity>

            <View style={styles.fechaRow}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.label}>Fecha (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={fecha}
                  onChangeText={setFecha}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            </View>
          </View>

          {/* Formulario para AGREGAR un Ítem */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>AGREGAR RENGLÓN</Text>
            
            {/* Tipo de Stock */}
            <Text style={styles.label}>Tipo de Stock</Text>
            <View style={styles.tipoStockRow}>
              {(['miel', 'panal', 'insumo'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.tipoBtn,
                    itemTipo === t ? styles.tipoBtnActivo : null,
                  ]}
                  onPress={() => {
                    setItemTipo(t);
                    setItemCantidad('');
                    setItemSubtotal('');
                    setInsumoSeleccionado(null);
                  }}
                >
                  <Text style={[styles.tipoBtnTexto, itemTipo === t ? styles.tipoBtnTextoActivo : null]}>
                    {t === 'miel' ? '🍯 Miel' : t === 'panal' ? '🧱 Panal' : '🧴 Insumo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {itemTipo === 'insumo' && (
              <View style={{ marginTop: 6, gap: 6 }}>
                <Text style={styles.label}>Seleccionar Insumo *</Text>
                <TouchableOpacity
                  style={styles.selectorBtn}
                  activeOpacity={0.7}
                  onPress={() => setInsumoModalVisible(true)}
                >
                  <Text style={insumoSeleccionado ? styles.selectorText : styles.selectorPlaceholder}>
                    {insumoSeleccionado ? insumoSeleccionado.nombre : 'Seleccionar insumo...'}
                  </Text>
                  <Text style={styles.selectorIcon}>▼</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Cantidad y Costo de Renglón */}
            <View style={styles.inputsRow}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.label}>
                  {itemTipo === 'miel' ? 'Cantidad (kg)' : 'Cantidad (unidades)'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={itemCantidad}
                  onChangeText={setItemCantidad}
                  keyboardType="numeric"
                  placeholder={itemTipo === 'miel' ? 'Ej: 10.5' : 'Ej: 5'}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.label}>Costo Renglón (ARS)</Text>
                <TextInput
                  style={styles.input}
                  value={itemSubtotal}
                  onChangeText={setItemSubtotal}
                  keyboardType="numeric"
                  placeholder="Ej: 5000"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.btnAgregarItem}
              onPress={handleAgregarItem}
            >
              <Text style={styles.btnAgregarItemText}>➕ Agregar Renglón</Text>
            </TouchableOpacity>
          </View>

          {/* Listado de ítems agregados */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>DETALLE DE LA COMPRA</Text>
            {items.length === 0 ? (
              <View style={styles.itemsVaciosContainer}>
                <Text style={styles.itemsVaciosTexto}>Aún no agregaste renglones a esta compra.</Text>
              </View>
            ) : (
              <View style={styles.itemsListContainer}>
                {items.map((it) => {
                  const emoji = it.tipo_stock === 'miel' ? '🍯' : it.tipo_stock === 'panal' ? '🧱' : '🧴';
                  const label = it.tipo_stock === 'miel' ? 'Miel' : it.tipo_stock === 'panal' ? 'Panal' : `Insumo: ${it.insumo_nombre}`;
                  const cantLabel = it.tipo_stock === 'miel' ? `${it.cantidad} kg` : `${it.cantidad} un`;
                  return (
                    <View key={it.id} style={styles.itemRow}>
                      <View style={styles.itemRowLeft}>
                        <Text style={styles.itemEmoji}>{emoji}</Text>
                        <View>
                          <Text style={styles.itemLabel}>{label}</Text>
                          <Text style={styles.itemSubText}>
                            {cantLabel} × {formatearDinero(Math.round(it.costo_unitario * 100))}/un
                          </Text>
                        </View>
                      </View>
                      <View style={styles.itemRowRight}>
                        <Text style={styles.itemSubtotal}>{formatearDinero(Math.round(it.subtotal * 100))}</Text>
                        <TouchableOpacity
                          style={styles.btnEliminarItem}
                          onPress={() => handleEliminarItem(it.id)}
                        >
                          <Text style={styles.btnEliminarItemTexto}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
                <View style={styles.separadorLine} />
                <View style={styles.totalGeneralRow}>
                  <Text style={styles.totalGeneralLabel}>TOTAL COMPRA</Text>
                  <Text style={styles.totalGeneralMonto}>{formatearDinero(Math.round(totalPesosGeneral * 100))}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Pago Inicial (Opcional) */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>PAGO INICIAL (OPCIONAL)</Text>
            
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Monto abonado ahora (ARS)</Text>
              <TextInput
                style={styles.input}
                value={montoPagadoPesos}
                onChangeText={setMontoPagadoPesos}
                keyboardType="numeric"
                placeholder="Ej: 2000 (dejar vacío si no abona nada)"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {montoPagadoPesos && parseFloat(montoPagadoPesos) > 0 ? (
              <>
                <Text style={[styles.label, { marginTop: 12 }]}>Medio de Pago</Text>
                <View style={styles.tipoStockRow}>
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

                <View style={{ marginTop: 12, gap: 6 }}>
                  <Text style={styles.label}>Notas del Pago</Text>
                  <TextInput
                    style={styles.input}
                    value={notasPago}
                    onChangeText={setNotasPago}
                    placeholder="Ej: Pago seña, comprobante 029..."
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </>
            ) : null}
          </View>

          {/* Notas Generales */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>OBSERVACIONES GENERALES</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notas}
              onChangeText={setNotas}
              multiline
              numberOfLines={3}
              placeholder="Notas generales de la compra..."
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          {/* Botón de Guardar */}
          <TouchableOpacity
            style={styles.btnGuardar}
            activeOpacity={0.8}
            onPress={handleGuardar}
          >
            <Text style={styles.btnGuardarTexto}>💾 Registrar Compra</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de Selección de Proveedor */}
      <Modal
        visible={provModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setProvModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitulo}>Seleccionar Proveedor</Text>
              <TouchableOpacity
                onPress={() => setProvModalVisible(false)}
                style={styles.modalCerrarBtn}
              >
                <Text style={styles.modalCerrarBtnTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchContainer}>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Buscar proveedor..."
                placeholderTextColor={COLORS.textMuted}
                value={searchProveedor}
                onChangeText={setSearchProveedor}
                clearButtonMode="while-editing"
              />
            </View>

            {loadingProveedores ? (
              <View style={styles.modalCentrado}>
                <ActivityIndicator size="large" color={COLORS.accent} />
              </View>
            ) : (
              <FlatList
                data={proveedores}
                keyExtractor={(item: Proveedor) => item.id.toString()}
                contentContainerStyle={styles.modalListContent}
                renderItem={({ item }: { item: Proveedor }) => (
                  <TouchableOpacity
                    style={styles.modalItemRow}
                    onPress={() => {
                      setProveedorSeleccionado(item);
                      setProvModalVisible(false);
                      setSearchProveedor('');
                    }}
                  >
                    <Text style={styles.modalItemNombre}>{item.nombre}</Text>
                    {item.telefono && (
                      <Text style={styles.modalItemSub}>{item.telefono}</Text>
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.modalVacioContainer}>
                    <Text style={styles.modalVacioTexto}>
                      No se encontraron proveedores activos.
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Selección de Insumo */}
      <Modal
        visible={insumoModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setInsumoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitulo}>Seleccionar Insumo</Text>
              <TouchableOpacity
                onPress={() => setInsumoModalVisible(false)}
                style={styles.modalCerrarBtn}
              >
                <Text style={styles.modalCerrarBtnTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={insumosList}
              keyExtractor={(item: Insumo) => item.id.toString()}
              contentContainerStyle={styles.modalListContent}
              renderItem={({ item }: { item: Insumo }) => (
                <TouchableOpacity
                  style={styles.modalItemRow}
                  onPress={() => {
                    setInsumoSeleccionado(item);
                    setInsumoModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemNombre}>{item.nombre}</Text>
                  <Text style={styles.modalItemSub}>
                    Stock actual: {item.stock_actual ?? 0} {item.unidad}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.modalVacioContainer}>
                  <Text style={styles.modalVacioTexto}>
                    No hay insumos activos.
                  </Text>
                </View>
              }
            />
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
  fechaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
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
  tipoStockRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tipoBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tipoBtnActivo: {
    borderColor: COLORS.accent,
    backgroundColor: '#E8A02015',
  },
  tipoBtnTexto: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  tipoBtnTextoActivo: {
    color: COLORS.accent,
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
  inputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btnAgregarItem: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnAgregarItemText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  itemsVaciosContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  itemsVaciosTexto: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  itemsListContainer: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemEmoji: {
    fontSize: 20,
  },
  itemLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  itemSubText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  itemRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemSubtotal: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  btnEliminarItem: {
    backgroundColor: 'rgba(224, 90, 90, 0.15)',
    borderRadius: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  btnEliminarItemTexto: {
    color: COLORS.danger,
    fontWeight: 'bold',
    fontSize: 12,
  },
  separadorLine: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  totalGeneralRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalGeneralLabel: {
    color: COLORS.accent,
    fontWeight: '800',
    fontSize: 14,
  },
  totalGeneralMonto: {
    color: COLORS.accent,
    fontWeight: '900',
    fontSize: 18,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
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
  modalListContent: {
    paddingBottom: 20,
  },
  modalItemRow: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 12,
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
});
