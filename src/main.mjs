/**
 * Initializes UI hooks for opening skill search.
 *
 * @param {{
 *   openSkillSearchPopup?: () => Promise<void> | void,
 *   isSearchHotkey?: (event: KeyboardEvent) => boolean,
 *   openHotkeySettingsPopup?: () => Promise<void> | void,
 *   hasOfficialSettings?: boolean,
 * }} [dependencies] Injected runtime dependencies.
 * @returns {void}
 */
export function init({ openSkillSearchPopup, isSearchHotkey, openHotkeySettingsPopup, hasOfficialSettings } = {}) {
	if (typeof openSkillSearchPopup !== 'function') {
		console.warn('SkillSearch: Popup handler is not available.');
		return;
	}
	if (typeof isSearchHotkey !== 'function') {
		console.warn('SkillSearch: Hotkey matcher is not available.');
		return;
	}

	registerSidebarButton(openSkillSearchPopup, openHotkeySettingsPopup, Boolean(hasOfficialSettings));

	document.addEventListener('keydown', (event) => {
		if (!isSearchHotkey(event)) return;
		if (isTypingInField(event.target)) return;

		event.preventDefault();
		void openSkillSearchPopup();
	});
}

/**
 * Registers a sidebar action for opening search.
 *
 * @param {() => Promise<void> | void} openSkillSearchPopup Opens the search popup.
 * @param {(() => Promise<void> | void) | undefined} openHotkeySettingsPopup Opens settings popup.
 * @param {boolean} hasOfficialSettings Whether settings were registered through Mod Settings API.
 * @returns {void}
 */
function registerSidebarButton(openSkillSearchPopup, openHotkeySettingsPopup, hasOfficialSettings) {
	if (typeof sidebar === 'undefined' || typeof sidebar.category !== 'function') {
		console.warn('SkillSearch: Sidebar API not available in this context.');
		return;
	}

	const moddingCategory = sidebar.category('Modding');

	moddingCategory.item('SkillSearch:Open', {
		name: 'Skill Search',
		iconClass: 'fa fa-search',
		onRender: ({ iconEl }) => {
			if (!(iconEl instanceof HTMLElement)) return;
			iconEl.style.display = 'flex';
			iconEl.style.alignItems = 'center';
			iconEl.style.justifyContent = 'center';
		},
		onClick: () => {
			void openSkillSearchPopup();
		},
	});

	if (hasOfficialSettings || typeof openHotkeySettingsPopup !== 'function') return;

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
