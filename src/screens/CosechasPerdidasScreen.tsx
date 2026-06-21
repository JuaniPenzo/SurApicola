// =============================================================================
// SurApícola — Pantalla de Cosechas y Pérdidas de Stock (Fase 4)
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
import { useCosechasPerdidas } from '../hooks/useCosechasPerdidas';
import { formatearDinero, formatearGramos, formatearUnidades, formatearFecha, fechaHoy } from '../utils/format';
import type { TipoStock } from '../types';

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

export function CosechasPerdidasScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const {
    operaciones,
    loading,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    crearCosecha,
    crearPerdida,
    anularCosecha,
    anularPerdida,
  } = useCosechasPerdidas();

  // ── Modales de Carga y Detalle ─────────────────────────────────────────────
  const [selectedOp, setSelectedOp] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  
  // Modales de Alta
  const [cosechaModalVisible, setCosechaModalVisible] = useState(false);
  const [perdidaModalVisible, setPerdidaModalVisible] = useState(false);

  // Campos de Cosecha
  const [fechaCosecha, setFechaCosecha] = useState(fechaHoy());
  const [tipoCosecha, setTipoCosecha] = useState<TipoStock>('miel');
  const [cantidadCosecha, setCantidadCosecha] = useState(''); // kg para miel, units para panal
  const [notasCosecha, setNotasCosecha] = useState('');

  // Campos de Pérdida
  const [fechaPerdida, setFechaPerdida] = useState(fechaHoy());
  const [tipoPerdida, setTipoPerdida] = useState<TipoStock>('miel');
  const [cantidadPerdida, setCantidadPerdida] = useState(''); // kg para miel, units para panal
  const [motivoPerdida, setMotivoPerdida] = useState('');
  const [notasPerdida, setNotasPerdida] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [])
  );

  const abrirDetalle = (op: any) => {
    setSelectedOp(op);
    setDetailModalVisible(true);
  };

  const cerrarDetalles = () => {
    setDetailModalVisible(false);
    setSelectedOp(null);
  };

  // ── Guardar Cosecha ────────────────────────────────────────────────────────
  const handleGuardarCosecha = async () => {
    const cantNum = parseFloat(cantidadCosecha);
    if (isNaN(cantNum) || cantNum <= 0) {
      Alert.alert('Validación', 'Ingresá una cantidad válida mayor a cero.');
      return;
    }

    // Convertir cantidad a gramos para miel, unidades para panal
    const cantidadBD = tipoCosecha === 'miel' 
      ? Math.round(cantNum * 1000) 
      : Math.round(cantNum);

    try {
      await crearCosecha({
        fecha: fechaCosecha,
        tipo_stock: tipoCosecha,
        cantidad: cantidadBD,
        notas: notasCosecha.trim() || null,
      });

      setCosechaModalVisible(false);
      // Reset
      setCantidadCosecha('');
      setNotasCosecha('');
      setFechaCosecha(fechaHoy());
      Alert.alert('Éxito', 'Cosecha registrada correctamente.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la cosecha.');
    }
  };

  // ── Guardar Pérdida ────────────────────────────────────────────────────────
  const handleGuardarPerdida = async () => {
    const cantNum = parseFloat(cantidadPerdida);
    if (isNaN(cantNum) || cantNum <= 0) {
      Alert.alert('Validación', 'Ingresá una cantidad válida mayor a cero.');
      return;
    }

    if (!motivoPerdida || motivoPerdida.trim().length === 0) {
      Alert.alert('Validación', 'El motivo de la pérdida es obligatorio.');
      return;
    }

    // Convertir cantidad a gramos para miel, unidades para panal
    const cantidadBD = tipoPerdida === 'miel' 
      ? Math.round(cantNum * 1000) 
      : Math.round(cantNum);

    try {
      await crearPerdida({
        fecha: fechaPerdida,
        tipo_stock: tipoPerdida,
        cantidad: cantidadBD,
        motivo: motivoPerdida.trim(),
        notas: notasPerdida.trim() || null,
      });

      setPerdidaModalVisible(false);
      // Reset
      setCantidadPerdida('');
      setMotivoPerdida('');
      setNotasPerdida('');
      setFechaPerdida(fechaHoy());
      Alert.alert('Éxito', 'Pérdida registrada correctamente.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo registrar la pérdida.');
    }
  };

  // ── Anular Operación ───────────────────────────────────────────────────────
  const handleConfirmarAnulacion = () => {
    if (!selectedOp) return;
    const esCosecha = selectedOp.tipo_operacion === 'cosecha';

    Alert.alert(
      esCosecha ? '¿Anular esta cosecha?' : '¿Anular esta pérdida?',
      esCosecha 
        ? 'Esta acción retirará las cantidades del stock. Si el disponible actual es insuficiente, la acción será bloqueada.'
        : 'Esta acción devolverá las cantidades al stock de miel/panal.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Anular Operación',
          style: 'destructive',
          onPress: async () => {
            try {
              if (esCosecha) {
                await anularCosecha(selectedOp.id);
              } else {
                await anularPerdida(selectedOp.id);
              }
              cerrarDetalles();
              Alert.alert('Éxito', 'Operación anulada y stock recalculado.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo anular la operación.');
            }
          },
        },
      ]
    );
  };

  // ── Renderizado de Operación ───────────────────────────────────────────────
  const renderOp = ({ item }: { item: any }) => {
    const esCosecha = item.tipo_operacion === 'cosecha';
    const esAnulado = item.anulado === 1;

    const cantFormateada =
      item.tipo_stock === 'miel'
        ? formatearGramos(item.cantidad)
        : formatearUnidades(item.cantidad);

    return (
      <TouchableOpacity
        style={[styles.card, esAnulado && styles.cardAnulada]}
        activeOpacity={0.7}
        onPress={() => abrirDetalle(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.opBadge, esCosecha ? styles.opCosecha : styles.opPerdida]}>
            {esCosecha ? '🍯 COSECHA' : '📤 PÉRDIDA'}
          </Text>
          {esAnulado && (
            <View style={styles.badgeAnulado}>
              <Text style={styles.badgeAnuladoTexto}>ANULADA</Text>
            </View>
          )}
        </View>

        <Text style={[styles.opDescripcion, esAnulado && styles.textTachado]} numberOfLines={1}>
          {esCosecha ? 'Ingreso por cosecha propia' : `Pérdida: ${item.motivo}`}
        </Text>
        
        <View style={styles.metaRow}>
          <Text style={styles.opFecha}>{formatearFecha(item.fecha)}</Text>
          <Text style={styles.opCantidad}>
            • Cantidad: {cantFormateada}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing && operaciones.length === 0) {
    return (
      <SafeAreaView style={styles.centrado}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.estadoTexto}>Cargando operaciones...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Cabecera */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.navigate('Stock')}>
          <Text style={styles.btnVolverTexto}>Volver</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo}>⚙️ Operaciones</Text>
          <Text style={styles.headerSubtitulo}>Cosechas y Mermas de stock</Text>
        </View>
      </View>

      {/* Botones de Acción */}
      <View style={styles.accionesHeaderRow}>
        <TouchableOpacity
          style={[styles.btnAlta, { backgroundColor: '#1B3A2B', borderColor: COLORS.success }]}
          onPress={() => setCosechaModalVisible(true)}
        >
          <Text style={[styles.btnAltaTexto, { color: COLORS.success }]}>+ Cosecha</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnAlta, { backgroundColor: '#3A1E1E', borderColor: COLORS.danger }]}
          onPress={() => setPerdidaModalVisible(true)}
        >
          <Text style={[styles.btnAltaTexto, { color: COLORS.danger }]}>+ Pérdida</Text>
        </TouchableOpacity>
      </View>

      {/* Error SQL */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTexto}>⚠️ {error}</Text>
        </View>
      )}

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por notas, motivo, tipo..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Listado */}
      <FlatList
        data={operaciones}
        keyExtractor={(item) => `${item.tipo_operacion}_${item.id}`}
        renderItem={renderOp}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={refresh}
        ListEmptyComponent={
          <View style={styles.vacioContainer}>
            <Text style={styles.vacioEmoji}>⚙️</Text>
            <Text style={styles.vacioTitulo}>
              {search.trim().length > 0 ? 'Sin coincidencias' : 'Sin operaciones cargadas'}
            </Text>
            <Text style={styles.vacioSubtitulo}>
              {search.trim().length > 0
                ? 'Probá escribiendo otros términos en la búsqueda.'
                : 'Cargá cosechas propias o pérdidas físicas de stock para controlar tu inventario.'}
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
            {selectedOp && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalHeaderTitulo}>
                    Detalle de {selectedOp.tipo_operacion === 'cosecha' ? 'Cosecha' : 'Pérdida'} #{selectedOp.id}
                  </Text>
                  <TouchableOpacity onPress={cerrarDetalles} style={styles.modalCerrarBtn}>
                    <Text style={styles.modalCerrarBtnTexto}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.detailContainer}>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Tipo de Operación</Text>
                    <Text style={[styles.detailValue, { textTransform: 'uppercase', color: selectedOp.tipo_operacion === 'cosecha' ? COLORS.success : COLORS.danger }]}>
                      {selectedOp.tipo_operacion}
                    </Text>

                    <Text style={[styles.detailLabel, { marginTop: 12 }]}>Fecha</Text>
                    <Text style={styles.detailValue}>{formatearFecha(selectedOp.fecha)}</Text>

                    <Text style={[styles.detailLabel, { marginTop: 12 }]}>Producto</Text>
                    <Text style={styles.detailValue}>
                      {selectedOp.tipo_stock === 'miel' ? '🍯 Miel' : '🧱 Panal'}
                    </Text>

                    <Text style={[styles.detailLabel, { marginTop: 12 }]}>Cantidad</Text>
                    <Text style={styles.detailValue}>
                      {selectedOp.tipo_stock === 'miel'
                        ? formatearGramos(selectedOp.cantidad)
                        : formatearUnidades(selectedOp.cantidad)}
                    </Text>

                    {selectedOp.tipo_operacion !== 'cosecha' && selectedOp.motivo && (
                      <>
                        <Text style={[styles.detailLabel, { marginTop: 12 }]}>Motivo de Pérdida</Text>
                        <Text style={styles.detailValue}>🚨 {selectedOp.motivo}</Text>
                      </>
                    )}

                    {selectedOp.notas && (
                      <>
                        <Text style={[styles.detailLabel, { marginTop: 12 }]}>Notas</Text>
                        <Text style={styles.detailNotes}>📝 {selectedOp.notas}</Text>
                      </>
                    )}

                    {selectedOp.anulado === 1 && (
                      <>
                        <Text style={[styles.detailLabel, { marginTop: 12, color: COLORS.danger }]}>Motivo de Anulación</Text>
                        <Text style={[styles.detailValue, { color: COLORS.danger }]}>
                          🚫 {selectedOp.motivo_anulacion || 'Anulada'}
                        </Text>
                      </>
                    )}
                  </View>

                  {/* Acciones */}
                  {selectedOp.anulado !== 1 && (
                    <TouchableOpacity
                      style={styles.btnAnularGasto}
                      onPress={handleConfirmarAnulacion}
                    >
                      <Text style={styles.btnAnularGastoTexto}>🗄️ Anular Operación</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Alta Cosecha */}
      <Modal
        visible={cosechaModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCosechaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitulo}>Registrar Cosecha</Text>
              <TouchableOpacity
                onPress={() => setCosechaModalVisible(false)}
                style={styles.modalCerrarBtn}
              >
                <Text style={styles.modalCerrarBtnTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 16 }}>
              {/* Tipo Stock */}
              <Text style={styles.label}>Tipo de Stock *</Text>
              <View style={styles.tipoRow}>
                <TouchableOpacity
                  style={[
                    styles.tipoBtn,
                    tipoCosecha === 'miel' ? styles.tipoBtnActivo : null,
                  ]}
                  onPress={() => {
                    setTipoCosecha('miel');
                    setCantidadCosecha('');
                  }}
                >
                  <Text style={[styles.tipoBtnTexto, tipoCosecha === 'miel' ? styles.tipoBtnTextoActivo : null]}>
                    🍯 Miel (kg)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tipoBtn,
                    tipoCosecha === 'panal' ? styles.tipoBtnActivo : null,
                  ]}
                  onPress={() => {
                    setTipoCosecha('panal');
                    setCantidadCosecha('');
                  }}
                >
                  <Text style={[styles.tipoBtnTexto, tipoCosecha === 'panal' ? styles.tipoBtnTextoActivo : null]}>
                    🧱 Panal (uds)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Cantidad */}
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>
                  {tipoCosecha === 'miel' ? 'Cantidad cosechada (kg) *' : 'Cantidad cosechada (unidades) *'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={cantidadCosecha}
                  onChangeText={setCantidadCosecha}
                  keyboardType="numeric"
                  placeholder={tipoCosecha === 'miel' ? 'Ej. 10.5' : 'Ej. 5'}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              {/* Fecha */}
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Fecha</Text>
                <TextInput
                  style={styles.input}
                  value={fechaCosecha}
                  onChangeText={setFechaCosecha}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              {/* Notas */}
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Notas / Observaciones</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notasCosecha}
                  onChangeText={setNotasCosecha}
                  multiline
                  numberOfLines={3}
                  placeholder="Comentarios sobre la cosecha..."
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <TouchableOpacity style={styles.btnGuardarGasto} onPress={handleGuardarCosecha}>
                <Text style={styles.btnGuardarGastoTexto}>Guardar Cosecha</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Alta Pérdida */}
      <Modal
        visible={perdidaModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPerdidaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitulo}>Registrar Pérdida</Text>
              <TouchableOpacity
                onPress={() => setPerdidaModalVisible(false)}
                style={styles.modalCerrarBtn}
              >
                <Text style={styles.modalCerrarBtnTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 16 }}>
              {/* Tipo Stock */}
              <Text style={styles.label}>Tipo de Stock *</Text>
              <View style={styles.tipoRow}>
                <TouchableOpacity
                  style={[
                    styles.tipoBtn,
                    tipoPerdida === 'miel' ? styles.tipoBtnActivo : null,
                  ]}
                  onPress={() => {
                    setTipoPerdida('miel');
                    setCantidadPerdida('');
                  }}
                >
                  <Text style={[styles.tipoBtnTexto, tipoPerdida === 'miel' ? styles.tipoBtnTextoActivo : null]}>
                    🍯 Miel (kg)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tipoBtn,
                    tipoPerdida === 'panal' ? styles.tipoBtnActivo : null,
                  ]}
                  onPress={() => {
                    setTipoPerdida('panal');
                    setCantidadPerdida('');
                  }}
                >
                  <Text style={[styles.tipoBtnTexto, tipoPerdida === 'panal' ? styles.tipoBtnTextoActivo : null]}>
                    🧱 Panal (uds)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Cantidad */}
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>
                  {tipoPerdida === 'miel' ? 'Cantidad perdida (kg) *' : 'Cantidad perdida (unidades) *'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={cantidadPerdida}
                  onChangeText={setCantidadPerdida}
                  keyboardType="numeric"
                  placeholder={tipoPerdida === 'miel' ? 'Ej. 2.3' : 'Ej. 3'}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              {/* Motivo */}
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Motivo de la Pérdida *</Text>
                <TextInput
                  style={styles.input}
                  value={motivoPerdida}
                  onChangeText={setMotivoPerdida}
                  placeholder="Ej. Rotura de frascos, mermas de colmena..."
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              {/* Fecha */}
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Fecha</Text>
                <TextInput
                  style={styles.input}
                  value={fechaPerdida}
                  onChangeText={setFechaPerdida}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              {/* Notas */}
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Notas / Observaciones</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notasPerdida}
                  onChangeText={setNotasPerdida}
                  multiline
                  numberOfLines={3}
                  placeholder="Comentarios adicionales..."
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <TouchableOpacity style={styles.btnGuardarGasto} onPress={handleGuardarPerdida}>
                <Text style={styles.btnGuardarGastoTexto}>Guardar Pérdida</Text>
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
  accionesHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  btnAlta: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnAltaTexto: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  errorBanner: {
    backgroundColor: '#3A1E1E',
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorTexto: {
    color: COLORS.danger,
    fontSize: 13,
  },
  searchContainer: {
    paddingHorizontal: 16,
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
  cardAnulada: {
    borderColor: 'transparent',
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  opBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  opCosecha: {
    backgroundColor: '#1B3A2B',
    color: COLORS.success,
  },
  opPerdida: {
    backgroundColor: '#3A1E1E',
    color: COLORS.danger,
  },
  badgeAnulado: {
    backgroundColor: '#3A1515',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  badgeAnuladoTexto: {
    color: COLORS.danger,
    fontSize: 9,
    fontWeight: 'bold',
  },
  opDescripcion: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  textTachado: {
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  opFecha: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  opCantidad: {
    color: COLORS.accentLight,
    fontSize: 12,
    fontWeight: 'bold',
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
  btnAnularGasto: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.danger,
    marginTop: 8,
  },
  btnAnularGastoTexto: {
    color: COLORS.danger,
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Form Styles
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
  tipoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tipoBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingVertical: 10,
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
    fontSize: 12,
    fontWeight: 'bold',
  },
  tipoBtnTextoActivo: {
    color: COLORS.accent,
  },
  btnGuardarGasto: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnGuardarGastoTexto: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalCentrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
});
