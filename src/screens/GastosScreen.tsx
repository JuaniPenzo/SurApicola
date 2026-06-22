// =============================================================================
// SurApícola — Pantalla de Gastos Operativos (Fase 3D)
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
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/AppNavigator';
import { useGastos } from '../hooks/useGastos';
import { getGastoById } from '../database/gastos';
import { useSQLiteContext } from 'expo-sqlite';
import { formatearDinero, formatearFecha, fechaHoy } from '../utils/format';
import type { MedioPago, EstadoGasto } from '../types';
import type { RangoFiltro } from '../utils/fechas';

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

export function GastosScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const {
    gastos,
    loading,
    refreshing,
    error,
    search,
    setSearch,
    rango,
    setRango,
    fechaDesde,
    fechaHasta,
    setCustomFechas,
    refresh,
    registrarPago,
    anularGasto,
  } = useGastos();

  const [inputDesde, setInputDesde] = useState(fechaDesde);
  const [inputHasta, setInputHasta] = useState(fechaHasta);
  const [dateError, setDateError] = useState<string | null>(null);

  React.useEffect(() => {
    setInputDesde(fechaDesde);
    setInputHasta(fechaHasta);
  }, [fechaDesde, fechaHasta]);

  const handleAplicarFiltro = () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!inputDesde || !inputDesde.trim()) {
      setDateError('Falta ingresar la fecha Desde.');
      return;
    }
    if (!inputHasta || !inputHasta.trim()) {
      setDateError('Falta ingresar la fecha Hasta.');
      return;
    }

    if (!dateRegex.test(inputDesde)) {
      setDateError('La fecha Desde debe tener el formato AAAA-MM-DD.');
      return;
    }
    if (!dateRegex.test(inputHasta)) {
      setDateError('La fecha Hasta debe tener el formato AAAA-MM-DD.');
      return;
    }

    const d1 = new Date(inputDesde + 'T00:00:00');
    const d2 = new Date(inputHasta + 'T00:00:00');

    if (isNaN(d1.getTime())) {
      setDateError('La fecha Desde es inválida.');
      return;
    }
    if (isNaN(d2.getTime())) {
      setDateError('La fecha Hasta es inválida.');
      return;
    }

    if (d1 > d2) {
      setDateError('La fecha Desde no puede ser mayor que la fecha Hasta.');
      return;
    }

    setDateError(null);
    setCustomFechas(inputDesde, inputHasta);
  };

  const rangos: { key: RangoFiltro; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Este mes' },
    { key: 'entre_fechas', label: 'Entre fechas' },
  ];

  // ── Estados de Detalle y Formulario de Pago ────────────────────────────────
  const [selectedGasto, setSelectedGasto] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [pagoModalVisible, setPagoModalVisible] = useState(false);

  // Campos del Pago
  const [montoPago, setMontoPago] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo');
  const [fechaPago, setFechaPago] = useState(fechaHoy());
  const [notasPago, setNotasPago] = useState('');

  // Recargar al enfocar pantalla
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [])
  );

  const abrirDetalle = async (id: number) => {
    try {
      const fullGasto = await getGastoById(db, id);
      if (fullGasto) {
        setSelectedGasto(fullGasto);
        setDetailModalVisible(true);
      } else {
        Alert.alert('Error', 'No se pudieron cargar los detalles del gasto.');
      }
    } catch (err) {
      Alert.alert('Error', 'Ocurrió un error en la base de datos.');
    }
  };

  const cerrarDetalles = () => {
    setDetailModalVisible(false);
    setSelectedGasto(null);
  };

  // ── Registrar Pago posterior ───────────────────────────────────────────────
  const abrirFormularioPago = () => {
    if (!selectedGasto) return;
    const saldo = selectedGasto.total_centavos - obtenerTotalPagado(selectedGasto);
    setMontoPago((saldo / 100).toString());
    setMedioPago('efectivo');
    setFechaPago(fechaHoy());
    setNotasPago('');
    setPagoModalVisible(true);
  };

  const handleGuardarPago = async () => {
    if (!selectedGasto) return;
    const montoCentavos = Math.round(parseFloat(montoPago) * 100);
    const saldo = selectedGasto.total_centavos - obtenerTotalPagado(selectedGasto);

    if (isNaN(montoCentavos) || montoCentavos <= 0) {
      Alert.alert('Validación', 'El monto a pagar debe ser un número positivo.');
      return;
    }
    if (montoCentavos > saldo) {
      Alert.alert('Validación', `El monto no puede superar el saldo pendiente ($${saldo / 100}).`);
      return;
    }

    try {
      await registrarPago(selectedGasto.id, {
        monto_centavos: montoCentavos,
        medio_pago: medioPago,
        fecha: fechaPago,
        notas: notasPago.trim() || null,
      });

      // Refrescar modal de detalles
      const updated = await getGastoById(db, selectedGasto.id);
      setSelectedGasto(updated);
      setPagoModalVisible(false);
      Alert.alert('Éxito', 'El pago se registró correctamente.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar el pago.');
    }
  };

  // ── Anular Gasto ───────────────────────────────────────────────────────────
  const handleConfirmarAnulacion = () => {
    if (!selectedGasto) return;
    Alert.alert(
      '¿Anular este gasto?',
      'Esta acción marcará el gasto como anulado y anulará todos los pagos asociados de forma permanente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Anular Gasto',
          style: 'destructive',
          onPress: async () => {
            try {
              await anularGasto(selectedGasto.id);
              cerrarDetalles();
              Alert.alert('Éxito', 'El gasto ha sido anulado.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo anular el gasto.');
            }
          },
        },
      ]
    );
  };

  // ── Helper para sumar pagos activos ────────────────────────────────────────
  const obtenerTotalPagado = (g: any): number => {
    if (!g.pagos) return 0;
    return g.pagos.reduce((acc: number, p: any) => acc + p.monto_centavos, 0);
  };

  // ── Helper de colores de estado ────────────────────────────────────────────
  const getBadgeColors = (estado: EstadoGasto) => {
    switch (estado) {
      case 'pagado':
        return { bg: '#1B3A2B', text: COLORS.success };
      case 'parcial':
        return { bg: '#2B2B1B', text: COLORS.accentLight };
      case 'anulado':
        return { bg: '#3A1E1E', text: COLORS.danger };
      default:
        return { bg: '#2A2A3A', text: COLORS.textMuted };
    }
  };

  // ── Renderizado de fila de gasto ───────────────────────────────────────────
  const renderGasto = ({ item }: { item: any }) => {
    const saldo = item.total_centavos - item.pagado_centavos;
    const badge = getBadgeColors(item.estado);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => abrirDetalle(item.id)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.gastoNum}>Gasto #{item.id}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>
              {item.estado.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.gastoDescripcion} numberOfLines={1}>{item.descripcion}</Text>
        
        <View style={styles.metaRow}>
          <Text style={styles.gastoFecha}>{formatearFecha(item.fecha)}</Text>
          <Text style={styles.gastoCategoria}>• {item.categoria_nombre}</Text>
          {item.proveedor_nombre ? (
            <Text style={styles.gastoProveedor} numberOfLines={1}>
              • Prov: {item.proveedor_nombre}
            </Text>
          ) : null}
        </View>

        <View style={styles.cardValores}>
          <View style={styles.valorCol}>
            <Text style={styles.valorLabel}>Total</Text>
            <Text style={styles.valorPesos}>{formatearDinero(item.total_centavos)}</Text>
          </View>
          <View style={styles.valorCol}>
            <Text style={styles.valorLabel}>Pagado</Text>
            <Text style={[styles.valorPesos, { color: COLORS.success }]}>
              {formatearDinero(item.pagado_centavos)}
            </Text>
          </View>
          {saldo > 0 && item.estado !== 'anulado' && (
            <View style={styles.valorCol}>
              <Text style={styles.valorLabel}>Saldo</Text>
              <Text style={[styles.valorPesos, { color: COLORS.accentLight }]}>
                {formatearDinero(saldo)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing && gastos.length === 0) {
    return (
      <SafeAreaView style={styles.centrado}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.estadoTexto}>Cargando gastos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Cabecera */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.navigate('Inicio')}>
          <Text style={styles.btnVolverTexto}>Volver</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo}>📤 Gastos Operativos</Text>
          <Text style={styles.headerSubtitulo}>Gastos operativos del negocio</Text>
        </View>
        <TouchableOpacity
          style={styles.btnNuevo}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('NuevoGasto')}
        >
          <Text style={styles.btnNuevoTexto}>Nuevo gasto</Text>
        </TouchableOpacity>
      </View>

      {/* Advertencia Gastos vs Compras */}
      <View style={styles.advertenciaBanner}>
        <Text style={styles.advertenciaTexto}>
          ℹ️ Las compras de miel, panal y envases se cargan desde el módulo de Compras, no desde Gastos.
        </Text>
      </View>

      {/* Error SQLite */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTexto}>⚠️ {error}</Text>
        </View>
      )}

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por descripción, categoría, proveedor..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Rango de Fechas Selector */}
      <View style={styles.rangoContainer}>
        {rangos.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[styles.rangoBtn, rango === r.key && styles.rangoBtnActivo]}
            onPress={() => setRango(r.key)}
          >
            <Text style={[styles.rangoBtnTexto, rango === r.key && styles.rangoBtnTextoActivo]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Selector de Rango Personalizado */}
      {rango === 'entre_fechas' && (
        <View style={styles.customRangoContainerWrapper}>
          <View style={styles.customRangoContainer}>
            <View style={styles.customRangoCol}>
              <Text style={styles.customRangoLabel}>Desde (AAAA-MM-DD)</Text>
              <TextInput
                style={[styles.customRangoInput, dateError ? styles.customRangoInputError : null]}
                value={inputDesde}
                onChangeText={(val) => {
                  setInputDesde(val);
                  setDateError(null);
                }}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                maxLength={10}
              />
            </View>
            <View style={styles.customRangoCol}>
              <Text style={styles.customRangoLabel}>Hasta (AAAA-MM-DD)</Text>
              <TextInput
                style={[styles.customRangoInput, dateError ? styles.customRangoInputError : null]}
                value={inputHasta}
                onChangeText={(val) => {
                  setInputHasta(val);
                  setDateError(null);
                }}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                maxLength={10}
              />
            </View>
          </View>
          {dateError && <Text style={styles.errorRangoTexto}>{dateError}</Text>}
          <TouchableOpacity style={styles.btnAplicarFiltro} onPress={handleAplicarFiltro}>
            <Text style={styles.btnAplicarFiltroTexto}>Aplicar filtro</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Listado */}
      <FlatList
        data={gastos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderGasto}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={refresh}
        ListEmptyComponent={
          <View style={styles.vacioContainer}>
            <Text style={styles.vacioEmoji}>📤</Text>
            <Text style={styles.vacioTitulo}>
              {search.trim().length > 0 ? 'Sin coincidencias' : 'Sin gastos registrados'}
            </Text>
            <Text style={styles.vacioSubtitulo}>
              {search.trim().length > 0
                ? 'Probá escribiendo otros términos en la búsqueda.'
                : 'Cargá gastos operativos para llevar un control financiero del negocio.'}
            </Text>
          </View>
        }
      />

      {/* Modal de Detalle */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={cerrarDetalles}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedGasto && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalHeaderTitulo}>
                    Gasto #{selectedGasto.id}
                  </Text>
                  <TouchableOpacity onPress={cerrarDetalles} style={styles.modalCerrarBtn}>
                    <Text style={styles.modalCerrarBtnTexto}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.detailContainer}>
                  {/* Detalles Básicos */}
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Descripción</Text>
                    <Text style={styles.detailValue}>{selectedGasto.descripcion}</Text>

                    <Text style={[styles.detailLabel, { marginTop: 12 }]}>Categoría</Text>
                    <Text style={styles.detailValue}>{selectedGasto.categoria_nombre}</Text>

                    {selectedGasto.proveedor_nombre && (
                      <>
                        <Text style={[styles.detailLabel, { marginTop: 12 }]}>Proveedor</Text>
                        <Text style={styles.detailValue}>{selectedGasto.proveedor_nombre}</Text>
                      </>
                    )}

                    <Text style={[styles.detailLabel, { marginTop: 12 }]}>Fecha</Text>
                    <Text style={styles.detailValue}>{formatearFecha(selectedGasto.fecha)}</Text>

                    {selectedGasto.notas && (
                      <>
                        <Text style={[styles.detailLabel, { marginTop: 12 }]}>Notas</Text>
                        <Text style={styles.detailNotes}>📝 {selectedGasto.notas}</Text>
                      </>
                    )}
                  </View>

                  {/* Detalle de Pagos */}
                  <Text style={styles.sectionHeader}>PAGOS / ABONOS REGISTRADOS</Text>
                  {selectedGasto.pagos && selectedGasto.pagos.length > 0 ? (
                    selectedGasto.pagos.map((pago: any) => (
                      <View key={pago.id} style={styles.pagoRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pagoMetodo}>
                            {pago.medio_pago.toUpperCase()}
                          </Text>
                          <Text style={styles.pagoFecha}>
                            {formatearFecha(pago.fecha)} {pago.notas ? ` • ${pago.notas}` : ''}
                          </Text>
                        </View>
                        <Text style={styles.pagoMonto}>
                          {formatearDinero(pago.monto_centavos)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noPagosTexto}>No hay pagos registrados para este gasto.</Text>
                  )}

                  {/* Resumen Final */}
                  <View style={styles.resumenCaja}>
                    <View style={styles.resumenFila}>
                      <Text style={styles.resumenLabel}>Total Gasto:</Text>
                      <Text style={styles.resumenValor}>
                        {formatearDinero(selectedGasto.total_centavos)}
                      </Text>
                    </View>
                    <View style={styles.resumenFila}>
                      <Text style={styles.resumenLabel}>Total Pagado:</Text>
                      <Text style={[styles.resumenValor, { color: COLORS.success }]}>
                        {formatearDinero(obtenerTotalPagado(selectedGasto))}
                      </Text>
                    </View>
                    {selectedGasto.total_centavos - obtenerTotalPagado(selectedGasto) > 0 &&
                      selectedGasto.estado !== 'anulado' && (
                        <View style={styles.resumenFila}>
                          <Text style={styles.resumenLabel}>Saldo Pendiente:</Text>
                          <Text style={[styles.resumenValor, { color: COLORS.accentLight }]}>
                            {formatearDinero(
                              selectedGasto.total_centavos - obtenerTotalPagado(selectedGasto)
                            )}
                          </Text>
                        </View>
                      )}
                  </View>

                  {/* Botones de Acción */}
                  <View style={styles.modalAcciones}>
                    {selectedGasto.estado !== 'anulado' &&
                      selectedGasto.total_centavos - obtenerTotalPagado(selectedGasto) > 0 && (
                        <TouchableOpacity
                          style={[styles.modalBtn, styles.modalBtnPago]}
                          onPress={abrirFormularioPago}
                        >
                          <Text style={styles.modalBtnPagoTexto}>💰 Registrar Pago</Text>
                        </TouchableOpacity>
                      )}

                    {selectedGasto.estado !== 'anulado' && (
                      <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnAnular]}
                        onPress={handleConfirmarAnulacion}
                      >
                        <Text style={styles.modalBtnAnularTexto}>🗄️ Anular Gasto</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Sub-Modal: Registrar Pago Posterior */}
      <Modal
        visible={pagoModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPagoModalVisible(false)}
      >
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitulo}>Registrar Pago</Text>
              <TouchableOpacity
                onPress={() => setPagoModalVisible(false)}
                style={styles.modalCerrarBtn}
              >
                <Text style={styles.modalCerrarBtnTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Monto a pagar (ARS)</Text>
                <TextInput
                  style={styles.input}
                  value={montoPago}
                  onChangeText={setMontoPago}
                  keyboardType="numeric"
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Medio de Pago</Text>
                <View style={styles.medioPagoRow}>
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

              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Fecha</Text>
                <TextInput
                  style={styles.input}
                  value={fechaPago}
                  onChangeText={setFechaPago}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Notas / Observaciones</Text>
                <TextInput
                  style={styles.input}
                  value={notasPago}
                  onChangeText={setNotasPago}
                  placeholder="Ej. Nro comprobante, seña, etc."
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <TouchableOpacity style={styles.btnGuardarPago} onPress={handleGuardarPago}>
                <Text style={styles.btnGuardarPagoTexto}>Guardar Pago</Text>
              </TouchableOpacity>
            </ScrollView>
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
  centrado: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  estadoTexto: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  btnVolver: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: COLORS.card,
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnVolverTexto: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitulo: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  btnNuevo: {
    backgroundColor: COLORS.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnNuevoTexto: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 13,
  },
  errorBanner: {
    backgroundColor: '#3A1E1E',
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
    margin: 16,
    marginBottom: 0,
    borderRadius: 8,
  },
  errorTexto: {
    color: COLORS.danger,
    fontSize: 13,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  gastoNum: {
    color: COLORS.accentLight,
    fontWeight: 'bold',
    fontSize: 13,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  gastoDescripcion: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  gastoFecha: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  gastoCategoria: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  gastoProveedor: {
    color: COLORS.textMuted,
    fontSize: 12,
    flex: 1,
  },
  cardValores: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 10,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  valorCol: {
    alignItems: 'center',
  },
  valorLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  valorPesos: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  vacioContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  vacioEmoji: {
    fontSize: 48,
  },
  vacioTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  vacioSubtitulo: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Modal Detalle
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
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
  detailContainer: {
    gap: 16,
    paddingBottom: 32,
  },
  detailCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  detailNotes: {
    fontSize: 14,
    color: COLORS.text,
    fontStyle: 'italic',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginTop: 8,
  },
  pagoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pagoMetodo: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  pagoFecha: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  pagoMonto: {
    color: COLORS.success,
    fontSize: 14,
    fontWeight: 'bold',
  },
  noPagosTexto: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 12,
  },
  resumenCaja: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
    marginTop: 8,
  },
  resumenFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resumenLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  resumenValor: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalAcciones: {
    gap: 12,
    marginTop: 16,
  },
  modalBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPago: {
    backgroundColor: COLORS.success,
  },
  modalBtnPagoTexto: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalBtnAnular: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  modalBtnAnularTexto: {
    color: COLORS.danger,
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Sub-Modal Styles
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  subModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '80%',
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
  medioPagoRow: {
    flexDirection: 'row',
    gap: 8,
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
  btnGuardarPago: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnGuardarPagoTexto: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 14,
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
  rangoContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rangoBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rangoBtnActivo: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  rangoBtnTexto: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textMuted,
  },
  rangoBtnTextoActivo: {
    color: '#000000',
  },
  customRangoContainerWrapper: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  customRangoContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  customRangoCol: {
    flex: 1,
    gap: 6,
  },
  customRangoLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  customRangoInput: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: COLORS.text,
    fontSize: 13,
  },
  customRangoInputError: {
    borderColor: COLORS.danger,
  },
  btnAplicarFiltro: {
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnAplicarFiltroTexto: {
    color: COLORS.bg,
    fontWeight: '700',
    fontSize: 13,
  },
  errorRangoTexto: {
    color: COLORS.danger,
    fontSize: 12,
  },
});
