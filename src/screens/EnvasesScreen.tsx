// =============================================================================
// SurApícola — Pantalla de Envases e Insumos (Prompt 3)
// =============================================================================
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useInsumos } from '../hooks/useInsumos';
import { getPresentacionInsumos, setPresentacionInsumos } from '../database/insumos';
import type { Insumo, MovimientoInsumo, PresentacionInsumo, TipoOrigenInsumo } from '../types';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const COLORS = {
  bg: '#0F0F1A',
  surface: '#16213E',
  surfaceHigh: '#1E2A4A',
  accent: '#E8A020',
  accentLight: '#F5C842',
  green: '#4CAF50',
  yellow: '#FFC107',
  red: '#EF5350',
  red2: '#C62828',
  text: '#F0F0F8',
  textMuted: '#8A8A9A',
  textDim: '#5A5A6A',
  border: '#2A2A3E',
  borderLight: '#3A3A5E',
  blue: '#42A5F5',
};

const UNIDADES_COMUNES = ['unidad', 'caja', 'rollo', 'par', 'kg', 'litro'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fechaHoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function stockColor(stock: number, minimo: number = 0): string {
  if (stock <= 0) return COLORS.red;
  if (minimo > 0 && stock < minimo) return COLORS.yellow;
  return COLORS.green;
}

function stockLabel(stock: number, minimo: number = 0): string {
  if (stock <= 0) return 'Sin stock';
  if (minimo > 0 && stock < minimo) return 'Stock bajo';
  return 'En stock';
}

function etiquetaTipoOrigen(tipo: TipoOrigenInsumo): string {
  const map: Record<TipoOrigenInsumo, string> = {
    compra_insumo: '🛒 Compra',
    ajuste_entrada: '➕ Ajuste entrada',
    ajuste_salida: '➖ Ajuste salida',
    venta_item: '📦 Venta',
    anulacion_venta_item: '↩️ Anulación venta',
  };
  return map[tipo] ?? tipo;
}

// ---------------------------------------------------------------------------
// Tipos locales de modales
// ---------------------------------------------------------------------------

type ModalTipo =
  | 'none'
  | 'nuevo_insumo'
  | 'editar_insumo'
  | 'detalle_insumo'
  | 'registrar_movimiento'
  | 'configurar_presentacion';

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function EnvasesScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { insumos, loading, error, refresh, crearInsumo, actualizarInsumo, archivarInsumo, registrarMovimiento, getMovimientos } = useInsumos();

  // Estado de modales
  const [modalTipo, setModalTipo] = useState<ModalTipo>('none');
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<Insumo | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoInsumo[]>([]);

  // Formulario nuevo/editar insumo
  const [formNombre, setFormNombre] = useState('');
  const [formUnidad, setFormUnidad] = useState('unidad');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formStockMinimo, setFormStockMinimo] = useState('0');

  // Formulario movimiento
  const [movCantidad, setMovCantidad] = useState('');
  const [movTipo, setMovTipo] = useState<'compra_insumo' | 'ajuste_entrada' | 'ajuste_salida'>('compra_insumo');
  const [movNotas, setMovNotas] = useState('');

  // Guardar
  const [guardando, setGuardando] = useState(false);

  // Recargar al enfocar
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // ---------------------------------------------------------------------------
  // Modal: Detalle de Insumo
  // ---------------------------------------------------------------------------

  const abrirDetalle = useCallback(async (insumo: Insumo) => {
    setInsumoSeleccionado(insumo);
    const movs = await getMovimientos(insumo.id);
    setMovimientos(movs);
    setModalTipo('detalle_insumo');
  }, [getMovimientos]);

  // ---------------------------------------------------------------------------
  // Modal: Nuevo insumo
  // ---------------------------------------------------------------------------

  const abrirNuevoInsumo = useCallback(() => {
    setFormNombre('');
    setFormUnidad('unidad');
    setFormDescripcion('');
    setFormStockMinimo('0');
    setInsumoSeleccionado(null);
    setModalTipo('nuevo_insumo');
  }, []);

  const abrirEditarInsumo = useCallback((insumo: Insumo) => {
    setFormNombre(insumo.nombre);
    setFormUnidad(insumo.unidad);
    setFormDescripcion(insumo.descripcion ?? '');
    setFormStockMinimo(String(insumo.stock_minimo ?? 0));
    setInsumoSeleccionado(insumo);
    setModalTipo('editar_insumo');
  }, []);

  const guardarInsumo = useCallback(async () => {
    const nombre = formNombre.trim();
    if (!nombre) { Alert.alert('Error', 'El nombre es obligatorio.'); return; }

    const minVal = parseInt(formStockMinimo, 10);
    const stock_minimo = isNaN(minVal) || minVal < 0 ? 0 : minVal;

    setGuardando(true);
    let ok = false;
    if (insumoSeleccionado && modalTipo === 'editar_insumo') {
      ok = await actualizarInsumo(insumoSeleccionado.id, {
        nombre,
        unidad: formUnidad,
        descripcion: formDescripcion.trim() || null,
        stock_minimo,
      });
    } else {
      ok = await crearInsumo({
        nombre,
        unidad: formUnidad,
        descripcion: formDescripcion.trim() || null,
        stock_minimo,
      });
    }
    setGuardando(false);
    if (ok) setModalTipo('none');
    else Alert.alert('Error', 'No se pudo guardar el insumo.');
  }, [formNombre, formUnidad, formDescripcion, formStockMinimo, insumoSeleccionado, modalTipo, actualizarInsumo, crearInsumo]);

  const confirmarArchivar = useCallback((insumo: Insumo) => {
    Alert.alert(
      'Archivar insumo',
      `¿Archivar "${insumo.nombre}"? Ya no aparecerá en las listas ni en nuevas ventas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: async () => {
            await archivarInsumo(insumo.id);
            setModalTipo('none');
          },
        },
      ]
    );
  }, [archivarInsumo]);

  // ---------------------------------------------------------------------------
  // Modal: Registrar movimiento
  // ---------------------------------------------------------------------------

  const abrirMovimiento = useCallback((insumo: Insumo) => {
    setInsumoSeleccionado(insumo);
    setMovCantidad('');
    setMovTipo('compra_insumo');
    setMovNotas('');
    setModalTipo('registrar_movimiento');
  }, []);

  const guardarMovimiento = useCallback(async () => {
    const cant = parseInt(movCantidad, 10);
    if (!insumoSeleccionado || isNaN(cant) || cant <= 0) {
      Alert.alert('Error', 'Ingresá una cantidad válida mayor a 0.');
      return;
    }
    const cantidad = movTipo === 'ajuste_salida' ? -cant : cant;

    setGuardando(true);
    const ok = await registrarMovimiento({
      insumo_id: insumoSeleccionado.id,
      fecha: fechaHoy(),
      cantidad,
      tipo_origen: movTipo,
      notas: movNotas.trim() || null,
    });
    setGuardando(false);
    if (ok) {
      setModalTipo('none');
    } else {
      Alert.alert('Error', 'No se pudo registrar el movimiento.');
    }
  }, [insumoSeleccionado, movCantidad, movTipo, movNotas, registrarMovimiento]);

  // ---------------------------------------------------------------------------
  // Modal: Configurar Presentación → Insumos
  // ---------------------------------------------------------------------------

  const [presentacionesConfig, setPresentacionesConfig] = useState<any[]>([]);
  const [presSeleccionada, setPresSeleccionada] = useState<any | null>(null);
  const [insumosPresActuales, setInsumosPresActuales] = useState<PresentacionInsumo[]>([]);
  const [insumosEditConfig, setInsumosEditConfig] = useState<Array<{ insumo_id: number; cantidad_por_unidad: number; nombre: string }>>([]);

  const abrirConfigPresentaciones = useCallback(async () => {
    const pres = await db.getAllAsync<any>('SELECT * FROM presentaciones WHERE activa = 1 ORDER BY nombre ASC');
    setPresentacionesConfig(pres);
    setPresSeleccionada(null);
    setInsumosEditConfig([]);
    setModalTipo('configurar_presentacion');
  }, [db]);

  const seleccionarPresentacion = useCallback(async (pres: any) => {
    setPresSeleccionada(pres);
    const rels = await getPresentacionInsumos(db, pres.id);
    setInsumosPresActuales(rels);
    setInsumosEditConfig(
      rels.map((r) => ({
        insumo_id: r.insumo_id,
        cantidad_por_unidad: r.cantidad_por_unidad,
        nombre: r.insumo_nombre ?? `Insumo #${r.insumo_id}`,
      }))
    );
  }, [db]);

  const agregarInsumoAConfig = useCallback((insumo: Insumo) => {
    setInsumosEditConfig((prev) => {
      if (prev.find((i) => i.insumo_id === insumo.id)) return prev;
      return [...prev, { insumo_id: insumo.id, cantidad_por_unidad: 1, nombre: insumo.nombre }];
    });
  }, []);

  const quitarInsumoDeConfig = useCallback((insumoId: number) => {
    setInsumosEditConfig((prev) => prev.filter((i) => i.insumo_id !== insumoId));
  }, []);

  const cambiarCantidadConfig = useCallback((insumoId: number, valor: string) => {
    const cant = parseInt(valor, 10);
    setInsumosEditConfig((prev) =>
      prev.map((i) => i.insumo_id === insumoId ? { ...i, cantidad_por_unidad: isNaN(cant) ? 1 : Math.max(1, cant) } : i)
    );
  }, []);

  const guardarConfigPresentacion = useCallback(async () => {
    if (!presSeleccionada) return;
    setGuardando(true);
    await setPresentacionInsumos(db, presSeleccionada.id, insumosEditConfig);
    setGuardando(false);
    Alert.alert('✅ Guardado', `Configuración de "${presSeleccionada.nombre}" actualizada.`);
    setPresSeleccionada(null);
    setInsumosEditConfig([]);
  }, [db, presSeleccionada, insumosEditConfig]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading && insumos.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>🧴 Envases e Insumos</Text>
          <Text style={styles.headerSub}>{insumos.length} insumo{insumos.length !== 1 ? 's' : ''} activo{insumos.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.configBtn} onPress={abrirConfigPresentaciones}>
          <Text style={styles.configBtnText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Lista de insumos */}
      <FlatList
        data={insumos}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={COLORS.accent} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={() => (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>Sin insumos cargados</Text>
            <Text style={styles.emptyDesc}>Usá el botón "+" para agregar frascos, baldes, etiquetas u otros materiales.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => abrirDetalle(item)} activeOpacity={0.85}>
            <View style={styles.cardLeft}>
              <View style={[styles.stockBadge, { backgroundColor: stockColor(item.stock_actual ?? 0, item.stock_minimo) + '22', borderColor: stockColor(item.stock_actual ?? 0, item.stock_minimo) }]}>
                <Text style={[styles.stockNum, { color: stockColor(item.stock_actual ?? 0, item.stock_minimo) }]}>
                  {item.stock_actual ?? 0}
                </Text>
                <Text style={[styles.stockUnit, { color: stockColor(item.stock_actual ?? 0, item.stock_minimo) }]}>
                  {item.unidad}
                </Text>
              </View>
            </View>
            <View style={styles.cardMid}>
              <Text style={styles.cardNombre}>{item.nombre}</Text>
              <View style={[styles.statusPill, { backgroundColor: stockColor(item.stock_actual ?? 0, item.stock_minimo) + '33' }]}>
                <Text style={[styles.statusPillText, { color: stockColor(item.stock_actual ?? 0, item.stock_minimo) }]}>
                  {stockLabel(item.stock_actual ?? 0, item.stock_minimo)}
                </Text>
              </View>
            </View>
            <View style={styles.cardRight}>
              <TouchableOpacity
                style={styles.btnAgregar}
                onPress={() => abrirMovimiento(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.btnAgregarText}>+ Agregar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={abrirNuevoInsumo} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* ── Modal: Nuevo / Editar Insumo ─────────────────────────────────────── */}
      <Modal visible={modalTipo === 'nuevo_insumo' || modalTipo === 'editar_insumo'} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {modalTipo === 'nuevo_insumo' ? '➕ Nuevo Insumo' : '✏️ Editar Insumo'}
            </Text>

            <Text style={styles.fieldLabel}>Nombre *</Text>
            <TextInput
              style={styles.input}
              value={formNombre}
              onChangeText={setFormNombre}
              placeholder="Ej: Frasco 500ml"
              placeholderTextColor={COLORS.textDim}
            />

            <Text style={styles.fieldLabel}>Unidad</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {UNIDADES_COMUNES.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.chipUnidad, formUnidad === u && styles.chipUnidadActive]}
                  onPress={() => setFormUnidad(u)}
                >
                  <Text style={[styles.chipUnidadText, formUnidad === u && styles.chipUnidadTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Descripción (opcional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={formDescripcion}
              onChangeText={setFormDescripcion}
              placeholder="Descripción breve..."
              placeholderTextColor={COLORS.textDim}
              multiline
            />

            <Text style={styles.fieldLabel}>Stock Mínimo</Text>
            <TextInput
              style={styles.input}
              value={formStockMinimo}
              onChangeText={setFormStockMinimo}
              placeholder="0"
              placeholderTextColor={COLORS.textDim}
              keyboardType="numeric"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalTipo('none')}>
                <Text style={styles.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGuardar} onPress={guardarInsumo} disabled={guardando}>
                <Text style={styles.btnGuardarText}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Detalle de Insumo ──────────────────────────────────────────── */}
      <Modal visible={modalTipo === 'detalle_insumo'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            {insumoSeleccionado && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{insumoSeleccionado.nombre}</Text>
                    <Text style={[styles.textMuted, { marginTop: 2 }]}>{insumoSeleccionado.unidad}</Text>
                    {insumoSeleccionado.descripcion ? <Text style={styles.textMuted}>{insumoSeleccionado.descripcion}</Text> : null}
                  </View>
                  <View style={[styles.stockBadgeLg, { borderColor: stockColor(insumoSeleccionado.stock_actual ?? 0, insumoSeleccionado.stock_minimo) }]}>
                    <Text style={[styles.stockNumLg, { color: stockColor(insumoSeleccionado.stock_actual ?? 0, insumoSeleccionado.stock_minimo) }]}>
                      {insumoSeleccionado.stock_actual ?? 0}
                    </Text>
                    <Text style={[styles.stockUnitLg, { color: stockColor(insumoSeleccionado.stock_actual ?? 0, insumoSeleccionado.stock_minimo) }]}>
                      {insumoSeleccionado.unidad}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  <TouchableOpacity style={[styles.btnAccion, { flex: 1 }]} onPress={() => { setModalTipo('none'); setTimeout(() => abrirMovimiento(insumoSeleccionado), 300); }}>
                    <Text style={styles.btnAccionText}>🛒 Registrar entrada</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnAccionSecundario, { flex: 1 }]} onPress={() => { setModalTipo('none'); setTimeout(() => abrirEditarInsumo(insumoSeleccionado), 300); }}>
                    <Text style={styles.btnAccionSecText}>✏️ Editar</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionLabel}>Últimos movimientos</Text>
                <ScrollView style={{ flex: 1, maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                  {movimientos.length === 0 ? (
                    <Text style={[styles.textMuted, { marginTop: 8 }]}>Sin movimientos registrados.</Text>
                  ) : (
                    movimientos.map((mov) => (
                      <View key={mov.id} style={styles.movRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.movTipo}>{etiquetaTipoOrigen(mov.tipo_origen)}</Text>
                          <Text style={styles.movFecha}>{mov.fecha}</Text>
                          {mov.notas ? <Text style={styles.movNotas}>{mov.notas}</Text> : null}
                        </View>
                        <Text style={[styles.movCantidad, { color: mov.cantidad > 0 ? COLORS.green : COLORS.red }]}>
                          {mov.cantidad > 0 ? `+${mov.cantidad}` : mov.cantidad}
                        </Text>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
                  <TouchableOpacity style={styles.btnArchivar} onPress={() => confirmarArchivar(insumoSeleccionado)}>
                    <Text style={styles.btnArchivarText}>Archivar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnCerrar} onPress={() => setModalTipo('none')}>
                    <Text style={styles.btnCerrarText}>Cerrar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal: Registrar Movimiento ───────────────────────────────────────── */}
      <Modal visible={modalTipo === 'registrar_movimiento'} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>📥 Registrar Movimiento</Text>
            {insumoSeleccionado && (
              <Text style={styles.textMuted}>{insumoSeleccionado.nombre} — Stock actual: <Text style={{ color: COLORS.accent }}>{insumoSeleccionado.stock_actual ?? 0} {insumoSeleccionado.unidad}</Text></Text>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Tipo</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {([
                { key: 'compra_insumo', label: '🛒 Compra' },
                { key: 'ajuste_entrada', label: '➕ Ajuste entrada' },
                { key: 'ajuste_salida', label: '➖ Ajuste salida' },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.chipUnidad, movTipo === opt.key && styles.chipUnidadActive]}
                  onPress={() => setMovTipo(opt.key)}
                >
                  <Text style={[styles.chipUnidadText, movTipo === opt.key && styles.chipUnidadTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Cantidad *</Text>
            <TextInput
              style={styles.input}
              value={movCantidad}
              onChangeText={setMovCantidad}
              placeholder="0"
              placeholderTextColor={COLORS.textDim}
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Notas (opcional)</Text>
            <TextInput
              style={styles.input}
              value={movNotas}
              onChangeText={setMovNotas}
              placeholder="Observaciones..."
              placeholderTextColor={COLORS.textDim}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalTipo('none')}>
                <Text style={styles.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGuardar} onPress={guardarMovimiento} disabled={guardando}>
                <Text style={styles.btnGuardarText}>{guardando ? 'Guardando...' : 'Confirmar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Configurar Presentaciones ──────────────────────────────────── */}
      <Modal visible={modalTipo === 'configurar_presentacion'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>⚙️ Insumos por Presentación</Text>
            <Text style={styles.textMuted}>Configurá cuántos insumos consume cada unidad de una presentación al ser vendida.</Text>

            {presSeleccionada === null ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Seleccioná una presentación</Text>
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  {presentacionesConfig.map((p) => (
                    <TouchableOpacity key={p.id} style={styles.presRow} onPress={() => seleccionarPresentacion(p)}>
                      <Text style={styles.presNombre}>{p.nombre}</Text>
                      <Text style={styles.presArrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={[styles.btnCerrar, { marginTop: 16 }]} onPress={() => setModalTipo('none')}>
                  <Text style={styles.btnCerrarText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}>
                  <TouchableOpacity onPress={() => setPresSeleccionada(null)}>
                    <Text style={{ color: COLORS.accent, fontSize: 20 }}>←</Text>
                  </TouchableOpacity>
                  <Text style={styles.sectionLabel}>{presSeleccionada.nombre}</Text>
                </View>

                <Text style={[styles.textMuted, { marginTop: 4 }]}>Insumos configurados:</Text>

                <ScrollView style={{ maxHeight: 200, marginVertical: 8 }} showsVerticalScrollIndicator={false}>
                  {insumosEditConfig.length === 0 ? (
                    <Text style={[styles.textMuted, { fontStyle: 'italic', marginTop: 8 }]}>Sin insumos. Agregá uno de la lista de abajo.</Text>
                  ) : (
                    insumosEditConfig.map((i) => (
                      <View key={i.insumo_id} style={styles.configRow}>
                        <Text style={styles.configNombre} numberOfLines={1}>{i.nombre}</Text>
                        <TextInput
                          style={styles.configCantInput}
                          value={String(i.cantidad_por_unidad)}
                          onChangeText={(v) => cambiarCantidadConfig(i.insumo_id, v)}
                          keyboardType="numeric"
                        />
                        <Text style={[styles.textMuted, { marginHorizontal: 4 }]}>ud/venta</Text>
                        <TouchableOpacity onPress={() => quitarInsumoDeConfig(i.insumo_id)}>
                          <Text style={{ color: COLORS.red, fontSize: 20, paddingHorizontal: 4 }}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </ScrollView>

                <Text style={[styles.textMuted, { marginTop: 4 }]}>Agregar insumo:</Text>
                <ScrollView style={{ maxHeight: 130 }} showsVerticalScrollIndicator={false}>
                  {insumos
                    .filter((ins) => !insumosEditConfig.find((c) => c.insumo_id === ins.id))
                    .map((ins) => (
                      <TouchableOpacity key={ins.id} style={styles.addInsumoRow} onPress={() => agregarInsumoAConfig(ins)}>
                        <Text style={styles.addInsumoNombre}>+ {ins.nombre}</Text>
                        <Text style={styles.textMuted}>{ins.unidad}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.btnCancelar} onPress={() => setPresSeleccionada(null)}>
                    <Text style={styles.btnCancelarText}>Volver</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnGuardar} onPress={guardarConfigPresentacion} disabled={guardando}>
                    <Text style={styles.btnGuardarText}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backBtnText: { color: COLORS.accent, fontSize: 24 },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  headerSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  configBtn: { marginLeft: 'auto', padding: 8 },
  configBtnText: { fontSize: 22 },

  errorBanner: { backgroundColor: COLORS.red2, padding: 12, marginHorizontal: 16, marginTop: 8, borderRadius: 8 },
  errorText: { color: '#fff', fontSize: 13 },

  emptyBox: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyDesc: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  cardLeft: { alignItems: 'center' },
  stockBadge: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 54,
  },
  stockNum: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  stockUnit: { fontSize: 10, fontWeight: '600', marginTop: 1 },

  cardMid: { flex: 1 },
  cardNombre: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  cardRight: { alignItems: 'flex-end' },
  btnAgregar: {
    backgroundColor: COLORS.accent + '22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnAgregarText: { color: COLORS.accent, fontSize: 12, fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    backgroundColor: COLORS.accent,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: { color: COLORS.bg, fontSize: 28, fontWeight: '800', lineHeight: 30 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  fieldLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  chipUnidad: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: COLORS.surfaceHigh,
  },
  chipUnidadActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '22' },
  chipUnidadText: { color: COLORS.textMuted, fontSize: 13 },
  chipUnidadTextActive: { color: COLORS.accent, fontWeight: '700' },

  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btnCancelar: { flex: 1, backgroundColor: COLORS.surfaceHigh, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnCancelarText: { color: COLORS.textMuted, fontWeight: '700' },
  btnGuardar: { flex: 1, backgroundColor: COLORS.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnGuardarText: { color: COLORS.bg, fontWeight: '800', fontSize: 15 },

  // Detalle
  stockBadgeLg: { borderRadius: 12, borderWidth: 2, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', minWidth: 70 },
  stockNumLg: { fontSize: 28, fontWeight: '900', lineHeight: 32 },
  stockUnitLg: { fontSize: 11, fontWeight: '600' },

  sectionLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  movRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  movTipo: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  movFecha: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  movNotas: { color: COLORS.textDim, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  movCantidad: { fontSize: 18, fontWeight: '800', marginLeft: 8 },

  btnAccion: { backgroundColor: COLORS.accent, borderRadius: 10, padding: 10, alignItems: 'center' },
  btnAccionText: { color: COLORS.bg, fontWeight: '800', fontSize: 13 },
  btnAccionSecundario: { backgroundColor: COLORS.surfaceHigh, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  btnAccionSecText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 13 },

  btnArchivar: { backgroundColor: COLORS.red + '22', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.red, flex: 1 },
  btnArchivarText: { color: COLORS.red, fontWeight: '700' },
  btnCerrar: { backgroundColor: COLORS.surfaceHigh, borderRadius: 10, padding: 12, alignItems: 'center', flex: 1 },
  btnCerrarText: { color: COLORS.textMuted, fontWeight: '700' },

  textMuted: { color: COLORS.textMuted, fontSize: 13 },

  // Config presentaciones
  presRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  presNombre: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  presArrow: { color: COLORS.textMuted, fontSize: 20 },

  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  configNombre: { color: COLORS.text, fontSize: 13, flex: 1 },
  configCantInput: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 48,
    textAlign: 'center',
    fontSize: 14,
  },

  addInsumoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  addInsumoNombre: { color: COLORS.blue, fontSize: 13, fontWeight: '600' },
});
