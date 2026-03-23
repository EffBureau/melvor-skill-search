/**
 * Initializes UI hooks for opening skill search.
 *
 * @param {{
 *   openSkillSearchPopup?: () => Promise<void> | void,
 *   isSearchHotkey?: (event: KeyboardEvent) => boolean,
 * }} [dependencies] Injected runtime dependencies.
 * @returns {void}
 */
export function init({ openSkillSearchPopup, isSearchHotkey } = {}) {
	if (typeof openSkillSearchPopup !== 'function') {
		console.warn('SkillSearch: Popup handler is not available.');
		return;
	}
	if (typeof isSearchHotkey !== 'function') {
		console.warn('SkillSearch: Hotkey matcher is not available.');
		return;
	}

	registerSidebarButton(openSkillSearchPopup);

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
 * @returns {void}
 */
function registerSidebarButton(openSkillSearchPopup) {
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
