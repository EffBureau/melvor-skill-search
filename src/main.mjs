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
let isKeydownBound = false;

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
	if (isKeydownBound) return;
	isKeydownBound = true;

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

	const shopLocation = getShopLocation();
	const targetCategory = shopLocation?.category ?? sidebar.category('General');
	const skillSearchItem = targetCategory.item('Skill Search', {
		name: 'Skill Search',
		...(shopLocation ? { before: shopLocation.itemId } : {}),
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

	skillSearchItem.subitem('SkillSearch:Settings', {
		name: 'Settings',
		onClick: () => {
			void openHotkeySettingsPopup();
		},
	});
}

/**
 * Finds the current category/item id for Shop in the rendered sidebar.
 *
 * @returns {{ category: any, itemId: string } | null}
 */
function getShopLocation() {
	if (typeof sidebar?.categories !== 'function') return null;

	for (const category of sidebar.categories()) {
		if (!category || typeof category.items !== 'function') continue;

		const shop = category.items().find((item) => {
			const id = String(item?.id ?? '').trim().toLowerCase();
			const label = String(item?.nameEl?.textContent ?? '').trim().toLowerCase();
			return id === 'shop' || id === 'melvord:shop' || label === 'shop';
		});

		if (shop) {
			return {
				category,
				itemId: shop.id,
			};
		}
	}

	return null;
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
