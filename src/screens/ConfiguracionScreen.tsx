import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useConfiguracion } from '../hooks/useConfiguracion';
import { useExportacion } from '../hooks/useExportacion';
import { useSQLiteContext } from 'expo-sqlite';
import {
  getAllCategoriasGasto,
  crearCategoriaGasto,
  actualizarCategoriaGasto,
  setCategoriaGastoActiva,
  eliminarODesactivarCategoriaGasto,
} from '../database/gastos';
import type { CategoriaGasto } from '../types';


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

export function ConfiguracionScreen() {
  const navigation = useNavigation();
  const {
    loading: loadingConfig,
    error: errorConfig,
    configGeneral,
    cargarConfiguracionGeneral,
    actualizarConfiguracionGeneral,
  } = useConfiguracion();

  const {
    loading: loadingExport,
    error: errorExport,
    exportarClientes,
    exportarProveedores,
    exportarVentas,
    exportarStock,
    exportarEnvasesInsumos,
    exportarResumenGeneral,
    exportarTodo,
    crearBackupSQLite,
  } = useExportacion();

  // Estados del Formulario
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [email, setEmail] = useState('');
  const [moneda, setMoneda] = useState('ARS');
  const [unidad, setUnidad] = useState('kg');
  const [ultimoBackup, setUltimoBackup] = useState('');

  // Modales de Restauración
  const [modalRestoreVisible, setModalRestoreVisible] = useState(false);
  const [modalConfirm2Visible, setModalConfirm2Visible] = useState(false);

  const db = useSQLiteContext();

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
      console.error('[ConfiguracionScreen] Error al cargar categorías:', err);
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


  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const res = await cargarConfiguracionGeneral();
    if (res) {
      setNombre(res.nombre_emprendimiento);
      setTelefono(res.telefono_emprendimiento);
      setDireccion(res.direccion_emprendimiento);
      setEmail(res.email_emprendimiento);
      setMoneda(res.moneda);
      setUnidad(res.unidad_miel_principal);
      setUltimoBackup(res.ultimo_backup_fecha ? new Date(res.ultimo_backup_fecha).toLocaleString('es-AR') : 'Nunca');
    }
  };

  const handleGuardar = async () => {
    // Validar email solo si se carga
    if (email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        Alert.alert('Email inválido', 'Por favor, ingresá un correo electrónico con formato correcto.');
        return;
      }
    }

    const exito = await actualizarConfiguracionGeneral({
      nombre_emprendimiento: nombre.trim() === '' ? 'SurApícola' : nombre.trim(),
      telefono_emprendimiento: telefono.trim(),
      direccion_emprendimiento: direccion.trim(),
      email_emprendimiento: email.trim(),
    });

    if (exito) {
      Alert.alert('Guardado', 'Los datos generales del emprendimiento se actualizaron correctamente.');
      cargarDatos();
    } else {
      Alert.alert('Error', errorConfig || 'No se pudieron guardar los cambios.');
    }
  };

  const handleBackup = async () => {
    Alert.alert(
      'Crear Respaldo',
      '¿Deseás crear una copia de seguridad completa de la base de datos y compartirla?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, respaldar',
          onPress: async () => {
            const res = await crearBackupSQLite();
            if (res.exito) {
              Alert.alert('Respaldo Exitoso', 'La copia de seguridad se generó correctamente.');
              cargarDatos();
            } else {
              Alert.alert('Error', res.error || 'No se pudo generar la copia de seguridad.');
            }
          },
        },
      ]
    );
  };

  const handleRestoreBackup = () => {
    setModalRestoreVisible(true);
  };

  const handleConfirmRestore1 = () => {
    setModalRestoreVisible(false);
    // Doble confirmación requerida
    setTimeout(() => {
      setModalConfirm2Visible(true);
    }, 400);
  };

  const handleFinalConfirmRestore = () => {
    setModalConfirm2Visible(false);
    // Mostrar información de limitación de restauración pendiente en esta versión
    setTimeout(() => {
      Alert.alert(
        '⚠️ Restauración Pendiente',
        'La importación directa de archivos .db está en desarrollo para prevenir pérdidas accidentales de datos en SQLite local. Tu base de datos original no sufrió cambios.\n\nPara restaurar un respaldo anterior, por favor contactate con el soporte técnico de SurApícola.',
        [{ text: 'Entendido' }]
      );
    }, 400);
  };

  const isGlobalLoading = loadingConfig || loadingExport;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Cabecera */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚙️ Configuración</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={{ flex: 1 }}
      >
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll} keyboardShouldPersistTaps="handled">
        {isGlobalLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>Procesando solicitud...</Text>
          </View>
        )}

        {/* Sección A: Datos del Emprendimiento */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🏢 DATOS DEL EMPRENDIMIENTO</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nombre del Emprendimiento</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. SurApícola"
              placeholderTextColor={COLORS.textMuted}
              value={nombre}
              onChangeText={setNombre}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Teléfono de Contacto</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. +54 9 11 1234-5678"
              placeholderTextColor={COLORS.textMuted}
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Dirección física</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Ruta 3 Km 120, Buenos Aires"
              placeholderTextColor={COLORS.textMuted}
              value={direccion}
              onChangeText={setDireccion}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email corporativo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. contacto@surapicola.com"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.rowGrid}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Moneda predeterminada</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={moneda}
                editable={false}
              />
              <Text style={styles.inputHelp}>Fijo ARS en esta versión</Text>
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Unidad principal de miel</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={unidad}
                editable={false}
              />
              <Text style={styles.inputHelp}>Fijo en kilogramos (kg)</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleGuardar}>
            <Text style={styles.saveButtonText}>Guardar Datos Generales</Text>
          </TouchableOpacity>
        </View>

        {/* Sección B: Respaldos de Seguridad */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>💾 RESPALDO DE SEGURIDAD</Text>
          <Text style={styles.description}>
            Copiá la base de datos local actual para guardarla en la nube, enviarla por WhatsApp o guardarla como archivo.
          </Text>

          <View style={styles.backupInfoBox}>
            <Text style={styles.backupInfoText}>
              Última copia de seguridad: <Text style={{ color: COLORS.accentLight, fontWeight: 'bold' }}>{ultimoBackup}</Text>
            </Text>
          </View>

          <TouchableOpacity style={styles.actionButton} onPress={handleBackup}>
            <Text style={styles.actionButtonText}>📦 Crear Backup Completo (.db)</Text>
          </TouchableOpacity>
        </View>

        {/* Sección C: Exportación a CSV */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📤 EXPORTACIÓN DE DATOS (CSV / TXT)</Text>
          <Text style={styles.description}>
            Generá archivos de planilla Excel configurados con separador de punto y coma (;) para leerlos cómodamente en tu computadora.
          </Text>

          <View style={styles.buttonGrid}>
            <TouchableOpacity style={styles.gridBtn} onPress={() => exportarClientes()}>
              <Text style={styles.gridBtnText}>👥 Exportar Clientes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.gridBtn} onPress={() => exportarProveedores()}>
              <Text style={styles.gridBtnText}>🚚 Exportar Proveedores</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.gridBtn} onPress={() => exportarVentas()}>
              <Text style={styles.gridBtnText}>🛒 Exportar Ventas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.gridBtn} onPress={() => exportarStock()}>
              <Text style={styles.gridBtnText}>🍯 Exportar Stock</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.gridBtn} onPress={() => exportarEnvasesInsumos()}>
              <Text style={styles.gridBtnText}>📦 Exportar Insumos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.gridBtn} onPress={() => exportarResumenGeneral()}>
              <Text style={styles.gridBtnText}>📊 Resumen de Negocio</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.actionButton, styles.exportAllBtn]} onPress={() => exportarTodo()}>
            <Text style={styles.exportAllBtnText}>⚡ Exportar Todas las Tablas (CSV)</Text>
          </TouchableOpacity>
        </View>

        {/* Sección D: Categorías de Gasto */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🏷️ CATEGORÍAS DE GASTO</Text>
          <Text style={styles.description}>
            Agregá nuevas categorías de gasto, renombrá las existentes o activá/desactivá las que uses en tu negocio.
          </Text>

          <TouchableOpacity style={styles.actionButton} onPress={abrirGestionCategorias}>
            <Text style={styles.actionButtonText}>⚙️ Gestionar Categorías de Gasto</Text>
          </TouchableOpacity>
        </View>

        {/* Sección E: Restauración */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={[styles.sectionTitle, { color: COLORS.danger }]}>⚠️ RESTAURAR COPIA DE SEGURIDAD</Text>
          <Text style={styles.description}>
            Permite restaurar un archivo de base de datos anterior. Esta operación es sumamente delicada.
          </Text>

          <TouchableOpacity style={[styles.actionButton, styles.dangerBtn]} onPress={handleRestoreBackup}>
            <Text style={styles.dangerBtnText}>🔄 Restaurar Backup (.db)</Text>
          </TouchableOpacity>
        </View>

        {/* Sección E: Información de la App */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>SurApícola App — Versión 1.0.0</Text>
          <Text style={styles.infoSubtext}>
            Los datos se guardan de forma 100% local y segura en este dispositivo.
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL 1: Confirmación de Restauración */}
      <Modal
        visible={modalRestoreVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalRestoreVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ ATENCIÓN: Acción Crítica</Text>
            <Text style={styles.modalDescription}>
              Restaurar una copia de seguridad reemplazará por completo la base de datos actual.
              Cualquier dato cargado desde la fecha de ese respaldo se perderá permanentemente.
            </Text>
            <Text style={styles.modalWarning}>
              Se recomienda enfáticamente crear una copia de seguridad actual antes de proceder.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalRestoreVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmRestore1}
              >
                <Text style={styles.modalConfirmText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Doble Confirmación */}
      <Modal
        visible={modalConfirm2Visible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalConfirm2Visible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🛑 CONFIRMACIÓN FINAL</Text>
            <Text style={styles.modalDescription}>
              ¿Estás seguro de que deseás restaurar el archivo y reiniciar la aplicación?
              Esta acción es irreversible y no se puede deshacer.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalConfirm2Visible(false)}
              >
                <Text style={styles.modalCancelText}>No, cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: COLORS.danger }]}
                onPress={handleFinalConfirmRestore}
              >
                <Text style={styles.modalConfirmText}>Sí, reemplazar base</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Gestión de Categorías de Gasto */}
      <Modal
        visible={modalCategoriasVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalCategoriasVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%', maxWidth: 450 }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: COLORS.text }]}>🏷️ Categorías de Gasto</Text>
              <TouchableOpacity onPress={() => setModalCategoriasVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Agregá o modificá las categorías que usás para catalogar tus gastos operativos.
            </Text>

            {/* Crear nueva categoría */}
            <View style={styles.crearBox}>
              <TextInput
                style={styles.modalInput}
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
                          style={[styles.modalInput, { flex: 1, height: 38 }]}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    marginRight: 12,
  },
  backButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  loadingOverlay: {
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dangerCard: {
    borderColor: '#5A1F1F',
    backgroundColor: '#1E0F0F',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 1,
    marginBottom: 12,
  },
  description: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: '#1A1A2E',
  },
  inputHelp: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
    marginLeft: 2,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  saveButton: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  backupInfoBox: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  backupInfoText: {
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  dangerBtn: {
    borderColor: COLORS.danger,
    backgroundColor: 'transparent',
  },
  dangerBtnText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  gridBtn: {
    width: '48%',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBtnText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  exportAllBtn: {
    borderColor: COLORS.success,
    backgroundColor: 'transparent',
  },
  exportAllBtnText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '600',
  },
  infoCard: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  infoSubtext: {
    fontSize: 10,
    color: '#5E5E6E',
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    gap: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.danger,
  },
  modalDescription: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  modalWarning: {
    fontSize: 12,
    color: COLORS.accentLight,
    lineHeight: 16,
    backgroundColor: 'rgba(232, 160, 32, 0.1)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.2)',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: COLORS.textMuted,
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  crearBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginVertical: 4,
  },
  modalInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    color: COLORS.text,
    fontSize: 13,
  },
  crearBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crearBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoriasList: {
    flex: 1,
    marginVertical: 10,
    maxHeight: 280,
  },
  categoriaRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  categoriaRowInactiva: {
    opacity: 0.6,
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  displayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  categoriaNombre: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
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
    padding: 6,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveInlineBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveInlineText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cancelInlineBtn: {
    backgroundColor: COLORS.bg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelInlineText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  cerrarModalBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cerrarModalText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
