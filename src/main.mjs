/**
 * Initializes UI hooks for opening skill search.
 *
 * @param {{
 *   openSkillSearchPopup?: () => Promise<void> | void,
 *   isSearchHotkey?: (event: KeyboardEvent) => boolean,
 *   getSearchHotkey?: () => string,
 *   onSearchHotkeyChanged?: (listener: (hotkey: string) => void) => (() => void),
 * }} [dependencies] Injected runtime dependencies.
 * @returns {void}
 */
let isKeydownBound = false;
let unsubscribeHotkeyBadge = null;

export function init({
	openSkillSearchPopup,
	isSearchHotkey,
	getSearchHotkey,
	onSearchHotkeyChanged,
} = {}) {
	if (typeof openSkillSearchPopup !== 'function') {
		console.warn('SkillSearch: Popup handler is not available.');
		return;
	}
	if (typeof isSearchHotkey !== 'function') {
		console.warn('SkillSearch: Hotkey matcher is not available.');
		return;
	}

	registerSidebarButton(
		openSkillSearchPopup,
		getSearchHotkey,
		onSearchHotkeyChanged,
	);
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
 * @param {(() => string) | undefined} getSearchHotkey Reads the configured hotkey label.
 * @param {((listener: (hotkey: string) => void) => (() => void)) | undefined} onSearchHotkeyChanged Subscribes to hotkey changes.
 * @returns {void}
 */
function registerSidebarButton(openSkillSearchPopup, getSearchHotkey, onSearchHotkeyChanged) {
	if (typeof sidebar === 'undefined' || typeof sidebar.category !== 'function') {
		console.warn('SkillSearch: Sidebar API not available in this context.');
		return;
	}

	const archaeologyIcon = getArchaeologyIconData();
	const iconConfig = getItemIconConfig(archaeologyIcon);
	const shopLocation = getShopLocation();
	const targetCategory = shopLocation?.category ?? sidebar.category('General');
	const skillSearchItem = targetCategory.item('Skill Search', {
		name: 'Skill Search',
		...(shopLocation ? { before: shopLocation.itemId } : {}),
		...iconConfig,
		aside: getHotkeyIndicatorText(getSearchHotkey),
		onRender: ({ asideEl }) => {
			applyHotkeyIndicatorStyles(asideEl, getSearchHotkey);
		},
		onClick: () => {
			void openSkillSearchPopup();
		},
	});

	if (typeof unsubscribeHotkeyBadge === 'function') {
		unsubscribeHotkeyBadge();
		unsubscribeHotkeyBadge = null;
	}
	if (typeof onSearchHotkeyChanged === 'function') {
		unsubscribeHotkeyBadge = onSearchHotkeyChanged(() => {
			applyHotkeyIndicatorStyles(skillSearchItem.asideEl, getSearchHotkey);
		});
	}
}

/**
 * Returns the key label for the sidebar hotkey indicator.
 *
 * @param {(() => string) | undefined} getSearchHotkey Reads current hotkey binding.
 * @returns {string}
 */
function getHotkeyIndicatorText(getSearchHotkey) {
	if (typeof getSearchHotkey !== 'function') return 'Ctrl+K';

	const hotkey = String(getSearchHotkey() ?? '').trim();
	return hotkey || 'Ctrl+K';
}

/**
 * Styles and updates the sidebar hotkey indicator badge.
 *
 * @param {HTMLElement | undefined} asideEl Sidebar item aside element.
 * @param {(() => string) | undefined} getSearchHotkey Reads current hotkey binding.
 * @returns {void}
 */
function applyHotkeyIndicatorStyles(asideEl, getSearchHotkey) {
	if (!(asideEl instanceof HTMLElement)) return;

	asideEl.textContent = getHotkeyIndicatorText(getSearchHotkey);
	asideEl.title = `Hotkey: ${asideEl.textContent}`;
	asideEl.style.display = 'inline-flex';
	asideEl.style.alignItems = 'center';
	asideEl.style.justifyContent = 'center';
	asideEl.style.minWidth = '3rem';
	asideEl.style.padding = '0.12rem 0.42rem';
	asideEl.style.borderRadius = '0.35rem';
	asideEl.style.background = 'rgba(255,255,255,0.08)';
	asideEl.style.color = 'rgba(255,255,255,0.95)';
	asideEl.style.fontSize = '0.68rem';
	asideEl.style.lineHeight = '1.2';
	asideEl.style.fontWeight = '600';
	asideEl.style.letterSpacing = '0.01em';
	asideEl.style.whiteSpace = 'nowrap';
	asideEl.style.border = '1px solid rgba(255,255,255,0.14)';
}

/**
 * Finds Archaeology icon metadata from game skill media.
 *
 * @returns {{kind?: string, value?: string} | null}
 */
function getArchaeologyIconData() {
	const gameApi = typeof game !== 'undefined' ? game : globalThis.game;
	const skills = gameApi?.skills?.allObjects;
	if (!skills) return null;

	const archaeology = Array.from(skills).find((skill) => {
		const name = String(skill?.name ?? '').trim().toLowerCase();
		return name === 'archaeology';
	});

	if (typeof archaeology?.media !== 'string' || !archaeology.media) return null;
	return { kind: 'image', value: archaeology.media };
}

/**
 * Converts icon metadata to sidebar ItemConfig icon fields.
 *
 * @param {{kind?: string, value?: string} | null} iconData
 * @returns {{icon?: string, iconClass?: string}}
 */
function getItemIconConfig(iconData) {
	if (!iconData || typeof iconData !== 'object') {
		return { iconClass: 'fa fa-search' };
	}

	if (iconData.kind === 'image' && typeof iconData.value === 'string' && iconData.value) {
		return { icon: iconData.value };
	}

	if (iconData.kind === 'class' && typeof iconData.value === 'string' && iconData.value) {
		return { iconClass: iconData.value };
	}

	return { iconClass: 'fa fa-search' };
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
