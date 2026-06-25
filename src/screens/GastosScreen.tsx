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
import {
  getGastoById,
  getAllCategoriasGasto,
  crearCategoriaGasto,
  actualizarCategoriaGasto,
  setCategoriaGastoActiva,
  eliminarODesactivarCategoriaGasto,
} from '../database/gastos';
import { useSQLiteContext } from 'expo-sqlite';
import { formatearDinero, formatearFecha, fechaHoy } from '../utils/format';
import type { MedioPago, EstadoGasto, CategoriaGasto } from '../types';
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

  // ── Estados de Detalle y Categorías ────────────────────────────────────────
  const [selectedGasto, setSelectedGasto] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Estados de Categorías de Gasto
  const [modalCategoriasVisible, setModalCategoriasVisible] = useState(false);
  const [categoriasGasto, setCategoriasGasto] = useState<CategoriaGasto[]>([]);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('');
  const [editandoCategoriaId, setEditandoCategoriaId] = useState<number | null>(null);
  const [editandoCategoriaNombre, setEditandoCategoriaNombre] = useState('');

  const cargarCategorias = async () => {
    try {
      const list = await getAllCategoriasGasto(db);
      setCategoriasGasto(list);
    } catch (err) {
      console.error('[GastosScreen] Error al cargar categorías:', err);
    }
  };

  const handleCrearCategoria = async () => {
    const trimmed = nuevaCategoriaNombre.trim();
    if (trimmed === '') {
      Alert.alert('Validación', 'El nombre de la categoría no puede estar vacío.');
      return;
    }
    try {
      await crearCategoriaGasto(db, trimmed);
      setNuevaCategoriaNombre('');
      await cargarCategorias();
      Alert.alert('Éxito', 'Categoría de gasto creada correctamente.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo crear la categoría.');
    }
  };

  const handleGuardarEdicion = async (id: number) => {
    const trimmed = editandoCategoriaNombre.trim();
    if (trimmed === '') {
      Alert.alert('Validación', 'El nombre de la categoría no puede estar vacío.');
      return;
    }
    try {
      await actualizarCategoriaGasto(db, id, trimmed);
      setEditandoCategoriaId(null);
      setEditandoCategoriaNombre('');
      await cargarCategorias();
      Alert.alert('Éxito', 'Categoría de gasto actualizada correctamente.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo actualizar la categoría.');
    }
  };

  const handleToggleActiva = async (id: number, activaActual: 0 | 1) => {
    const nuevoEstado = activaActual === 1 ? 0 : 1;
    const mensaje = nuevoEstado === 0 
      ? '¿Deseás desactivar esta categoría? No aparecerá para nuevos gastos, pero los existentes mantendrán su nombre.' 
      : '¿Deseás activar esta categoría?';
    
    Alert.alert(
      nuevoEstado === 0 ? 'Desactivar Categoría' : 'Activar Categoría',
      mensaje,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await setCategoriaGastoActiva(db, id, nuevoEstado);
              await cargarCategorias();
            } catch (err) {
              Alert.alert('Error', 'No se pudo cambiar el estado de la categoría.');
            }
          }
        }
      ]
    );
  };

  const abrirGestionCategorias = async () => {
    await cargarCategorias();
    setModalCategoriasVisible(true);
  };

  const handleEliminarCategoria = async (id: number, nombre: string) => {
    Alert.alert(
      '🗑️ Eliminar Categoría',
      `¿Qué deseás hacer con "${nombre}"?\n\nSi ya fue usada en gastos, se desactivará (no afecta el historial). Si nunca fue usada, se eliminará permanentemente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            try {
              const resultado = await eliminarODesactivarCategoriaGasto(db, id);
              await cargarCategorias();
              if (resultado === 'eliminada') {
                Alert.alert('Eliminada', `La categoría "${nombre}" fue eliminada permanentemente.`);
              } else {
                Alert.alert('Desactivada', `La categoría "${nombre}" fue desactivada. Los gastos históricos no se modificaron.`);
              }
            } catch (err) {
              Alert.alert('Error', 'No se pudo eliminar la categoría.');
            }
          },
        },
      ]
    );
  };

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
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.btnNuevo, { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border }]}
            activeOpacity={0.8}
            onPress={abrirGestionCategorias}
          >
            <Text style={[styles.btnNuevoTexto, { color: COLORS.text }]}>Categorías 🏷️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnNuevo}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('NuevoGasto')}
          >
            <Text style={styles.btnNuevoTexto}>Nuevo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Advertencia Gastos vs Compras */}
      <View style={styles.advertenciaBanner}>
        <Text style={styles.advertenciaTexto}>
          ℹ️ Los gastos son egresos operativos. Las compras de miel, panal, envases o insumos deben cargarse desde Compras.
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
          placeholder="Buscar por descripción o categoría..."
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
                  </View>

                  {/* Botones de Acción */}
                  <View style={styles.modalAcciones}>
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

      {/* Modal: Gestión de Categorías de Gasto */}
      <Modal
        visible={modalCategoriasVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalCategoriasVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitulo}>🏷️ Categorías de Gasto</Text>
              <TouchableOpacity onPress={() => setModalCategoriasVisible(false)} style={styles.modalCerrarBtn}>
                <Text style={styles.modalCerrarBtnTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Agregá o modificá las categorías que usás para catalogar tus gastos operativos.
            </Text>

            {/* Crear nueva categoría */}
            <View style={styles.crearBox}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Nueva categoría..."
                placeholderTextColor={COLORS.textMuted}
                value={nuevaCategoriaNombre}
                onChangeText={setNuevaCategoriaNombre}
              />
              <TouchableOpacity style={styles.crearBtn} onPress={handleCrearCategoria}>
                <Text style={styles.crearBtnText}>Agregar ➕</Text>
              </TouchableOpacity>
            </View>

            {/* Lista scrollable de categorías */}
            <ScrollView style={styles.categoriasList} showsVerticalScrollIndicator={false}>
              {categoriasGasto.map((cat) => {
                const isEditing = editandoCategoriaId === cat.id;

                return (
                  <View key={cat.id} style={[styles.categoriaRow, cat.activa === 0 && styles.categoriaRowInactiva]}>
                    {isEditing ? (
                      <View style={styles.editRow}>
                        <TextInput
                          style={[styles.input, { flex: 1, height: 38 }]}
                          value={editandoCategoriaNombre}
                          onChangeText={setEditandoCategoriaNombre}
                          autoFocus
                        />
                        <TouchableOpacity 
                          style={styles.saveInlineBtn} 
                          onPress={() => handleGuardarEdicion(cat.id)}
                        >
                          <Text style={styles.saveInlineText}>OK</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.cancelInlineBtn} 
                          onPress={() => {
                            setEditandoCategoriaId(null);
                            setEditandoCategoriaNombre('');
                          }}
                        >
                          <Text style={styles.cancelInlineText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.displayRow}>
                        <Text style={[styles.categoriaNombre, cat.activa === 0 && styles.categoriaNombreInactiva]}>
                          {cat.nombre} {cat.activa === 0 ? ' (Inactiva)' : ''}
                        </Text>
                        
                        <View style={styles.rowActions}>
                          <TouchableOpacity
                            style={styles.actionBtnSmall}
                            onPress={() => {
                              setEditandoCategoriaId(cat.id);
                              setEditandoCategoriaNombre(cat.nombre);
                            }}
                          >
                            <Text style={{ fontSize: 14 }}>✏️</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.actionBtnSmall}
                            onPress={() => handleToggleActiva(cat.id, cat.activa)}
                          >
                            <Text style={{ fontSize: 14 }}>
                              {cat.activa === 1 ? '🟢' : '🔴'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionBtnSmall, { backgroundColor: 'rgba(224, 90, 90, 0.12)', borderColor: 'rgba(224, 90, 90, 0.3)' }]}
                            onPress={() => handleEliminarCategoria(cat.id, cat.nombre)}
                          >
                            <Text style={{ fontSize: 14 }}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.cerrarModalBtn} onPress={() => setModalCategoriasVisible(false)}>
              <Text style={styles.cerrarModalText}>Listo</Text>
            </TouchableOpacity>
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
  modalDesc: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  crearBox: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  crearBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crearBtnText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 13,
  },
  categoriasList: {
    flex: 1,
    marginBottom: 16,
  },
  categoriaRow: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoriaRowInactiva: {
    opacity: 0.5,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveInlineBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveInlineText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 12,
  },
  cancelInlineBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cancelInlineText: {
    color: COLORS.textMuted,
    fontWeight: 'bold',
    fontSize: 12,
  },
  displayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoriaNombre: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  categoriaNombreInactiva: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cerrarModalBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cerrarModalText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
});
