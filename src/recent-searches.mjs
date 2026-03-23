const STORAGE_KEY = 'skill-search:recent-entry-ids';
const MAX_RECENT_ITEMS = 5;

/**
 * @typedef {object} RecentSearchEntry
 * @property {string} id Unique entry identifier.
 */

/**
 * Indicates whether local storage is available in the current runtime.
 *
 * @returns {boolean}
 */
function canUseStorage() {
	try {
		return typeof globalThis.localStorage !== 'undefined';
	} catch (error) {
		return false;
	}
}

/**
 * Reads recent entry IDs from persistent storage.
 *
 * @returns {string[]}
 */
function readRecentIds() {
	if (!canUseStorage()) return [];

	try {
		const raw = globalThis.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];

		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		return parsed.filter((id) => typeof id === 'string' && id.trim().length > 0);
	} catch (error) {
		return [];
	}
}

/**
 * Writes recent entry IDs to persistent storage.
 *
 * @param {string[]} ids Recent entry IDs in newest-first order.
 * @returns {void}
 */
function writeRecentIds(ids) {
	if (!canUseStorage()) return;

	try {
		globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENT_ITEMS)));
	} catch (error) {
		// Ignore storage write errors in restricted environments.
	}
}

/**
 * Adds an entry to the recent history list.
 *
 * @param {RecentSearchEntry | null | undefined} entry Selected entry.
 * @returns {void}
 */
export function addRecentEntry(entry) {
	if (!entry || typeof entry.id !== 'string') return;

	const nextIds = [
		entry.id,
		...readRecentIds().filter((id) => id !== entry.id),
	];

	writeRecentIds(nextIds);
}

/**
 * Resolves recent entries against currently available entries.
 *
 * @template T
 * @param {T[]} entries Current available entries.
 * @returns {T[]} Recent entries that still exist in the current entry set.
 */
export function getRecentEntries(entries) {
	if (!Array.isArray(entries) || entries.length === 0) return [];

	const byId = new Map(entries.map((entry) => [entry.id, entry]));
	return readRecentIds()
		.map((id) => byId.get(id))
		.filter((entry) => Boolean(entry));
}
