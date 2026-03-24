const DEFAULT_HOTKEY = 'Ctrl+K';
const SETTINGS_SECTION = 'General';
const SETTINGS_KEY_HOTKEY = 'search-hotkey';
let modSettingsSection = null;
let modSettingsRegistered = false;
let cachedHotkey = DEFAULT_HOTKEY;
const hotkeyChangeListeners = new Set();

/**
 * Resolves the SweetAlert API available in the current runtime.
 *
 * @returns {any | null} Swal-compatible API or null when unavailable.
 */
function getSwal() {
	if (typeof SwalLocale !== 'undefined') return SwalLocale;
	if (typeof Swal !== 'undefined') return Swal;
	return null;
}

/**
 * Resolves the settings API from either setup context or a direct settings object.
 *
 * @param {any} input Setup context or settings object.
 * @returns {{section?: (name: string) => any} | null}
 */
function resolveSettingsApi(input) {
	if (input && typeof input.section === 'function') return input;
	if (input?.settings && typeof input.settings.section === 'function') return input.settings;

	try {
		const contextSettings = globalThis.mod?.getContext?.(import.meta)?.settings;
		if (contextSettings && typeof contextSettings.section === 'function') {
			return contextSettings;
		}
	} catch (error) {
		// Ignore context lookup failures in environments without mod.getContext.
	}

	return null;
}

/**
 * Subscribes to hotkey updates.
 *
 * @param {(hotkey: string) => void} listener Callback invoked with normalized hotkey.
 * @returns {() => void} Unsubscribe function.
 */
export function onSearchHotkeyChanged(listener) {
	if (typeof listener !== 'function') return () => {};
	hotkeyChangeListeners.add(listener);

	return () => {
		hotkeyChangeListeners.delete(listener);
	};
}

/**
 * Notifies listeners when the active hotkey changes.
 *
 * @param {string} hotkey Normalized hotkey.
 * @returns {void}
 */
function notifyHotkeyChanged(hotkey) {
	hotkeyChangeListeners.forEach((listener) => {
		try {
			listener(hotkey);
		} catch (error) {
			// Ignore listener failures to avoid breaking settings updates.
		}
	});
}

/**
 * Registers this mod's settings in the official Mod Settings UI.
 *
 * @param {any} input Setup context or settings object.
 * @returns {boolean} True when settings were successfully registered.
 */
export function registerHotkeySettings(input) {
	const settings = resolveSettingsApi(input);
	if (!settings) return false;

	try {
		modSettingsSection = settings.section(SETTINGS_SECTION);
	} catch (error) {
		modSettingsSection = null;
		return false;
	}

	if (!modSettingsSection || typeof modSettingsSection.add !== 'function') {
		modSettingsSection = null;
		return false;
	}

	if (modSettingsRegistered) {
		syncCachedHotkeyFromSettings();
		return true;
	}

	modSettingsSection.add([
		{
			type: 'text',
			name: SETTINGS_KEY_HOTKEY,
			label: 'Search Hotkey',
			hint: 'Used for opening Skill Search (for example: Ctrl+K).',
			default: cachedHotkey,
			onChange: (value) => {
				cachedHotkey = formatParsedHotkey(parseHotkey(String(value ?? '')));
				notifyHotkeyChanged(cachedHotkey);
				return true;
			},
		},
		{
			type: 'button',
			name: 'record-search-hotkey',
			display: 'Record Hotkey',
			onClick: () => {
				void openHotkeySettingsPopup();
			},
		},
	]);

	modSettingsRegistered = true;
	syncCachedHotkeyFromSettings();
	return true;
}

/**
 * Synchronizes in-memory hotkey cache from registered mod settings.
 *
 * @returns {void}
 */
function syncCachedHotkeyFromSettings() {
	if (!modSettingsRegistered || !modSettingsSection?.get) return;

	try {
		const value = modSettingsSection.get(SETTINGS_KEY_HOTKEY);
		if (typeof value === 'string' && value.trim()) {
			const nextHotkey = formatParsedHotkey(parseHotkey(value.trim()));
			if (nextHotkey !== cachedHotkey) {
				cachedHotkey = nextHotkey;
				notifyHotkeyChanged(cachedHotkey);
			}
		}
	} catch (error) {
		// Ignore lookup errors during init edge cases.
	}
}

/**
 * Reads the persisted hotkey or returns the default binding.
 *
 * @returns {string} Stored hotkey string.
 */
function readStoredHotkey() {
	syncCachedHotkeyFromSettings();
	return cachedHotkey;
}

/**
 * Persists the hotkey binding.
 *
 * @param {string} hotkey Normalized hotkey string.
 * @returns {void}
 */
function writeStoredHotkey(hotkey) {
	cachedHotkey = hotkey;
	notifyHotkeyChanged(cachedHotkey);
	if (!modSettingsRegistered || !modSettingsSection?.set) return;

	try {
		modSettingsSection.set(SETTINGS_KEY_HOTKEY, hotkey);
	} catch (error) {
		// Ignore update errors during init edge cases.
	}
}

/**
 * Normalizes key names across browser key values.
 *
 * @param {string} key Raw key value from KeyboardEvent.
 * @returns {string} Normalized key identifier.
 */
function normalizeKeyName(key) {
	const normalized = String(key || '').trim().toLowerCase();
	if (!normalized) return '';

	if (normalized === ' ') return 'space';
	if (normalized === 'esc') return 'escape';
	if (normalized === 'control') return 'ctrl';
	return normalized;
}

/**
 * Indicates whether a key token is a modifier-only key.
 *
 * @param {string} key Normalized key token.
 * @returns {boolean}
 */
function isModifierKey(key) {
	const normalized = normalizeKeyName(key);
	return normalized === 'ctrl' || normalized === 'alt' || normalized === 'shift' || normalized === 'meta';
}

/**
 * Converts a keyboard event into a normalized hotkey string.
 *
 * @param {KeyboardEvent} event Keyboard event.
 * @returns {string} Formatted hotkey or empty string for invalid captures.
 */
function eventToHotkey(event) {
	const key = normalizeKeyName(event?.key);
	if (!key || isModifierKey(key)) return '';

	const parsed = {
		ctrl: Boolean(event?.ctrlKey),
		alt: Boolean(event?.altKey),
		shift: Boolean(event?.shiftKey),
		meta: Boolean(event?.metaKey),
		key,
	};

	return formatParsedHotkey(parsed);
}

/**
 * Parses a hotkey string into modifier and key components.
 *
 * @param {string} hotkey Hotkey string (e.g. Ctrl+K).
 * @returns {{ctrl: boolean, alt: boolean, shift: boolean, meta: boolean, key: string}}
 */
function parseHotkey(hotkey) {
	const parts = String(hotkey || '')
		.split('+')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

	const parsed = {
		ctrl: false,
		alt: false,
		shift: false,
		meta: false,
		key: '',
	};

	parts.forEach((part) => {
		const normalized = part.toLowerCase();
		if (normalized === 'ctrl' || normalized === 'control') {
			parsed.ctrl = true;
			return;
		}
		if (normalized === 'alt') {
			parsed.alt = true;
			return;
		}
		if (normalized === 'shift') {
			parsed.shift = true;
			return;
		}
		if (normalized === 'meta' || normalized === 'cmd' || normalized === 'command' || normalized === 'win') {
			parsed.meta = true;
			return;
		}
		parsed.key = normalizeKeyName(part);
	});

	if (!parsed.key) {
		parsed.key = normalizeKeyName(DEFAULT_HOTKEY.split('+').pop());
	}

	return parsed;
}

/**
 * Formats a parsed hotkey object into a display string.
 *
 * @param {{ctrl: boolean, alt: boolean, shift: boolean, meta: boolean, key: string}} parsed Parsed hotkey object.
 * @returns {string}
 */
function formatParsedHotkey(parsed) {
	const parts = [];
	if (parsed.ctrl) parts.push('Ctrl');
	if (parsed.alt) parts.push('Alt');
	if (parsed.shift) parts.push('Shift');
	if (parsed.meta) parts.push('Meta');
	parts.push((parsed.key || 'k').length === 1 ? (parsed.key || 'k').toUpperCase() : parsed.key || 'k');
	return parts.join('+');
}

/**
 * Returns the currently configured hotkey.
 *
 * @returns {string}
 */
export function getSearchHotkey() {
	return formatParsedHotkey(parseHotkey(readStoredHotkey()));
}

/**
 * Checks whether a keyboard event matches the configured search hotkey.
 *
 * @param {KeyboardEvent} event Keyboard event.
 * @returns {boolean}
 */
export function isSearchHotkey(event) {
	if (!event) return false;

	const configured = parseHotkey(readStoredHotkey());
	const eventKey = normalizeKeyName(event.key);
	if (!eventKey || eventKey !== configured.key) return false;

	if (Boolean(event.ctrlKey) !== configured.ctrl) return false;
	if (Boolean(event.altKey) !== configured.alt) return false;
	if (Boolean(event.shiftKey) !== configured.shift) return false;
	if (Boolean(event.metaKey) !== configured.meta) return false;

	return true;
}

/**
 * Opens the settings popup and records a new hotkey from user input.
 *
 * @returns {Promise<void>}
 */
export async function openHotkeySettingsPopup() {
	const popupApi = getSwal();
	if (!popupApi) {
		console.warn('SkillSearch: Swal API not available for settings popup.');
		return;
	}

	const current = getSearchHotkey();
	let capturedHotkey = current;
	const result = await popupApi.fire({
		title: 'Skill Search Settings',
		input: 'text',
		inputLabel: 'Search hotkey',
		inputValue: current,
		inputPlaceholder: 'Press a key combination',
		didOpen: (popup) => {
			const label = popup.querySelector('.swal2-input-label');
			if (label instanceof HTMLElement) {
				label.style.setProperty('color', 'var(--bs-light, #f8f9fa)', 'important');
			}

			const input = popup.querySelector('.swal2-input');
			if (!(input instanceof HTMLInputElement)) return;

			input.readOnly = true;
			input.style.setProperty('color', 'var(--bs-light, #f8f9fa)', 'important');
			input.focus();

			const hint = document.createElement('div');
			hint.style.width = `${input.offsetWidth}px`;
			hint.style.margin = '0.35rem auto 0 auto';
			hint.style.fontSize = '0.85rem';
			hint.style.lineHeight = '1.35';
			hint.style.textAlign = 'left';
			hint.style.color = 'var(--bs-light, #f8f9fa)';
			hint.style.opacity = '0.95';
			hint.textContent = 'Press your desired key combo now. Example: Ctrl+K';
			input.insertAdjacentElement('afterend', hint);

			const capture = (event) => {
				event.preventDefault();

				const next = eventToHotkey(event);
				if (!next) return;

				capturedHotkey = next;
				input.value = next;
			};

			input.addEventListener('keydown', capture);
			popup.addEventListener('keydown', capture);
		},
		showCancelButton: true,
		confirmButtonText: 'Save',
		inputValidator: () => {
			const parsed = parseHotkey(capturedHotkey);
			if (!parsed.key) return 'Enter a valid key combination.';
			return null;
		},
	});

	if (!result.isConfirmed) return;

	const normalized = formatParsedHotkey(parseHotkey(capturedHotkey));
	writeStoredHotkey(normalized);

	await popupApi.fire({
		icon: 'success',
		title: 'Saved',
		text: `Search hotkey set to ${normalized}.`,
		timer: 1200,
		showConfirmButton: false,
	});
}
