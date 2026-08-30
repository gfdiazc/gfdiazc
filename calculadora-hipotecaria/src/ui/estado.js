/**
 * Estado de la aplicación y persistencia.
 *
 * Guarda en localStorage para que no pierdas lo que cargaste al cerrar la
 * pestaña. Todo lo que se guarda es local a tu navegador: no sale a ningún
 * servidor, porque la app no tiene servidor.
 */

import { entradaPorDefecto } from '../engine/index.js';

const CLAVE = 'calculadora-hipotecaria-cl/v1';

function nuevoEscenario(nombre, entrada) {
  return { id: 'e' + Math.random().toString(36).slice(2, 9), nombre, entrada };
}

export function estadoInicial() {
  const base = entradaPorDefecto();
  return {
    escenarios: [nuevoEscenario(base.propiedad.nombre, base)],
    activoId: null, // se resuelve al primero
    pestana: 'datos',
  };
}

export function cargar() {
  const inicial = estadoInicial();
  inicial.activoId = inicial.escenarios[0].id;
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return inicial;
    const guardado = JSON.parse(crudo);
    if (!guardado?.escenarios?.length) return inicial;
    // Rellena claves nuevas que no existían cuando se guardó.
    guardado.escenarios = guardado.escenarios.map((e) => ({
      ...e,
      entrada: fusionar(entradaPorDefecto(), e.entrada),
    }));
    if (!guardado.escenarios.some((e) => e.id === guardado.activoId)) {
      guardado.activoId = guardado.escenarios[0].id;
    }
    return guardado;
  } catch {
    return inicial;
  }
}

export function guardar(estado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({
      escenarios: estado.escenarios,
      activoId: estado.activoId,
      pestana: estado.pestana,
    }));
  } catch {
    // Ventana privada o almacenamiento bloqueado: la app funciona igual,
    // simplemente no recuerda entre sesiones.
  }
}

export function limpiar() {
  try { localStorage.removeItem(CLAVE); } catch { /* ver comentario en guardar */ }
}

/** Mezcla profunda: la base aporta las claves, el guardado aporta los valores. */
function fusionar(base, guardado) {
  if (!guardado || typeof guardado !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(guardado)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      out[k] = fusionar(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export function escenarioActivo(estado) {
  return estado.escenarios.find((e) => e.id === estado.activoId) || estado.escenarios[0];
}

export function leerRuta(objeto, ruta) {
  return ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), objeto);
}

export function escribirRuta(objeto, ruta, valor) {
  const partes = ruta.split('.');
  const ultima = partes.pop();
  const destino = partes.reduce((o, k) => (o[k] ??= {}), objeto);
  destino[ultima] = valor;
}

export function duplicarEscenario(estado, id) {
  const original = estado.escenarios.find((e) => e.id === id);
  if (!original) return estado;
  const copia = nuevoEscenario(
    `${original.entrada.propiedad.nombre} (copia)`,
    JSON.parse(JSON.stringify(original.entrada)),
  );
  copia.entrada.propiedad.nombre = copia.nombre;
  estado.escenarios.push(copia);
  estado.activoId = copia.id;
  return estado;
}

export function agregarEscenario(estado) {
  const n = estado.escenarios.length + 1;
  const entrada = entradaPorDefecto();
  entrada.propiedad.nombre = `Departamento ${n}`;
  const nuevo = nuevoEscenario(entrada.propiedad.nombre, entrada);
  estado.escenarios.push(nuevo);
  estado.activoId = nuevo.id;
  return estado;
}

export function eliminarEscenario(estado, id) {
  if (estado.escenarios.length <= 1) return estado;
  estado.escenarios = estado.escenarios.filter((e) => e.id !== id);
  if (estado.activoId === id) estado.activoId = estado.escenarios[0].id;
  return estado;
}

export { nuevoEscenario };
