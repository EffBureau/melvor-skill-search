/**
 * Initializes UI hooks for opening skill search and settings.
 *
 * @param {{
 *   openSkillSearchPopup?: () => Promise<void> | void,
 *   isSearchHotkey?: (event: KeyboardEvent) => boolean,
 *   openHotkeySettingsPopup?: () => Promise<void> | void,
 * }} [dependencies] Injected runtime dependencies.
 * @returns {void}
 */
export function init({ openSkillSearchPopup, isSearchHotkey, openHotkeySettingsPopup } = {}) {
	if (typeof openSkillSearchPopup !== 'function') {
		console.warn('SkillSearch: Popup handler is not available.');
		return;
	}
	if (typeof isSearchHotkey !== 'function') {
		console.warn('SkillSearch: Hotkey matcher is not available.');
		return;
	}
	if (typeof openHotkeySettingsPopup !== 'function') {
		console.warn('SkillSearch: Settings popup handler is not available.');
		return;
	}

	registerSidebarButton(openSkillSearchPopup, openHotkeySettingsPopup);

	document.addEventListener('keydown', (event) => {
		if (!isSearchHotkey(event)) return;
		if (isTypingInField(event.target)) return;

		event.preventDefault();
		void openSkillSearchPopup();
	});
}

/**
 * Registers sidebar actions for opening search and configuring hotkeys.
 *
 * @param {() => Promise<void> | void} openSkillSearchPopup Opens the search popup.
 * @param {() => Promise<void> | void} openHotkeySettingsPopup Opens settings popup.
 * @returns {void}
 */
function registerSidebarButton(openSkillSearchPopup, openHotkeySettingsPopup) {
	if (typeof sidebar === 'undefined' || typeof sidebar.category !== 'function') {
		console.warn('SkillSearch: Sidebar API not available in this context.');
		return;
	}

	const moddingCategory = sidebar.category('Modding');

	moddingCategory.item('SkillSearch:Open', {
		name: 'Skill Search',
		icon: 'fa fa-search',
		onClick: () => {
			void openSkillSearchPopup();
		},
	});

	moddingCategory.item('Mod Settings', (modSettingsItem) => {
		modSettingsItem.subitem('SkillSearch:Settings', {
			name: 'Skill Search Settings',
			onClick: () => {
				void openHotkeySettingsPopup();
			},
		});
	});
}

/**
 * Determines whether the keyboard event target is an editable field.
 *
 * @param {EventTarget | null} target Event target from keydown listener.
 * @returns {boolean} True when the user is currently typing in an editable element.
 */
function isTypingInField(target) {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;

	const tagName = target.tagName.toLowerCase();
	return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}
