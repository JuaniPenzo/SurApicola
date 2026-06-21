// =============================================================================
// SurApícola — Pantalla de Nueva Venta (Fase 3B)
// =============================================================================
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/AppNavigator';
import { useSQLiteContext } from 'expo-sqlite';
import { getClientesActivos } from '../database/clientes';
import { getPresentacionesActivas } from '../database/presentaciones';
import { getStockActual } from '../database/stock';
import { getCategoriasPrecio, getPrecioSugerido } from '../database/precios';
import { useVentas } from '../hooks/useVentas';
import { formatearDinero, formatearGramos, formatearUnidades, fechaHoy } from '../utils/format';
import type { Cliente, Presentacion, MedioPago, CategoriaPrecio } from '../types';

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

interface ItemRow {
  key: string;
  presentacion: Presentacion | null;
  cantidad: number;
  precio_unitario: number; // en centavos
}

export function NuevaVentaScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const { crearVenta } = useVentas();

  // ── Datos de Referencia (SQLite) ───────────────────────────────────────────
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPrecio[]>([]);
  const [stockActual, setStockActual] = useState<{ mielGramos: number; stockPanalUnidades: number } | null>(null);

  // ── Campos de la Venta ─────────────────────────────────────────────────────
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<CategoriaPrecio | null>(null);
  const [fecha, setFecha] = useState(fechaHoy());
  const [notas, setNotas] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);

  // Campos de Cobro Inicial
  const [montoCobrado, setMontoCobrado] = useState('');
  const [medioCobro, setMedioCobro] = useState<MedioPago>('efectivo');
  const [notasCobro, setNotasCobro] = useState('');

  // ── Modales de Selección ───────────────────────────────────────────────────
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [preciosModalVisible, setPreciosModalVisible] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [activeItemKeyForProduct, setActiveItemKeyForProduct] = useState<string | null>(null);

  // Cargar catálogos
  const loadData = async () => {
    try {
      const cls = await getClientesActivos(db);
      const prs = await getPresentacionesActivas(db);
      const stk = await getStockActual(db);
      const cats = await getCategoriasPrecio(db);
      
      // Adaptar stock actual a tipos internos
      setClientes(cls);
      setPresentaciones(prs);
      setCategorias(cats);
      setStockActual({
        mielGramos: stk.mielGramos,
        stockPanalUnidades: stk.panalUnidades,
      });
    } catch (err) {
      console.error('[NuevaVentaScreen] Error al cargar catálogos:', err);
    }
  };

  const resetForm = () => {
    setClienteSeleccionado(null);
    setCategoriaSeleccionada(null);
    setFecha(fechaHoy());
    setNotas('');
    setItems([{ key: Math.random().toString(36).substring(7), presentacion: null, cantidad: 1, precio_unitario: 0 }]);
    setMontoCobrado('');
    setMedioCobro('efectivo');
    setNotasCobro('');
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
      resetForm();
    }, [db])
  );


  // ── Acciones de Ítems ──────────────────────────────────────────────────────
  const agregarRenglon = () => {
    const newKey = Math.random().toString(36).substring(7);
    setItems((prev) => [
      ...prev,
      { key: newKey, presentacion: null, cantidad: 1, precio_unitario: 0 },
    ]);
  };

  const eliminarRenglon = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const abrirSelectorProducto = (key: string) => {
    setActiveItemKeyForProduct(key);
    setProductModalVisible(true);
  };

  const seleccionarProducto = async (p: Presentacion) => {
    if (!activeItemKeyForProduct) return;

    let precioSugerido = p.precio_centavos;
    let avisoSugerido = false;

    if (categoriaSeleccionada) {
      const sugerido = await getPrecioSugerido(db, categoriaSeleccionada.id, p.id);
      if (sugerido !== null) {
        precioSugerido = sugerido;
      } else {
        avisoSugerido = true;
      }
    }

    setItems((prev) =>
      prev.map((it) =>
        it.key === activeItemKeyForProduct
          ? { ...it, presentacion: p, precio_unitario: precioSugerido }
          : it
      )
    );
    setProductModalVisible(false);
    setActiveItemKeyForProduct(null);

    if (avisoSugerido) {
      Alert.alert(
        'Aviso',
        `No hay precio configurado para "${p.nombre}" en la lista "${categoriaSeleccionada?.nombre}". Se autocompletó con el precio base. Podés editarlo manualmente.`
      );
    }
  };

  const cambiarCategoriaPrecio = async (cat: CategoriaPrecio | null) => {
    setCategoriaSeleccionada(cat);
    setPreciosModalVisible(false);

    if (items.some((it) => it.presentacion !== null)) {
      Alert.alert(
        'Actualizar Precios',
        '¿Desea actualizar los precios de los productos ya agregados en la venta según la nueva lista seleccionada?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Sí, actualizar',
            onPress: async () => {
              const updatedItems = await Promise.all(
                items.map(async (it) => {
                  if (!it.presentacion) return it;
                  let precio = it.presentacion.precio_centavos;
                  if (cat) {
                    const sug = await getPrecioSugerido(db, cat.id, it.presentacion.id);
                    if (sug !== null) {
                      precio = sug;
                    }
                  }
                  return { ...it, precio_unitario: precio };
                })
              );
              setItems(updatedItems);
            },
          },
        ]
      );
    }
  };

  const cambiarCantidad = (key: string, val: string) => {
    const cant = parseInt(val) || 0;
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, cantidad: cant } : it))
    );
  };

  const cambiarPrecioUnitario = (key: string, val: string) => {
    const precioPesos = parseFloat(val) || 0;
    const precioCentavos = Math.round(precioPesos * 100);
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, precio_unitario: precioCentavos } : it))
    );
  };

  // ── Cálculos Dinámicos ─────────────────────────────────────────────────────
  const calcularTotal = (): number => {
    return items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0);
  };

  // Calcular demanda de stock
  const calcularDemandas = () => {
    let miel = 0;
    let panal = 0;
    for (const it of items) {
      if (!it.presentacion) continue;
      if (it.presentacion.tipo === 'miel') {
        miel += it.cantidad * it.presentacion.gramos_por_unidad;
      } else {
        panal += it.cantidad * it.presentacion.unidades_panal_por_unidad;
      }
    }
    return { miel, panal };
  };

  // ── Guardar Venta ──────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!clienteSeleccionado) {
      Alert.alert('Validación', 'Seleccioná un cliente.');
      return;
    }

    const itemsValidos = items.filter((it) => it.presentacion !== null && it.cantidad > 0);
    if (itemsValidos.length === 0) {
      Alert.alert('Validación', 'Agregá al menos un producto con cantidad mayor a cero.');
      return;
    }

    const total = calcularTotal();
    const cobro = montoCobrado ? Math.round(parseFloat(montoCobrado) * 100) : 0;

    if (isNaN(cobro) || cobro < 0) {
      Alert.alert('Validación', 'El cobro inicial debe ser cero o un número positivo.');
      return;
    }
    if (cobro > total) {
      Alert.alert('Validación', 'El cobro inicial no puede superar el total de la venta.');
      return;
    }

    // Validar stock
    const demandas = calcularDemandas();
    if (stockActual) {
      if (demandas.miel > stockActual.mielGramos) {
        Alert.alert(
          'Stock Insuficiente',
          `No hay suficiente stock de miel. Demandado: ${formatearGramos(demandas.miel)}. Disponible: ${formatearGramos(stockActual.mielGramos)}.`
        );
        return;
      }
      if (demandas.panal > stockActual.stockPanalUnidades) {
        Alert.alert(
          'Stock Insuficiente',
          `No hay suficiente stock de panal. Demandado: ${formatearUnidades(demandas.panal)}. Disponible: ${formatearUnidades(stockActual.stockPanalUnidades)}.`
        );
        return;
      }
    }

    const inputItems = itemsValidos.map((it) => {
      const p = it.presentacion!;
      return {
        presentacion_id: p.id,
        cantidad: it.cantidad,
        precio_unitario_centavos: it.precio_unitario,
        subtotal_centavos: it.cantidad * it.precio_unitario,
        codigo_snap: p.codigo,
        nombre_snap: p.nombre,
        tipo_snap: p.tipo,
        gramos_por_unidad_snap: p.gramos_por_unidad,
        unidades_panal_por_unidad_snap: p.unidades_panal_por_unidad,
      };
    });

    try {
      await crearVenta({
        cliente_id: clienteSeleccionado.id,
        categoria_precio_id: categoriaSeleccionada ? categoriaSeleccionada.id : null,
        fecha,
        total_centavos: total,
        notas: notas.trim() || null,
        items: inputItems,
        monto_cobrado: cobro,
        medio_cobro: cobro > 0 ? medioCobro : null,
        notas_cobro: notasCobro.trim() || null,
      });

      Alert.alert('Éxito', 'Venta registrada correctamente.', [
        { text: 'Aceptar', onPress: () => navigation.navigate('Ventas') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la venta.');
    }
  };

  const demandas = calcularDemandas();
  const totalVenta = calcularTotal();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.navigate('Ventas')}>
          <Text style={styles.btnVolverTexto}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>🛒 Nueva Venta</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Información del Cliente */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>CLIENTE</Text>
            <TouchableOpacity
              style={styles.selectorBtn}
              activeOpacity={0.7}
              onPress={() => setClientModalVisible(true)}
            >
              <Text style={clienteSeleccionado ? styles.selectorText : styles.selectorPlaceholder}>
                {clienteSeleccionado ? clienteSeleccionado.nombre : 'Seleccionar cliente...'}
              </Text>
              <Text style={styles.selectorIcon}>▼</Text>
            </TouchableOpacity>

            {/* Lista de Precios */}
            <Text style={[styles.seccionTitulo, { marginTop: 12 }]}>LISTA DE PRECIOS</Text>
            <TouchableOpacity
              style={styles.selectorBtn}
              activeOpacity={0.7}
              onPress={() => setPreciosModalVisible(true)}
            >
              <Text style={categoriaSeleccionada ? styles.selectorText : styles.selectorPlaceholder}>
                {categoriaSeleccionada ? categoriaSeleccionada.nombre : 'Venta Manual (Sin lista sugerida)...'}
              </Text>
              <Text style={styles.selectorIcon}>▼</Text>
            </TouchableOpacity>

            <View style={styles.fechaRow}>
              <View style={{ flex: 1, gap: 6, marginTop: 12 }}>
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
          </View>

          {/* Renglones de Productos */}
          <View style={styles.seccionCard}>
            <View style={styles.seccionHeaderRow}>
              <Text style={styles.seccionTitulo}>PRODUCTOS / ÍTEMS</Text>
              <TouchableOpacity style={styles.btnAgregar} onPress={agregarRenglon}>
                <Text style={styles.btnAgregarTexto}>+ Agregar Ítem</Text>
              </TouchableOpacity>
            </View>

            {items.map((item, index) => (
              <View key={item.key} style={styles.itemRowContainer}>
                <View style={styles.itemRowHeader}>
                  <Text style={styles.itemIndex}># {index + 1}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => eliminarRenglon(item.key)}>
                      <Text style={styles.btnEliminarRenglon}>Eliminar ✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Seleccionar Presentación */}
                <TouchableOpacity
                  style={[styles.selectorBtn, { marginBottom: 10 }]}
                  activeOpacity={0.7}
                  onPress={() => abrirSelectorProducto(item.key)}
                >
                  <Text style={item.presentacion ? styles.selectorText : styles.selectorPlaceholder}>
                    {item.presentacion ? item.presentacion.nombre : 'Seleccionar producto...'}
                  </Text>
                  <Text style={styles.selectorIcon}>▼</Text>
                </TouchableOpacity>

                <View style={styles.itemInputsRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.label}>Cantidad</Text>
                    <TextInput
                      style={styles.input}
                      value={item.cantidad.toString()}
                      onChangeText={(val) => cambiarCantidad(item.key, val)}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={{ flex: 1.5, gap: 4 }}>
                    <Text style={styles.label}>Precio Unit. (ARS)</Text>
                    <TextInput
                      style={styles.input}
                      value={(item.precio_unitario / 100).toString()}
                      onChangeText={(val) => cambiarPrecioUnitario(item.key, val)}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={{ flex: 1.2, alignItems: 'flex-end', justifyContent: 'center' }}>
                    <Text style={styles.label}>Subtotal</Text>
                    <Text style={styles.itemSubtotalText}>
                      {formatearDinero(item.cantidad * item.precio_unitario)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Información del Stock Actual y Demandas de Venta */}
          {stockActual && (
            <View style={styles.stockCard}>
              <Text style={styles.stockTitulo}>STOCK Y DEMANDAS DE VENTA</Text>
              <View style={styles.stockFila}>
                <Text style={styles.stockLabel}>Miel (kg):</Text>
                <Text
                  style={[
                    styles.stockValor,
                    demandas.miel > stockActual.mielGramos ? styles.stockError : null,
                  ]}
                >
                  Demanda: {formatearGramos(demandas.miel)} / Disponible:{' '}
                  {formatearGramos(stockActual.mielGramos)}
                </Text>
              </View>
              <View style={styles.stockFila}>
                <Text style={styles.stockLabel}>Panal (unidades):</Text>
                <Text
                  style={[
                    styles.stockValor,
                    demandas.panal > stockActual.stockPanalUnidades ? styles.stockError : null,
                  ]}
                >
                  Demanda: {formatearUnidades(demandas.panal)} / Disponible:{' '}
                  {formatearUnidades(stockActual.stockPanalUnidades)}
                </Text>
              </View>
            </View>
          )}

          {/* Registro del Cobro Inicial */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>COBRO INICIAL (OPCIONAL)</Text>
            <View style={styles.subInputGroup}>
              <Text style={styles.label}>Monto entregado (ARS)</Text>
              <TextInput
                style={styles.input}
                value={montoCobrado}
                onChangeText={setMontoCobrado}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {montoCobrado && parseFloat(montoCobrado) > 0 ? (
              <>
                <View style={styles.subInputGroup}>
                  <Text style={styles.label}>Medio de Cobro</Text>
                  <View style={styles.tabsMedio}>
                    {(['efectivo', 'transferencia', 'otro'] as MedioPago[]).map((medio) => (
                      <TouchableOpacity
                        key={medio}
                        style={[
                          styles.tabMedioBtn,
                          medioCobro === medio ? styles.tabMedioActivo : null,
                        ]}
                        onPress={() => setMedioCobro(medio)}
                      >
                        <Text
                          style={[
                            styles.tabMedioTexto,
                            medioCobro === medio ? styles.tabMedioTextoActivo : null,
                          ]}
                        >
                          {medio.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.subInputGroup}>
                  <Text style={styles.label}>Notas de Cobro</Text>
                  <TextInput
                    style={styles.input}
                    value={notasCobro}
                    onChangeText={setNotasCobro}
                    placeholder="Ej: Seña inicial en efectivo..."
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </>
            ) : null}
          </View>

          {/* Notas de la Venta */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>OBSERVACIONES DE LA VENTA</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notas}
              onChangeText={setNotas}
              placeholder="Notas internas..."
              placeholderTextColor={COLORS.textMuted}
              multiline={true}
              numberOfLines={3}
            />
          </View>

          {/* Caja Resumen y Botón de Envío */}
          <View style={styles.resumenCaja}>
            <View style={styles.resumenFila}>
              <Text style={styles.resumenLabel}>Total a facturar:</Text>
              <Text style={styles.resumenValor}>{formatearDinero(totalVenta)}</Text>
            </View>
            <TouchableOpacity style={styles.btnGuardarVenta} onPress={handleGuardar}>
              <Text style={styles.btnGuardarVentaTexto}>CONFIRMAR Y GUARDAR VENTA</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Modal de Selección: Clientes ─────────────────────────────────────── */}
      <Modal
        visible={clientModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setClientModalVisible(false)}
      >
        <View style={styles.overlaySelector}>
          <View style={styles.selectorContent}>
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitulo}>Seleccionar Cliente</Text>
              <TouchableOpacity onPress={() => setClientModalVisible(false)}>
                <Text style={styles.btnCerrarSelector}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.selectorList}>
              {clientes.length === 0 ? (
                <Text style={styles.noDataSelector}>No hay clientes activos en la base.</Text>
              ) : (
                clientes.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.selectorOption}
                    onPress={() => {
                      setClienteSeleccionado(c);
                      setClientModalVisible(false);
                    }}
                  >
                    <Text style={styles.optionNombre}>{c.nombre}</Text>
                    {c.telefono && <Text style={styles.optionSub}>{c.telefono}</Text>}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal de Selección: Categorías de Precio ─────────────────────────── */}
      <Modal
        visible={preciosModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPreciosModalVisible(false)}
      >
        <View style={styles.overlaySelector}>
          <View style={styles.selectorContent}>
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitulo}>Seleccionar Lista de Precios</Text>
              <TouchableOpacity onPress={() => setPreciosModalVisible(false)}>
                <Text style={styles.btnCerrarSelector}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.selectorList}>
              <TouchableOpacity
                style={styles.selectorOption}
                onPress={() => cambiarCategoriaPrecio(null)}
              >
                <Text style={styles.optionNombre}>Venta Manual (Sin lista sugerida)</Text>
                <Text style={styles.optionSub}>Permite ingresar precios ad-hoc desde cero</Text>
              </TouchableOpacity>
              
              {categorias.length === 0 ? (
                <Text style={styles.noDataSelector}>No hay listas de precios activas en la base.</Text>
              ) : (
                categorias.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.selectorOption}
                    onPress={() => cambiarCategoriaPrecio(c)}
                  >
                    <Text style={styles.optionNombre}>{c.nombre}</Text>
                    {c.descripcion && <Text style={styles.optionSub}>{c.descripcion}</Text>}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal de Selección: Presentaciones ───────────────────────────────── */}
      <Modal
        visible={productModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setProductModalVisible(false)}
      >
        <View style={styles.overlaySelector}>
          <View style={styles.selectorContent}>
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitulo}>Seleccionar Presentación</Text>
              <TouchableOpacity onPress={() => setProductModalVisible(false)}>
                <Text style={styles.btnCerrarSelector}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.selectorList}>
              {presentaciones.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.selectorOption}
                  onPress={() => seleccionarProducto(p)}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.optionNombre}>{p.nombre}</Text>
                    <Text style={styles.optionPrecio}>{formatearDinero(p.precio_centavos)}</Text>
                  </View>
                  <Text style={styles.optionSub}>
                    {p.tipo === 'miel' ? 'Miel (pura)' : 'Panal (panal por unidad)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
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
  },
  btnVolver: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 16,
  },
  btnVolverTexto: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  headerTitulo: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  seccionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  seccionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seccionTitulo: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  btnAgregar: {
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnAgregarTexto: {
    color: COLORS.accentLight,
    fontSize: 11,
    fontWeight: '700',
  },
  selectorBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectorText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  selectorPlaceholder: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  selectorIcon: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  fechaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.text,
    fontSize: 14,
  },
  textArea: {
    minHeight: 60,
  },
  // Ítems de venta
  itemRowContainer: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  itemRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemIndex: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
  },
  btnEliminarRenglon: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '600',
  },
  itemInputsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  itemSubtotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    paddingBottom: 8,
  },
  // Stock Card
  stockCard: {
    backgroundColor: 'rgba(232, 160, 32, 0.05)',
    borderColor: 'rgba(232, 160, 32, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  stockTitulo: {
    fontSize: 10,
    color: COLORS.accentLight,
    fontWeight: '700',
    letterSpacing: 1,
  },
  stockFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stockLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  stockValor: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  stockError: {
    color: COLORS.danger,
  },
  // Cobro Inicial
  subInputGroup: {
    gap: 6,
    marginBottom: 10,
  },
  tabsMedio: {
    flexDirection: 'row',
    gap: 6,
  },
  tabMedioBtn: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabMedioActivo: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  tabMedioTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabMedioTextoActivo: {
    color: COLORS.bg,
  },
  // Resumen
  resumenCaja: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  resumenFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resumenLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  resumenValor: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.success,
  },
  btnGuardarVenta: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnGuardarVentaTexto: {
    color: COLORS.bg,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  // Overlay de Selectores
  overlaySelector: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  selectorContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  selectorTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  btnCerrarSelector: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectorList: {
    padding: 16,
  },
  selectorOption: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  optionNombre: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  optionSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  optionPrecio: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accentLight,
  },
  noDataSelector: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
