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

export function init({
	openSkillSearchPopup,
	isSearchHotkey,
	openHotkeySettingsPopup,
	hasOfficialSettings,
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
		openHotkeySettingsPopup,
		Boolean(hasOfficialSettings),
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
 * @param {(() => Promise<void> | void) | undefined} openHotkeySettingsPopup Opens settings popup.
 * @param {boolean} hasOfficialSettings Whether settings were registered through Mod Settings API.
 * @returns {void}
 */
function registerSidebarButton(openSkillSearchPopup, openHotkeySettingsPopup, hasOfficialSettings) {
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
		onClick: () => {
			void openSkillSearchPopup();
		},
	});

	if (hasOfficialSettings || typeof openHotkeySettingsPopup !== 'function') return;

	skillSearchItem.subitem('SkillSearch:Settings', {
		name: buildSettingsLabel(archaeologyIcon),
		onClick: () => {
			void openHotkeySettingsPopup();
		},
	});
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
 * Builds a settings label element with optional icon for fallback sidebar settings.
 *
 * @param {{kind?: string, value?: string} | null} iconData
 * @returns {string | HTMLElement}
 */
function buildSettingsLabel(iconData) {
	if (!iconData || typeof iconData !== 'object') return 'Settings';

	const container = document.createElement('span');
	container.style.display = 'inline-flex';
	container.style.alignItems = 'center';
	container.style.gap = '0.35rem';

	if (iconData.kind === 'image' && typeof iconData.value === 'string' && iconData.value) {
		const img = document.createElement('img');
		img.src = iconData.value;
		img.alt = '';
		img.width = 14;
		img.height = 14;
		container.appendChild(img);
	} else if (iconData.kind === 'class' && typeof iconData.value === 'string' && iconData.value) {
		const icon = document.createElement('i');
		icon.className = iconData.value;
		container.appendChild(icon);
	}

	const text = document.createElement('span');
	text.textContent = 'Settings';
	container.appendChild(text);

	return container;
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
