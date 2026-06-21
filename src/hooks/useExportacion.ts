import { useState, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { exportTableToCSV, generarResumenNegocioTexto } from '../database/exportacion';
import { setConfiguracion } from '../database/configuracion';

export function useExportacion() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper interno para exportar y compartir tabla
  const exportarTabla = useCallback(async (tableName: string, label: string) => {
    setLoading(true);
    setError(null);
    try {
      const csvContent = await exportTableToCSV(db, tableName);
      const filename = `${tableName}_export_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Exportar ${label}`,
          UTI: 'public.comma-separated-values-text',
        });
        return { exito: true, archivoRuta: fileUri };
      } else {
        throw new Error('La función de compartir no está disponible.');
      }
    } catch (err: any) {
      const errMsg = err.message || `Error al exportar ${label}`;
      setError(errMsg);
      return { exito: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  }, [db]);

  // Exportar Clientes
  const exportarClientes = useCallback(() => exportarTabla('clientes', 'Clientes'), [exportarTabla]);

  // Exportar Proveedores
  const exportarProveedores = useCallback(() => exportarTabla('proveedores', 'Proveedores'), [exportarTabla]);

  // Exportar Ventas
  const exportarVentas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Exportamos ventas e items_venta
      const csvVentas = await exportTableToCSV(db, 'ventas');
      const csvItems = await exportTableToCSV(db, 'items_venta');

      const filenameV = `ventas_export_${new Date().toISOString().split('T')[0]}.csv`;
      const filenameI = `items_venta_export_${new Date().toISOString().split('T')[0]}.csv`;

      const fileUriV = `${FileSystem.cacheDirectory}${filenameV}`;
      const fileUriI = `${FileSystem.cacheDirectory}${filenameI}`;

      await FileSystem.writeAsStringAsync(fileUriV, csvVentas, { encoding: FileSystem.EncodingType.UTF8 });
      await FileSystem.writeAsStringAsync(fileUriI, csvItems, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUriV, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar Ventas',
          UTI: 'public.comma-separated-values-text',
        });
        await Sharing.shareAsync(fileUriI, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar Ítems de Venta',
          UTI: 'public.comma-separated-values-text',
        });
        return { exito: true };
      } else {
        throw new Error('La función de compartir no está disponible.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Error al exportar ventas';
      setError(errMsg);
      return { exito: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  }, [db]);

  // Exportar Stock (movimientos_stock)
  const exportarStock = useCallback(() => exportarTabla('movimientos_stock', 'Movimientos de Stock'), [exportarTabla]);

  // Exportar Envases e Insumos
  const exportarEnvasesInsumos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const csvInsumos = await exportTableToCSV(db, 'insumos');
      const csvMovs = await exportTableToCSV(db, 'movimientos_insumo');

      const filenameI = `insumos_export_${new Date().toISOString().split('T')[0]}.csv`;
      const filenameM = `movimientos_insumo_export_${new Date().toISOString().split('T')[0]}.csv`;

      const fileUriI = `${FileSystem.cacheDirectory}${filenameI}`;
      const fileUriM = `${FileSystem.cacheDirectory}${filenameM}`;

      await FileSystem.writeAsStringAsync(fileUriI, csvInsumos, { encoding: FileSystem.EncodingType.UTF8 });
      await FileSystem.writeAsStringAsync(fileUriM, csvMovs, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUriI, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar Insumos',
          UTI: 'public.comma-separated-values-text',
        });
        await Sharing.shareAsync(fileUriM, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar Movimientos Insumos',
          UTI: 'public.comma-separated-values-text',
        });
        return { exito: true };
      } else {
        throw new Error('La función de compartir no está disponible.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Error al exportar insumos';
      setError(errMsg);
      return { exito: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  }, [db]);

  // Exportar Resumen General
  const exportarResumenGeneral = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const txtContent = await generarResumenNegocioTexto(db);
      const filename = `surapicola_resumen_${new Date().toISOString().split('T')[0]}.txt`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, txtContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Exportar Resumen General',
          UTI: 'public.text',
        });
        return { exito: true, archivoRuta: fileUri };
      } else {
        throw new Error('La función de compartir no está disponible.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Error al exportar resumen general';
      setError(errMsg);
      return { exito: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  }, [db]);

  // Exportar todo (todas las tablas una a una en formato CSV)
  const exportarTodo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tablas = [
        { name: 'clientes', label: 'Clientes' },
        { name: 'proveedores', label: 'Proveedores' },
        { name: 'ventas', label: 'Ventas' },
        { name: 'items_venta', label: 'Ítems de Venta' },
        { name: 'cobros', label: 'Cobros' },
        { name: 'compras_proveedor', label: 'Compras a Proveedores' },
        { name: 'pagos_proveedor', label: 'Pagos a Proveedores' },
        { name: 'gastos_operativos', label: 'Gastos Operativos' },
        { name: 'pagos_gasto', label: 'Pagos de Gastos' },
        { name: 'movimientos_stock', label: 'Movimientos de Stock' },
        { name: 'insumos', label: 'Insumos' },
        { name: 'movimientos_insumo', label: 'Movimientos de Insumo' },
        { name: 'categorias_precio', label: 'Categorías de Precio' },
        { name: 'precios_presentacion', label: 'Precios de Presentación' },
      ];

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('La función de compartir no está disponible.');
      }

      for (const t of tablas) {
        const csvContent = await exportTableToCSV(db, t.name);
        const filename = `${t.name}_export_${new Date().toISOString().split('T')[0]}.csv`;
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;
        
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Exportar ${t.label}`,
          UTI: 'public.comma-separated-values-text',
        });
      }

      return { exito: true };
    } catch (err: any) {
      const errMsg = err.message || 'Error al exportar todos los datos';
      setError(errMsg);
      return { exito: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  }, [db]);

  // Crear Backup Completo de SQLite
  const crearBackupSQLite = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dbDir = `${FileSystem.documentDirectory}SQLite/surapicola.db`;
      
      // Verificar si la base de datos existe
      const info = await FileSystem.getInfoAsync(dbDir);
      if (!info.exists) {
        throw new Error('Base de datos SQLite local no encontrada.');
      }

      // Nombre del archivo de respaldo
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const backupFilename = `surapicola_backup_${year}-${month}-${day}_${hours}-${minutes}.db`;
      
      const backupUri = `${FileSystem.cacheDirectory}${backupFilename}`;

      // Copiar el archivo original
      await FileSystem.copyAsync({
        from: dbDir,
        to: backupUri,
      });

      // Compartir
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backupUri, {
          mimeType: 'application/x-sqlite3',
          dialogTitle: 'Respaldar Base de Datos SurApícola',
          UTI: 'public.sqlite3-database',
        });

        // Registrar la fecha de último backup en la base de datos
        const fechaBackup = now.toISOString();
        await setConfiguracion(db, 'ultimo_backup_fecha', fechaBackup);

        return { exito: true, archivoRuta: backupUri, fecha: fechaBackup };
      } else {
        throw new Error('La función de compartir no está disponible.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Error al crear la copia de seguridad';
      setError(errMsg);
      return { exito: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  }, [db]);

  return {
    loading,
    error,
    exportarClientes,
    exportarProveedores,
    exportarVentas,
    exportarStock,
    exportarEnvasesInsumos,
    exportarResumenGeneral,
    exportarTodo,
    crearBackupSQLite,
  };
}
