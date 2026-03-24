const COMBAT_SIM_NAMESPACE = 'mythCombatSimulator';

/**
 * Attempts to register this mod namespace with Myth Combat Simulator.
 *
 * Safe no-op when Combat Simulator is not installed or exposes no API.
 *
 * @param {{namespace?: string}} [context] Toolkit setup context.
 * @returns {boolean} True when registration call was made, false otherwise.
 */
export function registerCombatSimulatorNamespace(context = {}) {
	const namespace = normalizeNamespace(context.namespace);
	if (!namespace) return false;

	const api = getCombatSimulatorApi();
	if (!api || typeof api.registerNamespace !== 'function') return false;

	try {
		api.registerNamespace(namespace);
		return true;
	} catch (error) {
		console.warn('SkillSearch: Failed to register namespace with Combat Simulator.', error);
		return false;
	}
}

/**
 * Logs registered namespaces from Combat Simulator when available.
 *
 * @returns {void}
 */
export function logCombatSimulatorRegistrationState() {
	const api = getCombatSimulatorApi();
	if (!api || typeof api.registeredNamespaces !== 'function') return;

	try {
		const namespaces = api.registeredNamespaces();
		if (Array.isArray(namespaces)) {
			console.debug('SkillSearch: Combat Simulator namespaces:', namespaces);
		}
	} catch {
		// Ignore optional diagnostic failures.
	}
}

function getCombatSimulatorApi() {
	if (typeof mod === 'undefined' || !mod?.api) return undefined;
	return mod.api[COMBAT_SIM_NAMESPACE];
}

function normalizeNamespace(namespace) {
	if (typeof namespace !== 'string') return undefined;
	const trimmed = namespace.trim();
	if (!trimmed) return undefined;
	return trimmed.toLowerCase();
}
